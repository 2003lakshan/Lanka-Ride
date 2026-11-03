"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocationState } from "./PlacesAutocompleteInput";

// Fix Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LeafletRouteMapProps {
  origin: LocationState | null;
  destination: LocationState | null;
}

function MapBoundsManager({ origin, destination }: LeafletRouteMapProps) {
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
    if (origin && destination && origin.lat && origin.lng && destination.lat && destination.lng) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (origin && origin.lat && origin.lng) {
      map.setView([origin.lat, origin.lng], 14);
    } else if (destination && destination.lat && destination.lng) {
      map.setView([destination.lat, destination.lng], 14);
    }
  }, [origin, destination, map]);

  return null;
}

export default function LeafletRouteMap({ origin, destination }: LeafletRouteMapProps) {
  const center: [number, number] = origin?.lat ? [origin.lat, origin.lng] : [7.8731, 80.7718]; // Sri Lanka
  
  const positions: [number, number][] = [];
  if (origin?.lat && origin?.lng) positions.push([origin.lat, origin.lng]);
  if (destination?.lat && destination?.lng) positions.push([destination.lat, destination.lng]);

  return (
    <MapContainer 
      center={center} 
      zoom={7} 
      style={{ height: "100%", width: "100%", zIndex: 1 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {origin?.lat && origin?.lng && <Marker position={[origin.lat, origin.lng]} />}
      {destination?.lat && destination?.lng && <Marker position={[destination.lat, destination.lng]} />}
      
      {positions.length === 2 && (
        <Polyline positions={positions} color="#2563EB" weight={3} dashArray="5, 10" />
      )}
      
      <MapBoundsManager origin={origin} destination={destination} />
    </MapContainer>
  );
}
