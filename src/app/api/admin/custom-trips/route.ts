import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const { bookingId, action, notes, confirmedAmount, confirmedCurrency, useRiderBudget } = await req.json();
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    let finalAmount = confirmedAmount;
    let finalCurrency = confirmedCurrency;

    if (action === "APPROVE") {
      if (useRiderBudget) {
        const proposedBudget = booking.customTripDetails?.budget;
        const proposedCurrency = booking.customTripDetails?.budgetCurrency || "USD";
        const budgetCovers = booking.customTripDetails?.budgetCovers;

        if (!proposedBudget || Number(proposedBudget) <= 0) {
          return NextResponse.json({ error: "Cannot use rider's budget because it is not a valid positive amount." }, { status: 400 });
        }
        if (budgetCovers !== "Transport only") {
          return NextResponse.json({ error: "Cannot automatically accept a budget that covers the entire trip. Please explicitly set the transport price." }, { status: 400 });
        }
        finalAmount = proposedBudget;
        finalCurrency = proposedCurrency;
      }

      if (!finalAmount || Number(finalAmount) <= 0) {
        return NextResponse.json({ error: "A valid positive confirmed amount is required." }, { status: 400 });
      }

      booking.status = "AWAITING_PAYMENT";
      booking.adminNotes = undefined;
      booking.customTripDetails = {
        ...booking.customTripDetails,
        confirmedAmount: Number(finalAmount),
        confirmedCurrency: finalCurrency
      };
    } else if (action === "REJECT") {
      booking.status = "CANCELLED";
      if (notes) booking.adminNotes = notes;
    } else if (action === "REQUEST_CHANGES" || action === "SEND_REVIEW") {
      booking.status = "NEEDS_REVISION";
      if (notes) {
        booking.adminNotes = notes;
      }
    } else if (action === "CONFIRM_PAYMENT" || action === "APPROVE_AND_PUBLISH") {
      // 1. Idempotency check: if already approved/published, return safely without duplicate notifications
      if (booking.status === "PENDING" && booking.approvedAt) {
        return NextResponse.json({
          success: true,
          status: booking.status,
          alreadyConfirmed: true,
          message: "Trip is already approved and published to drivers.",
          booking: {
            ...booking.toObject(),
            _id: booking._id.toString(),
            approvedAt: booking.approvedAt.toISOString(),
          },
        });
      }

      // 2. Server-side payment verification check
      if (booking.paymentStatus !== "PAID") {
        return NextResponse.json(
          { error: "Cannot publish trip to drivers. Payment must be verified as PAID before final approval." },
          { status: 400 }
        );
      }

      // 3. Transition to approved/available-for-drivers status
      booking.status = "PENDING";
      booking.paymentStatus = "PAID";
      booking.approvedBy = (session.user as any).id;
      booking.approvedAt = new Date();
      booking.driverId = undefined; // Keep unassigned until an eligible driver accepts it

      // Ensure confirmedAmount and currency are preserved as-is without changing paid amount
      if (!booking.customTripDetails?.confirmedAmount && booking.customTripDetails?.budget) {
        booking.customTripDetails.confirmedAmount = booking.customTripDetails.budget;
        booking.customTripDetails.confirmedCurrency = booking.customTripDetails.budgetCurrency || "USD";
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await booking.save();

    // Realtime broadcast events
    import("@/lib/realtime").then(({ broadcastBookingAvailable, broadcastBookingStatusChanged }) => {
      if (action === "CONFIRM_PAYMENT" || action === "APPROVE_AND_PUBLISH") {
        // Final admin approval: now visible to eligible drivers
        broadcastBookingAvailable(booking);
        broadcastBookingStatusChanged(booking, "PENDING", {
          approvedAt: booking.approvedAt,
          paymentStatus: "PAID",
        });
      } else {
        broadcastBookingStatusChanged(booking, booking.status, {
          adminNotes: notes,
          confirmedAmount: finalAmount,
          confirmedCurrency: finalCurrency,
        });
      }
    }).catch(console.error);

    import("@/lib/notifications").then(async ({ sendNotification, notifyEligibleDrivers }) => {
      if (action === "CONFIRM_PAYMENT" || action === "APPROVE_AND_PUBLISH") {
        // 1. Publish to eligible approved drivers and notify them
        await notifyEligibleDrivers({
          type: "NEW_AVAILABLE_TRIP",
          title: "New Custom Tour Available",
          message: `A new verified custom tour ${booking.bookingReference} is now available for assignment.`,
          link: `/driver/booking/${booking._id.toString()}`,
          deduplicationKey: `custom_published_driver_${booking._id.toString()}`
        });

        // 2. Notify the rider that the trip is approved and awaiting a driver
        if (booking.touristId) {
          const touristId = typeof booking.touristId === "object" ? booking.touristId._id || booking.touristId : booking.touristId;
          await sendNotification({
            recipientId: touristId.toString(),
            type: "CUSTOM_TRIP_APPROVED",
            title: "Custom Trip Approved & Published",
            message: `Your custom trip ${booking.bookingReference} has been verified and published to our driver network. We will notify you once a driver accepts your trip!`,
            link: `/my-bookings?ref=${booking.bookingReference}`,
            deduplicationKey: `custom_published_rider_${booking._id.toString()}`
          });
        }
      } else if (booking.touristId) {
        let notifType = "";
        let title = "";
        let message = "";
        if (action === "APPROVE") {
          notifType = "CUSTOM_TRIP_APPROVED";
          title = "Custom Trip Approved";
          message = `Your custom trip ${booking.bookingReference} has been approved for ${finalCurrency} ${finalAmount}! Please complete payment.`;
        } else if (action === "REJECT") {
          notifType = "CUSTOM_TRIP_REJECTED";
          title = "Custom Trip Rejected";
          message = `Your custom trip ${booking.bookingReference} has been rejected.`;
        } else if (action === "REQUEST_CHANGES" || action === "SEND_REVIEW") {
          notifType = "CUSTOM_TRIP_NEEDS_REVISION";
          title = "Custom Trip Needs Revision";
          message = `Your custom trip ${booking.bookingReference} requires some changes.`;
        }
        
        if (notifType) {
          await sendNotification({
            recipientId: booking.touristId.toString(),
            type: notifType,
            title,
            message,
            link: `/my-bookings?ref=${booking.bookingReference}`,
            deduplicationKey: `custom_trip_${action}_${booking._id.toString()}`
          });
        }
      }
    }).catch(console.error);

    return NextResponse.json({ 
      success: true, 
      status: booking.status,
      booking: {
        ...booking.toObject(),
        _id: booking._id.toString(),
        approvedAt: booking.approvedAt ? booking.approvedAt.toISOString() : null,
        approvedBy: booking.approvedBy ? booking.approvedBy.toString() : null,
      }
    });

  } catch (error: any) {
    console.error("Admin custom trip action error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
