"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export interface RouteWaypoint {
  lat: number;
  lng: number;
  address: string;
  notes?: string;
}

export interface PickMeRoutePreviewMapProps {
  pickup: RouteWaypoint | null;
  destination: RouteWaypoint | null;
  intermediateStops?: RouteWaypoint[];
  routeGeometry?: [number, number][]; // [lat, lng][]
  height?: string;
  className?: string;
  interactive?: boolean;
}

// Marker icon generators using Leaflet DivIcon
function createPickupIcon() {
  return L.divIcon({
    className: "custom-pickup-marker",
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: #10B981;
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.45);
        color: white;
        font-weight: 700;
        font-size: 13px;
        transform: translate(-50%, -50%);
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [0, 0],
    popupAnchor: [0, -18],
  });
}

function createStopIcon(index: number) {
  return L.divIcon({
    className: "custom-stop-marker",
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: #F59E0B;
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 3px 8px rgba(245, 158, 11, 0.45);
        color: white;
        font-weight: 800;
        font-size: 12px;
        transform: translate(-50%, -50%);
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [0, 0],
    popupAnchor: [0, -16],
  });
}

function createDropoffIcon() {
  return L.divIcon({
    className: "custom-dropoff-marker",
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: #EF4444;
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 10px rgba(239, 68, 68, 0.45);
        color: white;
        font-weight: 700;
        font-size: 13px;
        transform: translate(-50%, -50%);
      ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [0, 0],
    popupAnchor: [0, -18],
  });
}

function MapAutoBounds({
  pickup,
  destination,
  intermediateStops = [],
  routeGeometry = [],
}: {
  pickup: RouteWaypoint | null;
  destination: RouteWaypoint | null;
  intermediateStops?: RouteWaypoint[];
  routeGeometry?: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    const handleInvalidate = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleInvalidate);
    window.addEventListener("lar:sidebar-toggle", handleInvalidate);

    const container = map.getContainer();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && container) {
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(container);
    }

    // Delayed invalidate for modal/accordion animations
    const timer = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      window.removeEventListener("resize", handleInvalidate);
      window.removeEventListener("lar:sidebar-toggle", handleInvalidate);
      if (ro) ro.disconnect();
      clearTimeout(timer);
    };
  }, [map]);

  useEffect(() => {
    // If we have polyline coordinates from OSRM, fit to polyline
    if (routeGeometry && routeGeometry.length > 1) {
      const bounds = L.latLngBounds(routeGeometry);
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
      return;
    }

    // Otherwise fit to all active waypoints
    const points: [number, number][] = [];
    if (pickup?.lat && pickup?.lng) points.push([pickup.lat, pickup.lng]);
    for (const stop of intermediateStops) {
      if (stop?.lat && stop?.lng) points.push([stop.lat, stop.lng]);
    }
    if (destination?.lat && destination?.lng) points.push([destination.lat, destination.lng]);

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [pickup, destination, intermediateStops, routeGeometry, map]);

  return null;
}

export default function PickMeRoutePreviewMap({
  pickup,
  destination,
  intermediateStops = [],
  routeGeometry = [],
  height = "260px",
  className = "",
  interactive = true,
}: PickMeRoutePreviewMapProps) {
  const pickupIcon = useMemo(() => createPickupIcon(), []);
  const dropoffIcon = useMemo(() => createDropoffIcon(), []);
  const stopIcons = useMemo(
    () => intermediateStops.map((_, i) => createStopIcon(i)),
    [intermediateStops.length]
  );

  const defaultCenter: [number, number] = pickup?.lat
    ? [pickup.lat, pickup.lng]
    : [6.9271, 79.8612]; // Colombo default

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-gray-200 shadow-sm ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        attributionControl={false}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Pickup Marker */}
        {pickup?.lat && pickup?.lng && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-xs font-sans">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 mb-1">
                  PICKUP
                </span>
                <p className="font-semibold text-gray-900">{pickup.address || "Pickup Location"}</p>
                {pickup.notes && <p className="text-gray-500 italic mt-0.5">Note: {pickup.notes}</p>}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Intermediate Stop Markers */}
        {intermediateStops.map((stop, idx) => {
          if (!stop?.lat || !stop?.lng) return null;
          return (
            <Marker
              key={`stop-${idx}`}
              position={[stop.lat, stop.lng]}
              icon={stopIcons[idx] || createStopIcon(idx)}
            >
              <Popup>
                <div className="text-xs font-sans">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mb-1">
                    STOP {idx + 1}
                  </span>
                  <p className="font-semibold text-gray-900">{stop.address || `Stop ${idx + 1}`}</p>
                  {stop.notes && <p className="text-gray-500 italic mt-0.5">Note: {stop.notes}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Dropoff Marker */}
        {destination?.lat && destination?.lng && (
          <Marker position={[destination.lat, destination.lng]} icon={dropoffIcon}>
            <Popup>
              <div className="text-xs font-sans">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 mb-1">
                  DROP-OFF
                </span>
                <p className="font-semibold text-gray-900">{destination.address || "Final Destination"}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Road Following Polyline */}
        {routeGeometry && routeGeometry.length > 1 && (
          <Polyline
            positions={routeGeometry}
            pathOptions={{
              color: "#2563EB",
              weight: 5,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        <MapAutoBounds
          pickup={pickup}
          destination={destination}
          intermediateStops={intermediateStops}
          routeGeometry={routeGeometry}
        />
      </MapContainer>

      {/* Floating map legend badge */}
      <div className="absolute top-2.5 right-2.5 z-10 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-200/80 shadow-xs flex items-center gap-2 text-[11px] font-medium text-gray-700">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          Pickup
        </span>
        {intermediateStops.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            {intermediateStops.length} {intermediateStops.length === 1 ? "Stop" : "Stops"}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
          Drop-off
        </span>
      </div>
    </div>
  );
}
