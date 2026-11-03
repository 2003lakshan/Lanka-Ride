"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, 
  MapPin, 
  Calendar, 
  Clock, 
  Car, 
  CreditCard, 
  CheckCircle, 
  ShieldAlert, 
  Phone, 
  MessageCircle,
  Navigation,
  Compass,
  AlertCircle,
  Wifi,
  WifiOff,
  Sparkles,
  ArrowRight,
  XCircle,
  HelpCircle,
  LifeBuoy,
  X,
  Mail
} from "lucide-react";
import RiderTrackingMap from "@/components/booking/RiderTrackingMap";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket } from "@/components/providers/SocketProvider";
import CancelRideModal from "@/components/booking/CancelRideModal";
import { CANCELLABLE_STATUSES, NON_CANCELLABLE_STARTED_STATUSES } from "@/lib/cancellation";

interface RouteStats {
  stageLabel: string;
  distanceKm?: number;
  durationMins?: number;
  nextTargetName?: string;
  isRoutingAvailable: boolean;
  isStale: boolean;
}

export default function TrackBookingPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { socket, isConnected, subscribeToBooking, unsubscribeFromBooking, registerReconnectHandler } = useSocket();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<any>(null);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [noDriversAccepted, setNoDriversAccepted] = useState(false);
  const [isRetryingDispatch, setIsRetryingDispatch] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState<string | null>(null);

  const initialUrlChecked = useRef(false);

  // Stabilized route stats handler with deep property equality check
  // Completely eliminates any re-render loop
  const handleRouteStatsChange = useCallback((stats: RouteStats) => {
    setRouteStats((prev) => {
      if (
        prev &&
        prev.stageLabel === stats.stageLabel &&
        prev.distanceKm === stats.distanceKm &&
        prev.durationMins === stats.durationMins &&
        prev.nextTargetName === stats.nextTargetName &&
        prev.isRoutingAvailable === stats.isRoutingAvailable &&
        prev.isStale === stats.isStale
      ) {
        return prev;
      }
      return stats;
    });
  }, []);

  const handleRetryDispatch = async () => {
    if (!booking?._id) return;
    setIsRetryingDispatch(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/retry-dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setNoDriversAccepted(false);
        setBooking((prev: any) => prev ? { ...prev, dispatchStatus: "SEARCHING" } : prev);
      }
    } catch (err) {
      console.error("Retry dispatch error:", err);
    } finally {
      setIsRetryingDispatch(false);
    }
  };

  const handleConfirmCancellation = async (reasonCode: string, comments?: string) => {
    if (!booking?._id) return;
    setIsCancellingBooking(true);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCode, comments }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel ride.");
      }
      if (data.booking) {
        setBooking(data.booking);
      } else {
        setBooking((prev: any) => (prev ? { ...prev, status: "CANCELLED" } : prev));
      }
      setIsCancelModalOpen(false);
      setCancellationNotice("Your ride has been successfully cancelled.");
      return true;
    } catch (err: any) {
      console.error("Cancel booking error:", err);
      throw err;
    } finally {
      setIsCancellingBooking(false);
    }
  };

  const fetchBooking = useCallback(async (ref: string, emailStr?: string) => {
    let url = `/api/bookings?ref=${encodeURIComponent(ref.trim())}&t=${Date.now()}`;
    if (emailStr && emailStr.trim()) {
      url += `&email=${encodeURIComponent(emailStr.trim())}`;
    }
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to find booking");
    }
    return data.data;
  }, []);

  // Auto-detect and track from query parameters (?ref=...&email=...)
  useEffect(() => {
    if (initialUrlChecked.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");
    const emailParam = params.get("email") || session?.user?.email || "";

    if (refParam) {
      initialUrlChecked.current = true;
      setReference(refParam);
      if (emailParam) setEmail(emailParam);

      setLoading(true);
      setError("");
      fetchBooking(refParam, emailParam)
        .then((data) => setBooking(data))
        .catch((err) => setError(err.message || "Failed to find booking"))
        .finally(() => setLoading(false));
    }
  }, [fetchBooking, session?.user?.email]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await fetchBooking(reference, email || session?.user?.email || "");
      setBooking(data);
    } catch (err: any) {
      setError(err.message || "Failed to find booking");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch on socket reconnect to recover missed state
  useEffect(() => {
    return registerReconnectHandler(() => {
      if (booking?.bookingReference) {
        fetchBooking(booking.bookingReference, booking.passengerDetails?.email || session?.user?.email || "")
          .then((data) => setBooking(data))
          .catch(console.error);
      }
    });
  }, [registerReconnectHandler, fetchBooking, booking?.bookingReference, booking?.passengerDetails?.email, session?.user?.email]);

  // Subscribe to booking room in realtime
  useEffect(() => {
    if (!booking?._id) return;

    const activeStatuses = [
      "DRIVER_ASSIGNED", 
      "DRIVER_EN_ROUTE", 
      "DRIVER_ARRIVED", 
      "PASSENGER_PICKED_UP", 
      "TRIP_IN_PROGRESS"
    ];

    if (activeStatuses.includes(booking.status)) {
      subscribeToBooking(booking._id);
    }

    return () => {
      unsubscribeFromBooking(booking._id);
    };
  }, [booking?._id, booking?.status, subscribeToBooking, unsubscribeFromBooking]);

  // Realtime listeners for this booking
  useEffect(() => {
    if (!socket || !booking?._id) return;

    const handleLocationUpdated = (data: any) => {
      if (data.bookingId !== booking._id) return;

      setBooking((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          driverLocation: {
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            capturedAt: data.capturedAt,
            receivedAt: data.receivedAt,
            updatedAt: data.updatedAt,
          },
        };
      });
    };

    const handleStatusChanged = (data: any) => {
      if (data.bookingId !== booking._id) return;

      if (booking.bookingReference) {
        fetchBooking(booking.bookingReference, booking.passengerDetails?.email || session?.user?.email || "")
          .then((fresh) => {
            if (fresh) setBooking(fresh);
          })
          .catch(() => {
            setBooking((prev: any) => (prev ? { ...prev, status: data.status } : prev));
          });
      } else {
        setBooking((prev: any) => (prev ? { ...prev, status: data.status } : prev));
      }

      if (data.status === "COMPLETED" || data.status === "CANCELLED" || data.status === "REFUNDED") {
        unsubscribeFromBooking(booking._id);
      }
    };

    const handleNoDriversAccepted = (data: any) => {
      if (data.bookingId === booking._id) {
        setNoDriversAccepted(true);
      }
    };

    const handleDriverAccepted = (data: any) => {
      setNoDriversAccepted(false);
      if (data.booking?._id !== booking._id) return;

      if (booking.bookingReference) {
        fetchBooking(booking.bookingReference, booking.passengerDetails?.email || session?.user?.email || "")
          .then((fresh) => {
            if (fresh) setBooking(fresh);
          })
          .catch(console.error);
      } else {
        setBooking((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: "DRIVER_ASSIGNED",
            driverId: data.driver,
          };
        });
      }
    };

    socket.on("driver:location_updated", handleLocationUpdated);
    socket.on("booking:status_changed", handleStatusChanged);
    socket.on("booking:driver_accepted", handleDriverAccepted);
    socket.on("ride:no_drivers_accepted", handleNoDriversAccepted);
    socket.on("ride:no_drivers_found", handleNoDriversAccepted);

    return () => {
      socket.off("driver:location_updated", handleLocationUpdated);
      socket.off("booking:status_changed", handleStatusChanged);
      socket.off("booking:driver_accepted", handleDriverAccepted);
      socket.off("ride:no_drivers_accepted", handleNoDriversAccepted);
      socket.off("ride:no_drivers_found", handleNoDriversAccepted);
    };
  }, [socket, booking?._id, booking?.bookingReference, booking?.passengerDetails?.email, fetchBooking, session?.user?.email, unsubscribeFromBooking]);

  // Non-overlapping 3-second polling fallback to lightweight location endpoint
  // Operates ONLY when realtime WebSocket is disconnected
  useEffect(() => {
    let timeoutId: any = null;
    let isPolling = false;
    let active = true;

    const activeStatuses = [
      "DRIVER_ASSIGNED", 
      "DRIVER_EN_ROUTE", 
      "DRIVER_ARRIVED", 
      "PASSENGER_PICKED_UP", 
      "TRIP_IN_PROGRESS"
    ];

    if (!booking?._id || !activeStatuses.includes(booking.status)) {
      return;
    }

    if (isConnected) {
      // Realtime WebSocket is healthy: duplicate polling is suppressed
      return;
    }

    const pollLocation = async () => {
      if (isPolling || !active) return;
      isPolling = true;

      try {
        const res = await fetch(`/api/bookings/${booking._id}/location?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (res.ok) {
          const locData = await res.json();
          if (active && locData) {
            setBooking((prev: any) => {
              if (!prev) return prev;
              return {
                ...prev,
                status: locData.status || prev.status,
                driverLocation: locData.driverLocation || prev.driverLocation,
                customTripDetails: locData.customTripDetails || prev.customTripDetails,
                ...(locData.driver ? {
                  driverId: {
                    ...prev.driverId,
                    fullName: locData.driver.name,
                    name: locData.driver.name,
                    vehicleRegistration: locData.driver.vehicleRegistration,
                    phoneNumber: locData.driver.phoneNumber,
                  }
                } : {}),
              };
            });
          }
        }
      } catch (e) {
        console.warn("Location polling error:", e);
      } finally {
        isPolling = false;
        if (active) {
          // Schedule next poll 3 seconds after this request finishes
          // Completely eliminates overlapping concurrent requests
          timeoutId = setTimeout(pollLocation, 3000);
        }
      }
    };

    // Begin non-overlapping polling
    pollLocation();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [booking?._id, booking?.status, isConnected]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
      case "AWAITING_PAYMENT":
        return {
          bg: "bg-amber-100 text-amber-800 border-amber-200",
          label: "Awaiting Assignment",
        };
      case "CONFIRMED":
        return {
          bg: "bg-blue-100 text-blue-800 border-blue-200",
          label: "Confirmed - Finding Driver",
        };
      case "DRIVER_ASSIGNED":
      case "DRIVER_EN_ROUTE":
        return {
          bg: "bg-blue-100 text-blue-800 border-blue-200",
          label: "Driver coming to pick you up",
        };
      case "DRIVER_ARRIVED":
        return {
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          label: "Driver has arrived at pickup",
        };
      case "PASSENGER_PICKED_UP":
      case "TRIP_IN_PROGRESS":
        return {
          bg: "bg-purple-100 text-purple-800 border-purple-200",
          label: "Trip in progress",
        };
      case "COMPLETED":
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-200",
          label: "Trip Completed",
        };
      case "CANCELLED":
      case "REFUNDED":
        return {
          bg: "bg-rose-100 text-rose-800 border-rose-200",
          label: "Trip Cancelled",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-200",
          label: status.replace(/_/g, " "),
        };
    }
  };

  const isCancellable = Boolean(
    booking && (CANCELLABLE_STATUSES as readonly string[]).includes(booking.status)
  );
  const isTripStarted = Boolean(
    booking && (NON_CANCELLABLE_STARTED_STATUSES as readonly string[]).includes(booking.status)
  );
  const isBeforePickup = booking && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"].includes(booking.status);
  const isTripInProgress = booking && ["PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"].includes(booking.status);
  const isTripFinished = booking && ["COMPLETED", "CANCELLED", "REFUNDED"].includes(booking.status);

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
          <p className="text-slate-500 mb-8">For security reasons, you must be logged in to your account to view live trip tracking.</p>
          <Link href="/login" className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/30">
            Log In to Track
          </Link>
        </div>
      </div>
    );
  }

  const badge = booking ? getStatusBadge(booking.status) : null;
  const driver = booking?.driverId;
  const driverName = driver?.fullName || driver?.name || "Assigned Driver";
  const vehicleReg = driver?.vehicleRegistration || driver?.driverProfile?.vehicleDetails?.registrationNumber || "Assigned";
  const vehicleModel = driver?.driverProfile?.vehicleDetails?.model || booking?.vehicleTypeId?.name;
  const rawPhone = driver?.phoneNumber;
  const hasValidPhone = Boolean(
    rawPhone &&
    typeof rawPhone === "string" &&
    rawPhone.replace(/[^0-9]/g, "").length >= 7 &&
    !["n/a", "no contact provided", "unknown", "none"].includes(rawPhone.trim().toLowerCase())
  );
  const phone = hasValidPhone ? rawPhone.trim() : null;

  // Last location update time text
  const lastLocationUpdate = booking?.driverLocation?.updatedAt 
    ? new Date(booking.driverLocation.updatedAt).toLocaleTimeString() 
    : null;

  return (
    <div className="bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 min-h-screen py-10 relative overflow-hidden">
      {/* Abstract decorative background */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-transparent blur-3xl -z-10 pointer-events-none rounded-full transform -translate-y-1/2"></div>
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            <Navigation size={13} className="text-blue-600 animate-pulse" />
            <span>Lanka Airport Ride • Live GPS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">Track Your Ride</h1>
          <p className="text-slate-500 text-base max-w-xl mx-auto">Real-time driver location updates and road navigation for your airport ride.</p>
        </div>

        {!booking ? (
          <div className="bg-white/90 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 max-w-lg mx-auto transform transition-all">
            <form onSubmit={handleTrack} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Booking Reference</label>
                <input
                  type="text"
                  required
                  placeholder="LAR-202X-0000X"
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400 font-semibold uppercase tracking-wider"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  placeholder={session?.user?.email || "name@example.com"}
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400 font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Leave empty to use your logged-in account email.</span>
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl text-xs font-semibold border border-rose-200 flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-2xl font-bold text-base hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 flex justify-center items-center gap-2 mt-4 cursor-pointer"
              >
                {loading ? (
                   <span className="flex items-center gap-2">
                     <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                     Locating ride...
                   </span>
                ) : (
                  <>
                    <Search size={18} />
                    <span>Track Ride</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100">
            {/* Header Stage Bar */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Booking Ref</span>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
                      {booking.bookingReference}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                    {badge?.label}
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm mt-1 flex items-center gap-2">
                    <Calendar size={13} className="text-blue-400" />
                    <span>Booked on {new Date(booking.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
                  {/* Connection indicator */}
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                    isConnected 
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800" 
                      : "bg-blue-950/80 text-blue-300 border-blue-800"
                  }`}>
                    {isConnected ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Realtime</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>Live Polling (3s)</span>
                      </>
                    )}
                  </div>

                  {/* Header cancellation or contact support action */}
                  {isCancellable && (
                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle size={13} />
                      <span>Cancel Ride</span>
                    </button>
                  )}
                  {isTripStarted && (
                    <button
                      type="button"
                      onClick={() => setIsSupportModalOpen(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <HelpCircle size={13} />
                      <span>Contact Support</span>
                    </button>
                  )}

                  {/* Status Pill */}
                  <div className={`px-4 py-1.5 rounded-full font-extrabold text-xs uppercase tracking-wider border ${badge?.bg}`}>
                    {booking.status.replace(/_/g, " ")}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-8 space-y-6 bg-slate-50/60">
              {cancellationNotice && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                    <span>{cancellationNotice}</span>
                  </div>
                  <button
                    onClick={() => setCancellationNotice(null)}
                    className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Dedicated Cancelled Trip Banner with Full Reason & Status */}
              {booking.status === "CANCELLED" && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-6 sm:p-7 text-rose-950 shadow-md animate-in fade-in duration-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <XCircle size={26} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-200">
                          Ride Cancelled
                        </span>
                        {booking.cancelledAt && (
                          <span className="text-xs text-rose-700 font-semibold">
                            {new Date(booking.cancelledAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-xl text-slate-900">
                        This ride was cancelled
                      </h3>
                      <p className="text-sm text-slate-800">
                        Reason: <span className="font-bold text-slate-900">{booking.cancellationReasonText || booking.cancellationReasonCode || "Cancelled by passenger"}</span>
                      </p>
                      {booking.cancelledBy && (
                        <p className="text-xs text-slate-600">
                          Cancelled by: <span className="font-semibold text-slate-800">{booking.cancelledBy.name || booking.cancelledBy.role}</span> ({booking.cancelledBy.role})
                        </p>
                      )}
                      {booking.cancellationComments && (
                        <div className="mt-2.5 p-3 bg-white/90 rounded-xl border border-rose-200 text-xs text-slate-700 italic">
                          &ldquo;{booking.cancellationComments}&rdquo;
                        </div>
                      )}
                      {booking.refundReviewStatus === "PENDING_REVIEW" && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-semibold flex items-center gap-2">
                          <AlertCircle size={16} className="text-amber-600 shrink-0" />
                          <span>This ride was paid. It has been flagged for administrative review to process eligible refunds.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Local Ride Nearby Dispatch Search / Expiry Banner */}
              {booking.status === "PENDING" && (
                <div>
                  {(noDriversAccepted || booking.dispatchStatus === "EXPIRED") ? (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 sm:p-7 text-amber-950 shadow-md animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                        <div className="flex items-start gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                            <AlertCircle size={24} />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-slate-900">
                              No nearby driver accepted
                            </h3>
                            <p className="text-sm text-slate-600 mt-1 max-w-lg">
                              No driver within the 15 km pickup radius accepted your ride offer in time. You can retry searching for nearby drivers or cancel this ride.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setIsCancelModalOpen(true)}
                            disabled={isCancellingBooking || isRetryingDispatch}
                            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 hover:border-rose-400 text-slate-700 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Cancel Ride
                          </button>

                          <button
                            type="button"
                            onClick={handleRetryDispatch}
                            disabled={isRetryingDispatch || isCancellingBooking}
                            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <Search size={14} />
                            <span>{isRetryingDispatch ? "Searching..." : "Retry Driver Search"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
                      <div className="absolute right-0 top-0 bottom-0 w-64 bg-linear-to-l from-blue-600/30 to-transparent pointer-events-none" />
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="relative flex h-12 w-12 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-2xl h-12 w-12 bg-blue-500 items-center justify-center text-white font-bold shadow-md">
                              <Navigation size={22} className="animate-spin" />
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 bg-blue-800/80 px-2 py-0.5 rounded-md">
                                Live Nearby Dispatch
                              </span>
                              <span className="text-xs text-blue-200">15 km Pickup Radius</span>
                            </div>
                            <h3 className="font-black text-lg text-white mt-0.5">
                              Searching for nearby {booking.pickMeDetails?.vehicleCategory || "Local"} drivers...
                            </h3>
                            <p className="text-xs text-blue-200 mt-0.5">
                              Your ride offer is being sent to eligible drivers near your pickup location.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsCancelModalOpen(true)}
                          disabled={isCancellingBooking}
                          className="px-4 py-2 rounded-xl bg-blue-800/80 hover:bg-rose-950 hover:text-rose-300 text-blue-100 text-xs font-bold transition-colors border border-blue-700/60 cursor-pointer"
                        >
                          Cancel Request
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Live Tracking Map Section */}
              <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                <div className="relative h-[420px] sm:h-[480px] w-full">
                  <RiderTrackingMap 
                    status={booking.status}
                    driverLat={booking.driverLocation?.lat}
                    driverLng={booking.driverLocation?.lng}
                    driverLocationUpdatedAt={booking.driverLocation?.updatedAt || booking.driverLocation?.capturedAt}
                    driverName={driverName}
                    vehicleRegistration={vehicleReg}
                    vehicleModel={vehicleModel}
                    pickupLat={booking.pickupLat || booking.airportId?.lat || 7.1803}
                    pickupLng={booking.pickupLng || booking.airportId?.lng || 79.8833}
                    pickupAddress={booking.pickupAddress || booking.airportId?.name || "Pickup Point"}
                    dropoffLat={booking.destinationLat}
                    dropoffLng={booking.destinationLng}
                    dropoffAddress={booking.destinationAddress}
                    customTripDetails={booking.customTripDetails}
                    onRouteStatsChange={handleRouteStatsChange}
                  />
                </div>
                
                {/* Driver Info & Status Bar */}
                {driver ? (
                  <div className="bg-white p-5 sm:p-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-5">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-13 h-13 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-600/20 shrink-0">
                        {driverName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-200">
                            Assigned Driver
                          </span>
                          {lastLocationUpdate && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              Updated {lastLocationUpdate}
                            </span>
                          )}
                        </div>
                        <p className="font-extrabold text-slate-900 text-lg leading-tight mt-0.5">{driverName}</p>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <Car size={13} className="text-slate-400" />
                          <span className="font-mono font-bold text-slate-800">{vehicleReg}</span>
                          {vehicleModel && <span>• {vehicleModel}</span>}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                      {phone && (
                        <>
                          <a 
                            href={`tel:${phone}`}
                            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-4 rounded-xl transition-colors border border-blue-200 text-xs shadow-sm"
                          >
                            <Phone size={15} />
                            <span>Call Driver</span>
                          </a>
                          <a 
                            href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 px-4 rounded-xl transition-colors border border-emerald-200 text-xs shadow-sm"
                          >
                            <MessageCircle size={15} />
                            <span>WhatsApp</span>
                          </a>
                        </>
                      )}

                      {/* Cancel Ride Action if driver is assigned/en route/arrived */}
                      {isCancellable && (
                        <button
                          type="button"
                          onClick={() => setIsCancelModalOpen(true)}
                          className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2 px-3.5 rounded-xl transition-colors border border-rose-200 text-xs shadow-sm cursor-pointer"
                        >
                          <XCircle size={15} />
                          <span>Cancel Ride</span>
                        </button>
                      )}

                      {/* Contact Support Action after trip start */}
                      {isTripStarted && (
                        <button
                          type="button"
                          onClick={() => setIsSupportModalOpen(true)}
                          className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2 px-3.5 rounded-xl transition-colors border border-purple-200 text-xs shadow-sm cursor-pointer"
                        >
                          <HelpCircle size={15} />
                          <span>Contact Support</span>
                        </button>
                      )}
                      
                      <div className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl text-center min-w-[110px]">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Plate</p>
                        <p className="font-mono font-black text-slate-800 text-sm">{vehicleReg}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-2 font-medium">
                      <Clock size={16} className="text-amber-500" />
                      {isTripFinished 
                        ? "Trip completed. Live driver sharing closed." 
                        : "Finding eligible driver. Live GPS updates will begin once assigned."}
                    </span>
                    <div className="flex items-center gap-3">
                      {isCancellable && (
                        <button
                          type="button"
                          onClick={() => setIsCancelModalOpen(true)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                        >
                          Cancel Ride
                        </button>
                      )}
                      <span className="font-mono font-bold text-slate-700">{booking.bookingReference}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Trip Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Route Card */}
                <div className="lg:col-span-3 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                        <MapPin size={20} />
                      </div>
                      Journey Route Details
                    </h3>

                    {routeStats?.distanceKm !== undefined && (
                      <div className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-xl text-xs font-bold">
                        <span>Road Distance: {routeStats.distanceKm} km</span>
                        <span>•</span>
                        <span>Est. ~{routeStats.durationMins} mins</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-slate-200 rounded-full"></div>
                    
                    <div className="space-y-8">
                      {/* Pickup */}
                      <div className="flex gap-6 relative">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md z-10 shrink-0">
                          A
                        </div>
                        <div className="pt-1">
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Pickup Location</p>
                          <p className="font-bold text-slate-900 text-lg">
                            {booking.pickupAddress || booking.airportId?.name || "Airport Terminal"}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-100">
                              <Calendar size={14} className="text-slate-400" /> {new Date(booking.arrivalDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-100">
                              <Clock size={14} className="text-slate-400" /> {booking.arrivalTime} 
                              {booking.flightNumber && <span className="text-blue-600 ml-1 font-bold">{booking.flightNumber}</span>}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Intermediate Stops if any */}
                      {(Array.isArray(booking.intermediateStops) && booking.intermediateStops.length > 0
                        ? booking.intermediateStops
                        : Array.isArray(booking.pickMeDetails?.intermediateStops)
                        ? booking.pickMeDetails.intermediateStops
                        : []
                      ).map((stop: any, idx: number) => (
                        <div key={stop._id || idx} className="flex gap-6 relative">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black shadow-md z-10 shrink-0 ${
                            stop.visited ? "bg-emerald-600 text-white" : "bg-purple-600 text-white"
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="pt-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-purple-600 uppercase font-bold tracking-widest mb-1">
                                Intermediate Stop {idx + 1}
                              </p>
                              {stop.visited && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full mb-1">
                                  Visited
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-slate-900 text-base">
                              {stop.address || stop.name || `Stop ${idx + 1}`}
                            </p>
                            {stop.notes && (
                              <p className="text-xs text-slate-500 mt-1">{stop.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Dropoff / Itinerary */}
                      <div className="flex gap-6 relative">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 z-10 shrink-0">
                          B
                        </div>
                        <div className="pt-1">
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">
                            {booking.customTripDetails?.isCustomTrip ? "Drop-off & Itinerary" : "Destination"}
                          </p>
                          <p className="font-bold text-slate-900 text-lg leading-tight">
                            {booking.destinationAddress || booking.customTripDetails?.dropoffLocation?.address || "Destination"}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            {booking.distanceKm && (
                              <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                <span className="text-slate-400 mr-1">Booked Distance:</span> {booking.distanceKm} km
                              </p>
                            )}
                            {booking.durationMins && (
                              <p className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                <span className="text-slate-400 mr-1">Est. Duration:</span> {Math.floor(booking.durationMins / 60)}h {booking.durationMins % 60}m
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Passenger & Vehicle */}
                <div className="lg:col-span-1 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                      <Car size={20} />
                    </div>
                    Passenger Details
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Vehicle Class</span>
                      <span className="font-bold text-slate-800">{booking.vehicleTypeId?.name || "Standard Sedan"}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Primary Passenger</span>
                      <span className="font-bold text-slate-800">
                        {booking.passengerDetails?.fullName || (booking.touristId as any)?.name || "Primary Passenger"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Travelers</span>
                      <span className="font-bold text-slate-800">
                        {(booking.passengerDetails?.adults ?? 1)} Adults, {(booking.passengerDetails?.children ?? 0)} Children
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment / Budget */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                        <CreditCard size={20} />
                      </div>
                      {booking.customTripDetails?.isCustomTrip ? "Trip Budget & Payment" : "Payment Summary"}
                    </h3>
                    <div className="space-y-4">
                      {!booking.customTripDetails?.isCustomTrip && (
                        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <span className="text-slate-500 font-medium">Payment Method</span>
                          <span className="font-bold text-slate-800 capitalize bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                            {booking.paymentMethod?.replace("_", " ") || "Pending"}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-slate-500 font-medium">Payment Status</span>
                        <span className="font-bold text-slate-800 flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                          {booking.paymentStatus === "PAID" ? (
                            <><CheckCircle size={16} className="text-emerald-500" /> PAID</>
                          ) : (
                            booking.paymentStatus
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-end">
                    <span className="text-slate-500 font-medium mb-1">
                      {booking.customTripDetails?.isCustomTrip ? "Confirmed Amount" : "Total Fare"}
                    </span>
                    <div className="text-right">
                      {booking.customTripDetails?.isCustomTrip ? (
                        <>
                          <span className="text-sm font-bold text-slate-400 mr-1">
                            {booking.customTripDetails.confirmedCurrency || booking.customTripDetails.budgetCurrency || "USD"}
                          </span>
                          <span className="font-black text-slate-900 text-3xl">
                            {(booking.customTripDetails.confirmedAmount || booking.customTripDetails.budget)?.toLocaleString() || "Flexible"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-slate-400 mr-1">LKR</span>
                          <span className="font-black text-slate-900 text-3xl">
                            {booking.fareBreakdown?.totalEstimatedFare?.toLocaleString() || "0"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 pb-2 flex justify-center">
                <button 
                  type="button"
                  onClick={() => {
                    setBooking(null);
                    setReference("");
                    setError("");
                  }}
                  className="px-6 py-3 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 font-bold transition-all flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Search size={16} /> Track another booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Ride Modal */}
      <CancelRideModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancellation}
        bookingReference={booking?.bookingReference}
        isSubmitting={isCancellingBooking}
      />

      {/* Contact Support Modal for started trips */}
      {isSupportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-6 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
              Contact 24/7 Dispatch Support
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Because your ride is currently in progress, standard cancellation is disabled to safeguard passenger and driver safety. Our operations team can handle immediate stops, emergency cancellations, or route adjustments.
            </p>

            <div className="space-y-3 mb-6">
              <a
                href="tel:+94112345678"
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-purple-600" />
                  <span>Operations Hotline (+94 11 234 5678)</span>
                </div>
                <span className="text-purple-600 dark:text-purple-400 text-[11px] uppercase tracking-wider font-extrabold">Call Now</span>
              </a>

              <a
                href="https://wa.me/94771234567"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp Priority Desk</span>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider font-extrabold">Chat</span>
              </a>

              <a
                href={`mailto:support@lankaairportride.com?subject=Assistance needed with Trip ${booking?.bookingReference || ""}`}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Email Support Desk</span>
                </div>
                <span className="text-blue-600 dark:text-blue-400 text-[11px] uppercase tracking-wider font-extrabold">Email</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setIsSupportModalOpen(false)}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
