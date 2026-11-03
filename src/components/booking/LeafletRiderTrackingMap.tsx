"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { 
  Clock, 
  Navigation, 
  MapPin, 
  Car, 
  Compass, 
  AlertCircle, 
  Maximize2, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  WifiOff
} from "lucide-react";
import { isValidCoordinate } from "@/lib/navigation";

// Fix Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom Icons
const driverCarIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [28, 46],
  iconAnchor: [14, 46],
  popupAnchor: [1, -40],
  shadowSize: [41, 41]
});

const pickupMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dropoffMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const stopMarkerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export interface RiderTrackingMapProps {
  status: string;
  driverLat?: number;
  driverLng?: number;
  driverLocationUpdatedAt?: string;
  driverName?: string;
  vehicleRegistration?: string;
  vehicleModel?: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  dropoffAddress?: string;
  itineraryLocations?: { lat: number; lng: number; name: string; visited?: boolean }[];
  customTripDetails?: any;
  followDriver?: boolean;
  onFollowDriverChange?: (follow: boolean) => void;
  onRouteStatsChange?: (stats: {
    stageLabel: string;
    distanceKm?: number;
    durationMins?: number;
    nextTargetName?: string;
    isRoutingAvailable: boolean;
    isStale: boolean;
  }) => void;
}

