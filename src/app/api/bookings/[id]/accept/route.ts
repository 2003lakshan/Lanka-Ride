import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(session.user as any).isApproved) {
      return NextResponse.json({ error: "Driver is not approved to accept rides yet." }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    // Use findOneAndUpdate with condition to prevent race conditions
    // Only accept if status is PENDING or CONFIRMED and driverId is null
    const updatedBooking = await Booking.findOneAndUpdate(
      { 
        _id: id, 
        status: { $in: ["PENDING", "CONFIRMED"] },
        $or: [
          { driverId: null },
          { driverId: { $exists: false } }
        ]
      },
      { 
        status: "DRIVER_ASSIGNED",
        driverId: (session.user as any).id
      },
      { new: true }
    );

    if (!updatedBooking) {
      return NextResponse.json({ error: "Booking is no longer available or already accepted by another driver." }, { status: 400 });
    }

    return NextResponse.json({ message: "Successfully accepted booking", data: updatedBooking }, { status: 200 });
  } catch (error: any) {
    console.error("Accept ride error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
