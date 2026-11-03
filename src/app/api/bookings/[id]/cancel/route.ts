import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import {
  CANCELLABLE_STATUSES,
  NON_CANCELLABLE_STARTED_STATUSES,
  NON_CANCELLABLE_FINISHED_STATUSES,
  validateCancellationReason,
} from "@/lib/cancellation";
import {
  broadcastBookingStatusChanged,
  broadcastRideOfferWithdrawn,
} from "@/lib/realtime";
import { sendNotification, notifyAdmins } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { reasonCode, comments } = body;

    const validation = validateCancellationReason(reasonCode, comments);
    if (!validation.isValid || !validation.reasonOption) {
      return NextResponse.json(
        { error: validation.error || "Invalid cancellation reason." },
        { status: 400 }
      );
    }
    const reasonOption = validation.reasonOption;

    await dbConnect();
    const existing = await Booking.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userEmail = session.user.email?.toLowerCase();

    // Verify ownership or admin permission
    const isOwner =
      (existing.touristId && existing.touristId.toString() === userId) ||
      (userEmail &&
        existing.passengerDetails?.email &&
        existing.passengerDetails.email.toLowerCase() === userEmail);

    if (userRole !== "ADMIN" && !isOwner) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this booking." },
        { status: 403 }
      );
    }

    // Idempotency: if already cancelled, return existing cancelled booking
    if (existing.status === "CANCELLED") {
      return NextResponse.json({
        success: true,
        message: "Booking is already cancelled.",
        booking: existing,
      });
    }

    // Disallow cancellation if trip has already started (picked up or in progress)
    if (NON_CANCELLABLE_STARTED_STATUSES.includes(existing.status as any)) {
      return NextResponse.json(
        {
          error:
            "The ride has already started. Please contact support if you need assistance.",
          code: "TRIP_STARTED",
        },
        { status: 409 }
      );
    }

    // Disallow cancellation if completed or refunded
    if (NON_CANCELLABLE_FINISHED_STATUSES.includes(existing.status as any)) {
      return NextResponse.json(
        {
          error: "Completed rides cannot be cancelled.",
          code: "TRIP_COMPLETED",
        },
        { status: 400 }
      );
    }

    const cancelledAt = new Date();
    const cancelledByRole = userRole === "ADMIN" ? "ADMIN" : "TOURIST";
    const cancelledByName =
      session.user.name || (userRole === "ADMIN" ? "Admin" : "Passenger");

    // Atomically transition an eligible ride to CANCELLED
    const cancelledBooking = await Booking.findOneAndUpdate(
      {
        _id: id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
          dispatchStatus: "CANCELLED",
          cancelledAt,
          cancelledBy: {
            userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
            role: cancelledByRole,
            name: cancelledByName,
          },
          cancellationReasonCode: reasonOption.code,
          cancellationReasonText: reasonOption.label,
          cancellationComments: comments?.trim() || undefined,
          statusBeforeCancellation: existing.status,
          refundReviewStatus:
            existing.paymentStatus === "PAID" ? "PENDING_REVIEW" : "NOT_APPLICABLE",
        },
      },
      { returnDocument: "after" }
    );

    // If update didn't match, check why (race with driver acceptance or trip start)
    if (!cancelledBooking) {
      const refreshed = await Booking.findById(id);
      if (refreshed?.status === "CANCELLED") {
        return NextResponse.json({
          success: true,
          message: "Booking is already cancelled.",
          booking: refreshed,
        });
      }
      if (
        refreshed &&
        NON_CANCELLABLE_STARTED_STATUSES.includes(refreshed.status as any)
      ) {
        return NextResponse.json(
          {
            error:
              "The driver has already started this trip. Please contact support.",
            code: "TRIP_STARTED",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "Could not cancel booking in its current state. Please refresh.",
          code: "STATUS_CONFLICT",
        },
        { status: 409 }
      );
    }

    const bookingIdStr = cancelledBooking._id.toString();
    const bookingRef = cancelledBooking.bookingReference || "";

    // 1. Withdraw ride offer from any eligible drivers still ringing/viewing modal
    await broadcastRideOfferWithdrawn(
      bookingIdStr,
      bookingRef,
      "RIDER_CANCELLED"
    ).catch((err) =>
      console.warn("[Cancel] Failed to broadcast offer withdrawal:", err)
    );

    // 2. Broadcast status change to booking room, rider, assigned driver, and admin
    await broadcastBookingStatusChanged(cancelledBooking, "CANCELLED", {
      reasonCode: reasonOption.code,
      reasonText: reasonOption.label,
      comments: comments?.trim(),
      cancelledAt: cancelledAt.toISOString(),
      cancelledBy: cancelledBooking.cancelledBy,
      refundReviewStatus: cancelledBooking.refundReviewStatus,
    }).catch((err) =>
      console.warn("[Cancel] Failed to broadcast booking status change:", err)
    );

    // 3. Asynchronously notify assigned driver (if any) and admin
    (async () => {
      try {
        if (cancelledBooking.driverId) {
          await sendNotification({
            recipientId: cancelledBooking.driverId.toString(),
            type: "RIDE_CANCELLED_BY_PASSENGER",
            title: "Ride Cancelled",
            message: `Passenger cancelled ride ${bookingRef}. Reason: ${reasonOption.label}`,
            link: "/driver/dashboard",
            deduplicationKey: `cancel_notif_${bookingIdStr}_${Date.now()}`,
          });
        }

        await notifyAdmins({
          type: "RIDE_CANCELLED",
          title: "Trip Cancelled",
          message: `Trip ${bookingRef} was cancelled by ${cancelledByName} (${reasonOption.label}).${
            cancelledBooking.refundReviewStatus === "PENDING_REVIEW"
              ? " NOTE: Payment was collected and requires refund review."
              : ""
          }`,
          link: "/admin/pickme",
          deduplicationKey: `admin_cancel_${bookingIdStr}`,
        });
      } catch (notifErr) {
        console.error("[Cancel] Notification error:", notifErr);
      }
    })();

    return NextResponse.json({
      success: true,
      message: "Ride cancelled successfully.",
      booking: cancelledBooking,
    });
  } catch (error: any) {
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel ride." },
      { status: 500 }
    );
  }
}
