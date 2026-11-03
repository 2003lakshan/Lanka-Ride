import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { broadcastBookingStatusChanged } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "NEEDS_REVISION",
  "PENDING",
  "AWAITING_PAYMENT",
  "PENDING_ADMIN_CONFIRMATION",
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "PASSENGER_PICKED_UP",
  "TRIP_IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

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
    const { status, reason } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    await dbConnect();
    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // Authorization checks
    if (userRole === "ADMIN") {
      // Admin has full authorization
    } else if (userRole === "DRIVER") {
      // Driver must be assigned to this booking
      if (!booking.driverId || booking.driverId.toString() !== userId) {
        return NextResponse.json({ error: "Unauthorized: You are not the driver assigned to this booking" }, { status: 403 });
      }

      const driverAllowedTransitions = [
        "DRIVER_EN_ROUTE",
        "DRIVER_ARRIVED",
        "PASSENGER_PICKED_UP",
        "TRIP_IN_PROGRESS",
        "COMPLETED",
      ];
      if (!driverAllowedTransitions.includes(status)) {
        return NextResponse.json({ error: `Drivers cannot transition booking to status ${status}` }, { status: 403 });
      }
    } else if (userRole === "TOURIST") {
      // Tourist can only cancel their own un-started booking
      if (!booking.touristId || booking.touristId.toString() !== userId) {
        return NextResponse.json({ error: "Unauthorized: You do not own this booking" }, { status: 403 });
      }
      if (status !== "CANCELLED") {
        return NextResponse.json({ error: "Tourists can only request cancellation" }, { status: 403 });
      }
      if (["PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS", "COMPLETED"].includes(booking.status)) {
        return NextResponse.json({ error: "Cannot cancel a trip that is already in progress or completed" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized role" }, { status: 403 });
    }

    // Idempotency check: if already in requested status, return gracefully
    if (booking.status === status) {
      return NextResponse.json({
        success: true,
        status: booking.status,
        booking,
        message: `Trip is already in status ${status}.`,
      });
    }

    // Handle COMPLETED transition
    if (status === "COMPLETED") {
      if (!booking.completedAt) {
        booking.completedAt = new Date();
      }
    }

    // Handle DRIVER_ARRIVED manual transition
    if (status === "DRIVER_ARRIVED") {
      if (!booking.arrivedAt) {
        booking.arrivedAt = new Date();
      }
      if (!booking.arrivalSource) {
        booking.arrivalSource = "MANUAL";
      }
      booking.arrivalCandidate = undefined;
    }

    // Handle CANCELLED transition
    if (status === "CANCELLED") {
      if (!booking.cancelledAt) {
        booking.cancelledAt = new Date();
      }
      booking.cancelledBy = {
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        role: userRole,
        name: session.user.name || (userRole === "ADMIN" ? "Admin" : "Passenger"),
      };
      if (reason) {
        booking.cancellationReasonText = reason;
      }
      booking.statusBeforeCancellation = booking.status;
      if (booking.paymentStatus === "PAID" && !booking.refundReviewStatus) {
        booking.refundReviewStatus = "PENDING_REVIEW";
      }
    }

    booking.status = status;
    if (reason) {
      booking.adminNotes = { ...(booking.adminNotes || {}), statusReason: reason };
    }
    await booking.save();

    if (status === "CANCELLED") {
      import("@/lib/realtime").then(({ broadcastRideOfferWithdrawn }) => {
        broadcastRideOfferWithdrawn(booking._id.toString(), booking.bookingReference, "RIDER_CANCELLED").catch(() => {});
      }).catch(() => {});
    }

    // Broadcast status change in realtime to all authorized participants
    await broadcastBookingStatusChanged(booking, status, {
      reason,
      completedAt: booking.completedAt ? booking.completedAt.toISOString() : undefined,
      arrivedAt: booking.arrivedAt ? booking.arrivedAt.toISOString() : undefined,
      arrivalSource: booking.arrivalSource,
    });

    // Notifications for rider and admin
    import("@/lib/notifications").then(async ({ sendNotification, notifyAdmins }) => {
      // Notify rider
      if (booking.touristId) {
        const isCompleted = status === "COMPLETED";
        const notifTitle = isCompleted
          ? "Trip Completed"
          : status === "DRIVER_ARRIVED"
          ? "Driver Arrived"
          : `Trip Status: ${status.replace(/_/g, " ")}`;

        const notifMessage = isCompleted
          ? `Your trip ${booking.bookingReference} has been completed. Thank you for choosing Lanka Airport Ride!`
          : status === "DRIVER_ARRIVED"
          ? "Your driver has arrived at the pickup location."
          : `Your booking ${booking.bookingReference} status changed to ${status.replace(/_/g, " ")}.`;

        await sendNotification({
          recipientId: booking.touristId.toString(),
          type: isCompleted ? "TRIP_COMPLETED" : `TRIP_STATUS_${status}`,
          title: notifTitle,
          message: notifMessage,
          link: `/track?ref=${booking.bookingReference}`,
          deduplicationKey: `status_change_${status}_${booking._id.toString()}`,
        });
      }

      // Notify admin on trip completion or other status changes
      if (status === "COMPLETED") {
        await notifyAdmins({
          type: "TRIP_COMPLETED",
          title: "Trip Completed",
          message: `Trip ${booking.bookingReference} has been marked as completed by driver${booking.passengerDetails?.fullName ? ` for ${booking.passengerDetails.fullName}` : ""}.`,
          link: "/admin/trips",
          deduplicationKey: `admin_trip_completed_${booking._id.toString()}`,
        });
      }

      // Notify driver if admin changed status
      if (booking.driverId && userRole !== "DRIVER") {
        await sendNotification({
          recipientId: booking.driverId.toString(),
          type: `TRIP_STATUS_${status}`,
          title: `Trip Status: ${status.replace(/_/g, " ")}`,
          message: `Booking ${booking.bookingReference} status changed to ${status.replace(/_/g, " ")}.`,
          link: `/driver/booking/${booking._id.toString()}`,
          deduplicationKey: `status_change_drv_${status}_${booking._id.toString()}`,
        });
      }
    }).catch(console.error);

    return NextResponse.json({ success: true, status: booking.status, booking });
  } catch (error: any) {
    console.error("Update booking status error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
