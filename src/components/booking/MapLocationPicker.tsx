"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { LocationState } from "./PlacesAutocompleteInput";

const LeafletMapLocationPicker = dynamic(
  () => import("./LeafletMapLocationPicker"),
  { ssr: false, loading: () => <div className="w-full h-[250px] flex items-center justify-center bg-slate-100 rounded-2xl border-2 border-slate-200 text-slate-400 font-medium z-10">Loading map...</div> }
);

interface MapLocationPickerProps {
  label: string;
  value: LocationState | null;
  onChange: (loc: LocationState) => void;
}

export default function MapLocationPicker({ label, value, onChange }: MapLocationPickerProps) {
  return (
    <div className="w-full relative">
      <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
      <LeafletMapLocationPicker value={value} onChange={onChange} />
      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
        <MapPin size={12} /> Click anywhere on the map to set location
      </p>
    </div>
  );
}
