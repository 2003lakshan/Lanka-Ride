"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, LocateFixed, Loader2, RefreshCw } from "lucide-react";

// Fix Leaflet marker icon asset issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export interface LeafletCenterPinMapProps {
  initialCenter?: { lat: number; lng: number } | null;
  onCenterChange: (coords: { lat: number; lng: number }) => void;
  confirmLabel?: string;
}

/**
 * Controller inside MapContainer to handle map drag, center reporting,
 * and robust size invalidation across modal opening transitions.
 */
function CenterMapEvents({
  onCenterChange,
  setIsDragging,
}: {
  onCenterChange: (coords: { lat: number; lng: number }) => void;
  setIsDragging: (dragging: boolean) => void;
}) {
  const map = useMap();
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;

  useEffect(() => {
    // Invalidate size on mount, resize, and after CSS scale/zoom animations finish
    const handleInvalidate = () => {
      try {
        if (map && map.getContainer()) {
          map.invalidateSize();
        }
      } catch {
        // Map instance might be unmounting
      }
    };

    // Staggered invalidation across modal mount & CSS animation
    handleInvalidate();
    const t1 = setTimeout(handleInvalidate, 80);
    const t2 = setTimeout(handleInvalidate, 180);
    const t3 = setTimeout(handleInvalidate, 350);
    const t4 = setTimeout(handleInvalidate, 600);

    window.addEventListener("resize", handleInvalidate);
    window.addEventListener("lar:sidebar-toggle", handleInvalidate);

    let resizeObserver: ResizeObserver | null = null;
    try {
      const container = map.getContainer();
      if (typeof ResizeObserver !== "undefined" && container) {
        resizeObserver = new ResizeObserver(() => handleInvalidate());
        resizeObserver.observe(container);
      }
    } catch {}

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener("resize", handleInvalidate);
      window.removeEventListener("lar:sidebar-toggle", handleInvalidate);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [map]);

  useMapEvents({
    movestart() {
      setIsDragging(true);
    },
    dragstart() {
      setIsDragging(true);
    },
    move() {
      setIsDragging(true);
    },
    moveend() {
      setIsDragging(false);
      try {
        const center = map.getCenter();
        if (center && typeof center.lat === "number" && typeof center.lng === "number") {
          onCenterChangeRef.current({
            lat: Number(center.lat.toFixed(5)),
            lng: Number(center.lng.toFixed(5)),
          });
        }
      } catch {}
    },
    dragend() {
      setIsDragging(false);
      try {
        const center = map.getCenter();
        if (center && typeof center.lat === "number" && typeof center.lng === "number") {
          onCenterChangeRef.current({
            lat: Number(center.lat.toFixed(5)),
            lng: Number(center.lng.toFixed(5)),
          });
        }
      } catch {}
    },
  });

  return null;
}

/**
 * Floating GPS button to center on current location without blocking manual selection.
 */
function LocateMeButton() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!navigator.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        try {
          map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, {
            animate: true,
            duration: 1.0,
          });
        } catch {}
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="leaflet-bottom leaflet-right mb-4 mr-3 pointer-events-auto z-[400]">
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        aria-label="Locate my position"
        title="Locate my current position"
        className="w-10 h-10 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 rounded-2xl shadow-xl border border-slate-200 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
      >
        {locating ? (
          <Loader2 size={16} className="animate-spin text-blue-600" />
        ) : (
          <LocateFixed size={16} className="text-blue-600" />
        )}
      </button>
    </div>
  );
}

export default function LeafletCenterPinMap({
  initialCenter,
  onCenterChange,
}: LeafletCenterPinMapProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hasMapError, setHasMapError] = useState(false);

  const sriLankaDefault: [number, number] = [6.9271, 79.8612];
  const center: [number, number] = useMemo(() => {
    if (initialCenter && typeof initialCenter.lat === "number" && typeof initialCenter.lng === "number") {
      if (initialCenter.lat !== 0 || initialCenter.lng !== 0) {
        return [initialCenter.lat, initialCenter.lng];
      }
    }
    return sriLankaDefault;
  }, [initialCenter]);

  if (hasMapError) {
    return (
      <div
        style={{ width: "100%", height: "100%", minHeight: "300px" }}
        className="bg-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-3"
      >
        <p className="text-xs text-slate-600 font-semibold">
          Unable to render interactive map view.
        </p>
        <button
          type="button"
          onClick={() => setHasMapError(false)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-slate-800 cursor-pointer"
        >
          <RefreshCw size={14} />
          <span>Retry Map</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "300px",
        position: "relative",
      }}
      className="select-none bg-slate-100 overflow-hidden"
    >
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={true}
        zoomControl={true}
        attributionControl={true}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "300px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <CenterMapEvents
          onCenterChange={onCenterChange}
          setIsDragging={setIsDragging}
        />
        <LocateMeButton />
      </MapContainer>

      {/* FIXED CENTRAL FLOATING PIN (tip anchored precisely at center 50% 50% of map) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
          overflow: "hidden",
        }}
      >
        {/* Center reticle target dot & ground shadow at exact 50% 50% */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="w-2 h-2 rounded-full bg-slate-900 border border-white shadow-xs" />
          <div
            className={`w-5 h-1.5 bg-slate-900/30 rounded-full blur-[1px] transition-all duration-200 mt-0.5 ${
              isDragging ? "scale-60 opacity-30 translate-y-1" : "scale-100 opacity-80"
            }`}
          />
        </div>

        {/* Pin whose tip touches exact 50% 50% */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: isDragging
              ? "translate(-50%, calc(-100% - 14px)) scale(1.1)"
              : "translate(-50%, -100%) scale(1)",
            transformOrigin: "bottom center",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transition: "transform 0.2s ease-out",
          }}
        >
          {/* Pin Head */}
          <div className="w-10 h-10 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shadow-xl border-2 border-white ring-2 ring-slate-900/10">
            <MapPin size={22} className="fill-amber-400 text-slate-950 -mt-0.5" />
          </div>

          {/* Pin Needle pointer pointing directly down to center point */}
          <div className="w-1.5 h-3.5 bg-slate-950 rounded-b-full shadow-xs -mt-0.5" />
        </div>
      </div>
    </div>
  );
}
