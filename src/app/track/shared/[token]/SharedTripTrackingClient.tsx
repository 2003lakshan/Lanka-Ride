"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  Car, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Radio, 
  MessageCircle, 
  ExternalLink,
  Compass,
  Star,
  CheckCircle2,
  XCircle,
  Clock4,
  Lock
} from "lucide-react";
import RiderTrackingMap from "@/components/booking/RiderTrackingMap";
import { io, Socket } from "socket.io-client";
import { getSocketServerUrl } from "@/components/providers/SocketProvider";
import { getWhatsAppSupportNumber, buildWhatsAppLink } from "@/lib/whatsapp";
import type { SanitizedSharedBooking } from "@/lib/shareToken";
import BrandLogo from "@/components/brand/BrandLogo";

interface SharedTripTrackingClientProps {
  token: string;
}

export default function SharedTripTrackingClient({ token }: SharedTripTrackingClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code: string; extra?: any } | null>(null);
  const [trip, setTrip] = useState<SanitizedSharedBooking | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [lastLocationTime, setLastLocationTime] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Load authoritative sanitized public trip data
  const loadTrackingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/track/shared/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        setError({
          message: data.error || "Failed to load trip tracking data.",
          code: data.code || "UNKNOWN_ERROR",
          extra: data,
        });
        setTrip(null);
        return;
      }

      setTrip(data.data);
      if (data.data.driverLocation?.updatedAt) {
        setLastLocationTime(new Date(data.data.driverLocation.updatedAt));
      }
    } catch (err: any) {
      setError({
        message: err.message || "Network error while connecting to tracking service.",
        code: "NETWORK_ERROR",
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTrackingData();
  }, [loadTrackingData]);

  // Connect to realtime Socket.IO server as a guest using the share token
  useEffect(() => {
    if (!token || !trip || error) return;

    let isMounted = true;
    const socketUrl = getSocketServerUrl();

    const socketInstance = io(socketUrl, {
      auth: { shareToken: token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
      timeout: 8000,
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      if (isMounted) setIsSocketConnected(true);
    });

    socketInstance.on("disconnect", () => {
      if (isMounted) setIsSocketConnected(false);
    });

    // Real-time driver GPS coordinate stream
    socketInstance.on("driver:location_updated", (payload: any) => {
      if (!isMounted || !payload) return;

      // Ensure the update belongs to our trip
      if (payload.bookingId && trip && payload.bookingId !== trip.bookingId) {
        return;
      }

      const newLat = typeof payload.lat === "number" ? payload.lat : parseFloat(payload.lat);
      const newLng = typeof payload.lng === "number" ? payload.lng : parseFloat(payload.lng);

      if (!isNaN(newLat) && !isNaN(newLng)) {
        const updateDate = payload.updatedAt ? new Date(payload.updatedAt) : new Date();
        setLastLocationTime(updateDate);
        setTrip((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            driverLocation: {
              lat: newLat,
              lng: newLng,
              updatedAt: updateDate.toISOString(),
              accuracy: payload.accuracy,
            },
          };
        });
      }
    });

    // Real-time trip status changes
    socketInstance.on("booking:status_changed", (payload: any) => {
      if (!isMounted || !payload) return;
      if (payload.bookingId && trip && payload.bookingId !== trip.bookingId) {
        return;
      }

      // Reload authoritative payload to update status notices and permissions
      loadTrackingData();
    });

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, trip?.bookingId, error, loadTrackingData]);

  const handleSupportClick = () => {
    const supportNum = getWhatsAppSupportNumber();
    const cleanNum = supportNum.replace(/\D/g, "");
    const msg = `Hi At Your Service, I am viewing the shared tracking link for booking ${trip?.bookingReference || "Reference"}. Could you please assist me?`;
    const link = buildWhatsAppLink(cleanNum, msg);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // --------------------------------------------------------------------------
  // STATE 1: Loading
  // --------------------------------------------------------------------------
  if (loading && !trip) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 animate-pulse">
          <Car className="w-7 h-7" />
        </div>
        <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Verifying secure tracking link...</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Accessing encrypted live tracking records. No account sign-in required.
        </p>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STATE 2: Error (Invalid, Revoked, or Expired)
  // --------------------------------------------------------------------------
  if (error || !trip) {
    const isRevoked = error?.code === "REVOKED";
    const isExpired = error?.code === "EXPIRED";

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-5">
          <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center ${
            isRevoked 
              ? "bg-rose-100 text-rose-600" 
              : isExpired 
              ? "bg-amber-100 text-amber-600" 
              : "bg-slate-100 text-slate-600"
          }`}>
            {isRevoked ? (
              <XCircle className="w-8 h-8" />
            ) : isExpired ? (
              <Clock4 className="w-8 h-8" />
            ) : (
              <AlertCircle className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">
              {isRevoked
                ? "Tracking Link Revoked"
                : isExpired
                ? "Tracking Link Expired"
                : "Tracking Link Unavailable"}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {error?.message || "This shared tracking link is either invalid or no longer active."}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 text-left space-y-1.5">
            <p className="font-semibold text-slate-700">Why am I seeing this?</p>
            <p>
              • If the traveller revoked this link or generated a new one, this specific link is disabled.
            </p>
            <p>
              • Shared tracking links automatically expire 24 hours after the trip concludes.
            </p>
            <p>
              • Please ask the passenger or trip owner to send their current live tracking link.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={loadTrackingData}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
            >
              <RefreshCw className="w-4 h-4" /> Check Again
            </button>
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              <Lock className="w-4 h-4" /> Sign In to Passenger Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STATE 3: Active Tracking View
  // --------------------------------------------------------------------------
  const { statusInfo } = trip;
  const isLive = statusInfo.isLiveTracking;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="mobile-header" size="xs" linkToHome={true} />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hidden sm:inline-block">
              Shared View
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Socket Status Indicator */}
            {isLive && (
              <div
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                  isSocketConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isSocketConnected ? "animate-pulse text-emerald-600" : "text-amber-500"}`} />
                <span>{isSocketConnected ? "Live GPS Connected" : "Connecting..."}</span>
              </div>
            )}

            <button
              onClick={handleSupportClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp Help</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Status Announcement Banner */}
        <div
          className={`p-4 sm:p-5 rounded-3xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            statusInfo.badgeVariant === "active"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
              : statusInfo.badgeVariant === "confirmed"
              ? "bg-blue-50/90 border-blue-200 text-blue-950"
              : statusInfo.badgeVariant === "completed"
              ? "bg-slate-100 border-slate-200 text-slate-800"
              : statusInfo.badgeVariant === "cancelled"
              ? "bg-rose-50 border-rose-200 text-rose-950"
              : "bg-amber-50/90 border-amber-200 text-amber-950"
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                statusInfo.badgeVariant === "active"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : statusInfo.badgeVariant === "confirmed"
                  ? "bg-blue-600 text-white shadow-sm"
                  : statusInfo.badgeVariant === "completed"
                  ? "bg-slate-700 text-white shadow-sm"
                  : statusInfo.badgeVariant === "cancelled"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-amber-500 text-white shadow-sm"
              }`}
            >
              {statusInfo.badgeVariant === "active" ? (
                <Radio className="w-5 h-5 animate-pulse" />
              ) : statusInfo.badgeVariant === "completed" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : statusInfo.badgeVariant === "cancelled" ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base">{statusInfo.label}</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/70 font-semibold border border-black/5">
                  Ref: {trip.bookingReference}
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                {statusInfo.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center shrink-0">
            <button
              onClick={loadTrackingData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 font-bold text-xs border border-slate-200 shadow-xs transition"
              title="Refresh tracking status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[420px] sm:min-h-[520px]">
              {trip.pickupCoords ? (
                <RiderTrackingMap
                  status={trip.status}
                  driverLat={trip.driverLocation?.lat}
                  driverLng={trip.driverLocation?.lng}
                  driverLocationUpdatedAt={trip.driverLocation?.updatedAt}
                  driverName={trip.driver?.name}
                  vehicleModel={trip.driver?.vehicleModel}
                  vehicleRegistration={trip.driver?.registrationNumber || undefined}
                  pickupLat={trip.pickupCoords.lat}
                  pickupLng={trip.pickupCoords.lng}
                  pickupAddress={trip.pickupGeneral}
                  dropoffLat={trip.destinationCoords?.lat}
                  dropoffLng={trip.destinationCoords?.lng}
                  dropoffAddress={trip.destinationGeneral}
                />
              ) : (
                <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center bg-slate-50 text-slate-500 p-8 text-center space-y-2">
                  <Compass className="w-10 h-10 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700">Map will display once route coordinates are loaded</p>
                  <p className="text-xs text-slate-400">Scheduled route: {trip.pickupGeneral} → {trip.destinationGeneral}</p>
                </div>
              )}

              {/* Timestamp of last GPS update */}
              {isLive && trip.driverLocation && (
                <div className="absolute bottom-3 left-3 z-[1000] px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium shadow-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>
                    GPS updated{" "}
                    {lastLocationTime
                      ? lastLocationTime.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "just now"}
                  </span>
                </div>
              )}
            </div>

            {/* Custom Trip Multi-Day Itinerary Preview (if custom trip) */}
            {trip.customTripItinerary && trip.customTripItinerary.length > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Custom Tour Itinerary ({trip.customTripItinerary.length} Days)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {trip.customTripItinerary.map((day) => (
                    <div
                      key={day.dayNumber}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-700">Day {day.dayNumber}</span>
                        {day.overnightCity && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100/60 text-blue-900">
                            {day.overnightCity}
                          </span>
                        )}
                      </div>
                      {day.placesToVisit && day.placesToVisit.length > 0 ? (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {day.placesToVisit.map((p) => p.name).filter(Boolean).join(" • ")}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Scenic travel day</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Section */}
          <div className="lg:col-span-4 space-y-5">
            {/* Driver & Vehicle Card */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Assigned Driver & Vehicle
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Verified Driver
                </span>
              </div>

              {trip.driver ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-lg">
                      {trip.driver.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{trip.driver.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{trip.driver.rating.toFixed(1)}</span>
                        </div>
                        {trip.driver.completedTrips && (
                          <span>• {trip.driver.completedTrips} trips</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Vehicle Model:</span>
                      <strong className="text-slate-800">{trip.driver.vehicleModel}</strong>
                    </div>
                    {trip.driver.registrationNumber && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">License Plate:</span>
                        <strong className="font-mono text-slate-900 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                          {trip.driver.registrationNumber}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 space-y-1 text-xs">
                  <Car className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-600">Driver Assignment in Progress</p>
                  <p className="text-slate-400">
                    A dedicated driver will be assigned prior to the trip departure time.
                  </p>
                </div>
              )}
            </div>

            {/* Trip Details Card */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-3">
                Trip Route & Schedule
              </span>

              <div className="space-y-3.5 text-xs">
                {/* Pickup */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Pickup Location</span>
                    <p className="font-semibold text-slate-800">{trip.pickupGeneral}</p>
                  </div>
                </div>

                {/* Destination */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Destination</span>
                    <p className="font-semibold text-slate-800">{trip.destinationGeneral}</p>
                  </div>
                </div>

                {/* Date & Time */}
                {trip.tripDate && (
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                    <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Scheduled Date</span>
                      <p className="font-semibold text-slate-800">
                        {new Date(trip.tripDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {trip.pickupTime ? ` at ${trip.pickupTime}` : ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Privacy & Safe Sharing Shield */}
            <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Protected Shared View</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                This public link provides real-time vehicle location for friends and family. Passenger personal contact details, identity documents, and payment data are strictly hidden.
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Are you the passenger?</span>
                <Link
                  href="/login"
                  className="text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1"
                >
                  Manage Booking <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400 space-y-1">
          <p>© {new Date().getFullYear()} At Your Service – Powered by Pexora. All rights reserved.</p>
          <p className="text-[11px]">
            Official Sri Lanka Tourism Transportation & Live Fleet Management.
          </p>
        </div>
      </footer>
    </div>
  );
}
