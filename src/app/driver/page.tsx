import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import Airport from "@/models/Airport";
import VehicleType from "@/models/VehicleType";
import { Car, MapPin, Calendar, Clock, Phone, User as UserIcon, CheckCircle } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import AcceptRideButton from "@/components/driver/AcceptRideButton";

// Ensure we don't cache this page so driver sees latest
export const dynamic = "force-dynamic";

export default async function DriverDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "DRIVER") {
    redirect("/login");
  }

  if (!(session.user as any).isApproved) {
    return (
      <div className="bg-slate-50 min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="bg-white p-10 md:p-16 rounded-3xl shadow-xl border border-slate-100 max-w-lg text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-yellow-400"></div>
          <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
             <Clock className="text-yellow-500" size={32} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Pending Approval</h2>
          <p className="text-slate-600 mb-8 text-lg">
            Your application is currently under review by our admin team. You will be able to view and accept rides once approved.
          </p>
          <a href="/" className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-medium transition-colors">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  await dbConnect();
  
  if (!Airport) console.log("Airport model loaded");
  if (!VehicleType) console.log("VehicleType model loaded");

  const bookings = await Booking.find({
    $or: [
      { status: "PENDING" },
      { status: "CONFIRMED" },
      { driverId: (session.user as any).id }
    ]
  })
    .populate('airportId')
    .populate('vehicleTypeId')
    .sort({ arrivalDate: 1, arrivalTime: 1 })
    .lean();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "CONFIRMED": return "bg-blue-100 text-blue-800";
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Driver Dashboard</h1>
            <p className="text-slate-600">View and manage all upcoming bookings.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/driver/packages" className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm border border-blue-200">
              Manage Packages
            </Link>
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm font-medium text-slate-700">
              Total Bookings: {bookings.length}
            </div>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-slate-200">
            <p className="text-slate-500 text-lg">No bookings found in the system yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookings.map((booking: any) => (
              <div key={booking._id.toString()} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                  <span className="font-bold">{booking.bookingReference}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${getStatusColor(booking.status)}`}>
                    {booking.status.replace(/_/g, " ")}
                  </span>
                </div>
                
                <div className="p-5 space-y-4">
                  {/* Route */}
                  <div className="relative pl-6 space-y-4 border-b border-slate-100 pb-4">
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200"></div>
                    
                    <div className="relative">
                      <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white z-10"></div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-0.5">Pickup</p>
                      <p className="font-medium text-slate-800 text-sm truncate">{booking.airportId?.name || "Unknown Airport"}</p>
                      <div className="flex gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(booking.arrivalDate).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Clock size={12}/> {booking.arrivalTime}</span>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-slate-800 border-2 border-white z-10"></div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-0.5">Drop-off</p>
                      <p className="font-medium text-slate-800 text-sm line-clamp-2">{booking.destinationAddress}</p>
                    </div>
                  </div>

                  {/* Passenger & Vehicle */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <UserIcon size={16} className="text-slate-400" />
                      <span className="font-medium text-slate-700">{booking.passengerDetails.fullName}</span>
                      <span className="text-slate-500 ml-auto">{booking.passengerDetails.adults}A, {booking.passengerDetails.children}C</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={16} className="text-slate-400" />
                      <span className="text-slate-600">{booking.passengerDetails.whatsappNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Car size={16} className="text-slate-400" />
                      <span className="text-slate-600 truncate">{booking.vehicleTypeId?.name || "Standard Vehicle"}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Est. Fare</p>
                      <p className="font-bold text-slate-900">LKR {booking.fareBreakdown.totalEstimatedFare.toLocaleString()}</p>
                    </div>
                    {(!booking.driverId && (booking.status === "PENDING" || booking.status === "CONFIRMED")) ? (
                      <AcceptRideButton bookingId={booking._id.toString()} />
                    ) : (
                      <Link href={`/driver/booking/${booking._id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        View Details &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
