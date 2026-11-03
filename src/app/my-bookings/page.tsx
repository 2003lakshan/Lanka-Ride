import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import PackageEnquiry from "@/models/PackageEnquiry";
import "@/models/Airport";
import "@/models/VehicleType";
import "@/models/User";
import "@/models/Package";
import MyBookingsClient from "@/components/booking/MyBookingsClient";
import { serializeBookingToDTO, serializeEnquiryToDTO } from "@/lib/bookingDto";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  await dbConnect();

  const bookings = await Booking.find({ touristId: (session.user as any).id })
    .populate("airportId")
    .populate("vehicleTypeId")
    .populate("driverId", "name phoneNumber vehicleRegistration")
    .sort({ createdAt: -1 })
    .lean();

  const enquiries = await PackageEnquiry.find({ riderId: (session.user as any).id })
    .populate("packageId", "title")
    .sort({ updatedAt: -1 })
    .lean();

  const serializedBookings = bookings.map(serializeBookingToDTO);
  const serializedEnquiries = enquiries.map(serializeEnquiryToDTO);

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Bookings</h1>
          <p className="text-slate-600">View and manage your airport transfers.</p>
        </div>

        <MyBookingsClient
          initialBookings={serializedBookings}
          initialEnquiries={serializedEnquiries}
        />
      </div>
    </div>
  );
}
