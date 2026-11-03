"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface LeafletOfferInnerMapProps {
  driverLocation?: { lat: number; lng: number };
  pickupLocation: LocationPoint;
  intermediateStops?: LocationPoint[];
  destinationLocation?: LocationPoint;
}

export default function LeafletOfferInnerMap({
  driverLocation,
  pickupLocation,
  intermediateStops = [],
  destinationLocation,
}: LeafletOfferInnerMapProps) {
  const [roadCoordinates, setRoadCoordinates] = useState<[number, number][]>([]);

  const isValid = (lat?: number, lng?: number) =>
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat !== 0 &&
    lng !== 0;

  // Collect waypoints in order: pickup -> stops -> destination
  const journeyWaypoints: { lat: number; lng: number }[] = [];
  if (pickupLocation && isValid(pickupLocation.lat, pickupLocation.lng)) {
    journeyWaypoints.push({ lat: pickupLocation.lat, lng: pickupLocation.lng });
  }
  intermediateStops.forEach((s) => {
    if (isValid(s.lat, s.lng)) journeyWaypoints.push({ lat: s.lat, lng: s.lng });
  });
  if (destinationLocation && isValid(destinationLocation.lat, destinationLocation.lng)) {
    journeyWaypoints.push({ lat: destinationLocation.lat, lng: destinationLocation.lng });
  }

  // Fetch actual road geometry from server to draw road-following curve along Galle Road
  useEffect(() => {
    if (journeyWaypoints.length < 2) return;

    let cancelled = false;
    fetch("/api/calculate-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints: journeyWaypoints }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.coordinates && Array.isArray(data.coordinates) && data.coordinates.length > 1) {
          setRoadCoordinates(data.coordinates);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    pickupLocation?.lat,
    pickupLocation?.lng,
    destinationLocation?.lat,
    destinationLocation?.lng,
    intermediateStops.length,
  ]);

  // Collect all valid points for fitting map bounds
  const allPoints: [number, number][] = [];
  if (driverLocation && isValid(driverLocation.lat, driverLocation.lng)) {
    allPoints.push([driverLocation.lat, driverLocation.lng]);
  }
  journeyWaypoints.forEach((pt) => allPoints.push([pt.lat, pt.lng]));

  // Create crisp CSS DivIcons matching the screenshot
  const createPinIcon = (pinColor: string, label: string) => {
    return L.divIcon({
      className: "offer-map-div-pin",
      html: `<div style="display: flex; align-items: center; gap: 4px; pointer-events: none;">
        <div style="background-color: ${pinColor}; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4); shrink: 0;"></div>
        <div style="background: white; padding: 2px 6px; border-radius: 6px; font-weight: 800; font-size: 10px; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.25); white-space: nowrap; border: 1px solid #e2e8f0;">${label}</div>
      </div>`,
      iconSize: [120, 24],
      iconAnchor: [8, 12],
    });
  };

  const createDotIcon = (color: string) => {
    return L.divIcon({
      className: "offer-map-dot-icon",
      html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  };

  const driverIcon = L.divIcon({
    className: "offer-map-driver-icon",
    html: `<div style="background-color: #2563eb; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">🚗</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  const pickupIcon = createPinIcon("#10b981", pickupLocation?.name || "Colombo Fort");
  const stopIcon = (idx: number) => createDotIcon("#f59e0b");
  const dropoffIcon = createPinIcon("#ef4444", destinationLocation?.name || "Mount Lavinia");

  // Bounds adjuster component
  function BoundsFitter({ pts }: { pts: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
      if (pts.length === 1) {
        map.setView(pts[0], 13);
      } else if (pts.length > 1) {
        try {
          const bounds = L.latLngBounds(pts);
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
        } catch {}
      }
      map.invalidateSize();
    }, [map, pts]);
    return null;
  }

  const center: [number, number] = allPoints[0] || [6.9271, 79.8612];

  // Polyline coordinates: use high-resolution road coordinates if available, otherwise straight lines
  const journeyPolyline: [number, number][] =
    roadCoordinates.length > 1
      ? roadCoordinates
      : journeyWaypoints.map((pt) => [pt.lat, pt.lng]);

  // Driver to pickup connector
  const driverToPickupPolyline: [number, number][] = [];
  if (
    driverLocation &&
    isValid(driverLocation.lat, driverLocation.lng) &&
    pickupLocation &&
    isValid(pickupLocation.lat, pickupLocation.lng)
  ) {
    driverToPickupPolyline.push([driverLocation.lat, driverLocation.lng]);
    driverToPickupPolyline.push([pickupLocation.lat, pickupLocation.lng]);
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden relative z-0"
      style={{ height: "115px", minHeight: "115px" }}
    >
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        {/* OpenStreetMap Tile Layer (no API key required, crisp and clean) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <BoundsFitter pts={allPoints} />

        {/* Driver location */}
        {driverLocation && isValid(driverLocation.lat, driverLocation.lng) && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
        )}

        {/* Driver to pickup dotted route line */}
        {driverToPickupPolyline.length === 2 && (
          <Polyline
            positions={driverToPickupPolyline}
            pathOptions={{ color: "#3b82f6", weight: 3, dashArray: "4, 6", opacity: 0.8 }}
          />
        )}

        {/* Passenger journey route polyline - Vibrant Blue road-following route matching screenshot */}
        {journeyPolyline.length >= 2 && (
          <Polyline
            positions={journeyPolyline}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {/* Pickup marker with label */}
        {pickupLocation && isValid(pickupLocation.lat, pickupLocation.lng) && (
          <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={pickupIcon} />
        )}

        {/* Intermediate stop markers */}
        {intermediateStops.map((stop, idx) =>
          isValid(stop.lat, stop.lng) ? (
            <Marker key={idx} position={[stop.lat, stop.lng]} icon={stopIcon(idx)} />
          ) : null
        )}

        {/* Destination marker with label */}
        {destinationLocation && isValid(destinationLocation.lat, destinationLocation.lng) && (
          <Marker
            position={[destinationLocation.lat, destinationLocation.lng]}
            icon={dropoffIcon}
          />
        )}
      </MapContainer>
    </div>
  );
}
