"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
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

interface Props {
  value: LocationState | null;
  onChange: (loc: LocationState) => void;
}

function LocationMarker({ value, onChange }: Props) {
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

    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleInvalidate);
      window.removeEventListener("lar:sidebar-toggle", handleInvalidate);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (value) {
      map.flyTo([value.lat, value.lng], map.getZoom());
    }
  }, [value, map]);

  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      onChange({
        address: `Selected on map (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng,
        source: "gps",
      });
    },
  });

  return value ? (
    <Marker position={[value.lat, value.lng]} />
  ) : null;
}

export default function LeafletMapLocationPicker({ value, onChange }: Props) {
  const defaultCenter: [number, number] = [7.8731, 80.7718]; // Sri Lanka
  const center: [number, number] = value ? [value.lat, value.lng] : defaultCenter;
  
  return (
    <div className="w-full h-[250px] rounded-2xl overflow-hidden bg-slate-100 relative z-0 border-2 border-slate-200">
      <MapContainer 
        center={center} 
        zoom={value ? 14 : 7} 
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker value={value} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
