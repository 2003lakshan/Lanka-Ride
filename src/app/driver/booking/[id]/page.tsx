import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import Airport from "@/models/Airport";
import VehicleType from "@/models/VehicleType";
import { MapPin, Phone, User as UserIcon, Calendar, Clock, Navigation } from "lucide-react";
import DriverMap from "@/components/driver/DriverMap";

export const dynamic = "force-dynamic";

export default async function DriverBookingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "DRIVER") {
    redirect("/login");
  }

  await dbConnect();
  
  if (Airport && VehicleType) {
    // no-op to ensure schema registration
  }

  const { id } = await params;
  
  const booking = await Booking.findOne({ 
    _id: id,
    driverId: (session.user as any).id
  }).populate('airportId').populate('vehicleTypeId').lean();

  if (!booking) {
    redirect("/driver");
  }

  // Find the exact lat/lng of the pickup location
  const airport = booking.airportId as any;
  const pickupLat = booking.pickupLat || airport?.lat || 7.180479;
  const pickupLng = booking.pickupLng || airport?.lng || 79.88331;
  const pickupName = booking.pickupAddress || airport?.name || "Pickup Location";

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-900">Ride Details</h1>
          <a href="/driver" className="text-blue-600 font-bold hover:underline">&larr; Back to Dashboard</a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* Map Section */}
            <DriverMap 
              bookingId={booking._id.toString()}
              status={booking.status}
              pickupLat={pickupLat} 
              pickupLng={pickupLng} 
              pickupName={pickupName} 
              dropoffLat={booking.destinationLat || 0}
              dropoffLng={booking.destinationLng || 0}
              dropoffName={booking.destinationAddress || ""}
            />

            {/* Passenger Information */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Passenger Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Full Name</p>
                    <p className="font-bold text-slate-900">{booking.passengerDetails.fullName}</p>
                    <p className="text-sm text-slate-600 mt-1">{booking.passengerDetails.nationality}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                    <Phone size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">WhatsApp Number</p>
                    <a href={`https://wa.me/${booking.passengerDetails.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-900 hover:text-green-600 transition-colors">
                      {booking.passengerDetails.whatsappNumber}
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="space-y-6">
            
            {/* Booking Summary */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Booking Summary</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-slate-500">Reference ID</span>
                  <span className="font-mono font-bold text-slate-900">{booking.bookingReference}</span>
                </div>
                
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-slate-500">Date & Time</span>
                  <div className="text-right">
                    <span className="block font-bold text-slate-900">{booking.arrivalDate ? new Date(booking.arrivalDate).toLocaleDateString() : 'N/A'}</span>
                    <span className="text-sm text-slate-500">{booking.arrivalTime || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-slate-500">Flight Number</span>
                  <span className="font-bold text-slate-900">{booking.flightNumber || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-slate-500">Status</span>
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded uppercase">
                    {booking.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg">
              <h3 className="text-lg font-bold text-slate-300 mb-2">Estimated Earnings</h3>
              <p className="text-4xl font-bold">LKR {booking.fareBreakdown.totalEstimatedFare.toLocaleString()}</p>
              <p className="text-slate-400 text-sm mt-2">Payment Method: {booking.paymentMethod.replace(/_/g, " ")}</p>
            </div>

          </div>
          
        </div>
      </div>
    </div>
  );
}
