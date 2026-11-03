"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { X, MapPin, CheckCircle2, Loader2 } from "lucide-react";

const LeafletCenterPinMap = dynamic(() => import("./LeafletCenterPinMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{ width: "100%", height: "100%", minHeight: "320px" }}
      className="flex flex-col items-center justify-center bg-slate-100 text-slate-500 font-bold gap-2"
    >
      <Loader2 size={24} className="animate-spin text-amber-500" />
      <span className="text-xs uppercase tracking-wider font-extrabold text-slate-600">
        Loading Interactive Map...
      </span>
    </div>
  ),
});

export interface DraggablePinMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  initialCoords?: { lat: number; lng: number } | null;
  initialAddress?: string;
  initialNotes?: string;
  onConfirm: (loc: { address: string; lat: number; lng: number; notes?: string }) => void;
}

export default function DraggablePinMapModal({
  isOpen,
  onClose,
  title,
  confirmLabel,
  initialCoords,
  initialAddress = "",
  initialNotes = "",
  onConfirm,
}: DraggablePinMapModalProps) {
  // Determine starting coordinates
  const initialLat = initialCoords?.lat && initialCoords.lat !== 0 ? initialCoords.lat : 6.9271;
  const initialLng = initialCoords?.lng && initialCoords.lng !== 0 ? initialCoords.lng : 79.8612;

  const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });

  // Never default to an endless "Locating address..." state
  const [addressLabel, setAddressLabel] = useState<string>(() => {
    if (initialAddress && initialAddress.trim()) {
      return initialAddress.trim();
    }
    return `Selected Point (${initialLat.toFixed(5)}, ${initialLng.toFixed(5)})`;
  });

  const [typedNotes, setTypedNotes] = useState(initialNotes || "");
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state if props change when opening
  useEffect(() => {
    if (isOpen) {
      const lat = initialCoords?.lat && initialCoords.lat !== 0 ? initialCoords.lat : 6.9271;
      const lng = initialCoords?.lng && initialCoords.lng !== 0 ? initialCoords.lng : 79.8612;
      setCenterCoords({ lat, lng });

      if (initialAddress && initialAddress.trim()) {
        setAddressLabel(initialAddress.trim());
      } else {
        setAddressLabel(`Selected Point (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      }
      setTypedNotes(initialNotes || "");
    }
  }, [isOpen, initialCoords, initialAddress, initialNotes]);

  // Lock body scroll and listen for Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Perform reverse geocode with graceful 2.5s timeout and coordinate fallback
  const performReverseGeocode = useCallback((coords: { lat: number; lng: number }) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setGeocoding(true);

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 2500);

    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=17&addressdetails=1`;

    fetch(osmUrl, {
      headers: { "User-Agent": "LankaAirportRide-PickMe/1.0" },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error");
        return res.json();
      })
      .then((data) => {
        clearTimeout(timeoutId);
        if (data && data.display_name) {
          const shortName = data.display_name.split(",").slice(0, 3).join(",").trim();
          setAddressLabel(shortName);
        } else {
          setAddressLabel(`Selected Point (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);
        }
      })
      .catch(() => {
        // Fallback gracefully without remaining stuck in loading state
        setAddressLabel(`Selected Point (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);
      })
      .finally(() => {
        setGeocoding(false);
      });
  }, []);

  // Center change handler from map moveend
  const handleCenterChange = useCallback(
    (coords: { lat: number; lng: number }) => {
      setCenterCoords(coords);

      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }

      // Update immediate coordinate label to prevent stale address
      setAddressLabel(`Selected Point (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);

      geocodeTimeoutRef.current = setTimeout(() => {
        performReverseGeocode(coords);
      }, 400);
    },
    [performReverseGeocode]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const finalAddress =
      addressLabel && !addressLabel.startsWith("Locating")
        ? addressLabel
        : `Selected on map (${centerCoords.lat.toFixed(5)}, ${centerCoords.lng.toFixed(5)})`;

    onConfirm({
      address: finalAddress,
      lat: centerCoords.lat,
      lng: centerCoords.lng,
      notes: typedNotes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
      style={{ zIndex: 9999 }}
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "672px",
          height: "85vh",
          maxHeight: "720px",
          minHeight: "480px",
          display: "flex",
          flexDirection: "column",
        }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
              Drag map under central pin
            </span>
            <h3 id="map-picker-title" className="text-lg font-black text-slate-900">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            aria-label="Close location picker"
          >
            <X size={20} />
          </button>
        </div>

        {/* Map Viewport Area with guaranteed explicit flex dimensions */}
        <div
          style={{
            flex: "1 1 0%",
            minHeight: "300px",
            width: "100%",
            position: "relative",
            overflow: "hidden",
          }}
          className="bg-slate-100"
        >
          <div className="absolute inset-0">
            <LeafletCenterPinMap
              initialCenter={centerCoords}
              onCenterChange={handleCenterChange}
            />
          </div>
        </div>

        {/* Bottom Location Confirmation Sheet */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 space-y-3 z-10 shrink-0">
          <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
              <MapPin size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Selected Coordinates
              </span>
              <p className="text-sm font-bold text-slate-900 truncate">
                {addressLabel}
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                {centerCoords.lat.toFixed(5)}, {centerCoords.lng.toFixed(5)}
              </p>
            </div>
            {geocoding && (
              <div className="flex items-center gap-1 shrink-0 mt-1 text-[10px] text-amber-600 font-bold">
                <Loader2 size={13} className="animate-spin" />
                <span className="hidden sm:inline">Looking up name...</span>
              </div>
            )}
          </div>

          {/* Optional Landmark / Entrance Note */}
          <div>
            <input
              type="text"
              placeholder="Landmark, building name or entrance note (Optional)"
              value={typedNotes}
              onChange={(e) => setTypedNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <CheckCircle2 size={15} />
              <span>{confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
