"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/components/providers/SocketProvider";
import { formatSriLankanDate } from "@/lib/dateTime";
import { 
  Navigation, 
  MapPin, 
  CheckCircle, 
  CheckCircle2, 
  Bed, 
  Flag, 
  AlertCircle, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  Compass,
  Car,
  Clock,
  Sparkles
} from "lucide-react";
import { 
  getDriverTripNavigationTarget, 
  DriverTripNavigationTarget,
  isValidCoordinate,
  buildGoogleMapsNavigationUrl
} from "@/lib/navigation";
import { useRouter } from "next/navigation";
import { useDriverTracking } from "@/components/providers/DriverTrackingProvider";

interface DriverTripNavigationCardProps {
  initialBooking: any;
  currentUserId: string;
}

export default function DriverTripNavigationCard({
  initialBooking,
  currentUserId
}: DriverTripNavigationCardProps) {
  const [booking, setBooking] = useState<any>(initialBooking);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFullItinerary, setShowFullItinerary] = useState(false);
  const router = useRouter();
  const { trackingStatus, stopTracking, setActiveBooking, activeBooking } = useDriverTracking();
  const { socket } = useSocket();

  const isAssignedDriver = 
    booking.driverId && 
    (booking.driverId._id || booking.driverId).toString() === currentUserId;

  const target: DriverTripNavigationTarget = getDriverTripNavigationTarget(booking);
  const isTripFinished = target.isAllCompleted || ["COMPLETED", "CANCELLED", "REFUNDED"].includes(booking.status);
  const isPickedUp = ["PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"].includes(booking.status);
  const isCustomTrip = Boolean(booking.customTripDetails?.isCustomTrip && booking.customTripDetails?.itinerary?.length > 0);
  const localStops = Array.isArray(booking.intermediateStops)
    ? booking.intermediateStops
    : Array.isArray(booking.pickMeDetails?.intermediateStops)
    ? booking.pickMeDetails.intermediateStops
    : [];
  const hasLocalStops = localStops.length > 0;

  // Sync with activeBooking from tracking provider
  useEffect(() => {
    if (activeBooking && (activeBooking._id || activeBooking.id) === booking._id) {
      if (activeBooking.status !== booking.status || activeBooking.arrivalSource !== booking.arrivalSource) {
        setBooking((prev: any) => ({
          ...prev,
          status: activeBooking.status,
          arrivalSource: activeBooking.arrivalSource ?? prev.arrivalSource,
          arrivedAt: activeBooking.arrivedAt ?? prev.arrivedAt,
        }));
      }
    }
  }, [activeBooking, booking._id, booking.status, booking.arrivalSource]);

  // Realtime listener for booking status changes
  useEffect(() => {
    if (!socket || !booking?._id) return;

    const handleStatusChanged = (data: any) => {
      if (data.bookingId !== booking._id) return;
      setBooking((prev: any) => ({
        ...prev,
        status: data.status,
        arrivalSource: data.arrivalSource ?? prev.arrivalSource,
        arrivedAt: data.arrivedAt ?? prev.arrivedAt,
      }));
    };

    socket.on("booking:status_changed", handleStatusChanged);
    return () => {
      socket.off("booking:status_changed", handleStatusChanged);
    };
  }, [socket, booking?._id]);

  // Status progression call to /api/bookings/[id]/status
  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update trip status");
      }
      if (data.booking) { 
        setBooking(data.booking); 
      } else { 
        setBooking((prev: any) => ({ ...prev, status: newStatus })); 
      }

      if (newStatus === "COMPLETED") {
        stopTracking("Trip completed.");
        setActiveBooking(null);
      }

      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  // Stop progression call to /api/bookings/[id]/progress
  const handleProgressAction = async (action: string, dayIndex?: number, stopIndex?: number) => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dayIndex, stopIndex })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update stop progress");
      }
      if (data.booking) {
        setBooking(data.booking);
      }

      if (action === "COMPLETE_TRIP") {
        stopTracking("Trip completed.");
        setActiveBooking(null);
      }

      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record stop progress");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isAssignedDriver) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-amber-900 text-sm">
        <p className="font-bold">Navigation View Restricted</p>
        <p className="mt-1 text-amber-700">Only the assigned driver can view active Google Maps navigation controls for this trip.</p>
      </div>
    );
  }

  if (booking.status === "CANCELLED") {
    return (
      <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-6 sm:p-8 text-rose-950 shadow-lg mb-6 animate-in fade-in duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <AlertCircle size={26} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200">
                Ride Cancelled
              </span>
              {booking.cancelledAt && (
                <span className="text-xs text-rose-600 font-medium">
                  {new Date(booking.cancelledAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-rose-950">
              This trip was cancelled by the {booking.cancelledBy?.role === "ADMIN" ? "Admin" : "Passenger"}
            </h3>
            <p className="text-sm text-rose-900 font-medium">
              Reason: <span className="font-bold">{booking.cancellationReasonText || booking.cancellationReasonCode || "Passenger cancelled ride."}</span>
            </p>
            {booking.cancellationComments && (
              <p className="text-xs text-rose-700 bg-white/70 p-3 rounded-xl border border-rose-200 italic">
                &ldquo;{booking.cancellationComments}&rdquo;
              </p>
            )}
            <p className="text-xs text-rose-800 pt-1">
              Trip navigation and live sharing have been stopped for this booking. Your availability is released for new offers.
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={() => router.push("/driver/dashboard")}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStepBadgeColor = (stepType: string) => {
    switch (stepType) {
      case "PICKUP":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "STOP":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "OVERNIGHT":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "DROPOFF":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      {/* Top Banner with Active Target Info */}
      <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Compass size={20} className="animate-spin-slow" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Navigation Destination</p>
              <h2 className="text-lg font-bold text-white">Turn-by-Turn Routing</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trackingStatus === "LIVE" && !isTripFinished && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live GPS</span>
              </span>
            )}
            {trackingStatus === "STARTING_GPS" && !isTripFinished && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Acquiring GPS</span>
              </span>
            )}
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase border ${getStepBadgeColor(target.stepType)}`}>
              {target.stepLabel}
            </span>
            {target.totalStops !== undefined && target.completedStops !== undefined && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {target.completedStops} / {target.totalStops} visited
              </span>
            )}
          </div>
        </div>

        {/* Destination Name Callout */}
        <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl p-4 sm:p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
                Current Stop / Next Point
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {target.name}
              </h3>
              {target.notes && (
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-400" />
                  {target.notes}
                </p>
              )}
            </div>

            {target.isCoordinateValid && (
              <a
                href={target.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/40 shrink-0 cursor-pointer"
              >
                <Navigation size={16} />
                <span>Start in Maps</span>
                <ExternalLink size={14} className="opacity-70" />
              </a>
            )}
          </div>

          {!target.isCoordinateValid && !isTripFinished && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-950/60 border border-amber-800/60 p-2.5 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>
                Coordinates missing for &ldquo;{target.name}&rdquo;. Please verify the destination address with the rider.
              </span>
            </div>
          )}
        </div>

        {/* Step Progression Action Button */}
        {!isTripFinished && (
          <div>
            {target.stepType === "PICKUP" && (
              <div className="space-y-3">
                {/* Automatic arrival banner (only shown if tracking active and not blocked) */}
                {booking.status === "DRIVER_ARRIVED" &&
                  booking.arrivalSource === "GPS" &&
                  trackingStatus !== "PERMISSION_BLOCKED" &&
                  trackingStatus !== "LOCATION_UNAVAILABLE" &&
                  trackingStatus !== "INSECURE_CONTEXT" && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-300">Arrival detected automatically</p>
                          <p className="text-[11px] text-emerald-400/80">Rider has been notified that you have arrived at pickup.</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        GPS Verified
                      </span>
                    </div>
                  )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {booking.status === "DRIVER_ASSIGNED" && (
                    <button
                      onClick={() => handleUpdateStatus("DRIVER_EN_ROUTE")}
                      disabled={isUpdating}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Car size={18} />
                      <span>I Am Heading to Pickup</span>
                    </button>
                  )}

                  {(booking.status === "DRIVER_ASSIGNED" || booking.status === "DRIVER_EN_ROUTE") && (
                    <button
                      onClick={() => handleUpdateStatus("DRIVER_ARRIVED")}
                      disabled={isUpdating}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      title="Tap if GPS arrival was not detected or pickup point is inaccessible"
                    >
                      <CheckCircle2 size={18} />
                      <span>I Have Arrived at Pickup</span>
                    </button>
                  )}

                  {booking.status === "DRIVER_ARRIVED" && (
                    <button
                      onClick={() => handleUpdateStatus("PASSENGER_PICKED_UP")}
                      disabled={isUpdating}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={18} />
                      <span>Passenger Picked Up &bull; Start Trip</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {target.stepType === "STOP" && (
              <button
                onClick={() => {
                  if (hasLocalStops) {
                    handleProgressAction("MARK_LOCAL_STOP_VISITED", undefined, target.stopIndex);
                  } else {
                    handleProgressAction("MARK_STOP_VISITED", target.dayIndex, target.stopIndex);
                  }
                }}
                disabled={isUpdating}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                <span>Mark {target.stepLabel} as Visited &bull; Advance Route</span>
              </button>
            )}

            {target.stepType === "OVERNIGHT" && (
              <button
                onClick={() => handleProgressAction("MARK_OVERNIGHT_VISITED", target.dayIndex)}
                disabled={isUpdating}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Bed size={18} />
                <span>Check In at Hotel &bull; Complete Day {booking.customTripDetails?.itinerary?.[target.dayIndex || 0]?.dayNumber || 1}</span>
              </button>
            )}

            {target.stepType === "DROPOFF" && (
              <button
                onClick={() => handleUpdateStatus("COMPLETED")}
                disabled={isUpdating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                <span>Arrived at Final Drop-off &bull; Complete Trip</span>
              </button>
            )}

            {errorMsg && (
              <div className="mt-3 p-3 bg-rose-900/80 border border-rose-700 rounded-xl text-rose-200 text-xs flex items-center justify-between">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="underline ml-2 text-rose-100">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        {isTripFinished && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">This journey is marked as {booking.status}. No further navigation is required.</span>
          </div>
        )}
      </div>

      
      {/* Local Ride Intermediate Stops Itinerary */}
      {!isCustomTrip && hasLocalStops && (
        <div className="p-6 bg-white border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <span>Trip Itinerary ({localStops.length} Intermediate {localStops.length === 1 ? "Stop" : "Stops"})</span>
            </h4>
            <span className="text-[11px] font-semibold text-slate-500">
              {localStops.filter((s: any) => s.visited).length} of {localStops.length} Visited
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Pickup */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle className={isPickedUp ? "text-emerald-600" : "text-emerald-400"} size={16} />
                <div>
                  <span className="font-bold text-emerald-950 block">Pickup Location</span>
                  <span className="text-emerald-800">{booking.pickupAddress}</span>
                  {(booking.pickupInstructions || booking.pickMeDetails?.pickupInstructions) && (
                    <span className="text-emerald-700 italic block mt-0.5">
                      Note: {booking.pickupInstructions || booking.pickMeDetails?.pickupInstructions}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Intermediate Stops */}
            {localStops.map((stop: any, sIdx: number) => {
              const isCurrentActive = target.stepType === "STOP" && target.stopIndex === sIdx;
              const hasCoords = isValidCoordinate(stop.lat, stop.lng);
              const directUrl = hasCoords ? buildGoogleMapsNavigationUrl(stop.lat, stop.lng) : null;

              return (
                <div
                  key={sIdx}
                  className={`p-3 rounded-xl flex items-center justify-between text-xs transition-all ${
                    stop.visited
                      ? "bg-slate-50 text-slate-500 line-through"
                      : isCurrentActive
                      ? "bg-amber-50 border-2 border-amber-300 text-amber-950 font-bold shadow-xs"
                      : "bg-white border border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleProgressAction("MARK_LOCAL_STOP_VISITED", undefined, sIdx)}
                      className="focus:outline-none hover:scale-110 transition-transform cursor-pointer"
                      title={stop.visited ? "Stop visited" : "Click to mark visited"}
                    >
                      {stop.visited ? (
                        <CheckCircle className="text-emerald-500" size={16} />
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCurrentActive
                              ? "bg-amber-500 text-white"
                              : "border border-slate-300 text-slate-600"
                          }`}
                        >
                          {stop.stopOrder || sIdx + 1}
                        </div>
                      )}
                    </button>
                    <div>
                      <span className="block font-semibold">
                        Stop {stop.stopOrder || sIdx + 1}: {stop.address}
                      </span>
                      {stop.notes && <span className="text-slate-400 italic block text-[10px]">Note: {stop.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrentActive && (
                      <span className="text-[10px] uppercase font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                        Next Stop
                      </span>
                    )}
                    {directUrl && (
                      <a
                        href={directUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                        title="Navigate in Google Maps"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final Drop-off */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              isTripFinished 
                ? "bg-emerald-50 border-emerald-100 text-emerald-950" 
                : target.stepType === "DROPOFF" 
                ? "bg-rose-50 border-rose-200 text-rose-950 font-bold" 
                : "bg-white border-slate-200 text-slate-700"
            }`}>
              <div className="flex items-center gap-2.5">
                <MapPin className="text-rose-500" size={16} />
                <div>
                  <span className="font-bold text-slate-900 block">Final Drop-off Destination</span>
                  <span className="text-slate-700">{booking.destinationAddress}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Day Itinerary Overview Breakdown */}
      {isCustomTrip && (
        <div className="p-6 bg-white border-t border-slate-100">
          <button
            onClick={() => setShowFullItinerary(!showFullItinerary)}
            className="w-full flex items-center justify-between text-slate-800 font-bold text-sm hover:text-blue-600 transition-colors cursor-pointer"
          >
            <span>Itinerary Stops Progress Checklist</span>
            <span className="flex items-center gap-1 text-xs text-slate-500 font-normal">
              {showFullItinerary ? "Hide details" : "View all stops"}
              {showFullItinerary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showFullItinerary && (
            <div className="mt-4 space-y-6 pt-4 border-t border-slate-100">
              {booking.customTripDetails.itinerary.map((day: any, dIdx: number) => (
                <div key={day.dayNumber || dIdx} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">
                        {day.dayNumber}
                      </span>
                      Day {day.dayNumber} - {formatSriLankanDate(day.date, 'Scheduled Date')}
                    </h5>
                    {day.startingLocation?.address && (
                      <span className="text-xs text-slate-500">From: {day.startingLocation.address}</span>
                    )}
                  </div>

                  <div className="space-y-2 pl-4 border-l-2 border-slate-200 ml-3">
                    {/* Places to visit */}
                    {day.placesToVisit?.map((place: any, pIdx: number) => {
                      const isCurrentActive = target.stepType === "STOP" && target.dayIndex === dIdx && target.stopIndex === pIdx;
                      const hasCoords = isValidCoordinate(place.lat, place.lng);
                      const directUrl = hasCoords ? buildGoogleMapsNavigationUrl(place.lat, place.lng) : null;

                      return (
                        <div
                          key={pIdx}
                          className={`p-3 rounded-xl flex items-center justify-between text-xs transition-all ${
                            place.visited 
                              ? "bg-slate-50 text-slate-500 line-through" 
                              : isCurrentActive
                              ? "bg-blue-50 border border-blue-200 text-blue-900 font-bold"
                              : "bg-white border border-slate-200 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleProgressAction(place.visited ? "UNMARK_STOP_VISITED" : "MARK_STOP_VISITED", dIdx, pIdx)}
                              className="focus:outline-none hover:scale-110 transition-transform cursor-pointer"
                              title={place.visited ? "Mark unvisited" : "Mark visited"}
                            >
                              {place.visited ? (
                                <CheckCircle className="text-emerald-500" size={16} />
                              ) : (
                                <div className={`w-4 h-4 rounded-full border ${isCurrentActive ? "border-blue-600 bg-blue-100" : "border-slate-300"}`}></div>
                              )}
                            </button>
                            <span>
                              {place.name || `Stop ${pIdx + 1}`}
                              {place.activityTime && <span className="text-slate-400 font-normal ml-1">({place.activityTime})</span>}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrentActive && (
                              <span className="text-[10px] uppercase font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                Active Target
                              </span>
                            )}
                            {directUrl && (
                              <a
                                href={directUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                title="Open this stop in Google Maps"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Overnight */}
                    {day.overnightLocation && (day.overnightLocation.lat || day.overnightLocation.hotel || day.overnightLocation.city) && (
                      <div
                        className={`p-3 rounded-xl flex items-center justify-between text-xs ${
                          day.overnightLocation.visited
                            ? "bg-slate-50 text-slate-500 line-through"
                            : target.stepType === "OVERNIGHT" && target.dayIndex === dIdx
                            ? "bg-amber-50 border border-amber-200 text-amber-900 font-bold"
                            : "bg-amber-50/50 border border-amber-100 text-amber-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => handleProgressAction(day.overnightLocation.visited ? "UNMARK_OVERNIGHT_VISITED" : "MARK_OVERNIGHT_VISITED", dIdx)}
                            className="focus:outline-none hover:scale-110 transition-transform cursor-pointer"
                            title={day.overnightLocation.visited ? "Mark unvisited" : "Mark visited"}
                          >
                            {day.overnightLocation.visited ? (
                              <CheckCircle className="text-emerald-500" size={16} />
                            ) : (
                              <Bed className="text-amber-600" size={16} />
                            )}
                          </button>
                          <span>
                            Overnight: {day.overnightLocation.hotel || day.overnightLocation.city || "Overnight Stay"}
                          </span>
                        </div>

                        {isValidCoordinate(day.overnightLocation.lat, day.overnightLocation.lng) && (
                          <a
                            href={buildGoogleMapsNavigationUrl(day.overnightLocation.lat, day.overnightLocation.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-700 hover:text-amber-900 p-1 hover:bg-amber-100 rounded"
                            title="Open overnight location in Google Maps"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
