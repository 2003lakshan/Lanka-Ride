import React from "react";

export const metadata = {
  title: "Driver Dashboard | At Your Service – Powered by Pexora",
  description: "Driver Portal - Manage available trips, navigate pickups, and track earnings.",
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {children}
    </div>
  );
}