// Great circle / Haversine distance in meters to prevent unnecessary route recalculations
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map Controller for view centering, bounds fitting, and resize invalidation
function MapController({
  driverLat,
  driverLng,
  followDriver,
  fitTrigger,
  boundsPoints,
}: {
  driverLat?: number;
  driverLng?: number;
  followDriver: boolean;
  fitTrigger: number;
  boundsPoints: [number, number][];
}) {
  const map = useMap();

  // Invalidate map size on window/container resize or sidebar toggle
  useEffect(() => {
    const handleInvalidate = () => map.invalidateSize();
    window.addEventListener("resize", handleInvalidate);
    window.addEventListener("lar:sidebar-toggle", handleInvalidate);

    let resizeObserver: ResizeObserver | null = null;
    const container = map.getContainer();
    if (typeof ResizeObserver !== "undefined" && container) {
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener("resize", handleInvalidate);
      window.removeEventListener("lar:sidebar-toggle", handleInvalidate);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [map]);

  // Handle follow driver view panning
  useEffect(() => {
    if (followDriver && driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng)) {
      map.panTo([driverLat, driverLng], { animate: true, duration: 1 });
    }
  }, [followDriver, driverLat, driverLng, map]);

  // Handle Fit Route trigger
  useEffect(() => {
    if (fitTrigger > 0 && boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [fitTrigger, boundsPoints, map]);

  return null;
}

export default function LeafletRiderTrackingMap({
  status,
  driverLat,
  driverLng,
  driverLocationUpdatedAt,
  driverName,
  vehicleRegistration,
  vehicleModel,
  pickupLat,
  pickupLng,
  pickupAddress,
  dropoffLat,
  dropoffLng,
  dropoffAddress,
  itineraryLocations,
  customTripDetails,
  followDriver: externalFollowDriver,
  onFollowDriverChange,
  onRouteStatsChange,
}: RiderTrackingMapProps) {
  const [internalFollowDriver, setInternalFollowDriver] = useState(false);
  const followDriver = externalFollowDriver !== undefined ? externalFollowDriver : internalFollowDriver;

  const setFollowDriver = (val: boolean) => {
    setInternalFollowDriver(val);
    onFollowDriverChange?.(val);
  };

  const [fitTrigger, setFitTrigger] = useState(1);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdateText, setLastUpdateText] = useState("");
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | undefined>(undefined);
  const [routeDurationMins, setRouteDurationMins] = useState<number | undefined>(undefined);
  const [isRoutingAvailable, setIsRoutingAvailable] = useState<boolean>(true);
  const [routingError, setRoutingError] = useState<string | null>(null);

  // Stabilize callback and state emission to completely prevent infinite render loops
  const onRouteStatsChangeRef = useRef(onRouteStatsChange);
  useEffect(() => {
    onRouteStatsChangeRef.current = onRouteStatsChange;
  });

  const lastEmittedStatsRef = useRef<{
    stageLabel: string;
    distanceKm?: number;
    durationMins?: number;
    nextTargetName?: string;
    isRoutingAvailable: boolean;
    isStale: boolean;
  } | null>(null);

  // Stored state for smart recalculation
  const lastCalculatedLocation = useRef<{ lat: number; lng: number } | null>(null);
  const lastTargetKey = useRef<string>("");
  const isFetchingRoute = useRef(false);

  // Stage determination:
  // Stage 1 (Before pickup): DRIVER_ASSIGNED, DRIVER_EN_ROUTE, DRIVER_ARRIVED
  // Stage 2 (Trip in progress): PASSENGER_PICKED_UP, TRIP_IN_PROGRESS
  // Stage 3: COMPLETED, CANCELLED
  const isTripFinished = ["COMPLETED", "CANCELLED", "REFUNDED"].includes(status);
  const isPickedUp = ["PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"].includes(status);
  const isDriverAssigned = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"].includes(status);

  const stageLabel = isTripFinished
    ? status === "COMPLETED"
      ? "Trip Completed"
      : `Trip ${status}`
    : isPickedUp
    ? "Trip in progress"
    : isDriverAssigned
    ? "Driver coming to pick you up"
    : "Trip Scheduled";

  // Resolve target waypoint(s) for road routing
  // Before pickup: target is Pickup
  // After pickup: target is Dropoff (or for custom trips: next uncompleted stop, followed by remaining stops)
  const isCustomTrip = Boolean(
    customTripDetails?.isCustomTrip &&
    Array.isArray(customTripDetails?.itinerary) &&
    customTripDetails.itinerary.length > 0
  );

  const { nextTargetName, targetWaypoints } = useMemo(() => {
    if (!isPickedUp) {
      // Stage 1: Route to pickup
      return {
        nextTargetName: pickupAddress || "Passenger Pickup",
        targetWaypoints: isValidCoordinate(pickupLat, pickupLng) ? [{ lat: pickupLat, lng: pickupLng, name: pickupAddress || "Pickup" }] : [],
      };
    }

    if (isCustomTrip) {
      // Stage 2: Custom tour: collect all uncompleted places in order
      const waypoints: { lat: number; lng: number; name: string }[] = [];
      let foundNextName = "";

      for (const day of customTripDetails.itinerary) {
        if (Array.isArray(day.placesToVisit)) {
          for (const place of day.placesToVisit) {
            if (!place.visited && isValidCoordinate(place.lat, place.lng)) {
              if (!foundNextName) foundNextName = place.name || `Day ${day.dayNumber} Stop`;
              waypoints.push({ lat: place.lat, lng: place.lng, name: place.name || "Stop" });
            }
          }
        }

        const overnight = day.overnightLocation;
        if (overnight && !overnight.visited && isValidCoordinate(overnight.lat, overnight.lng)) {
          const hotelName = overnight.hotel || overnight.city || `Day ${day.dayNumber} Hotel`;
          if (!foundNextName) foundNextName = hotelName;
          waypoints.push({ lat: overnight.lat, lng: overnight.lng, name: hotelName });
        }
      }

      // Final dropoff if specified
      const dropoffLoc = customTripDetails.dropoffLocation;
      const finalDropLat = dropoffLoc?.lat || dropoffLat;
      const finalDropLng = dropoffLoc?.lng || dropoffLng;
      const finalDropName = dropoffLoc?.address || dropoffAddress || "Final Destination";
      if (!dropoffLoc?.visited && isValidCoordinate(finalDropLat, finalDropLng)) {
        if (!foundNextName) foundNextName = finalDropName;
        waypoints.push({ lat: finalDropLat!, lng: finalDropLng!, name: finalDropName });
      }

      return {
        nextTargetName: foundNextName || finalDropName,
        targetWaypoints: waypoints,
      };
    }

    // Standard transfer: Stage 2 destination is dropoff
    const validDrop = isValidCoordinate(dropoffLat, dropoffLng);
    return {
      nextTargetName: dropoffAddress || "Drop-off Destination",
      targetWaypoints: validDrop ? [{ lat: dropoffLat!, lng: dropoffLng!, name: dropoffAddress || "Drop-off" }] : [],
    };
  }, [isPickedUp, isCustomTrip, pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress, customTripDetails]);

  // Check staleness of location
  useEffect(() => {
    if (!driverLocationUpdatedAt || isTripFinished) {
      setIsStale(false);
      setLastUpdateText("");
      return;
    }

    const checkStaleness = () => {
      const updatedDate = new Date(driverLocationUpdatedAt);
      const diffSecs = Math.floor((Date.now() - updatedDate.getTime()) / 1000);

      if (diffSecs > 30) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
      setLastUpdateText(updatedDate.toLocaleTimeString());
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 5000);
    return () => clearInterval(interval);
  }, [driverLocationUpdatedAt, isTripFinished]);

  // Smart road route calculation (OSRM):
  // Recalculate ONLY on:
  // 1. Initial load
  // 2. Destination change (e.g. pickup confirmed or stop completed)
  // 3. Meaningful driver movement (>= 150 meters from last calculation point)
  useEffect(() => {
    if (isTripFinished) {
      setRouteCoordinates([]);
      setRouteDistanceKm(undefined);
      setRouteDurationMins(undefined);
      return;
    }

    if (!isValidCoordinate(driverLat, driverLng) || targetWaypoints.length === 0) {
      return;
    }

    const currentKey = `${targetWaypoints.map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join("|")}`;
    const destinationChanged = currentKey !== lastTargetKey.current;

    let shouldRecalculate = false;

    if (!lastCalculatedLocation.current || destinationChanged) {
      shouldRecalculate = true;
    } else {
      const movedMeters = haversineMeters(
        driverLat!,
        driverLng!,
        lastCalculatedLocation.current.lat,
        lastCalculatedLocation.current.lng
      );
      // Only recalculate if driver moved >= 150 meters
      if (movedMeters >= 150) {
        shouldRecalculate = true;
      }
    }

    if (!shouldRecalculate || isFetchingRoute.current) return;

    isFetchingRoute.current = true;
    lastTargetKey.current = currentKey;

    const allWaypoints = [{ lat: driverLat!, lng: driverLng! }, ...targetWaypoints.map((w) => ({ lat: w.lat, lng: w.lng }))];

    fetch("/api/calculate-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints: allWaypoints }),
    })
      .then((res) => res.json())
      .then((data) => {
        isFetchingRoute.current = false;
        if (data.status === "ok" && Array.isArray(data.coordinates)) {
          setRouteCoordinates(data.coordinates);
          setRouteDistanceKm(data.distanceKm);
          setRouteDurationMins(data.durationMins);
          setIsRoutingAvailable(true);
          setRoutingError(null);
          lastCalculatedLocation.current = { lat: driverLat!, lng: driverLng! };

        } else {
          // Routing unavailable - do NOT fall back to straight line
          setRouteCoordinates([]);
          setRouteDistanceKm(undefined);
          setRouteDurationMins(undefined);
          setIsRoutingAvailable(false);
          setRoutingError(data.error || "Road routing is temporarily unavailable");
        }
      })
      .catch((err) => {
        isFetchingRoute.current = false;
        setRouteCoordinates([]);
        setIsRoutingAvailable(false);
        setRoutingError(err.message || "Failed to load road route");
      });
  }, [driverLat, driverLng, targetWaypoints, isTripFinished]);

  // Centralized route statistics dispatcher:
  // Dispatches to parent only when primitive values change
  useEffect(() => {
    const prev = lastEmittedStatsRef.current;
    const hasChanged =
      !prev ||
      prev.stageLabel !== stageLabel ||
      prev.distanceKm !== routeDistanceKm ||
      prev.durationMins !== routeDurationMins ||
      prev.nextTargetName !== nextTargetName ||
      prev.isRoutingAvailable !== isRoutingAvailable ||
      prev.isStale !== isStale;

    if (hasChanged) {
      const next = {
        stageLabel,
        distanceKm: routeDistanceKm,
        durationMins: routeDurationMins,
        nextTargetName,
        isRoutingAvailable,
        isStale,
      };
      lastEmittedStatsRef.current = next;
      onRouteStatsChangeRef.current?.(next);
    }
  }, [stageLabel, routeDistanceKm, routeDurationMins, nextTargetName, isRoutingAvailable, isStale]);

  // Points to include in map bounds fitting
  const boundsPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (isValidCoordinate(driverLat, driverLng)) {
      pts.push([driverLat!, driverLng!]);
    }
    if (isValidCoordinate(pickupLat, pickupLng)) {
      pts.push([pickupLat, pickupLng]);
    }
    if (isValidCoordinate(dropoffLat, dropoffLng)) {
      pts.push([dropoffLat!, dropoffLng!]);
    }
    for (const tw of targetWaypoints) {
      pts.push([tw.lat, tw.lng]);
    }
    // Include route coordinates if available
    for (let i = 0; i < routeCoordinates.length; i += Math.max(1, Math.floor(routeCoordinates.length / 20))) {
      pts.push(routeCoordinates[i]);
    }
    return pts;
  }, [driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, targetWaypoints, routeCoordinates]);

  const defaultCenter: [number, number] = isValidCoordinate(driverLat, driverLng)
    ? [driverLat!, driverLng!]
    : isValidCoordinate(pickupLat, pickupLng)
    ? [pickupLat, pickupLng]
    : [7.8731, 80.7718];

  return (
    <div className="relative w-full h-full flex flex-col select-none overflow-hidden rounded-3xl">
      {/* 1. Status & Stage Header Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Stage Pill */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-lg border border-slate-700/80 text-xs font-bold">
          <span className="relative flex h-3 w-3">
            {!isTripFinished && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPickedUp ? "bg-purple-400" : "bg-blue-400"
              }`} />
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              isTripFinished ? "bg-emerald-500" : isPickedUp ? "bg-purple-500" : "bg-blue-500"
            }`} />
          </span>
          <span className="uppercase tracking-wider">{stageLabel}</span>
        </div>

        {/* Live GPS / Staleness / Finished Badge */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isTripFinished ? (
            <div className="bg-slate-100 text-slate-700 px-3.5 py-1.5 rounded-full shadow-md text-xs font-bold border border-slate-300 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Trip Finished • Tracking Ended</span>
            </div>
          ) : !driverLat || !driverLng ? (
            <div className="bg-amber-500 text-slate-950 px-3.5 py-1.5 rounded-full shadow-md text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <Clock size={14} />
              <span>Awaiting driver GPS...</span>
            </div>
          ) : isStale ? (
            <div className="bg-amber-100 text-amber-900 border border-amber-300 px-3.5 py-1.5 rounded-full shadow-md text-xs font-bold flex items-center gap-1.5">
              <Clock size={14} className="text-amber-600" />
              <span>Last update: {lastUpdateText}</span>
            </div>
          ) : (
            <div className="bg-emerald-500 text-white px-3.5 py-1.5 rounded-full shadow-md text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Live GPS Active</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Routing Stats Banner (When distance/time is available) */}
      {!isTripFinished && (routeDistanceKm !== undefined || !isRoutingAvailable) && (
        <div className="absolute top-16 left-4 z-20 pointer-events-auto max-w-sm bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-1.5 animate-in fade-in">
          {isRoutingAvailable && routeDistanceKm !== undefined ? (
            <>
              <div className="flex items-center justify-between gap-3 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <span>{isPickedUp ? "Next Destination" : "Pickup Arrival"}</span>
                <span className="text-blue-600 font-extrabold">{routeDistanceKm} km road distance</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-slate-900">
                  ~{routeDurationMins} min{routeDurationMins === 1 ? "" : "s"}
                </span>
                <span className="text-slate-600 font-medium truncate" title={nextTargetName}>
                  to {nextTargetName}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2 text-amber-800">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Road route unavailable</span>
                <span className="text-[11px] text-amber-700">Displaying live GPS marker location.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Floating Map Controls (Follow Driver & Fit Route) */}
      <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
        {/* Follow Driver Button */}
        <button
          type="button"
          onClick={() => setFollowDriver(!followDriver)}
          className={`px-3.5 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            followDriver
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400"
              : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200"
          }`}
          title={followDriver ? "Disable follow driver auto-pan" : "Auto-pan to follow driver marker"}
        >
          <Compass size={16} className={followDriver ? "animate-spin" : ""} />
          <span>{followDriver ? "Following Driver" : "Follow Driver"}</span>
        </button>

        {/* Fit Route Button */}
        <button
          type="button"
          onClick={() => {
            setFollowDriver(false);
            setFitTrigger((t) => t + 1);
          }}
          className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          title="Fit entire route and markers into view"
        >
          <Maximize2 size={15} />
          <span>Fit Route</span>
        </button>
      </div>

      {/* 4. Main Leaflet Map View */}
      <div className="w-full h-full min-h-[380px] sm:min-h-[460px] relative z-0">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={{ height: "100%", width: "100%", zIndex: 1 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            driverLat={driverLat}
            driverLng={driverLng}
            followDriver={followDriver}
            fitTrigger={fitTrigger}
            boundsPoints={boundsPoints}
          />

          {/* Pickup Marker */}
          {isValidCoordinate(pickupLat, pickupLng) && (
            <Marker position={[pickupLat, pickupLng]} icon={pickupMarkerIcon}>
              <Popup>
                <div className="text-xs">
                  <p className="font-extrabold text-blue-700 uppercase">Pickup Location</p>
                  <p className="font-semibold text-slate-800">{pickupAddress || "Pickup Point"}</p>
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                Pickup: {pickupAddress?.split(",")[0] || "Pickup Point"}
              </Tooltip>
            </Marker>
          )}

          {/* Dropoff Marker */}
          {isValidCoordinate(dropoffLat, dropoffLng) && (
            <Marker position={[dropoffLat!, dropoffLng!]} icon={dropoffMarkerIcon}>
              <Popup>
                <div className="text-xs">
                  <p className="font-extrabold text-rose-700 uppercase">Drop-off Destination</p>
                  <p className="font-semibold text-slate-800">{dropoffAddress || "Drop-off Point"}</p>
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                Drop-off: {dropoffAddress?.split(",")[0] || "Destination"}
              </Tooltip>
            </Marker>
          )}

          {/* Intermediate Custom Itinerary Stops */}
          {targetWaypoints.map((pt, idx) => {
            if (pt.lat === pickupLat && pt.lng === pickupLng) return null;
            if (pt.lat === dropoffLat && pt.lng === dropoffLng) return null;
            return (
              <Marker key={`stop-${idx}`} position={[pt.lat, pt.lng]} icon={stopMarkerIcon}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-extrabold text-purple-700 uppercase">Tour Stop</p>
                    <p className="font-semibold text-slate-800">{pt.name}</p>
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                  {pt.name}
                </Tooltip>
              </Marker>
            );
          })}

          {/* Live Driver Marker */}
          {!isTripFinished && isValidCoordinate(driverLat, driverLng) && (
            <Marker position={[driverLat!, driverLng!]} icon={driverCarIcon}>
              <Popup>
                <div className="text-xs space-y-1">
                  <p className="font-extrabold text-emerald-700 uppercase flex items-center gap-1">
                    <Car size={13} />
                    <span>Your Driver: {driverName || "Assigned Driver"}</span>
                  </p>
                  {vehicleRegistration && (
                    <p className="font-mono font-bold text-slate-700 bg-slate-100 px-1 rounded w-fit">
                      {vehicleRegistration} {vehicleModel ? `• ${vehicleModel}` : ""}
                    </p>
                  )}
                  {driverLocationUpdatedAt && (
                    <p className="text-[10px] text-slate-500">
                      Updated at {new Date(driverLocationUpdatedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </Popup>
              <Tooltip direction="bottom" offset={[0, 10]} permanent opacity={0.95}>
                <span className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  {driverName ? driverName.split(" ")[0] : "Driver"} ({vehicleRegistration || "Assigned"})
                </span>
              </Tooltip>
            </Marker>
          )}

          {/* Road Route Polyline (Following actual roads) */}
          {!isTripFinished && routeCoordinates.length > 1 && (
            <Polyline
              positions={routeCoordinates}
              color={isPickedUp ? "#7C3AED" : "#2563EB"}
              weight={5}
              opacity={0.85}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
