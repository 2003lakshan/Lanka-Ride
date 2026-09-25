import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { Calendar, Clock, MapPin, Car, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  await dbConnect();
  
  const bookings = await Booking.find({ touristId: (session.user as any).id })
    .populate('airportId')
    .populate('vehicleTypeId')
    .sort({ createdAt: -1 })
    .lean();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "CONFIRMED": return "bg-blue-100 text-blue-800 border-blue-200";
      case "DRIVER_ASSIGNED": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "COMPLETED": return "bg-green-100 text-green-800 border-green-200";
      case "CANCELLED": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Bookings</h1>
          <p className="text-slate-600">View and manage your airport transfers.</p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="text-slate-400" size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">No bookings found</h3>
            <p className="text-slate-500 mb-6">You haven't made any bookings yet.</p>
            <a href="/booking" className="inline-flex bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
              Book a Ride
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking: any) => (
              <div key={booking._id.toString()} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                
                {/* Status Column */}
                <div className="md:w-64 bg-slate-900 p-6 flex flex-col justify-between text-white shrink-0">
                  <div>
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Reference</div>
                    <div className="font-mono text-lg font-bold mb-6">{booking.bookingReference}</div>
                    
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Status</div>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(booking.status)}`}>
                      {booking.status.replace(/_/g, " ")}
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-slate-800">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Fare</div>
                    <div className="text-xl font-bold">LKR {booking.fareBreakdown.totalEstimatedFare.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mt-1 capitalize">{booking.paymentMethod.replace("_", " ")}</div>
                  </div>
                </div>

                {/* Details Column */}
                <div className="p-6 md:p-8 flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <MapPin size={16} className="text-blue-600"/> Route Details
                      </h4>
                      <div className="relative pl-6 space-y-4">
                        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200"></div>
                        <div className="relative">
                          <div className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white"></div>
                          <p className="text-xs text-slate-500 font-bold uppercase">Pickup</p>
                          <p className="font-medium text-slate-800 text-sm">{booking.airportId?.name}</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-slate-800 ring-2 ring-white"></div>
                          <p className="text-xs text-slate-500 font-bold uppercase">Drop-off</p>
                          <p className="font-medium text-slate-800 text-sm">{booking.destinationAddress}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Date</p>
                        <p className="text-sm font-medium text-slate-800 flex items-center gap-1"><Calendar size={14} className="text-slate-400"/> {new Date(booking.arrivalDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Time</p>
                        <p className="text-sm font-medium text-slate-800 flex items-center gap-1"><Clock size={14} className="text-slate-400"/> {booking.arrivalTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <Car size={16} className="text-blue-600"/> Vehicle & Passengers
                      </h4>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="font-medium text-slate-800 mb-1">{booking.vehicleTypeId?.name}</p>
                        <p className="text-sm text-slate-600 mb-3">{booking.passengerDetails.adults} Adults, {booking.passengerDetails.children} Children, {booking.passengerDetails.luggage} Bags</p>
                        
                        {(booking.passengerDetails.childSeatRequired || booking.passengerDetails.meetAndGreetRequired) && (
                          <div className="text-xs text-slate-500 pt-3 border-t border-slate-200">
                            <strong>Add-ons:</strong> 
                            {booking.passengerDetails.childSeatRequired && " Child Seat"}
                            {booking.passengerDetails.childSeatRequired && booking.passengerDetails.meetAndGreetRequired && " • "}
                            {booking.passengerDetails.meetAndGreetRequired && " Meet & Greet"}
                          </div>
                        )}
                      </div>
                    </div>

                    {booking.status === "DRIVER_ASSIGNED" || booking.status === "DRIVER_EN_ROUTE" || booking.status === "DRIVER_ARRIVED" ? (
                       <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex flex-col gap-3">
                         <div>
                           <h4 className="text-sm font-bold text-blue-900 mb-1">Driver Assigned</h4>
                           <p className="text-xs text-blue-800">Your driver is on the way. You can track their live location.</p>
                         </div>
                         <a href={`/track?ref=${booking.bookingReference}&email=${encodeURIComponent(booking.passengerDetails.email)}`} className="bg-blue-600 hover:bg-blue-700 text-white text-center text-sm font-bold py-2.5 rounded-lg transition-colors w-full shadow-md shadow-blue-500/20">
                            Track Ride Live
                         </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <Info size={16} /> Driver assignment pending
                      </div>
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

// Temporary Info Icon since it was missing
function Info({ size, className }: { size: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  )
}
