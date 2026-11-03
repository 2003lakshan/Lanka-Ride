import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { evaluateArrivalDetection } from "@/lib/arrivalDetection";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized: Driver access only" }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, lat, lng, accuracy, capturedAt } = body;

    // Validate coordinates
    if (
      !bookingId ||
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      return NextResponse.json(
        { error: "Valid booking ID, latitude, and longitude are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Verify sender is the assigned driver
    const currentDriverId = (session.user as any).id;
    if (!booking.driverId || booking.driverId.toString() !== currentDriverId) {
      return NextResponse.json(
        { error: "Unauthorized: You are not the driver assigned to this booking" },
        { status: 403 }
      );
    }

    // Lifecycle enforcement: Only active stages allow live GPS uploads
    const activeStatuses = [
      "DRIVER_ASSIGNED",
      "DRIVER_EN_ROUTE",
      "DRIVER_ARRIVED",
      "PASSENGER_PICKED_UP",
      "TRIP_IN_PROGRESS",
    ];

    if (!activeStatuses.includes(booking.status)) {
      return NextResponse.json(
        {
          error: `Live location sharing is closed: booking status is ${booking.status}`,
          status: booking.status,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const sampleCapturedAt = capturedAt ? new Date(capturedAt) : now;

    // Reject out-of-order GPS updates
    if (booking.driverLocation?.capturedAt) {
      const prevCapturedAt = new Date(booking.driverLocation.capturedAt);
      if (sampleCapturedAt.getTime() <= prevCapturedAt.getTime()) {
        return NextResponse.json({
          ignored: true,
          message: "Out-of-order or duplicate GPS sample ignored",
          currentCapturedAt: prevCapturedAt.toISOString(),
          receivedCapturedAt: sampleCapturedAt.toISOString(),
        }, { status: 200 });
      }
    }

    const driverLocation = {
      lat,
      lng,
      accuracy: typeof accuracy === "number" ? accuracy : undefined,
      capturedAt: sampleCapturedAt,
      receivedAt: now,
      updatedAt: now,
    };

    let autoArrived = false;
    let finalStatus = booking.status;

    // Evaluate arrival detection ONLY when trip is in DRIVER_EN_ROUTE
    if (booking.status === "DRIVER_EN_ROUTE") {
      const arrivalResult = await evaluateArrivalDetection({
        booking,
        driverLat: lat,
        driverLng: lng,
        accuracy: typeof accuracy === "number" ? accuracy : undefined,
        sampleCapturedAt,
        now,
      });

      if (arrivalResult.action === "TRIGGER_ARRIVAL") {
        // Atomic status transition: only succeeds if still DRIVER_EN_ROUTE and driver still assigned
        const updatedBooking = await Booking.findOneAndUpdate(
          {
            _id: booking._id,
            status: "DRIVER_EN_ROUTE",
            driverId: currentDriverId,
          },
          {
            $set: {
              status: "DRIVER_ARRIVED",
              arrivedAt: now,
              arrivalSource: "GPS",
              driverLocation,
            },
            $unset: {
              arrivalCandidate: 1,
            },
          },
          { new: true }
        );

        if (updatedBooking) {
          autoArrived = true;
          finalStatus = "DRIVER_ARRIVED";

          // Broadcast status change in realtime to booking room, rider, and admin
          import("@/lib/realtime").then(({ broadcastBookingStatusChanged }) => {
            broadcastBookingStatusChanged(updatedBooking, "DRIVER_ARRIVED", {
              arrivedAt: now.toISOString(),
              arrivalSource: "GPS",
              autoDetected: true,
            });
          }).catch(console.error);

          // Notify rider once: "Your driver has arrived at the pickup location."
          import("@/lib/notifications").then(async ({ sendNotification }) => {
            if (updatedBooking.touristId) {
              await sendNotification({
                recipientId: updatedBooking.touristId.toString(),
                type: "TRIP_STATUS_DRIVER_ARRIVED",
                title: "Driver Arrived",
                message: "Your driver has arrived at the pickup location.",
                link: `/track?ref=${updatedBooking.bookingReference}`,
                deduplicationKey: `status_change_DRIVER_ARRIVED_${updatedBooking._id.toString()}`,
              });
            }
          }).catch(console.error);
        }
      } else if (arrivalResult.action === "RESET_CANDIDATE") {
        booking.driverLocation = driverLocation;
        booking.arrivalCandidate = undefined;
        await Booking.updateOne(
          { _id: booking._id },
          { $set: { driverLocation }, $unset: { arrivalCandidate: 1 } }
        );
      } else if (arrivalResult.action === "UPDATE_CANDIDATE") {
        booking.driverLocation = driverLocation;
        booking.arrivalCandidate = arrivalResult.candidate;
        await booking.save();
      } else {
        // SKIP_INVALID_PICKUP, IGNORE_STALE_SAMPLE, IGNORE_POOR_ACCURACY
        booking.driverLocation = driverLocation;
        await booking.save();
      }
    } else {
      // Other active statuses (DRIVER_ASSIGNED, DRIVER_ARRIVED, PASSENGER_PICKED_UP, TRIP_IN_PROGRESS)
      // Never reverse DRIVER_ARRIVED when GPS drifts, and never advance to PASSENGER_PICKED_UP
      booking.driverLocation = driverLocation;
      await booking.save();
    }

    // Broadcast saved coordinates in realtime to booking room & admin
    import("@/lib/realtime").then(({ broadcastDriverLocation }) => {
      broadcastDriverLocation(
        booking._id.toString(),
        lat,
        lng,
        accuracy,
        now,
        sampleCapturedAt,
        now
      );
    }).catch(console.error);

    // Also update driver's general location record so dispatch availability stays fresh
    import("@/models/User").then(({ default: User }) => {
      User.updateOne(
        { _id: currentDriverId },
        { $set: { currentLat: lat, currentLng: lng, locationUpdatedAt: now } }
      ).catch(() => {});
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: finalStatus,
      autoArrived,
      ...(autoArrived ? { arrivalSource: "GPS", arrivedAt: now.toISOString() } : {}),
      capturedAt: sampleCapturedAt.toISOString(),
      receivedAt: now.toISOString(),
    }, { status: 200 });
  } catch (error: any) {
    console.error("Update driver location error:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
