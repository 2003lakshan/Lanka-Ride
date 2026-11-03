import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Booking ID required" }, { status: 400 });
    }

    await dbConnect();

    // Query booking with minimal projection and populated driver details
    const filter = id.startsWith("LAR-") || id.startsWith("TEST-")
      ? { bookingReference: id }
      : { _id: id };

    const booking: any = await Booking.findOne(filter)
      .select("_id bookingReference status touristId passengerDetails driverId driverLocation customTripDetails arrivedAt arrivalSource updatedAt")
      .populate("driverId", "name fullName phoneNumber vehicleRegistration driverProfile")
      .lean();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userEmail = (session.user?.email || "").toLowerCase();

    // Permissions check:
    // Only assigned driver, booking rider/owner, or ADMIN can access live location
    if (userRole === "ADMIN") {
      // Allowed
    } else if (userRole === "DRIVER") {
      const assignedDriverId = booking.driverId?._id?.toString() || booking.driverId?.toString();
      if (!assignedDriverId || assignedDriverId !== userId) {
        return NextResponse.json(
          { error: "Unauthorized: You are not assigned to this booking" },
          { status: 403 }
        );
      }
    } else if (userRole === "TOURIST") {
      const ownerId = booking.touristId?.toString();
      const passengerEmail = (booking.passengerDetails?.email || "").toLowerCase();

      const isOwner =
        (ownerId && ownerId === userId) ||
        (userEmail && passengerEmail && userEmail === passengerEmail);

      if (!isOwner) {
        return NextResponse.json(
          { error: "Unauthorized: You do not have permission to view this booking's location" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json({ error: "Unauthorized role" }, { status: 403 });
    }

    // Lifecycle check: Completed or cancelled trips must not present last location as live
    const activeStatuses = [
      "DRIVER_ASSIGNED",
      "DRIVER_EN_ROUTE",
      "DRIVER_ARRIVED",
      "PASSENGER_PICKED_UP",
      "TRIP_IN_PROGRESS",
    ];
    const isLive = activeStatuses.includes(booking.status);

    let driverLoc = undefined;
    if (isLive && booking.driverLocation?.lat && booking.driverLocation?.lng) {
      driverLoc = {
        lat: booking.driverLocation.lat,
        lng: booking.driverLocation.lng,
        accuracy: booking.driverLocation.accuracy,
        capturedAt: booking.driverLocation.capturedAt,
        receivedAt: booking.driverLocation.receivedAt,
        updatedAt: booking.driverLocation.updatedAt,
      };
    }

    const driverData = booking.driverId
      ? {
          id: booking.driverId._id?.toString(),
          name: booking.driverId.fullName || booking.driverId.name,
          vehicleRegistration:
            booking.driverId.vehicleRegistration ||
            booking.driverId.driverProfile?.vehicleDetails?.registrationNumber,
          vehicleModel: booking.driverId.driverProfile?.vehicleDetails?.model,
          phoneNumber: booking.driverId.phoneNumber,
        }
      : null;

    return NextResponse.json({
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      status: booking.status,
      isLive,
      driverLocation: driverLoc,
      driver: driverData,
      customTripDetails: booking.customTripDetails,
      arrivedAt: booking.arrivedAt,
      arrivalSource: booking.arrivalSource,
      serverTime: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error("Fetch lightweight location error:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
