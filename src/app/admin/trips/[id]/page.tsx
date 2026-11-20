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
import AdminTripTrackingClient from "./AdminTripTrackingClient";
import { normalizeAdminTrip } from "@/lib/tripViewModel";

export const dynamic = "force-dynamic";

export default async function AdminTripTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-slate-800">Booking Not Found</h1>
          <a href="/admin/trips" className="text-blue-600 mt-4 inline-block hover:underline">Return to Platform Trips</a>
        </div>
      </div>
    );
  }

  const serializedBooking = JSON.parse(
    JSON.stringify(normalizeAdminTrip(booking))
  );

  return <AdminTripTrackingClient initialBooking={serializedBooking} bookingId={resolvedParams.id} />;
}
