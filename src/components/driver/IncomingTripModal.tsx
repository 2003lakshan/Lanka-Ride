"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  Car,
  Clock,
  User,
  Volume2,
  VolumeX,
  Navigation,
  Coins,
  Bell,
  ChevronsRight,
} from "lucide-react";
import SlideToAccept from "./SlideToAccept";
import OfferMapPreview from "./OfferMapPreview";
import { soundManager, SoundState } from "@/lib/sound";
import { formatSriLankanLKR } from "@/lib/dateTime";

export interface IncomingTripModalProps {
  trip: any;
  onDismiss: () => void;
  onAccepted: (acceptedBooking: any) => void;
  onRejected?: () => Promise<void> | void;
  isDevPreview?: boolean;
}

export default function IncomingTripModal({
  trip,
  onDismiss,
  onAccepted,
  onRejected,
  isDevPreview = false,
}: IncomingTripModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [soundState, setSoundState] = useState<SoundState>(soundManager.getState());
  const [timeLeftSec, setTimeLeftSec] = useState<number>(28);
  const [totalExpirySec, setTotalExpirySec] = useState<number>(28);

  const bookingId = (trip?.bookingId || trip?._id || "").toString();
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lar:close-notifications"));
    }
    if (scrollBodyRef.current) {
      scrollBodyRef.current.scrollTop = 0;
    }
  }, []);

  // Subscribe to SoundManager state
  useEffect(() => {
    return soundManager.subscribe(setSoundState);
  }, []);

  // Start continuous ringing chime and haptic feedback when modal appears
  useEffect(() => {
    if (bookingId && !isDevPreview) {
      soundManager.startRinging(bookingId);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([400, 250, 400, 250, 400]);
        } catch {}
      }
    }
    return () => {
      if (bookingId && !isDevPreview) {
        soundManager.stopRinging(bookingId);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(0);
          } catch {}
        }
      }
    };
  }, [bookingId, isDevPreview]);

  // Server-authoritative countdown timer based on trip.expiresAt matching 28s visual
  useEffect(() => {
    if (!trip) return;

    if (trip.expiresAt) {
      const expiresAtMs = new Date(trip.expiresAt).getTime();
      const serverTimeMs = trip.serverTime ? new Date(trip.serverTime).getTime() : Date.now();
      const rawSec = Math.round((expiresAtMs - serverTimeMs) / 1000);
      const totalSec = rawSec > 0 && rawSec <= 120 ? rawSec : 28;
      setTotalExpirySec(totalSec);

      const updateRemaining = () => {
        const rawRemaining = Math.ceil((expiresAtMs - Date.now()) / 1000);
        const remaining = Math.max(0, rawRemaining > 0 && rawRemaining <= 120 ? rawRemaining : 28);
        setTimeLeftSec(remaining);
      };

      updateRemaining();
      const interval = setInterval(updateRemaining, 350);
      return () => clearInterval(interval);
    } else {
      setTimeLeftSec(28);
      setTotalExpirySec(28);
      const interval = setInterval(() => {
        setTimeLeftSec((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [trip, bookingId, isDevPreview]);

  if (!trip || !mounted) return null;

  // Passenger Name from registered profile
  const passengerName =
    (trip.passengerName || "").trim() ||
    (trip.passengerDetails?.fullName || "").trim() ||
    (trip.touristId ? (trip.touristId.name || trip.touristId.fullName) : null) ||
    "Amara";

  // Vehicle category
  const vehicleCategory =
    trip.vehicleCategory ||
    trip.pickMeDetails?.vehicleCategory ||
    trip.vehicleTypeId?.name ||
    "Car";

  // Estimated Fare in LKR
  const rawFare =
    trip.estimatedFare ||
    trip.pickMeDetails?.estimatedFare ||
    trip.fareBreakdown?.totalEstimatedFare ||
    trip.totalPrice ||
    1850;
  const fareDisplay = rawFare > 0 ? formatSriLankanLKR(rawFare) : "LKR 1,850";

  // Payment method
  const paymentMethod = (trip.paymentMethod || "CASH").toUpperCase();

  // Locations
  const pickupAddress =
    trip.pickupLocation?.address ||
    trip.pickupAddress ||
    trip.airportId?.name ||
    "Colombo Fort Railway Station";

  const pickupLat = trip.pickupLocation?.lat ?? trip.pickupLat;
  const pickupLng = trip.pickupLocation?.lng ?? trip.pickupLng;

  const destinationAddress =
    trip.destinationLocation?.address ||
    trip.destinationAddress ||
    "Mount Lavinia Hotel";

  const destinationLat = trip.destinationLocation?.lat ?? trip.destinationLat;
  const destinationLng = trip.destinationLocation?.lng ?? trip.destinationLng;

  // Driver Location
  const driverLat = trip.driverLocation?.lat;
  const driverLng = trip.driverLocation?.lng;

  // Intermediate stops (ordered)
  const intermediateStops: any[] =
    trip.intermediateStops ||
    trip.pickMeDetails?.intermediateStops ||
    [];

  // Driver-to-pickup distance
  const driverToPickupKm = trip.driverToPickupDistanceKm || trip.driverToPickupStraightLineKm || 1.2;
  const driverToPickupMins = trip.driverToPickupDurationMins || Math.max(1, Math.round((driverToPickupKm / 25) * 60)) || 4;

  // Passenger journey road distance and duration
  const journeyKm = trip.passengerJourneyDistanceKm || trip.distanceKm || 12.8;
  const journeyMins = trip.passengerJourneyDurationMins || trip.durationMins || 32;

  // Progress percentage for countdown
  const progressPercent = Math.max(0, Math.min(100, (timeLeftSec / totalExpirySec) * 100));

  const handleAcceptSuccess = (acceptedBooking: any) => {
    if (!isDevPreview) soundManager.stopRinging(bookingId);
    onAccepted(acceptedBooking);
  };

  const handleReject = async () => {
    if (onRejected) {
      await onRejected();
    } else {
      if (!isDevPreview) soundManager.stopRinging(bookingId);
      onDismiss();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming Ride Request: ${trip.bookingReference || "New Ride"}`}
    >
      <div
        className="relative w-full max-w-[390px] max-h-[92vh] bg-white text-slate-900 rounded-[28px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col min-w-0"
        style={{
          width: "min(390px, calc(100vw - 16px))",
          backgroundColor: "#ffffff",
        }}
      >
        {/* Top Header Banner: Warm Yellow/Gold matching attached design */}
        <div
          className="px-4 pt-5 pb-3.5 sm:px-5 sm:pt-5 sm:pb-4 flex items-center justify-between gap-2 shrink-0 border-b border-amber-300/80"
          style={{ backgroundColor: "#FDE047" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">🔔</span>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-950 truncate">
              NEW RIDE REQUEST
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Audio Retry / Ringtone Control Button */}
            {!isDevPreview && (
              <button
                type="button"
                onClick={() => soundManager.startRinging(bookingId)}
                className={`px-2.5 py-1 text-xs font-black rounded-full flex items-center gap-1 shadow-xs transition-all cursor-pointer ${
                  soundState.audioBlocked || !soundState.isRinging
                    ? "bg-rose-600 text-white animate-pulse"
                    : "bg-emerald-700 text-white"
                }`}
                title={soundState.audioBlocked ? "Sound blocked by phone browser. Tap to play ringtone!" : "Ringing active. Tap to replay."}
              >
                {soundState.audioBlocked || !soundState.isRinging ? (
                  <>
                    <VolumeX size={12} />
                    <span>Tap Sound</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={12} className="animate-bounce" />
                    <span>Ringing</span>
                  </>
                )}
              </button>
            )}

            {/* Expiry Text and Circular Yellow Progress Badge */}
            <span className="text-xs text-slate-800 font-semibold">
              Expires in <strong className="font-bold text-slate-950">{timeLeftSec}s</strong>
            </span>

            <div
              className="relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-amber-500/80 bg-amber-300/30 shadow-inner"
              title="Offer timer"
            >
              <span className="text-[11px] font-black text-slate-950">
                {timeLeftSec}s
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Card Body */}
        <div ref={scrollBodyRef} className="overflow-y-auto min-h-0 flex-1 overscroll-contain pb-2">
          {/* Audio Blocked Alert Banner for Mobile Browsers */}
          {!isDevPreview && soundState.audioBlocked && (
            <button
              type="button"
              onClick={() => soundManager.startRinging(bookingId)}
              className="mx-4 mt-3 w-[calc(100%-32px)] p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl flex items-center justify-between text-xs font-black shadow-md cursor-pointer animate-pulse"
            >
              <div className="flex items-center gap-2 text-left">
                <VolumeX size={16} className="shrink-0" />
                <span>Phone blocked audio! Tap here to start ringtone</span>
              </div>
              <span className="bg-white text-rose-700 px-2.5 py-1 rounded-xl text-[11px] font-black shrink-0">Play Ringtone</span>
            </button>
          )}

          {/* Map Preview with Floating Vehicle Badge */}
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs relative shrink-0">
            <OfferMapPreview
              driverLocation={
                typeof driverLat === "number" && typeof driverLng === "number"
                  ? { lat: driverLat, lng: driverLng }
                  : undefined
              }
              pickupLocation={{
                lat: pickupLat,
                lng: pickupLng,
                address: pickupAddress,
                name: "Colombo Fort",
              }}
              intermediateStops={intermediateStops}
              destinationLocation={{
                lat: destinationLat,
                lng: destinationLng,
                address: destinationAddress,
                name: "Mount Lavinia",
              }}
            />

            {/* Floating Vehicle Category Pill Badge */}
            <div
              className="bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 border border-slate-100 text-slate-900 text-xs font-black uppercase tracking-wider"
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 400,
              }}
            >
              <Car size={13} className="text-slate-800 shrink-0" />
              <span>{vehicleCategory.toUpperCase()}</span>
            </div>
          </div>

          {/* Pickup Header Row */}
          <div className="px-4 pt-3 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Navigation size={17} className="fill-blue-900 text-blue-900" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight truncate">
                PICKUP • {typeof driverToPickupKm === "number" ? driverToPickupKm.toFixed(1).replace(".", ",") : "1,2"} km away
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                About {Math.max(1, Math.round(driverToPickupMins))} min to passenger
              </p>
            </div>
          </div>

          {/* Ordered Stops Timeline */}
          <div className="px-4 pt-2.5 space-y-0 text-left">
            {/* Pickup */}
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center shadow-xs">
                <span className="w-1 h-1 rounded-full bg-white" />
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 truncate flex-1" title={pickupAddress}>
                {pickupAddress}
              </p>
            </div>

            {/* Dotted Line */}
            <div className="border-l-2 border-dotted border-slate-300 ml-1.5 my-0.5 h-3.5" />

            {/* Intermediate stops if any */}
            {intermediateStops.map((stop: any, idx: number) => (
              <React.Fragment key={idx}>
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 bg-amber-400 border-2 border-white shadow-xs" />
                  <p className="text-xs text-slate-600 font-medium line-clamp-1 truncate flex-1">
                    Stop {idx + 1} • {stop.name || stop.address || `Stop ${idx + 1}`}
                  </p>
                </div>
                <div className="border-l-2 border-dotted border-slate-300 ml-1.5 my-0.5 h-3.5" />
              </React.Fragment>
            ))}

            {/* Destination */}
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 bg-red-600 border-2 border-white shadow-xs" />
              <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 truncate flex-1" title={destinationAddress}>
                {destinationAddress}
              </p>
            </div>
          </div>

          {/* Trip Distance & Driving Time Row */}
          <div className="mx-4 my-2.5 grid grid-cols-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 sm:p-3 divide-x divide-slate-200">
            <div className="pr-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span>TRIP DISTANCE</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                {typeof journeyKm === "number" ? journeyKm.toFixed(1) : "12.8"} km
              </p>
            </div>

            <div className="pl-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Clock size={12} className="text-slate-400 shrink-0" />
                <span>DRIVING TIME</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                {typeof journeyMins === "number" ? Math.round(journeyMins) : 32} min
              </p>
            </div>
          </div>

          {/* Fare & Payment Row with Stacked Gold Coins */}
          <div className="mx-4 my-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* 3D Stacked Golden Coins Vector */}
              <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="coinGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="50%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#CA8A04" />
                  </linearGradient>
                  <linearGradient id="coinRimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#CA8A04" />
                    <stop offset="100%" stopColor="#854D0E" />
                  </linearGradient>
                </defs>
                {/* Bottom Coin */}
                <path d="M10 31C10 31 10 35 24 35C38 35 38 31 38 31V34C38 38 24 38 10 34V31Z" fill="url(#coinRimGrad)" />
                <ellipse cx="24" cy="31" rx="14" ry="4.5" fill="url(#coinGoldGrad)" stroke="#A16207" strokeWidth="0.8" />
                {/* Middle Coin */}
                <path d="M10 23C10 23 10 27 24 27C38 27 38 23 38 23V26C38 30 24 30 10 26V23Z" fill="url(#coinRimGrad)" />
                <ellipse cx="24" cy="23" rx="14" ry="4.5" fill="url(#coinGoldGrad)" stroke="#A16207" strokeWidth="0.8" />
                {/* Top Coin */}
                <path d="M10 15C10 15 10 19 24 19C38 19 38 15 38 15V18C38 22 24 22 10 18V15Z" fill="url(#coinRimGrad)" />
                <ellipse cx="24" cy="15" rx="14" ry="4.5" fill="url(#coinGoldGrad)" stroke="#A16207" strokeWidth="0.8" />
              </svg>

              <div>
                <span className="text-xs font-semibold text-slate-500 block">
                  Estimated fare
                </span>
                <p className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-none mt-0.5">
                  {fareDisplay}
                </p>
              </div>
            </div>

            <div className="bg-[#FEF3C7] text-amber-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-xs shrink-0">
              {paymentMethod === "CASH" ? "Cash to driver" : "Paid online"}
            </div>
          </div>

          {/* Passenger Row */}
          <div className="mx-4 pt-2.5 pb-1 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
            <User size={15} className="text-slate-400 shrink-0" />
            <span>Passenger: </span>
            <strong className="text-slate-900 font-bold truncate">{passengerName}</strong>
          </div>
        </div>

        {/* Pinned Action Controls Footer */}
        <div
          className="p-4 bg-white border-t border-slate-100 shrink-0 space-y-2.5 shadow-lg"
          style={{ backgroundColor: "#ffffff" }}
        >
          <SlideToAccept
            variant="modal"
            bookingId={bookingId}
            bookingReference={trip.bookingReference}
            onSuccess={handleAcceptSuccess}
            onReject={handleReject}
            isDevPreview={isDevPreview}
            onError={(err) => {
              if (err.includes("already been accepted")) {
                setTimeout(() => {
                  if (!isDevPreview) soundManager.stopRinging(bookingId);
                  onDismiss();
                }, 1800);
              }
            }}
          />

          <p className="text-[11px] text-slate-400 text-center font-medium pt-0.5">
            Sample ride • Design preview
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
