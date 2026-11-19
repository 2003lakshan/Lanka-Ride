import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const {
      bookingId,
      action,
      notes,
      feedback,
      affectedFields,
      affectedDays,
      confirmedAmount,
      confirmedCurrency,
      useRiderBudget,
      expectedRevision,
    } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const adminId = (session.user as any).id;
    const adminUser = await User.findById(adminId).select("name email").lean();
    const adminName = adminUser?.name || "Administrator";

    const currentRevision = Number(booking.customTripDetails?.revision) || 1;

    // Check for expectedRevision concurrency mismatch
    if (expectedRevision !== undefined && expectedRevision !== null && expectedRevision !== "") {
      const targetRev = Number(expectedRevision);
      if (!isNaN(targetRev) && targetRev !== currentRevision) {
        return NextResponse.json(
          {
            error: "The rider updated or resubmitted their trip request while you were reviewing. Please refresh to inspect the latest revision.",
            conflict: true,
            currentRevision,
            expectedRevision: targetRev,
          },
          { status: 409 }
        );
      }
    }

    let finalAmount = confirmedAmount;
    let finalCurrency = confirmedCurrency || "USD";

    if (action === "APPROVE") {
      if (useRiderBudget) {
        const proposedBudget = booking.customTripDetails?.budget;
        const proposedCurrency = booking.customTripDetails?.budgetCurrency || "USD";
        const budgetCovers = booking.customTripDetails?.budgetCovers;

        if (!proposedBudget || Number(proposedBudget) <= 0) {
          return NextResponse.json(
            { error: "Cannot use rider's budget because it is not a valid positive amount." },
            { status: 400 }
          );
        }
        if (budgetCovers !== "Transport only") {
          return NextResponse.json(
            { error: "Cannot automatically accept a budget covering entire trip. Please set the transport price." },
            { status: 400 }
          );
        }
        finalAmount = proposedBudget;
        finalCurrency = proposedCurrency;
      }

      if (!finalAmount || Number(finalAmount) <= 0) {
        return NextResponse.json({ error: "A valid positive confirmed amount is required." }, { status: 400 });
      }

      // Atomic conditional update on revision
      const filter: any = {
        _id: booking._id,
        $or: [
          { "customTripDetails.revision": currentRevision },
          { "customTripDetails.revision": { $exists: false } },
          { "customTripDetails.revision": null },
        ],
      };

      const now = new Date();
      const updateDoc: any = {
        $set: {
          status: "PENDING",
          approvedBy: adminId,
          approvedAt: now,
          "customTripDetails.approvedRevision": currentRevision,
          "customTripDetails.confirmedAmount": Number(finalAmount),
          "customTripDetails.confirmedCurrency": finalCurrency,
        },
        $unset: {
          "customTripDetails.changeRequest": 1,
          adminNotes: 1,
        },
        $push: {
          "customTripDetails.reviewHistory": {
            action: "APPROVE",
            feedback: `Trip approved for ${finalCurrency} ${Number(finalAmount)}.`,
            actorId: adminId,
            actorRole: "ADMIN",
            actorName: adminName,
            timestamp: now,
            revision: currentRevision,
          },
        },
      };

      const updatedBooking = await Booking.findOneAndUpdate(filter, updateDoc, { new: true });
      if (!updatedBooking) {
        const latest = await Booking.findById(booking._id);
        return NextResponse.json(
          {
            error: "The rider updated or resubmitted their trip request while you were reviewing. Please refresh to inspect the latest revision.",
            conflict: true,
            currentRevision: latest?.customTripDetails?.revision || 1,
          },
          { status: 409 }
        );
      }

      // Publish to eligible drivers and notify rider
      try {
        const { broadcastBookingAvailable, broadcastBookingStatusChanged } = await import("@/lib/realtime");
        broadcastBookingAvailable(updatedBooking);
        broadcastBookingStatusChanged(updatedBooking, "PENDING", {
          approvedAt: updatedBooking.approvedAt,
          confirmedAmount: finalAmount,
          confirmedCurrency: finalCurrency,
        });
      } catch (rtErr) {
        console.error("Realtime broadcast error on approve:", rtErr);
      }

      try {
        const { sendNotification, notifyEligibleDrivers } = await import("@/lib/notifications");
        // 1. Publish to eligible approved drivers
        await notifyEligibleDrivers({
          type: "NEW_AVAILABLE_TRIP",
          title: "New Custom Tour Available",
          message: `A new verified custom tour ${updatedBooking.bookingReference} is now available for acceptance.`,
          link: `/driver/booking/${updatedBooking._id.toString()}`,
          deduplicationKey: `custom_published_drv_${updatedBooking._id.toString()}_rev${currentRevision}`,
        });

        // 2. Notify rider
        if (updatedBooking.touristId) {
          const touristId =
            typeof updatedBooking.touristId === "object"
              ? (updatedBooking.touristId as any)._id || updatedBooking.touristId
              : updatedBooking.touristId;
          await sendNotification({
            recipientId: touristId.toString(),
            type: "CUSTOM_TRIP_APPROVED",
            title: "Custom Trip Approved & Available for Drivers",
            message: `Your custom trip ${updatedBooking.bookingReference} has been approved by admin for ${finalCurrency} ${finalAmount} and is now available for driver acceptance!`,
            link: `/my-bookings?ref=${updatedBooking.bookingReference}`,
            deduplicationKey: `custom_approved_rider_${updatedBooking._id.toString()}_rev${currentRevision}`,
          });
        }
      } catch (notifErr) {
        console.error("Notification error on approve:", notifErr);
      }

      return NextResponse.json({
        success: true,
        status: updatedBooking.status,
        revision: currentRevision,
        message: "Trip approved and published to eligible drivers successfully.",
        booking: {
          ...updatedBooking.toObject(),
          _id: updatedBooking._id.toString(),
          approvedAt: updatedBooking.approvedAt?.toISOString(),
          approvedBy: updatedBooking.approvedBy?.toString(),
        },
      });

    } else if (action === "REQUEST_CHANGES" || action === "SEND_REVIEW") {
      const explanation = (feedback || notes?.general || notes?.contact || "").trim();
      if (!explanation) {
        return NextResponse.json(
          { error: "A clear explanation is required when requesting changes." },
          { status: 400 }
        );
      }

      // Atomic conditional update on revision
      const filter: any = {
        _id: booking._id,
        $or: [
          { "customTripDetails.revision": currentRevision },
          { "customTripDetails.revision": { $exists: false } },
          { "customTripDetails.revision": null },
        ],
      };

      const now = new Date();
      const fieldsList = Array.isArray(affectedFields) ? affectedFields : [];
      const daysList = Array.isArray(affectedDays) ? affectedDays.map(Number).filter((n: number) => !isNaN(n)) : [];

      const updateDoc: any = {
        $set: {
          status: "CHANGES_REQUESTED",
          "customTripDetails.changeRequest": {
            feedback: explanation,
            affectedFields: fieldsList,
            affectedDays: daysList,
            requestedAt: now,
            requestedBy: adminId,
            requestedByName: adminName,
            revision: currentRevision,
          },
        },
        $unset: {
          approvedAt: 1,
          approvedBy: 1,
          driverId: 1,
        },
        $push: {
          "customTripDetails.reviewHistory": {
            action: "REQUEST_CHANGES",
            feedback: explanation,
            affectedFields: fieldsList,
            affectedDays: daysList,
            actorId: adminId,
            actorRole: "ADMIN",
            actorName: adminName,
            timestamp: now,
            revision: currentRevision,
          },
        },
      };

      const updatedBooking = await Booking.findOneAndUpdate(filter, updateDoc, { new: true });
      if (!updatedBooking) {
        const latest = await Booking.findById(booking._id);
        return NextResponse.json(
          {
            error: "The rider updated or resubmitted their trip request while you were reviewing. Please refresh to inspect the latest revision.",
            conflict: true,
            currentRevision: latest?.customTripDetails?.revision || 1,
          },
          { status: 409 }
        );
      }

      // Realtime broadcast to withdraw from drivers (if was approved) and notify rider
      try {
        const { broadcastBookingStatusChanged, broadcastRideOfferWithdrawn } = await import("@/lib/realtime");
        broadcastRideOfferWithdrawn(updatedBooking._id.toString());
        broadcastBookingStatusChanged(updatedBooking, "CHANGES_REQUESTED", {
          feedback: explanation,
          affectedFields: fieldsList,
          affectedDays: daysList,
        });
      } catch (rtErr) {
        console.error("Realtime broadcast error on request changes:", rtErr);
      }

      // Notify only the relevant rider
      try {
        const { sendNotification } = await import("@/lib/notifications");
        if (updatedBooking.touristId) {
          const touristId =
            typeof updatedBooking.touristId === "object"
              ? (updatedBooking.touristId as any)._id || updatedBooking.touristId
              : updatedBooking.touristId;

          await sendNotification({
            recipientId: touristId.toString(),
            type: "CUSTOM_TRIP_CHANGES_REQUESTED",
            title: "Changes Requested for Your Custom Trip",
            message: `Admin requested changes to your custom trip ${updatedBooking.bookingReference}: "${explanation}". Please review and resubmit.`,
            link: `/my-bookings?ref=${updatedBooking.bookingReference}`,
            deduplicationKey: `custom_changes_${updatedBooking._id.toString()}_rev${currentRevision}`,
          });
        }
      } catch (notifErr) {
        console.error("Notification error on request changes:", notifErr);
      }

      return NextResponse.json({
        success: true,
        status: updatedBooking.status,
        revision: currentRevision,
        message: "Change request saved and rider notified successfully.",
        booking: {
          ...updatedBooking.toObject(),
          _id: updatedBooking._id.toString(),
        },
      });

    } else if (action === "REJECT") {
      const reason = (notes?.rejectionReason || feedback || "Trip request rejected by administrator.").trim();

      booking.status = "CANCELLED";
      booking.cancelledAt = new Date();
      booking.cancelledBy = {
        userId: adminId,
        role: "ADMIN",
        name: adminName,
      };
      booking.cancellationReasonText = reason;

      booking.customTripDetails = {
        ...booking.customTripDetails,
        reviewHistory: [
          ...(booking.customTripDetails?.reviewHistory || []),
          {
            action: "REJECT",
            feedback: reason,
            actorId: adminId,
            actorRole: "ADMIN",
            actorName: adminName,
            timestamp: new Date(),
            revision: currentRevision,
          },
        ],
      };

      await booking.save();

      try {
        const { broadcastBookingStatusChanged, broadcastRideOfferWithdrawn } = await import("@/lib/realtime");
        broadcastRideOfferWithdrawn(booking._id.toString());
        broadcastBookingStatusChanged(booking, "CANCELLED", { reason });
      } catch (rtErr) {}

      try {
        const { sendNotification } = await import("@/lib/notifications");
        if (booking.touristId) {
          const touristId =
            typeof booking.touristId === "object"
              ? (booking.touristId as any)._id || booking.touristId
              : booking.touristId;
          await sendNotification({
            recipientId: touristId.toString(),
            type: "CUSTOM_TRIP_REJECTED",
            title: "Custom Trip Rejected",
            message: `Your custom trip ${booking.bookingReference} has been rejected: "${reason}".`,
            link: `/my-bookings?ref=${booking.bookingReference}`,
            deduplicationKey: `custom_reject_${booking._id.toString()}_rev${currentRevision}`,
          });
        }
      } catch (notifErr) {}

      return NextResponse.json({
        success: true,
        status: booking.status,
        message: "Trip rejected.",
      });

    } else {
      return NextResponse.json({ error: "Invalid action. Supported: 'APPROVE', 'REQUEST_CHANGES', 'REJECT'." }, { status: 400 });
    }

  } catch (error: any) {
    console.error("[Admin Custom Trip Action Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to process custom trip action." }, { status: 500 });
  }
}
