import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import "@/models/Airport";
import "@/models/VehicleType";
import "@/models/User";
import "@/models/Package";
import "@/models/PackageEnquiry";
import { normalizeAdminTrip } from "@/lib/tripViewModel";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const resolvedParams = await params;
    const booking = await Booking.findById(resolvedParams.id)
      .populate('airportId')
      .populate('vehicleTypeId')
      .populate('touristId', 'name email phoneNumber nationality role')
      .populate('driverId', 'name email phoneNumber vehicleDetails licenseNumber vehicleRegistration')
      .populate('packageId')
      .populate({
        path: 'packageEnquiryId',
        populate: { path: 'riderId', select: 'name email phoneNumber nationality' }
      })
      .lean();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const normalized = normalizeAdminTrip(booking);

    return NextResponse.json({ data: normalized }, { status: 200 });
  } catch (error: any) {
    console.error("Admin fetch booking error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
