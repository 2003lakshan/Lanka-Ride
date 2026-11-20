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
import AdminLiveTrackingClient from "./AdminLiveTrackingClient";
import { normalizeAdminTrip } from "@/lib/tripViewModel";

export const dynamic = "force-dynamic";

export default async function AdminLiveTrackingPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  const activeStatuses = [
    "DRIVER_ASSIGNED", 
    "DRIVER_EN_ROUTE", 
    "DRIVER_ARRIVED", 
    "PASSENGER_PICKED_UP", 
    "TRIP_IN_PROGRESS"
  ];

  const activeBookings = await Booking.find({ status: { $in: activeStatuses as any } })
    .populate('airportId')
    .populate('vehicleTypeId')
    .populate('touristId', 'name email phoneNumber nationality role')
    .populate('driverId', 'name email phoneNumber vehicleDetails licenseNumber vehicleRegistration')
    .populate('packageId')
    .populate({
      path: 'packageEnquiryId',
      populate: { path: 'riderId', select: 'name email phoneNumber nationality' }
    })
    .sort({ updatedAt: -1 })
    .lean();

  const serializedBookings = JSON.parse(
    JSON.stringify(activeBookings.map((b: any) => normalizeAdminTrip(b)))
  );

  return <AdminLiveTrackingClient initialActiveBookings={serializedBookings} />;
}
