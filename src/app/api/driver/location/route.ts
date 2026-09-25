import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, lat, lng, accuracy } = body;

    if (!bookingId || lat === undefined || lng === undefined || (lat === 0 && lng === 0)) {
      return NextResponse.json({ error: "Booking ID, valid latitude and valid longitude required" }, { status: 400 });
    }

    await dbConnect();

    // Verify the driver is assigned to this specific active booking
    const booking = await Booking.findOne({
      _id: bookingId,
      driverId: (session.user as any).id,
      status: { $in: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"] }
    });

    if (!booking) {
      return NextResponse.json({ error: "Active booking not found or unauthorized" }, { status: 404 });
    }

    booking.driverLocation = {
      lat,
      lng,
      accuracy,
      updatedAt: new Date()
    };
    
    await booking.save();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Update location error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
