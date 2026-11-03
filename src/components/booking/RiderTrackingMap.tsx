"use client";

import dynamic from "next/dynamic";
import type { RiderTrackingMapProps } from "./LeafletRiderTrackingMap";

const LeafletRiderTrackingMap = dynamic(
  () => import("./LeafletRiderTrackingMap"),
  { 
    ssr: false, 
    loading: () => (
      <div className="w-full h-full min-h-[380px] sm:min-h-[460px] flex flex-col items-center justify-center bg-slate-100 text-slate-500 rounded-3xl border border-slate-200 p-6 text-center space-y-2">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <span className="text-xs font-bold text-slate-600">Initializing live map & road route...</span>
      </div>
    ) 
  }
);

export default function RiderTrackingMap(props: RiderTrackingMapProps) {
  return <LeafletRiderTrackingMap {...props} />;
}
export type { RiderTrackingMapProps };
