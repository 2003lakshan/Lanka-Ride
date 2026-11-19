import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";

/**
 * Helper to compute [startTime, endTime] for a booking to detect scheduling overlaps.
 */
function getBookingTimeWindow(booking: any): [Date, Date] {
  // Custom multi-day tour
  if (booking.customTripDetails?.isCustomTrip) {
    const start = booking.customTripDetails.startDate 
      ? new Date(booking.customTripDetails.startDate) 
      : booking.arrivalDate 
      ? new Date(booking.arrivalDate) 
      : new Date();

    let end: Date;
    if (booking.customTripDetails.endDate) {
      end = new Date(booking.customTripDetails.endDate);
    } else if (booking.customTripDetails.itinerary?.length > 0) {
      const lastDay = booking.customTripDetails.itinerary[booking.customTripDetails.itinerary.length - 1];
      end = lastDay.date ? new Date(lastDay.date) : new Date(start);
    } else {
      end = new Date(start);
    }

    // Set end of day (23:59:59.999) for end date
    end.setHours(23, 59, 59, 999);
    // Set start of day (00:00:00.000) for start date if not specified
    start.setHours(0, 0, 0, 0);

    return [start, end];
  }

  // PickMe / Local Ride
  if (booking.bookingType === "LOCAL_RIDE" || booking.pickMeDetails?.isPickMe) {
    const isRideNow = booking.pickMeDetails?.rideNow !== false;
    const start = (isRideNow || !booking.arrivalDate) ? new Date() : new Date(booking.arrivalDate);
    if (!isRideNow && booking.arrivalTime) {
      const [hours, mins] = booking.arrivalTime.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(mins)) {
        start.setHours(hours, mins, 0, 0);
      }
    }
    const durationMins = booking.durationMins || booking.pickMeDetails?.estimatedDurationMinutes || 45;
    const bufferMins = 20; // 20 min turnaround buffer for local rides
    const end = new Date(start.getTime() + (durationMins + bufferMins) * 60 * 1000);
    return [start, end];
  }

  // Standard transfer booking
  const arrivalDate = booking.arrivalDate ? new Date(booking.arrivalDate) : new Date();
  const arrivalTime = booking.arrivalTime || "12:00";
  const [hours, mins] = arrivalTime.split(":").map(Number);
  
  const start = new Date(arrivalDate);
  if (!isNaN(hours) && !isNaN(mins)) {
    start.setHours(hours, mins, 0, 0);
  }

  // Duration in minutes (default 2 hours + 1 hour buffer)
  const durationMins = booking.durationMins || 120;
  const bufferMins = 60; // 1 hr buffer for return/turnaround
  const end = new Date(start.getTime() + (durationMins + bufferMins) * 60 * 1000);

  return [start, end];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const driverId = (session.user as any).id;

    // 1. Recheck driver in database: ensure driver exists and is approved
    const driver = await User.findById(driverId);
    if (!driver) {
      return NextResponse.json({ error: "Driver account not found." }, { status: 404 });
    }

    if (!driver.isApproved) {
      return NextResponse.json(
        { error: "Driver is not approved to accept rides yet." },
        { status: 403 }
      );
    }

    // 2. Load existing booking to check status, approval, payment, and scheduling
    const existingBooking = await Booking.findById(id);
    if (!existingBooking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    // Check if already assigned (idempotent for retries from the same driver)
    if (existingBooking.driverId) {
      if (existingBooking.driverId.toString() === driverId.toString()) {
        return NextResponse.json({
          success: true,
          message: "Trip already assigned to you.",
          data: existingBooking,
        }, { status: 200 });
      }
      return NextResponse.json(
        { 
          error: "This ride has already been accepted", 
          code: "ALREADY_ACCEPTED" 
        }, 
        { status: 409 }
      );
    }

    // Check availability status
    if (existingBooking.status !== "PENDING" && existingBooking.status !== "CONFIRMED") {
      return NextResponse.json(
        { 
          error: "This booking is no longer available.", 
          code: "BOOKING_UNAVAILABLE" 
        }, 
        { status: 400 }
      );
    }

    // Custom trip specific server-side verification:
    // Requires admin approval before driver assignment
    if (existingBooking.customTripDetails?.isCustomTrip) {
      if (!existingBooking.approvedAt) {
        return NextResponse.json(
          { 
            error: "Cannot accept custom trip. Final admin approval is pending.",
            code: "ADMIN_APPROVAL_PENDING"
          }, 
          { status: 400 }
        );
      }
    }

    // Local ride (PickMe) specific verification:
    // Only offer and accept for drivers whose registered vehicle category matches rider selection!
    if (existingBooking.bookingType === "LOCAL_RIDE" || existingBooking.pickMeDetails?.isPickMe) {
      const requiredCategory = existingBooking.pickMeDetails?.vehicleCategory;
      const driverCategory = driver.vehicleCategory || driver.driverDetails?.vehicleCategory;
      if (requiredCategory && driverCategory) {
        if (requiredCategory.trim().toLowerCase() !== driverCategory.trim().toLowerCase()) {
          return NextResponse.json(
            { 
              error: `Vehicle category mismatch: This ride requires a ${requiredCategory}, but your registered vehicle is a ${driverCategory}.`,
              code: "VEHICLE_CATEGORY_MISMATCH"
            },
            { status: 403 }
          );
        }
      }
    }

    // 3. Prevent driver from acquiring two conflicting active rides
    const activeRunningTrip = await Booking.findOne({
      driverId: driver._id,
      _id: { $ne: existingBooking._id },
      status: { 
        $in: [
          "DRIVER_ASSIGNED", 
          "DRIVER_EN_ROUTE", 
          "DRIVER_ARRIVED", 
          "PASSENGER_PICKED_UP", 
          "TRIP_IN_PROGRESS"
        ] 
      }
    });

    if (activeRunningTrip) {
      return NextResponse.json(
        {
          error: `Active ride conflict: You currently have active trip ${activeRunningTrip.bookingReference} in progress. You cannot acquire conflicting concurrent rides.`,
          code: "ACTIVE_TRIP_CONFLICT"
        },
        { status: 409 }
      );
    }

    // 3b. Scheduling conflict check against driver's future bookings
    const [newStart, newEnd] = getBookingTimeWindow(existingBooking);

    const activeDriverBookings = await Booking.find({
      driverId: driver._id,
      _id: { $ne: existingBooking._id },
      status: { 
        $in: [
          "DRIVER_ASSIGNED", 
          "DRIVER_EN_ROUTE", 
          "DRIVER_ARRIVED", 
          "PASSENGER_PICKED_UP", 
          "TRIP_IN_PROGRESS", 
          "CONFIRMED"
        ] 
      }
    }).lean();

    for (const activeBooking of activeDriverBookings) {
      const [exStart, exEnd] = getBookingTimeWindow(activeBooking);
      // Overlap condition: startA < endB && endA > startB
      if (newStart < exEnd && newEnd > exStart) {
        return NextResponse.json(
          {
            error: `Scheduling conflict: You already have booking ${activeBooking.bookingReference} scheduled during this time window.`,
            code: "SCHEDULE_CONFLICT"
          },
          { status: 409 }
        );
      }
    }

    // 4. Atomic conditional update to eliminate race conditions between multiple simultaneous drivers
    const atomicFilter: any = { 
      _id: id, 
      status: { $in: ["PENDING", "CONFIRMED"] },
      $or: [
        { driverId: null },
        { driverId: { $exists: false } }
      ]
    };
    if (existingBooking.customTripDetails?.isCustomTrip) {
      atomicFilter.approvedAt = { $exists: true, $ne: null };
      if (existingBooking.customTripDetails.approvedRevision) {
        atomicFilter["customTripDetails.approvedRevision"] = existingBooking.customTripDetails.approvedRevision;
      }
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      atomicFilter,
      { 
        status: "DRIVER_ASSIGNED",
        driverId: driver._id,
        assignedAt: new Date(),
        dispatchStatus: "ACCEPTED"
      },
      { new: true }
    );

    if (!updatedBooking) {
      // Document matched nothing because another driver accepted milliseconds earlier
      return NextResponse.json(
        { 
          error: "This ride has already been accepted", 
          code: "ALREADY_ACCEPTED" 
        }, 
        { status: 409 }
      );
    }

    // Resolve vehicle registration details for notifications
    const vehicleReg = driver.vehicleRegistration || 
                       driver.driverDetails?.vehicleRegistrationNumber || 
                       driver.driverDetails?.registrationNumber || 
                       "Vehicle Details on file";
    const vehicleModel = driver.driverDetails?.vehicleModel || 
                         driver.driverDetails?.model || 
                         "Registered Vehicle";

    // 5. Realtime broadcast:
    // - Notifies rider & admin of assignment with driver and vehicle details
    // - Immediately removes request card from other eligible drivers' Available Trips & alerts
    import("@/lib/realtime").then(({ broadcastDriverAccepted, broadcastRideOfferWithdrawn }) => {
      broadcastDriverAccepted(updatedBooking, {
        _id: driver._id,
        name: driver.name,
        phoneNumber: driver.phoneNumber,
        vehicleRegistration: vehicleReg,
        vehicleModel: vehicleModel,
      });
      broadcastRideOfferWithdrawn(id, updatedBooking.bookingReference, "ACCEPTED");
    }).catch(console.error);

    // 6. Notifications
    import("@/lib/notifications").then(async ({ sendNotification, notifyAdmins }) => {
      // Driver notification
      await sendNotification({
        recipientId: driver._id.toString(),
        type: "BOOKING_ACCEPTED",
        title: "Booking Assigned to You",
        message: `You have successfully accepted booking ${updatedBooking.bookingReference}.`,
        link: `/driver/booking/${updatedBooking._id.toString()}`,
        deduplicationKey: `driver_accept_${updatedBooking._id.toString()}`
      });

      // Tourist notification with driver and vehicle registration details
      if (updatedBooking.touristId) {
        const touristId = typeof updatedBooking.touristId === "object" 
          ? updatedBooking.touristId._id || updatedBooking.touristId 
          : updatedBooking.touristId;

        await sendNotification({
          recipientId: touristId.toString(),
          type: "DRIVER_ASSIGNED",
          title: "Driver Assigned",
          message: `Driver ${driver.name} (${driver.phoneNumber || 'Contact available in trip'}, Vehicle: ${vehicleReg}) has been assigned to your booking ${updatedBooking.bookingReference}.`,
          link: `/my-bookings?ref=${updatedBooking.bookingReference}`,
          deduplicationKey: `tourist_assign_${updatedBooking._id.toString()}`
        });
      }

      // Admin notification with assigned driver and vehicle details
      await notifyAdmins({
        type: "BOOKING_ASSIGNED",
        title: "Driver Assigned to Booking",
        message: `Booking ${updatedBooking.bookingReference} was accepted by driver ${driver.name} (${vehicleReg}).`,
        link: `/admin/trips/${updatedBooking._id.toString()}`,
        deduplicationKey: `admin_assign_${updatedBooking._id.toString()}`
      });
    }).catch(console.error);

    return NextResponse.json({ 
      success: true, 
      message: "Successfully accepted booking", 
      data: updatedBooking 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Accept ride error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
