"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, Loader2, ArrowRight, RotateCw, ChevronsRight } from "lucide-react";

export interface DualSlideActionProps {
  bookingId: string;
  bookingReference?: string;
  onSuccess?: (booking: any) => void;
  onReject?: () => Promise<void> | void;
  onError?: (errorMessage: string) => void;
  disabled?: boolean;
  className?: string;
  isDevPreview?: boolean;
  simulateRejectFailure?: boolean;
  variant?: "modal" | "dual" | "single";
}

interface SingleSliderProps {
  type: "ACCEPT" | "DECLINE";
  isSubmitting: boolean;
  disabled: boolean;
  onConfirm: () => void;
  bookingReference?: string;
  isModalVariant?: boolean;
}

function SwipeTrack({
  type,
  isSubmitting,
  disabled,
  onConfirm,
  bookingReference,
  isModalVariant = false,
}: SingleSliderProps) {
  const isAccept = type === "ACCEPT";
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const isTrackingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const maxOffsetRef = useRef(0);

  const updateBounds = useCallback(() => {
    if (trackRef.current && handleRef.current) {
      const trackWidth = trackRef.current.clientWidth;
      const handleWidth = handleRef.current.clientWidth;
      // Max travel from left edge (with 4px padding on each side)
      const maxOffset = Math.max(0, trackWidth - handleWidth - 8);
      maxOffsetRef.current = maxOffset;
    }
  }, []);

  useEffect(() => {
    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, [updateBounds]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isSubmitting) return;

    updateBounds();
    if (maxOffsetRef.current <= 0) return;

    isTrackingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    activePointerIdRef.current = e.pointerId;

    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTrackingRef.current || activePointerIdRef.current !== e.pointerId) return;

    const deltaX = e.clientX - dragStartXRef.current;
    const deltaY = e.clientY - dragStartYRef.current;

    // Check gesture direction if not locked into horizontal drag yet
    if (!isDragging) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // If predominantly vertical gesture, release so the page or modal can scroll
      if (absY > absX && absY > 7) {
        isTrackingRef.current = false;
        activePointerIdRef.current = null;
        return;
      }

      // If predominantly horizontal gesture and moving right (>6px), lock into horizontal drag
      if (absX > absY && deltaX > 6) {
        setIsDragging(true);
        if (e.currentTarget.setPointerCapture) {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        }
      } else {
        return;
      }
    }

    // Calculate clamped horizontal offset (left to right only)
    const maxOffset = maxOffsetRef.current;
    const boundedX = Math.max(0, Math.min(deltaX, maxOffset));
    setDragX(boundedX);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTrackingRef.current || activePointerIdRef.current !== e.pointerId) return;

    isTrackingRef.current = false;
    activePointerIdRef.current = null;

    if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (isDragging) {
      setIsDragging(false);
      const maxOffset = maxOffsetRef.current;
      const threshold = maxOffset * 0.70; // 70% threshold

      if (dragX >= threshold && maxOffset > 0) {
        // Drag confirmed! Animate to end and trigger action
        setDragX(maxOffset);
        onConfirm();
      } else {
        // Released early -> spring back smoothly to 0
        setDragX(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || isSubmitting) return;

    if (e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      setDragX(maxOffsetRef.current);
      onConfirm();
    }
  };

  const maxOffset = maxOffsetRef.current || 1;
  const progress = Math.max(0, Math.min(1, dragX / maxOffset));
  const isLocked = disabled || isSubmitting;

  if (isModalVariant) {
    // Exact match for the design: green track for Accept, red track for Decline with white circular thumb (>>)
    const trackBg = isAccept
      ? isSubmitting ? "#15803d" : "#16a34a"
      : isSubmitting ? "#991b1b" : "#dc2626";
    const fillBg = isAccept ? "#15803d" : "#991b1b";
    const thumbTextColor = isAccept ? "text-emerald-600" : "text-rose-600";
    const labelText = isAccept ? "Slide to accept" : "Slide to decline";

    return (
      <div
        ref={trackRef}
        role="slider"
        aria-label={
          isAccept
            ? `Slide to Accept ride ${bookingReference || ""}`
            : `Slide to Decline ride ${bookingReference || ""}`
        }
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={isLocked ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`relative h-13 sm:h-14 w-full rounded-full p-1.5 flex items-center overflow-hidden transition-all shadow-md select-none focus:outline-hidden focus:ring-2 ${
          isAccept
            ? "focus:ring-emerald-400 hover:brightness-105"
            : "focus:ring-rose-400 hover:brightness-105"
        }`}
        style={{
          backgroundColor: trackBg,
          touchAction: "pan-y",
        }}
      >
        {/* Dynamic Progress Fill expanding behind thumb */}
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full transition-all"
          style={{
            backgroundColor: fillBg,
            width: isDragging ? `${dragX + 50}px` : progress > 0 ? "100%" : "0px",
            transition: isDragging ? "none" : "width 200ms ease-out",
          }}
        />

        {/* Centered Track Label */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity text-white"
          style={{
            opacity: Math.max(0, 1 - progress * 1.5),
          }}
        >
          <span className="text-sm sm:text-base font-bold tracking-wide flex items-center gap-1.5 pl-6 text-white">
            <span>{labelText}</span>
            <ArrowRight size={17} className="text-white" />
          </span>
        </div>

        {/* Draggable Circular White Handle (Thumb) */}
        <div
          ref={handleRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          className={`relative z-20 h-10 sm:h-11 w-10 sm:w-11 rounded-full bg-white ${thumbTextColor} flex items-center justify-center font-black shadow-lg cursor-grab active:cursor-grabbing transition-transform ${
            isDragging ? "transition-none" : "duration-200 ease-out"
          } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
          style={{
            transform: `translateX(${dragX}px)`,
            touchAction: "pan-y",
          }}
        >
          {isSubmitting ? (
            <Loader2 size={20} className={`animate-spin ${thumbTextColor}`} />
          ) : (
            <ChevronsRight size={22} className={`stroke-[2.5] ${thumbTextColor}`} />
          )}
        </div>
      </div>
    );
  }

  // Standard or dual track
  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={
        isAccept
          ? `Slide to Accept ride ${bookingReference || ""}`
          : `Slide to Decline ride ${bookingReference || ""}`
      }
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={isLocked ? -1 : 0}
      onKeyDown={handleKeyDown}
      className={`relative h-12 sm:h-13 w-full rounded-2xl p-1 flex items-center overflow-hidden transition-all border shadow-inner select-none focus:outline-hidden focus:ring-2 ${
        isAccept
          ? isSubmitting
            ? "bg-emerald-950/80 border-emerald-500/80 focus:ring-emerald-400"
            : "bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-600/40 focus:ring-emerald-400"
          : isSubmitting
          ? "bg-rose-950/80 border-rose-500/80 focus:ring-rose-400"
          : "bg-rose-950/30 hover:bg-rose-950/50 border-rose-600/40 focus:ring-rose-400"
      } ${isLocked ? "opacity-75" : ""}`}
      style={{ touchAction: "pan-y" }}
    >
      {/* Dynamic Progress Fill expanding behind thumb */}
      <div
        className={`absolute left-0 top-0 bottom-0 rounded-2xl transition-all ${
          isAccept
            ? "bg-linear-to-r from-emerald-600/50 via-emerald-500/70 to-emerald-400/90"
            : "bg-linear-to-r from-rose-700/50 via-rose-600/70 to-rose-500/90"
        }`}
        style={{
          width: isDragging ? `${dragX + 50}px` : progress > 0 ? "100%" : "0px",
          transition: isDragging ? "none" : "width 200ms ease-out",
        }}
      />

      {/* Track Label text with directional pulse */}
      <div
        className={`absolute inset-0 flex items-center justify-center gap-2 pointer-events-none transition-opacity ${
          isAccept ? "text-emerald-300" : "text-rose-300"
        }`}
        style={{
          opacity: Math.max(0, 1 - progress * 1.5),
        }}
      >
        <span className="text-xs font-black uppercase tracking-wider pl-12 pr-2 truncate">
          {isAccept ? "Slide to Accept" : "Slide to Decline"}
        </span>
        <ArrowRight
          size={14}
          className={`animate-pulse shrink-0 ${isAccept ? "text-emerald-400" : "text-rose-400"}`}
        />
      </div>

      {/* Draggable Handle / Thumb */}
      <div
        ref={handleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        className={`relative z-20 h-10 sm:h-11 w-13 sm:w-14 rounded-xl flex items-center justify-center font-black shadow-md cursor-grab active:cursor-grabbing transition-transform ${
          isDragging ? "transition-none" : "duration-200 ease-out"
        } ${
          isAccept
            ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95"
            : "bg-rose-600 text-white hover:bg-rose-500 active:scale-95"
        } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
        style={{
          transform: `translateX(${dragX}px)`,
          touchAction: "pan-y",
        }}
      >
        {isSubmitting ? (
          <Loader2
            size={18}
            className={`animate-spin ${isAccept ? "text-slate-950" : "text-white"}`}
          />
        ) : isAccept ? (
          <div className="flex items-center gap-0.5">
            <Check size={16} className="stroke-[3]" />
            <ArrowRight size={13} className="opacity-70" />
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <X size={16} className="stroke-[3]" />
            <ArrowRight size={13} className="opacity-70" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SlideToAccept({
  bookingId,
  bookingReference,
  onSuccess,
  onReject,
  onError,
  disabled = false,
  className = "",
  isDevPreview = false,
  simulateRejectFailure = false,
  variant = "modal",
}: DualSlideActionProps) {
  const [status, setStatus] = useState<"IDLE" | "ACCEPTING" | "ACCEPTED" | "DECLINING" | "DECLINED">("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<"ACCEPT" | "DECLINE" | null>(null);

  // Submit acceptance to server
  const submitAccept = async () => {
    if (status !== "IDLE" || disabled) return;
    setStatus("ACCEPTING");
    setErrorMessage(null);
    setLastFailedAction(null);

    if (isDevPreview) {
      setTimeout(() => {
        setStatus("ACCEPTED");
        onSuccess?.({
          _id: bookingId,
          bookingReference: bookingReference || "DEV-PREVIEW",
          status: "DRIVER_ASSIGNED",
          isMock: true,
        });
      }, 700);
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg =
          data.error ||
          (res.status === 409
            ? "This ride has already been accepted by another driver"
            : "Failed to accept ride");
        setErrorMessage(errorMsg);
        setLastFailedAction("ACCEPT");
        setStatus("IDLE");
        onError?.(errorMsg);
        return;
      }

      setStatus("ACCEPTED");
      onSuccess?.(data.data || data.booking || data);
    } catch (err: any) {
      const errorMsg = err.message || "Network error. Please try again.";
      setErrorMessage(errorMsg);
      setLastFailedAction("ACCEPT");
      setStatus("IDLE");
      onError?.(errorMsg);
    }
  };

  // Submit rejection/decline to server
  const submitDecline = async () => {
    if (status !== "IDLE" || disabled) return;
    setStatus("DECLINING");
    setErrorMessage(null);
    setLastFailedAction(null);

    if (isDevPreview) {
      setTimeout(async () => {
        if (simulateRejectFailure) {
          setErrorMessage("Simulated decline failure: server returned 500");
          setLastFailedAction("DECLINE");
          setStatus("IDLE");
          return;
        }
        setStatus("DECLINED");
        if (onReject) {
          await onReject();
        }
      }, 700);
      return;
    }

    try {
      if (onReject) {
        // DriverOfferProvider handles persistent rejection and throws if failed
        await onReject();
      } else {
        const res = await fetch(`/api/bookings/${bookingId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to decline ride offer on server");
        }
      }

      setStatus("DECLINED");
    } catch (err: any) {
      // Rejection failed! Do NOT falsely report success or dismiss.
      const errorMsg = err.message || "Failed to decline offer. Please retry.";
      setErrorMessage(errorMsg);
      setLastFailedAction("DECLINE");
      setStatus("IDLE");
      onError?.(errorMsg);
    }
  };

  const isSubmitting = status === "ACCEPTING" || status === "DECLINING";
  const isLocked = disabled || isSubmitting || status === "ACCEPTED" || status === "DECLINED";

  if (variant === "single") {
    return (
      <div className={`w-full select-none ${className}`}>
        <SwipeTrack
          type="ACCEPT"
          isSubmitting={status === "ACCEPTING"}
          disabled={isLocked && status !== "ACCEPTING"}
          onConfirm={submitAccept}
          bookingReference={bookingReference}
          isModalVariant={true}
        />
        {errorMessage && (
          <p className="text-rose-600 text-xs font-semibold mt-1">{errorMessage}</p>
        )}
      </div>
    );
  }

  if (variant === "modal") {
    return (
      <div className={`w-full select-none space-y-2.5 ${className}`}>
        {/* 1. Green "Slide to Accept" with circular thumb */}
        <SwipeTrack
          type="ACCEPT"
          isSubmitting={status === "ACCEPTING"}
          disabled={isLocked && status !== "ACCEPTING"}
          onConfirm={submitAccept}
          bookingReference={bookingReference}
          isModalVariant={true}
        />

        {/* 2. "Decline ride" Button matching the reference design */}
        <button
          type="button"
          onClick={submitDecline}
          disabled={isLocked}
          style={{ backgroundColor: "#ffffff" }}
          className={`w-full h-12 sm:h-13 rounded-full border border-slate-900 text-slate-900 font-bold text-sm sm:text-base flex items-center justify-center transition-colors shadow-xs cursor-pointer hover:bg-slate-50 relative z-10 ${
            isLocked ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {status === "DECLINING" ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-slate-900" />
              <span>Declining...</span>
            </span>
          ) : (
            <span>Decline ride</span>
          )}
        </button>

        {/* Error Banner with Explicit Retry Button */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
            <p className="text-rose-800 text-xs font-semibold flex-1">
              {errorMessage}
            </p>
            {lastFailedAction === "DECLINE" && (
              <button
                type="button"
                onClick={submitDecline}
                disabled={isSubmitting}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RotateCw size={12} className={isSubmitting ? "animate-spin" : ""} />
                <span>Retry Decline</span>
              </button>
            )}
            {lastFailedAction === "ACCEPT" && !errorMessage.includes("already been accepted") && (
              <button
                type="button"
                onClick={submitAccept}
                disabled={isSubmitting}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RotateCw size={12} className={isSubmitting ? "animate-spin" : ""} />
                <span>Retry Accept</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Dual sliders variant (used if explicitly specified)
  return (
    <div className={`w-full select-none space-y-2.5 ${className}`}>
      {/* 1. Green "Slide to Accept" */}
      <SwipeTrack
        type="ACCEPT"
        isSubmitting={status === "ACCEPTING"}
        disabled={isLocked && status !== "ACCEPTING"}
        onConfirm={submitAccept}
        bookingReference={bookingReference}
      />

      {/* 2. Red "Slide to Decline" */}
      <SwipeTrack
        type="DECLINE"
        isSubmitting={status === "DECLINING"}
        disabled={isLocked && status !== "DECLINING"}
        onConfirm={submitDecline}
        bookingReference={bookingReference}
      />

      {/* Accessible Button Alternatives */}
      <div className="flex items-center justify-between gap-2 pt-1 min-w-0">
        <button
          type="button"
          onClick={submitDecline}
          disabled={isLocked}
          aria-label="Decline ride offer"
          className="flex-1 min-w-0 py-2 px-2 sm:px-3 bg-slate-800/80 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-600/70 text-slate-300 hover:text-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "DECLINING" ? (
            <Loader2 size={13} className="animate-spin text-rose-400 shrink-0" />
          ) : (
            <X size={13} className="text-rose-400 shrink-0" />
          )}
          <span className="truncate">Decline Offer</span>
        </button>

        <button
          type="button"
          onClick={submitAccept}
          disabled={isLocked}
          aria-label="Accept ride offer"
          className="flex-1 min-w-0 py-2 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "ACCEPTING" ? (
            <Loader2 size={13} className="animate-spin text-slate-950 shrink-0" />
          ) : (
            <Check size={13} className="stroke-[3] shrink-0" />
          )}
          <span className="truncate">Accept Ride</span>
        </button>
      </div>

      {/* Error Banner with Explicit Retry Button */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-950/80 border border-rose-500/60 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
          <p className="text-rose-200 text-xs font-semibold flex-1">
            {errorMessage}
          </p>
          {lastFailedAction === "DECLINE" && (
            <button
              type="button"
              onClick={submitDecline}
              disabled={isSubmitting}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black shrink-0 flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={12} className={isSubmitting ? "animate-spin" : ""} />
              <span>Retry Decline</span>
            </button>
          )}
          {lastFailedAction === "ACCEPT" && !errorMessage.includes("already been accepted") && (
            <button
              type="button"
              onClick={submitAccept}
              disabled={isSubmitting}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg text-xs font-black shrink-0 flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={12} className={isSubmitting ? "animate-spin" : ""} />
              <span>Retry Accept</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const DualSlideAction = SlideToAccept;
