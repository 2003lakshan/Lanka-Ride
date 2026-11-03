"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { 
  Navigation, 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  Lock,
  Radio
} from "lucide-react";
import { useDriverTracking } from "@/components/providers/DriverTrackingProvider";

// Fix Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface DriverMapProps {
  bookingId: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  pickupName: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffName: string;
  activeTargetLat?: number;
  activeTargetLng?: number;
  activeTargetName?: string;
}

function MapUpdater({ driverLoc, destLat, destLng }: { driverLoc: any; destLat: number; destLng: number }) {
  const map = useMap();

  useEffect(() => {
    const handleInvalidate = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleInvalidate);
    window.addEventListener("lar:sidebar-toggle", handleInvalidate);

    let resizeObserver: ResizeObserver | null = null;
    const container = map.getContainer();
    if (typeof ResizeObserver !== "undefined" && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener("resize", handleInvalidate);
      window.removeEventListener("lar:sidebar-toggle", handleInvalidate);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (destLat && destLng) {
      const bounds = L.latLngBounds([[destLat, destLng]]);
      if (driverLoc) bounds.extend([driverLoc.lat, driverLoc.lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [driverLoc, destLat, destLng, map]);
  return null;
}

export default function LeafletDriverMap({ 
  bookingId,
  status, 
  pickupLat, 
  pickupLng, 
  pickupName, 
  dropoffLat, 
  dropoffLng,
  dropoffName,
  activeTargetLat,
  activeTargetLng,
  activeTargetName
}: DriverMapProps) {
  const {
    trackingStatus,
    statusText,
    driverLoc,
    lastSuccessfulUpload,
    isBackgrounded,
    permissionError,
    setActiveBooking,
    requestLocationPermission,
    retryTracking,
  } = useDriverTracking();

  const isTripInProgress = status === "TRIP_IN_PROGRESS" || status === "PASSENGER_PICKED_UP";
  const isTripFinished = ["COMPLETED", "CANCELLED", "REFUNDED"].includes(status);

  // Sync active booking to shared tracking provider
  useEffect(() => {
    if (!isTripFinished) {
      setActiveBooking({
        _id: bookingId,
        status,
        pickupLat,
        pickupLng,
        destinationLat: dropoffLat,
        destinationLng: dropoffLng,
      });
    }
  }, [bookingId, status, pickupLat, pickupLng, dropoffLat, dropoffLng, isTripFinished, setActiveBooking]);

  const activeDestLat = (activeTargetLat && !isNaN(activeTargetLat) && activeTargetLat !== 0)
    ? activeTargetLat
    : (isTripInProgress ? dropoffLat : pickupLat);

  const activeDestLng = (activeTargetLng && !isNaN(activeTargetLng) && activeTargetLng !== 0)
    ? activeTargetLng
    : (isTripInProgress ? dropoffLng : pickupLng);

  const activeDestName = activeTargetName || (isTripInProgress ? (dropoffName || "Drop-off") : (pickupName || "Pickup"));

  const positions: [number, number][] = [];
  if (driverLoc) positions.push([driverLoc.lat, driverLoc.lng]);
  if (activeDestLat && activeDestLng) positions.push([activeDestLat, activeDestLng]);

  // Format last upload time
  const lastUpdateTimeStr = lastSuccessfulUpload
    ? new Date(lastSuccessfulUpload.timestamp).toLocaleTimeString()
    : null;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Background Warning Banner */}
      {isBackgrounded && !isTripFinished && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0 animate-bounce" />
          <span>Browser is backgrounded. Mobile OS may suspend GPS updates. Please keep this tab active and visible.</span>
        </div>
      )}

      {/* Insecure Context Error Banner */}
      {trackingStatus === "INSECURE_CONTEXT" && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center gap-2">
          <Lock size={16} className="shrink-0" />
          <span>GPS sharing requires a secure context (HTTPS or localhost). Geolocation is disabled on unencrypted HTTP.</span>
        </div>
      )}

      {/* Permission Error Banner */}
      {permissionError && trackingStatus === "PERMISSION_BLOCKED" && (
        <div className="bg-rose-600 text-white px-4 py-3 text-xs font-medium space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert size={16} className="shrink-0" />
            <span>GPS Permission Blocked</span>
          </div>
          <p className="text-rose-100">
            Location access was blocked in your browser settings. To share your location with the assigned rider and admin:
          </p>
          <ol className="list-decimal list-inside text-rose-100 space-y-0.5 pt-1 pl-1">
            <li>Tap the lock / site settings icon in your browser address bar.</li>
            <li>Select <strong>Permissions</strong> or <strong>Site Settings</strong>.</li>
            <li>Change <strong>Location</strong> to <strong>Allow</strong>.</li>
            <li>Tap the <strong>Retry Location</strong> button below.</li>
          </ol>
        </div>
      )}

      {/* Explanation Banner when Permission is required */}
      {trackingStatus === "PERMISSION_REQUIRED" && !isTripFinished && (
        <div className="bg-blue-600 text-white px-4 py-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <Navigation size={16} className="shrink-0" />
              <span>Location Sharing Required for Active Trip</span>
            </div>
            <p className="text-blue-100 text-xs">
              Your real-time GPS position will be shared only with the assigned rider and admin during this active trip to coordinate pickup and ensure safety.
            </p>
          </div>
          <button
            type="button"
            onClick={requestLocationPermission}
            className="bg-white hover:bg-blue-50 text-blue-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Navigation size={14} />
            <span>Enable Location</span>
          </button>
        </div>
      )}

      {/* Interactive Map */}
      <div className="w-full h-64 sm:h-80 relative bg-slate-100 z-0">
        <MapContainer 
          center={[activeDestLat || 7.8731, activeDestLng || 80.7718]} 
          zoom={14} 
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {activeDestLat && activeDestLng && (
            <Marker position={[activeDestLat, activeDestLng]} />
          )}
          {driverLoc && <Marker position={[driverLoc.lat, driverLoc.lng]} icon={driverIcon} />}
          {driverLoc && positions.length > 1 && (
            <Polyline positions={positions} color={isTripInProgress ? "#8B5CF6" : "#2563EB"} weight={4} dashArray="5, 10" />
          )}
          {activeDestLat && activeDestLng && (
            <MapUpdater driverLoc={driverLoc} destLat={activeDestLat} destLng={activeDestLng} />
          )}
        </MapContainer>
      </div>
      
      {/* Dynamic Status Section (Replaces manual Share GPS button) */}
      <div className="p-6 bg-slate-900 text-white relative z-10 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span>Route to {activeDestName}</span>
            </h3>
            
            <p className="text-slate-400 text-xs flex items-center gap-1.5">
              <span>{statusText}</span>
              {lastUpdateTimeStr && trackingStatus === "LIVE" && (
                <span className="text-slate-400 font-normal">
                  • Last uploaded: <strong className="text-slate-200">{lastUpdateTimeStr}</strong>
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Live Location Sharing Badge */}
            {trackingStatus === "LIVE" && !isTripFinished && (
              <div className="flex items-center gap-2 bg-emerald-950 text-emerald-400 border border-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>Live Location Sharing</span>
                {lastSuccessfulUpload && (
                  <span className="text-emerald-300 font-normal text-[11px]">
                    (±{Math.round(lastSuccessfulUpload.accuracy)}m)
                  </span>
                )}
              </div>
            )}

            {/* Starting GPS State */}
            {trackingStatus === "STARTING_GPS" && !isTripFinished && (
              <div className="flex items-center gap-2 bg-amber-950 text-amber-300 border border-amber-800 px-3.5 py-2 rounded-xl text-xs font-bold">
                <Loader2 size={14} className="animate-spin text-amber-400" />
                <span>Starting GPS...</span>
              </div>
            )}

            {/* Permission Blocked State */}
            {trackingStatus === "PERMISSION_BLOCKED" && !isTripFinished && (
              <button
                type="button"
                onClick={retryTracking}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors text-xs cursor-pointer shadow"
              >
                <RefreshCw size={14} />
                <span>Retry Location</span>
              </button>
            )}

            {/* Permission Prompt State */}
            {trackingStatus === "PERMISSION_REQUIRED" && !isTripFinished && (
              <button
                type="button"
                onClick={requestLocationPermission}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors text-xs cursor-pointer shadow"
              >
                <Navigation size={14} />
                <span>Enable Location</span>
              </button>
            )}

            {/* Location Unavailable State */}
            {trackingStatus === "LOCATION_UNAVAILABLE" && !isTripFinished && (
              <button
                type="button"
                onClick={retryTracking}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors text-xs cursor-pointer shadow"
              >
                <RefreshCw size={14} />
                <span>Retry GPS</span>
              </button>
            )}

            {/* Connection Lost State */}
            {trackingStatus === "CONNECTION_LOST" && !isTripFinished && (
              <div className="flex items-center gap-2 bg-amber-950 text-amber-300 border border-amber-800 px-3.5 py-2 rounded-xl text-xs font-bold">
                <Radio size={14} className="animate-pulse text-amber-400" />
                <span>Connection Lost (Reconnecting...)</span>
              </div>
            )}

            {/* Trip Completed State */}
            {isTripFinished && (
              <div className="flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Trip Completed • Location Sharing Closed</span>
              </div>
            )}
          </div>
        </div>

        {/* Browser limitation transparency notice */}
        <div className="pt-2.5 border-t border-slate-800 flex items-start gap-2 text-[11px] text-slate-400">
          <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Driver Notice:</strong> Web browsers do not guarantee continuous 3-second background location tracking when the screen is turned off or another app is in the foreground. Keep this app visible during your trip for continuous GPS updates.
          </span>
        </div>
      </div>
    </div>
  );
}
