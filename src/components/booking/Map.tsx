"use client";

import dynamic from "next/dynamic";
import { LocationState } from "./PlacesAutocompleteInput";

const LeafletRouteMap = dynamic(
  () => import("./LeafletRouteMap"),
  { ssr: false, loading: () => <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-100 text-slate-500 rounded-2xl border border-slate-200 p-6 text-center">Loading route map...</div> }
);

interface MapProps {
  origin: LocationState | null;
  destination: LocationState | null;
}

export default function RouteMap({ origin, destination }: MapProps) {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
      <div className="w-full h-full min-h-[300px]">
        <LeafletRouteMap origin={origin} destination={destination} />
      </div>
    </div>
  );
}
