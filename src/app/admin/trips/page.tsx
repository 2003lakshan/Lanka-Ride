import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import "@/models/Airport";
import "@/models/VehicleType";
import "@/models/User";
import "@/models/Package";
import "@/models/PackageEnquiry";

import AdminTripsClient from "./AdminTripsClient";
import { normalizeAdminTrip } from "@/lib/tripViewModel";

export const dynamic = "force-dynamic";

export default async function AdminTripsPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  const bookings = await Booking.find()
    .populate('airportId')
    .populate('vehicleTypeId')
    .populate('touristId', 'name email phoneNumber nationality role')
    .populate('driverId', 'name email phoneNumber vehicleDetails licenseNumber vehicleRegistration')
    .populate('packageId')
    .populate({
      path: 'packageEnquiryId',
      populate: { path: 'riderId', select: 'name email phoneNumber nationality' }
    })
    .sort({ arrivalDate: -1, createdAt: -1 })
    .lean();

  const serializedBookings = bookings.map((b: any) => normalizeAdminTrip(b));

  return <AdminTripsClient initialBookings={serializedBookings} />;
}
