"use client";

import React, { useState } from "react";
import IncomingTripModal from "@/components/driver/IncomingTripModal";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Eye } from "lucide-react";

export default function DriverOfferPreviewPage() {
  const [showModal, setShowModal] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [expiresInSec, setExpiresInSec] = useState<number>(28);
  const [key, setKey] = useState(0);

  // In production, block preview
  const isProduction = process.env.NODE_ENV === "production";

  const mockTrip = {
    bookingId: "dev-preview-booking-001",
    bookingReference: "LAR-2026-PREVIEW",
    pickupLocation: {
      address: "Colombo Fort Railway Station",
      name: "Colombo Fort",
      lat: 6.9344,
      lng: 79.8500,
    },
    driverLocation: {
      lat: 6.9360,
      lng: 79.8520,
    },
    destinationLocation: {
      address: "Mount Lavinia Hotel",
      name: "Mount Lavinia",
      lat: 6.8340,
      lng: 79.8640,
    },
    intermediateStops: [
      {
        name: "ATM, Kollupitiya",
        address: "ATM, Kollupitiya",
        lat: 6.9050,
        lng: 79.8520,
        stopOrder: 1,
      },
    ],
    driverToPickupDistanceKm: 1.2,
    driverToPickupDurationMins: 4,
    driverToPickupStraightLineKm: 0.9,
    isRoadDistance: true,
    passengerJourneyDistanceKm: 12.8,
    passengerJourneyDurationMins: 32,
    estimatedFare: 1850,
    vehicleCategory: "Car",
    paymentMethod: "CASH",
    passengerName: "Amara",
    serverTime: Date.now(),
    expiresAt: Date.now() + expiresInSec * 1000,
  };

  const handleAccepted = (acceptedData: any) => {
    setLastAction(`Accepted ride offer (Reference: ${mockTrip.bookingReference}). Preview action completed without modifying real database bookings.`);
    setShowModal(false);
  };

  const handleRejected = async () => {
    if (simulateFailure) {
      throw new Error("Simulated network failure on decline. Tap Retry to try again.");
    }
    setLastAction(`Declined ride offer (Reference: ${mockTrip.bookingReference}). Preview action completed without modifying real database bookings.`);
    setShowModal(false);
  };

  const resetCard = () => {
    setLastAction(null);
    setKey((prev) => prev + 1);
    setShowModal(true);
  };

  if (isProduction) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-6 rounded-2xl max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold">Development Only</h1>
          <p className="text-slate-400 text-sm mt-1">
            The incoming ride popup card preview is only available in development mode.
          </p>
          <Link
            href="/driver"
            className="mt-4 inline-block px-4 py-2 bg-emerald-600 rounded-xl text-white font-bold text-xs"
          >
            Return to Driver Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative">
      {/* Background Driver Screen Simulation */}
      <div className="w-full max-w-4xl p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/driver"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Incoming Ride Card Preview</h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono rounded-full font-bold">
                  DEV ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect and test the approved incoming-ride popup card with real dual sliders.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetCard}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950"
          >
            <RefreshCw size={13} />
            <span>Reset / Reopen Card</span>
          </button>
        </div>

        {/* Controls & Configuration Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-xs">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Simulate Decline Failure
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
              <span>Fail Decline (Tests Retry button)</span>
            </label>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Countdown Expiry Duration
            </label>
            <div className="flex items-center gap-2">
              {[15, 30, 45].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setExpiresInSec(sec);
                    resetCard();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    expiresInSec === sec
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Card Status
            </label>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  showModal ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                }`}
              />
              <span className="font-semibold text-slate-300">
                {showModal ? "Card is Open (Modal Overlay)" : "Card is Closed / Dismissed"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Log Banner */}
        {lastAction && (
          <div className="p-3.5 bg-emerald-950/70 border border-emerald-500/60 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-200 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{lastAction}</span>
          </div>
        )}

        {/* Safety & Real Flow Compliance Note */}
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-400 text-xs flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <span>
            Preview mode renders the exact same <code className="text-emerald-300">IncomingTripModal</code> component. Real dispatches, database bookings, and GPS proximity filters remain completely untouched.
          </span>
        </div>
      </div>

      {/* Render the Exact Same IncomingTripModal Component */}
      {showModal && (
        <IncomingTripModal
          key={key}
          trip={mockTrip}
          onDismiss={() => {
            setLastAction("Offer dismissed / timed out.");
            setShowModal(false);
          }}
          onAccepted={handleAccepted}
          onRejected={handleRejected}
          isDevPreview={true}
        />
      )}
    </div>
  );
}
