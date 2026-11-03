import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    if (!body.destinationLat || !body.destinationLng || (body.destinationLat === 0 && body.destinationLng === 0)) {
      return NextResponse.json({ error: "Valid destination coordinates are required" }, { status: 400 });
    }

    // 1. Generate unique booking reference (LAR-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const count = await Booking.countDocuments({
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`),
      },
    });
    const referenceNumber = String(count + 1).padStart(5, "0");
    const bookingReference = `LAR-${year}-${referenceNumber}`;

    const session = await getServerSession(authOptions);
    const touristId = session?.user ? (session.user as any).id : undefined;

    // 2. Create the booking
    const booking = await Booking.create({
      ...body,
      bookingReference,
      status: "PENDING",
      touristId,
    });

    // 2.5 Realtime Nearby Driver Dispatch (if pickup coordinates exist)
    if (booking.pickupLat && booking.pickupLng && booking.pickupLat !== 0 && booking.pickupLng !== 0) {
      try {
        const { dispatchLocalRideOffer } = await import("@/lib/nearbyDispatch");
        await dispatchLocalRideOffer(booking);
      } catch (err: any) {
        console.error("[Booking Dispatch Error]", err);
      }
    }

    // Realtime broadcast to eligible drivers and admin dashboard
    import("@/lib/realtime").then(({ broadcastBookingAvailable }) => {
      broadcastBookingAvailable(booking);
    }).catch(console.error);

    // 3. Send Notifications
    import("@/lib/notifications").then(async ({ sendNotification, notifyAdmins, notifyEligibleDrivers }) => {
      if (touristId) {
        await sendNotification({
          recipientId: touristId,
          type: "BOOKING_SUBMITTED",
          title: "Booking Request Submitted",
          message: `Your booking request ${bookingReference} has been received.`,
          link: `/my-bookings?ref=${bookingReference}`,
          deduplicationKey: `booking_submit_rider_${booking._id.toString()}`
        });
      }
      await notifyAdmins({
        type: "NEW_BOOKING",
        title: "New Booking Request",
        message: `New unassigned booking ${bookingReference} requires attention.`,
        link: `/admin/trips/${booking._id.toString()}`,
        deduplicationKey: `booking_submit_admin_${booking._id.toString()}`
      });
      await notifyEligibleDrivers({
        type: "NEW_AVAILABLE_TRIP",
        title: "New Trip Available",
        message: `A new trip ${bookingReference} is available for assignment.`,
        link: `/driver/booking/${booking._id.toString()}`,
        deduplicationKey: `booking_submit_driver_${booking._id.toString()}`
      });
    }).catch(console.error);

    return NextResponse.json(
      {
        message: "Booking created successfully",
        data: {
          bookingReference: booking.bookingReference,
          id: booking._id,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Booking creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create booking" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref");
    const email = searchParams.get("email");
    const id = searchParams.get("id");

    // Allow guest riders who possess the booking reference to track their ride directly
    if (!session || !session.user) {
      if (ref) {
        const booking = await Booking.findOne({ bookingReference: ref })
          .populate("airportId")
          .populate("vehicleTypeId")
          .populate("driverId", "name fullName phoneNumber vehicleRegistration driverProfile vehicleCategory")
          .populate("touristId", "name email phoneNumber")
          .lean();

        if (!booking) {
          return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(booking.status)) {
          delete (booking as any).driverLocation;
        }

        return NextResponse.json({ data: booking }, { status: 200 });
      }

      return NextResponse.json({ error: "Unauthorized. Please log in to view or track bookings." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userEmail = (session.user?.email || "").toLowerCase();

    // Querying a single booking (by ref or id)
    if (ref || id) {
      const filter: any = {};
      if (id) filter._id = id;
      else if (ref) filter.bookingReference = ref;

      const booking = await Booking.findOne(filter)
        .populate("airportId")
        .populate("vehicleTypeId")
        .populate("driverId", "name fullName phoneNumber vehicleRegistration driverProfile")
        .populate("touristId", "name email phoneNumber")
        .lean();

      if (!booking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      // Permissions enforcement:
      // Only the booking's rider, assigned driver, and authorised admins may access
      if (userRole === "ADMIN") {
        // Authorized: Admin has global read permissions
      } else if (userRole === "DRIVER") {
        const assignedDriverId = booking.driverId
          ? ((booking.driverId as any)._id || booking.driverId).toString()
          : null;
        if (!assignedDriverId || assignedDriverId !== userId) {
          return NextResponse.json(
            { error: "Unauthorized: You are not the driver assigned to this booking." },
            { status: 403 }
          );
        }
      } else if (userRole === "TOURIST") {
        const ownerTouristId = booking.touristId
          ? ((booking.touristId as any)._id || booking.touristId).toString()
          : null;
        const passengerEmail = (booking.passengerDetails?.email || "").toLowerCase();
        const queryEmail = (email || "").toLowerCase();

        const isOwner =
          (ownerTouristId && ownerTouristId === userId) ||
          (userEmail && passengerEmail && userEmail === passengerEmail) ||
          (queryEmail && passengerEmail && queryEmail === passengerEmail);

        if (!isOwner) {
          return NextResponse.json(
            { error: "Unauthorized: You do not have permission to view or track this booking." },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json({ error: "Unauthorized role" }, { status: 403 });
      }

      // Lifecycle enforcement:
      // Stop location sharing for this booking when completed or cancelled.
      // Keep completed trips in history without presenting their last position as live.
      if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(booking.status)) {
        delete (booking as any).driverLocation;
      }

      return NextResponse.json({ data: booking }, { status: 200 });
    }

    // Listing bookings (when no ref or id is specified)
    let query: any = {};

    if (userRole === "TOURIST") {
      query = {
        $or: [
          { touristId: userId },
          ...(userEmail ? [{ "passengerDetails.email": userEmail }] : [])
        ]
      };
    } else if (userRole === "DRIVER") {
      const activeDriverTripStatuses = [
        "CONFIRMED",
        "DRIVER_ASSIGNED",
        "DRIVER_EN_ROUTE",
        "DRIVER_ARRIVED",
        "PASSENGER_PICKED_UP",
        "TRIP_IN_PROGRESS",
      ];
      query = {
        $or: [
          {
            status: { $in: ["PENDING", "CONFIRMED"] },
            $or: [{ driverId: null }, { driverId: { $exists: false } }],
          },
          {
            driverId: userId,
            status: { $in: activeDriverTripStatuses as any },
          },
        ],
      };
    }
    // ADMIN sees everything (query = {})

    const bookings = await Booking.find(query)
      .populate("airportId")
      .populate("vehicleTypeId")
      .populate("driverId", "name fullName phoneNumber vehicleRegistration driverProfile")
      .sort({ createdAt: -1 })
      .lean();

    // Remove live coordinates from completed/cancelled trips in history
    for (const b of bookings) {
      if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(b.status)) {
        delete (b as any).driverLocation;
      }
    }

    return NextResponse.json({ data: bookings }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch bookings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, bookingReference, flightNumber, arrivalTime, notes, passengerDetails } = body;

    const query: any = {};
    if (bookingId) query._id = bookingId;
    else if (bookingReference) query.bookingReference = bookingReference;
    else return NextResponse.json({ error: "Booking ID or reference required" }, { status: 400 });

    const userId = (session.user as any).id;
    const role = (session.user as any).role;
    if (role === "TOURIST") {
      query.touristId = userId;
    }

    const booking = await Booking.findOne(query);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (flightNumber !== undefined) booking.flightNumber = flightNumber;
    if (arrivalTime !== undefined) booking.arrivalTime = arrivalTime;
    if (passengerDetails) {
      booking.passengerDetails = { ...booking.passengerDetails, ...passengerDetails };
    }
    if (notes !== undefined && booking.passengerDetails) booking.passengerDetails.specialRequests = notes;

    await booking.save();

    // Broadcast trip updated to admins
    import("@/lib/realtime").then(({ emitRealtimeEvent }) => {
      emitRealtimeEvent({
        target: { toRole: "admin" },
        event: "booking:updated",
        data: { booking },
      });
    }).catch(console.error);

    // Notify admins
    import("@/lib/notifications").then(async ({ notifyAdmins }) => {
      await notifyAdmins({
        type: "TRIP_UPDATED",
        title: "Trip Request Updated",
        message: `Rider updated booking ${booking.bookingReference}.`,
        link: `/admin/trips/${booking._id.toString()}`,
        deduplicationKey: `booking_update_admin_${booking._id.toString()}_${Date.now()}`
      });
    }).catch(console.error);

    return NextResponse.json({ success: true, booking });
  } catch (err: any) {
    console.error("Booking update error:", err);
    return NextResponse.json({ error: err.message || "Failed to update booking" }, { status: 500 });
  }
}
