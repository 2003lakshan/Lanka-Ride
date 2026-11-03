"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSocket } from "@/components/providers/SocketProvider";

export type TrackingStatus =
  | "IDLE"                  // No active assigned trip
  | "PERMISSION_REQUIRED"   // Active trip exists, need driver to tap "Enable Location"
  | "PERMISSION_BLOCKED"    // Location permission denied in browser settings
  | "INSECURE_CONTEXT"      // HTTP context where browser disables Geolocation
  | "STARTING_GPS"          // Permission granted, acquiring satellite lock
  | "LIVE"                  // Successfully uploaded fresh coordinates (±Xm)
  | "LOCATION_UNAVAILABLE"  // GPS hardware off or position unavailable
  | "CONNECTION_LOST";      // Network offline during upload

export interface LastUploadInfo {
  timestamp: number;
  accuracy: number;
  lat: number;
  lng: number;
}

export interface DriverTrackingContextValue {
  trackingStatus: TrackingStatus;
  statusText: string;
  activeBooking: any | null;
  driverLoc: { lat: number; lng: number } | null;
  lastSuccessfulUpload: LastUploadInfo | null;
  isBackgrounded: boolean;
  permissionError: string | null;
  setActiveBooking: (booking: any | null) => void;
  requestLocationPermission: () => Promise<void>;
  retryTracking: () => void;
  stopTracking: (reason?: string) => void;
}

const DriverTrackingContext = createContext<DriverTrackingContextValue | null>(null);

const ACTIVE_STATUSES = [
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "PASSENGER_PICKED_UP",
  "TRIP_IN_PROGRESS",
];

