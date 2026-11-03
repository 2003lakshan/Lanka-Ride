import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ activeBooking: null });
    }

    await dbConnect();
    const driverId = (session.user as any).id;

    const activeStatuses = [
      "DRIVER_ASSIGNED",
      "DRIVER_EN_ROUTE",
      "DRIVER_ARRIVED",
      "PASSENGER_PICKED_UP",
      "TRIP_IN_PROGRESS",
    ] as const;

    const activeBooking = await Booking.findOne({
      driverId,
      status: { $in: activeStatuses },
    })
      .select("_id bookingReference status pickupAddress pickupLat pickupLng destinationAddress destinationLat destinationLng passengerDetails customTripDetails driverId")
      .lean();

    if (!activeBooking) {
      return NextResponse.json({ activeBooking: null });
    }

    return NextResponse.json({
      activeBooking: {
        _id: activeBooking._id.toString(),
        bookingReference: activeBooking.bookingReference,
        status: activeBooking.status,
        pickupAddress: activeBooking.pickupAddress,
        pickupLat: activeBooking.pickupLat,
        pickupLng: activeBooking.pickupLng,
        destinationAddress: activeBooking.destinationAddress,
        destinationLat: activeBooking.destinationLat,
        destinationLng: activeBooking.destinationLng,
        passengerDetails: activeBooking.passengerDetails ? {
          fullName: activeBooking.passengerDetails.fullName,
          whatsappNumber: activeBooking.passengerDetails.whatsappNumber,
          email: activeBooking.passengerDetails.email,
        } : null,
        isCustomTrip: Boolean(activeBooking.customTripDetails?.isCustomTrip),
        driverId: activeBooking.driverId?.toString(),
      },
    });
  } catch (err: any) {
    console.error("Error fetching driver active trip:", err);
    return NextResponse.json({ activeBooking: null, error: err.message }, { status: 500 });
  }
}
