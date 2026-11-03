import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import { formatSriLankanDate, formatSriLankanLKR, formatSriLankanDateTime } from "@/lib/dateTime";
import Booking from "@/models/Booking";
import Airport from "@/models/Airport";
import VehicleType from "@/models/VehicleType";
import { MapPin, Phone, User as UserIcon, Calendar, Clock, Navigation } from "lucide-react";
import DriverMap from "@/components/driver/DriverMap";
import DriverTripNavigationCard from "@/components/driver/DriverTripNavigationCard";
import { getDriverTripNavigationTarget } from "@/lib/navigation";

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
  }).populate('airportId').populate('vehicleTypeId').populate('touristId', 'name email phoneNumber nationality').lean();

  if (!booking || ["COMPLETED", "CANCELLED", "REFUNDED"].includes(booking.status)) {
    redirect("/driver");
  }

  // Find the exact lat/lng of the pickup location
  const airport = booking.airportId as any;
  const pickupLat = booking.pickupLat || airport?.lat || 7.180479;
  const pickupLng = booking.pickupLng || airport?.lng || 79.88331;
  const pickupName = booking.pickupAddress || airport?.name || "Pickup Location";

  // Calculate active navigation target
  const navTarget = getDriverTripNavigationTarget(booking);
  const serializedBooking = JSON.parse(JSON.stringify(booking));

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ride Details &amp; Navigation</h1>
            <p className="text-sm text-slate-500 mt-0.5">Booking Ref: <strong className="font-mono text-slate-800">{booking.bookingReference}</strong></p>
          </div>
          <a href="/driver" className="text-blue-600 font-bold hover:underline flex items-center gap-1">
            &larr; Back to Dashboard
          </a>
        </div>

        {/* Dedicated Google Maps Turn-by-Turn Navigation & Itinerary Controls */}
        <DriverTripNavigationCard 
          initialBooking={serializedBooking}
          currentUserId={(session.user as any).id}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Map & GPS Sharing Section */}
            <DriverMap 
              bookingId={booking._id.toString()}
              status={booking.status}
              pickupLat={pickupLat} 
              pickupLng={pickupLng} 
              pickupName={pickupName} 
              dropoffLat={booking.destinationLat || 0}
              dropoffLng={booking.destinationLng || 0}
              dropoffName={booking.destinationAddress || ""}
              activeTargetLat={navTarget.isCoordinateValid ? navTarget.lat : undefined}
              activeTargetLng={navTarget.isCoordinateValid ? navTarget.lng : undefined}
              activeTargetName={navTarget.name}
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
                    <p className="font-bold text-slate-900">{booking.passengerDetails?.fullName || (booking.touristId as any)?.name || "Guest Passenger"}</p>
                    <p className="text-sm text-slate-600 mt-1">{booking.passengerDetails?.nationality || (booking.touristId as any)?.nationality || "International"}</p>
                  </div>
                </div>

                {(() => {
                  const rawNum = booking.passengerDetails?.whatsappNumber || (booking.touristId as any)?.phoneNumber;
                  const hasValidNum = Boolean(
                    rawNum &&
                    typeof rawNum === "string" &&
                    rawNum.replace(/[^0-9]/g, "").length >= 7 &&
                    !["n/a", "no contact provided", "unknown", "none"].includes(rawNum.trim().toLowerCase())
                  );

                  return (
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${hasValidNum ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                        <Phone size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 font-medium">WhatsApp Number</p>
                        {hasValidNum ? (
                          <a 
                            href={`https://wa.me/${rawNum.replace(/[^0-9]/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-bold text-slate-900 hover:text-green-600 transition-colors"
                          >
                            {rawNum}
                          </a>
                        ) : (
                          <p className="text-slate-400 font-medium">Not provided</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                    <span className="block font-bold text-slate-900">{formatSriLankanDate(booking.arrivalDate || booking.customTripDetails?.startDate, 'N/A')}</span>
                    <span className="text-sm text-slate-500">{booking.arrivalTime || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-slate-500">Flight Number</span>
                  <span className="font-bold text-slate-900">{booking.flightNumber || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-slate-500">Status</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${booking.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>
                    {booking.status.replace(/_/g, " ")}
                  </span>
                </div>
                {booking.status === "COMPLETED" && (
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                    <span className="text-slate-500">Completed At</span>
                    <span className="text-xs font-bold text-emerald-700">
                      {formatSriLankanDateTime(booking.completedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Trip Itinerary Details */}
            {booking.customTripDetails?.isCustomTrip && booking.customTripDetails.itinerary && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Complete Itinerary</h3>
                <div className="space-y-6">
                  {booking.customTripDetails.itinerary.map((day: any) => (
                    <div key={day.dayNumber} className="border-l-2 border-slate-200 pl-4 py-2 relative">
                      <div className="absolute -left-[9px] top-4 w-4 h-4 bg-white border-4 border-slate-800 rounded-full"></div>
                      <h4 className="font-bold text-slate-900">Day {day.dayNumber} - {formatSriLankanDate(day.date, 'N/A')}</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        <strong>Start:</strong> {day.startingLocation?.address || 'N/A'} <br/>
                        <strong>Visits:</strong> {day.placesToVisit?.length > 0 ? day.placesToVisit.map((p: any) => p.name).join(", ") : 'None'} <br/>
                        <strong>Overnight:</strong> {day.overnightLocation?.hotel || day.overnightLocation?.city || 'N/A'} <br/>
                        <strong>Dist:</strong> {day.distanceKm?.toFixed(1) || 0} km, <strong>Time:</strong> {Math.round(day.drivingTimeMins || 0)} mins
                      </p>
                      {day.notes && <p className="text-sm text-amber-700 mt-2 bg-amber-50 p-2 rounded">Notes: {day.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Earnings / Budget */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg">
              <h3 className="text-lg font-bold text-slate-300 mb-2">
                {booking.customTripDetails?.isCustomTrip ? "Rider's Proposed Budget" : "Estimated Earnings"}
              </h3>
              <p className="text-4xl font-bold">
                {booking.customTripDetails?.isCustomTrip 
                  ? (booking.customTripDetails.budget ? `${booking.customTripDetails.budgetCurrency || 'USD'} ${booking.customTripDetails.budget}` : 'Flexible')
                  : formatSriLankanLKR(booking.fareBreakdown?.totalEstimatedFare, 'LKR 0')
                }
              </p>
              
              {booking.customTripDetails?.isCustomTrip && booking.customTripDetails.budget && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-2 text-sm text-slate-300">
                  <p><strong>Covers:</strong> {booking.customTripDetails.budgetCovers}</p>
                  <p><strong>Flexibility:</strong> {booking.customTripDetails.budgetFlexibility}</p>
                  {booking.customTripDetails.budgetNotes && (
                    <p className="italic text-slate-400">"{booking.customTripDetails.budgetNotes}"</p>
                  )}
                </div>
              )}

              {!booking.customTripDetails?.isCustomTrip && booking.paymentMethod && (
                <p className="text-slate-400 text-sm mt-2">Payment Method: {booking.paymentMethod.replace(/_/g, " ")}</p>
              )}
            </div>

          </div>
          
        </div>
      </div>
    </div>
  );
}