export function DriverTrackingProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const { socket } = useSocket();

  const [activeBooking, setActiveBookingState] = useState<any | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("IDLE");
  const [statusText, setStatusText] = useState<string>("Location sharing idle");
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [lastSuccessfulUpload, setLastSuccessfulUpload] = useState<LastUploadInfo | null>(null);
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Single watcher, upload timer, and in-flight tracking refs
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const isUploadingRef = useRef(false);
  const isTrackingRef = useRef(false);

  // Stored GPS samples
  const latestSampleRef = useRef<{
    lat: number;
    lng: number;
    accuracy: number;
    capturedAt: number;
  } | null>(null);

  const lastUploadedCapturedAtRef = useRef<number>(0);
  const activeTripIdRef = useRef<string | null>(null);
  const activeTripStatusRef = useRef<string | null>(null);

  const isDriver = session?.user && (session.user as any).role === "DRIVER";
  const currentUserId = session?.user ? (session.user as any).id : null;

  // Clean up all GPS watchers and upload timers
  const stopGpsWatcherAndUploadLoop = useCallback((reason?: string) => {
    isTrackingRef.current = false;

    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    isUploadingRef.current = false;

    if (reason) {
      setStatusText(reason);
    }
  }, []);

  // Public stop tracking
  const stopTracking = useCallback((reason?: string) => {
    stopGpsWatcherAndUploadLoop(reason || "Location sharing stopped.");
    setTrackingStatus("IDLE");
  }, [stopGpsWatcherAndUploadLoop]);

  // Non-overlapping 3-second upload loop
  const scheduleNextUpload = useCallback(() => {
    if (!isTrackingRef.current || !activeTripIdRef.current) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      if (!isTrackingRef.current || !activeTripIdRef.current) return;

      const sample = latestSampleRef.current;
      const tripId = activeTripIdRef.current;

      // Only upload if a fresh sample arrived that has not yet been uploaded
      if (sample && sample.capturedAt > lastUploadedCapturedAtRef.current) {
        if (!isUploadingRef.current) {
          isUploadingRef.current = true;
          try {
            const res = await fetch("/api/driver/location", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bookingId: tripId,
                lat: sample.lat,
                lng: sample.lng,
                accuracy: sample.accuracy,
                capturedAt: new Date(sample.capturedAt).toISOString(),
              }),
            });

            if (res.ok) {
              const resData = await res.json().catch(() => ({}));
              lastUploadedCapturedAtRef.current = sample.capturedAt;
              const now = Date.now();
              setLastSuccessfulUpload({
                timestamp: now,
                accuracy: sample.accuracy,
                lat: sample.lat,
                lng: sample.lng,
              });
              setTrackingStatus("LIVE");
              setStatusText(`Live location sharing (±${Math.round(sample.accuracy)}m)`);
              if (resData.autoArrived) {
                setActiveBookingState((prev: any) =>
                  prev ? {
                    ...prev,
                    status: "DRIVER_ARRIVED",
                    arrivalSource: "GPS",
                    arrivedAt: resData.arrivedAt,
                  } : null
                );
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              if (errData.status === "COMPLETED" || errData.status === "CANCELLED" || errData.status === "REFUNDED") {
                stopGpsWatcherAndUploadLoop("Trip ended. Location sharing closed.");
                setTrackingStatus("IDLE");
                setActiveBookingState(null);
                activeTripIdRef.current = null;
                return;
              } else {
                setStatusText(`Upload issue: ${errData.error || "Server rejected update"}`);
              }
            }
          } catch (e: any) {
            setTrackingStatus("CONNECTION_LOST");
            setStatusText("Connection lost: Retrying upload in 3s...");
          } finally {
            isUploadingRef.current = false;
          }
        }
      } else if (sample && sample.capturedAt <= lastUploadedCapturedAtRef.current) {
        // Sample exists but has not changed: awaiting fresh GPS fix from device
        // Do not present old coordinates as newly captured
        if (lastUploadedCapturedAtRef.current > 0) {
          const secsAgo = Math.round((Date.now() - lastUploadedCapturedAtRef.current) / 1000);
          if (secsAgo > 15) {
            setStatusText(`Awaiting fresh GPS fix... (last sent ${secsAgo}s ago)`);
          }
        }
      }

      // Continue non-overlapping 3-second upload loop
      if (isTrackingRef.current) {
        scheduleNextUpload();
      }
    }, 3000);
  }, [stopGpsWatcherAndUploadLoop]);

  // Start single high-accuracy GPS watcher and kick off upload loop
  const startGpsWatcherAndUploadLoop = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setTrackingStatus("LOCATION_UNAVAILABLE");
      setStatusText("Geolocation is not supported by your browser.");
      return;
    }

    // Check secure context
    const isSecure =
      window.isSecureContext !== false ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "https:";

    if (!isSecure) {
      setTrackingStatus("INSECURE_CONTEXT");
      setPermissionError("GPS sharing requires a secure context (HTTPS or localhost). Geolocation is blocked by your browser on unencrypted HTTP.");
      setStatusText("HTTPS or localhost required for GPS");
      return;
    }

    // Prevent duplicate watchers
    if (watchIdRef.current !== null) {
      return;
    }

    isTrackingRef.current = true;
    setTrackingStatus("STARTING_GPS");
    setStatusText("Starting GPS: Acquiring satellite fix...");
    setPermissionError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setPermissionError(null);
        const { latitude, longitude, accuracy } = position.coords;
        const capturedAt = position.timestamp || Date.now();

        // Store latest fresh sample with capture timestamp and accuracy
        latestSampleRef.current = {
          lat: latitude,
          lng: longitude,
          accuracy,
          capturedAt,
        };

        // Update driver marker coordinates immediately
        setDriverLoc({ lat: latitude, lng: longitude });

        // If no upload has succeeded yet, inform the driver of GPS lock
        if (lastUploadedCapturedAtRef.current === 0) {
          setStatusText(`GPS fix acquired (±${Math.round(accuracy)}m). Uploading...`);
        }
      },
      (error) => {
        console.warn("Geolocation watch error:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionError("GPS permission denied. Please allow location access in your browser settings.");
          setStatusText("GPS permission blocked");
          setTrackingStatus("PERMISSION_BLOCKED");
          stopGpsWatcherAndUploadLoop();
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setTrackingStatus("LOCATION_UNAVAILABLE");
          setStatusText("Location unavailable: Ensure device GPS is turned on.");
        } else if (error.code === error.TIMEOUT) {
          setStatusText("GPS acquiring satellite lock (retrying)...");
        } else {
          setStatusText(`GPS error: ${error.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    // Kick off non-overlapping 3-second upload loop
    scheduleNextUpload();
  }, [scheduleNextUpload, stopGpsWatcherAndUploadLoop]);

  // Explicit action for driver to request permission or start
  const requestLocationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setTrackingStatus("LOCATION_UNAVAILABLE");
      setPermissionError("Geolocation is not supported by your browser.");
      return;
    }

    // Check secure context
    const isSecure =
      window.isSecureContext !== false ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "https:";

    if (!isSecure) {
      setTrackingStatus("INSECURE_CONTEXT");
      setPermissionError("GPS sharing requires a secure context (HTTPS or localhost). Geolocation is blocked by your browser on unencrypted HTTP.");
      setStatusText("HTTPS or localhost required for GPS");
      return;
    }

    setTrackingStatus("STARTING_GPS");
    setStatusText("Requesting location permission...");
    setPermissionError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const capturedAt = position.timestamp || Date.now();
        latestSampleRef.current = { lat: latitude, lng: longitude, accuracy, capturedAt };
        setDriverLoc({ lat: latitude, lng: longitude });
        startGpsWatcherAndUploadLoop();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionError("GPS permission denied. Please allow location access in your browser settings.");
          setStatusText("GPS permission blocked");
          setTrackingStatus("PERMISSION_BLOCKED");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setTrackingStatus("LOCATION_UNAVAILABLE");
          setStatusText("Location unavailable: Ensure device GPS is turned on.");
        } else {
          setStatusText(`GPS error: ${error.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [startGpsWatcherAndUploadLoop]);

  // Retry tracking (e.g. after user changed settings or turned on GPS)
  const retryTracking = useCallback(() => {
    setPermissionError(null);
    requestLocationPermission();
  }, [requestLocationPermission]);

  // Set active booking from anywhere in driver pages
  const setActiveBooking = useCallback((booking: any | null) => {
    if (!booking) {
      activeTripIdRef.current = null;
      activeTripStatusRef.current = null;
      setActiveBookingState(null);
      stopGpsWatcherAndUploadLoop();
      setTrackingStatus("IDLE");
      setStatusText("Location sharing idle");
      return;
    }

    const tripId = (booking._id || booking.id).toString();
    const tripStatus = booking.status;
    const isAssigned =
      booking.driverId &&
      (booking.driverId._id || booking.driverId).toString() === currentUserId;

    if (!isAssigned || !ACTIVE_STATUSES.includes(tripStatus)) {
      activeTripIdRef.current = null;
      activeTripStatusRef.current = null;
      setActiveBookingState(null);
      stopGpsWatcherAndUploadLoop("Trip not active or not assigned to driver.");
      setTrackingStatus("IDLE");
      return;
    }

    activeTripIdRef.current = tripId;
    activeTripStatusRef.current = tripStatus;
    setActiveBookingState(booking);
  }, [currentUserId, stopGpsWatcherAndUploadLoop]);

  // On session change or active booking update: check permission and start automatic tracking
  useEffect(() => {
    // Only track if driver is logged in and has an active trip
    if (!isDriver || sessionStatus !== "authenticated" || !activeBooking) {
      if (isTrackingRef.current) {
        stopGpsWatcherAndUploadLoop();
        setTrackingStatus("IDLE");
        setStatusText("Location sharing idle");
      }
      return;
    }

    const tripStatus = activeBooking.status;
    if (!ACTIVE_STATUSES.includes(tripStatus)) {
      stopGpsWatcherAndUploadLoop("Trip ended.");
      setTrackingStatus("IDLE");
      return;
    }

    // Check secure context
    const isSecure =
      window.isSecureContext !== false ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "https:";

    if (!isSecure) {
      setTrackingStatus("INSECURE_CONTEXT");
      setPermissionError("GPS sharing requires a secure context (HTTPS or localhost). Geolocation is blocked by your browser on unencrypted HTTP.");
      setStatusText("HTTPS or localhost required for GPS");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTrackingStatus("LOCATION_UNAVAILABLE");
      setStatusText("Geolocation is not supported by your browser.");
      return;
    }

    // Check permission state via Permissions API
    if (typeof navigator.permissions !== "undefined" && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" as any })
        .then((permissionStatus) => {
          if (permissionStatus.state === "granted") {
            // Already granted: Start automatically without requiring a click!
            startGpsWatcherAndUploadLoop();
          } else if (permissionStatus.state === "denied") {
            setTrackingStatus("PERMISSION_BLOCKED");
            setPermissionError("GPS permission blocked. Please allow location access in your browser settings.");
            setStatusText("GPS permission blocked");
          } else {
            // 'prompt': Show explanation and Enable Location button
            setTrackingStatus("PERMISSION_REQUIRED");
            setStatusText("Permission needed: Please enable location to share with rider & admin.");
          }

          permissionStatus.onchange = () => {
            if (permissionStatus.state === "granted" && activeTripIdRef.current) {
              setPermissionError(null);
              startGpsWatcherAndUploadLoop();
            } else if (permissionStatus.state === "denied") {
              setTrackingStatus("PERMISSION_BLOCKED");
              setPermissionError("GPS permission blocked. Please allow location access in your browser settings.");
              setStatusText("GPS permission blocked");
              stopGpsWatcherAndUploadLoop();
            }
          };
        })
        .catch(() => {
          // Fallback if query throws: attempt start directly
          startGpsWatcherAndUploadLoop();
        });
    } else {
      // Browser doesn't support navigator.permissions: attempt start directly
      startGpsWatcherAndUploadLoop();
    }
  }, [isDriver, sessionStatus, activeBooking, startGpsWatcherAndUploadLoop, stopGpsWatcherAndUploadLoop]);

  // Initial load / refresh check: fetch driver's active trip from backend
  useEffect(() => {
    if (!isDriver || sessionStatus !== "authenticated") return;

    let isMounted = true;
    fetch("/api/driver/active-trip")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.activeBooking) {
          setActiveBooking(data.activeBooking);
        }
      })
      .catch((err) => {
        console.warn("Failed to check active trip on mount:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isDriver, sessionStatus, setActiveBooking]);

  // Document visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBackgrounded(true);
      } else {
        setIsBackgrounded(false);
        // Resume and obtain fresh position when page becomes visible again
        if (isTrackingRef.current && typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy } = pos.coords;
              const capturedAt = pos.timestamp || Date.now();
              latestSampleRef.current = { lat: latitude, lng: longitude, accuracy, capturedAt };
              setDriverLoc({ lat: latitude, lng: longitude });

              // If fresh, schedule an upload immediately
              if (capturedAt > lastUploadedCapturedAtRef.current && !isUploadingRef.current) {
                scheduleNextUpload();
              }
            },
            (err) => console.warn("Foreground position refresh error:", err),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [scheduleNextUpload]);

  // Realtime socket listeners for status updates
  useEffect(() => {
    if (!socket) return;

    const handleStatusChanged = (data: any) => {
      if (activeTripIdRef.current && data.bookingId === activeTripIdRef.current) {
        if (["COMPLETED", "CANCELLED", "REFUNDED"].includes(data.status)) {
          stopGpsWatcherAndUploadLoop("Trip ended. Location sharing closed.");
          setTrackingStatus("IDLE");
          setActiveBookingState(null);
          activeTripIdRef.current = null;
        } else {
          setActiveBookingState((prev: any) =>
            prev ? {
              ...prev,
              status: data.status,
              arrivalSource: data.arrivalSource ?? prev.arrivalSource,
              arrivedAt: data.arrivedAt ?? prev.arrivedAt,
            } : null
          );
        }
      }
    };

    socket.on("booking:status_changed", handleStatusChanged);
    return () => {
      socket.off("booking:status_changed", handleStatusChanged);
    };
  }, [socket, stopGpsWatcherAndUploadLoop]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopGpsWatcherAndUploadLoop();
    };
  }, [stopGpsWatcherAndUploadLoop]);

  const value: DriverTrackingContextValue = {
    trackingStatus,
    statusText,
    activeBooking,
    driverLoc,
    lastSuccessfulUpload,
    isBackgrounded,
    permissionError,
    setActiveBooking,
    requestLocationPermission,
    retryTracking,
    stopTracking,
  };

  return (
    <DriverTrackingContext.Provider value={value}>
      {children}
    </DriverTrackingContext.Provider>
  );
}

export function useDriverTracking(): DriverTrackingContextValue {
  const context = useContext(DriverTrackingContext);
  if (!context) {
    throw new Error("useDriverTracking must be used within a DriverTrackingProvider");
  }
  return context;
}
