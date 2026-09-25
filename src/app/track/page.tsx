"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Calendar, Clock, Car, CreditCard, CheckCircle, ShieldAlert, Phone, MessageCircle } from "lucide-react";
import RiderTrackingMap from "@/components/booking/RiderTrackingMap";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function TrackBookingPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<any>(null);

  const fetchBooking = async (ref: string, emailStr: string) => {
    const res = await fetch(`/api/bookings?ref=${ref}&email=${emailStr}&t=${Date.now()}`, {
      cache: "no-store"
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to find booking");
    }
    return data.data;
  };

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      const params = new URLSearchParams(window.location.search);
      const urlRef = params.get("ref");
      const urlEmail = params.get("email");
      
      if (urlRef && urlEmail && !booking && !loading) {
        setReference(urlRef);
        setEmail(urlEmail);
        
        const autoFetch = async () => {
          setLoading(true);
          try {
            const data = await fetchBooking(urlRef, urlEmail);
            setBooking(data);
          } catch (err: any) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        };
        autoFetch();
      }
    }
  }, [sessionStatus]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setBooking(null);

    try {
      // Clean up the reference in case the user accidentally pasted "ID " or extra spaces
      const cleanReference = reference.replace(/^ID\s+/i, '').trim();
      
      const data = await fetchBooking(cleanReference, email.trim());
      setBooking(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll for live driver location if the trip is active
  useEffect(() => {
    let interval: any;
    
    const activeStatuses = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"];
    
    if (booking && activeStatuses.includes(booking.status)) {
      interval = setInterval(async () => {
        try {
          const data = await fetchBooking(booking.bookingReference, booking.passengerDetails.email);
          setBooking(data);
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [booking?.status, booking?.bookingReference, booking?.passengerDetails?.email]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
      case "AWAITING_PAYMENT":
        return "bg-yellow-100 text-yellow-800";
      case "CONFIRMED":
      case "DRIVER_ASSIGNED":
        return "bg-blue-100 text-blue-800";
      case "DRIVER_EN_ROUTE":
      case "DRIVER_ARRIVED":
      case "TRIP_IN_PROGRESS":
        return "bg-purple-100 text-purple-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
      case "REFUNDED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const hasLiveTracking = booking && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"].includes(booking.status);

  if (sessionStatus === "loading") {
    return (
      <div className="bg-slate-50 min-h-screen py-12 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-3">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Authentication Required</h2>
          <p className="text-slate-500 mb-8">For security reasons, you must be logged in to your account to track rides.</p>
          <Link href="/login" className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/30">
            Log In to Track
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen py-12 relative overflow-hidden">
      {/* Abstract decorative background */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-br from-blue-600/10 to-purple-600/10 blur-3xl -z-10 pointer-events-none rounded-full transform -translate-y-1/2"></div>
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Track Your Ride</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Real-time status updates and live tracking for your airport transfer.</p>
        </div>

        {!booking ? (
          <div className="bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100/50 max-w-lg mx-auto transform transition-all">
            <form onSubmit={handleTrack} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Booking Reference</label>
                <input
                  type="text"
                  required
                  placeholder="LAR-202X-0000X"
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400 font-medium"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400 font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-medium border border-red-100 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-2xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 flex justify-center items-center gap-2 mt-4"
              >
                {loading ? (
                   <span className="flex items-center gap-2">
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     Locating...
                   </span>
                ) : <><Search size={20} /> Track Ride</>}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100">
            {/* Premium Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <p className="text-slate-400 font-medium text-sm mb-1 uppercase tracking-wider">Booking Reference</p>
                  <h2 className="text-3xl font-black tracking-tight mb-2">{booking.bookingReference}</h2>
                  <p className="text-slate-300 text-sm flex items-center gap-2">
                    <Calendar size={14} className="text-blue-400" />
                    Booked {new Date(booking.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className={`px-6 py-2 rounded-full font-bold text-sm uppercase tracking-widest shadow-inner ${getStatusColor(booking.status)} border border-white/10 backdrop-blur-md`}>
                  {booking.status.replace(/_/g, " ")}
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50">
              
              {/* Live Tracking Map - Prominent */}
              {hasLiveTracking && (
                <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100 overflow-hidden flex flex-col">
                  
                  <div className="relative h-[450px] w-full">
                    {/* Live indicator is handled by RiderTrackingMap component */}
                    
                    <RiderTrackingMap 
                      status={booking.status}
                      driverLat={booking.driverLocation?.lat}
                      driverLng={booking.driverLocation?.lng}
                      driverLocationUpdatedAt={booking.driverLocation?.updatedAt}
                      pickupLat={booking.airportId?.lat || 7.1803}
                      pickupLng={booking.airportId?.lng || 79.8833}
                      dropoffLat={booking.destinationLat}
                      dropoffLng={booking.destinationLng}
                    />
                  </div>
                  
                  {/* Driver Info Bar */}
                  {booking.driverId && (
                    <div className="bg-white p-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 relative">
                      <div className="flex items-center gap-5 w-full md:w-auto">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md shadow-blue-500/20 transform -rotate-3 shrink-0">
                          {booking.driverId.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Your Driver</p>
                          <p className="font-extrabold text-slate-900 text-lg">{booking.driverId.name}</p>
                          <p className="text-sm text-slate-500 font-medium">{booking.driverId.phoneNumber || "No phone provided"}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center">
                        {booking.driverId.phoneNumber && (
                          <>
                            <a 
                              href={`tel:${booking.driverId.phoneNumber}`}
                              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2.5 px-5 rounded-xl transition-colors border border-blue-200 shadow-sm"
                            >
                              <Phone size={18} />
                              Call
                            </a>
                            <a 
                              href={`https://wa.me/${booking.driverId.phoneNumber.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-2.5 px-5 rounded-xl transition-colors border border-green-200 shadow-sm"
                            >
                              <MessageCircle size={18} />
                              WhatsApp Call
                            </a>
                          </>
                        )}
                        <div className="bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-xl text-center shadow-inner min-w-[120px]">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">License Plate</p>
                          <p className="font-black text-slate-800 text-base tracking-wider">{booking.driverId.vehicleRegistration || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trip Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Route Card (Spans 2 columns on large screens if needed, or 1) */}
                <div className="lg:col-span-3 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
                  <h3 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                      <MapPin size={20} />
                    </div>
                    Journey Details
                  </h3>
                  
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-slate-200 rounded-full"></div>
                    
                    <div className="space-y-8">
                      {/* Pickup */}
                      <div className="flex gap-6 relative">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md z-10 shrink-0">
                          A
                        </div>
                        <div className="pt-1">
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Pickup Location</p>
                          <p className="font-bold text-slate-900 text-lg">{booking.airportId?.name || "Airport"}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-100">
                              <Calendar size={14} className="text-slate-400" /> {new Date(booking.arrivalDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-100">
                              <Clock size={14} className="text-slate-400" /> {booking.arrivalTime} 
                              <span className="text-blue-600 ml-1 font-bold">{booking.flightNumber}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dropoff */}
                      <div className="flex gap-6 relative">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 z-10 shrink-0">
                          B
                        </div>
                        <div className="pt-1">
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Destination</p>
                          <p className="font-bold text-slate-900 text-lg leading-tight">{booking.destinationAddress}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              <span className="text-slate-400 mr-1">Distance:</span> {booking.distanceKm} km
                            </p>
                            <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              <span className="text-slate-400 mr-1">Est. Time:</span> {Math.floor(booking.durationMins / 60)}h {booking.durationMins % 60}m
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vehicle & Passenger */}
                <div className="lg:col-span-1 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
                  <h3 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                      <Car size={20} />
                    </div>
                    Passenger
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Vehicle Class</span>
                      <span className="font-bold text-slate-800">{booking.vehicleTypeId?.name || "Standard"}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Primary Passenger</span>
                      <span className="font-bold text-slate-800">{booking.passengerDetails.fullName}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Travelers</span>
                      <span className="font-bold text-slate-800">{booking.passengerDetails.adults} Adults, {booking.passengerDetails.children} Children</span>
                    </div>
                  </div>
                </div>

                {/* Payment */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-3">
                      <div className="p-2 bg-green-50 rounded-xl text-green-600">
                        <CreditCard size={20} />
                      </div>
                      Payment Summary
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-slate-500 font-medium">Method</span>
                        <span className="font-bold text-slate-800 capitalize bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">{booking.paymentMethod.replace("_", " ")}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-slate-500 font-medium">Status</span>
                        <span className="font-bold text-slate-800 flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                          {booking.paymentStatus === "PAID" ? (
                            <><CheckCircle size={16} className="text-green-500" /> PAID</>
                          ) : (
                            booking.paymentStatus
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-end">
                    <span className="text-slate-500 font-medium mb-1">Total Fare</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-400 mr-1">LKR</span>
                      <span className="font-black text-slate-900 text-3xl">{booking.fareBreakdown.totalEstimatedFare.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 pb-4 flex justify-center">
                <button 
                  onClick={() => setBooking(null)}
                  className="px-6 py-3 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold transition-all flex items-center gap-2"
                >
                  <Search size={16} /> Track another booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
