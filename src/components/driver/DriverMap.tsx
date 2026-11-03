"use client";

import dynamic from "next/dynamic";

const LeafletDriverMap = dynamic(
  () => import("./LeafletDriverMap"),
  { 
    ssr: false, 
    loading: () => (
      <div className="w-full h-64 sm:h-80 bg-slate-100 flex items-center justify-center text-slate-500 rounded-3xl border border-slate-200">
        Loading driver map...
      </div>
    ) 
  }
);

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

export default function DriverMap(props: DriverMapProps) {
  return <LeafletDriverMap {...props} />;
}
