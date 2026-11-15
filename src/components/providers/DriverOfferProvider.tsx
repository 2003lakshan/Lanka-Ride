"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/providers/SocketProvider";
import IncomingTripModal from "@/components/driver/IncomingTripModal";
import { soundManager } from "@/lib/sound";

export interface DriverOfferContextValue {
  activeOffer: any | null;
  offerQueue: any[];
  availableOffers: any[];
  isBusy: boolean;
  isDriverOnline: boolean;
  hasFreshGps: boolean;
  isUpdatingLocation: boolean;
  locationError: string | null;
  isInsecureContext: boolean;
  dismissActiveOffer: () => void;
  rejectOffer: (bookingId: string) => Promise<void>;
  dequeueNextOffer: () => void;
  refreshActiveOffers: () => Promise<void>;
  reportDriverLocation: () => Promise<void>;
  simulateDriverLocation: () => Promise<void>;
  toggleDriverOnline: () => Promise<void>;
}

const DriverOfferContext = createContext<DriverOfferContextValue | null>(null);

export function useDriverOffers() {
  const context = useContext(DriverOfferContext);
  return context;
}

export function useIncomingRides() {
  return useDriverOffers();
}

const ACTIVE_TRIP_STATUSES = [
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "PASSENGER_PICKED_UP",
  "TRIP_IN_PROGRESS",
];

/**
 * IncomingRideProvider: Persistent provider mounted in the authenticated driver layout.
 * Manages:
 * 1. Authoritative driver busy state (suppresses offers while on an active trip).
 * 2. Realtime dispatch socket events ("ride:offer", "ride:offer_withdrawn", "ride:offer_expired").
 * 3. Authenticated recovery of missed pending offers upon connection / reconnection / trip completion.
 * 4. Lightweight polling fallback while driver page is visible and socket is disconnected.
 * 5. Deduplication by offer ID and queueing of simultaneous offers.
 * 6. Display of IncomingTripModal with sound and gesture / accessible actions.
 */
export function IncomingRideProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const { socket, isConnected, registerReconnectHandler } = useSocket();
  const router = useRouter();

  const [activeOffer, setActiveOffer] = useState<any | null>(null);
  const [offerQueue, setOfferQueue] = useState<any[]>([]);
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [withdrawalAlert, setWithdrawalAlert] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Global online and GPS state across all pages
  const [isDriverOnline, setIsDriverOnline] = useState<boolean>(true);
  const [hasFreshGps, setHasFreshGps] = useState<boolean>(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isInsecureContext, setIsInsecureContext] = useState<boolean>(false);

  const isDriver = sessionStatus === "authenticated" && (session?.user as any)?.role === "DRIVER";
  const currentUserId = (session?.user as any)?.id;
  const processedOfferIds = useRef<Set<string>>(new Set());
  const rejectedBookingIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef<boolean>(false);
  const isBusyRef = useRef<boolean>(false);
  const activeOfferRef = useRef<any | null>(null);

  // Check secure context safely after mount
  useEffect(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setIsInsecureContext(true);
    }
  }, []);

  // Simulator for developer testing on LAN HTTP without HTTPS
  const simulateDriverLocation = useCallback(async () => {
    if (!isDriver) return;
    setIsUpdatingLocation(true);
    setLocationError(null);
    try {
      const res = await fetch("/api/driver/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: 6.9271,
          lng: 79.8612,
          isOnline: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHasFreshGps(Boolean(data.isFresh));
        setIsDriverOnline(true);
      }
    } catch {
      setLocationError("Failed to update simulated location");
    } finally {
      setIsUpdatingLocation(false);
    }
  }, [isDriver]);

  // Report real driver GPS location to server heartbeat across any page
  const reportDriverLocation = useCallback(async () => {
    if (!isDriver) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLocationError("Mobile browsers block GPS on unencrypted HTTP. Tap 'Test GPS' to simulate, or use HTTPS.");
      setHasFreshGps(false);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setHasFreshGps(false);
      return;
    }

    setIsUpdatingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch("/api/driver/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: latitude,
              lng: longitude,
              isOnline: true,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setHasFreshGps(Boolean(data.isFresh));
            setIsDriverOnline(true);
          } else {
            setHasFreshGps(false);
          }
        } catch {
          // ignore network error
        } finally {
          setIsUpdatingLocation(false);
        }
      },
      (err) => {
        setLocationError(err.message || "Failed to acquire GPS");
        setHasFreshGps(false);
        setIsUpdatingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [isDriver]);

  // Fetch initial driver heartbeat and sync status across all pages
  useEffect(() => {
    if (!isDriver) return;
    let active = true;

    fetch("/api/driver/heartbeat")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setIsDriverOnline(Boolean(data.isOnline));
        setHasFreshGps(Boolean(data.isFresh));
        if (data.isOnline) {
          reportDriverLocation();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isDriver, reportDriverLocation]);

  // Periodic heartbeat every 25 seconds across all pages while driver is online
  useEffect(() => {
    if (!isDriver || !isDriverOnline) return;
    const interval = setInterval(() => {
      reportDriverLocation();
    }, 25000);
    return () => clearInterval(interval);
  }, [isDriver, isDriverOnline, reportDriverLocation]);

  const toggleDriverOnline = useCallback(async () => {
    if (!isDriver) return;
    const next = !isDriverOnline;
    setIsDriverOnline(next);

    // Initialize and prime ringtone player on direct driver user gesture
    soundManager.initializeRingtonePlayer().catch(() => {});

    try {
      await fetch("/api/driver/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: next }),
      });
      if (next) {
        reportDriverLocation();
      }
    } catch {}
  }, [isDriver, isDriverOnline, reportDriverLocation]);

  // Declarative sound and notification management when activeOffer transitions
  useEffect(() => {
    activeOfferRef.current = activeOffer;
    if (activeOffer) {
      const bId = (activeOffer.bookingId || activeOffer._id)?.toString();
      soundManager.startRinging(bId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lar:close-notifications"));
      }
      return () => {
        soundManager.stopRinging(bId);
      };
    }
  }, [activeOffer]);

  // Dequeue next valid unexpired offer from queue
  const dequeueNextOffer = useCallback(() => {
    if (isBusyRef.current) {
      setActiveOffer(null);
      setOfferQueue([]);
      return;
    }

    setOfferQueue((prev) => {
      if (prev.length > 0) {
        const [next, ...rest] = prev;
        queueMicrotask(() => {
          setActiveOffer(next);
        });
        return rest;
      }
      queueMicrotask(() => {
        setActiveOffer(null);
      });
      return [];
    });
  }, []);

  const dismissActiveOffer = useCallback(() => {
    setActiveOffer(null);
    dequeueNextOffer();
  }, [dequeueNextOffer]);

  const rejectOffer = useCallback(
    async (bookingId: string) => {
      const res = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to persist rejection on server");
      }

      rejectedBookingIdsRef.current.add(bookingId);

      setAvailableOffers((prev) =>
        prev.filter((o) => (o.bookingId || o._id).toString() !== bookingId)
      );
      setOfferQueue((prev) =>
        prev.filter((o) => (o.bookingId || o._id).toString() !== bookingId)
      );

      if (
        activeOfferRef.current &&
        (activeOfferRef.current.bookingId || activeOfferRef.current._id).toString() === bookingId
      ) {
        setActiveOffer(null);
        dequeueNextOffer();
      }
    },
    [dequeueNextOffer]
  );

  // Reconcile active offers from authenticated server endpoint
  const refreshActiveOffers = useCallback(async () => {
    if (!isDriver) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      const res = await fetch("/api/driver/offers/active");
      if (!res.ok) return;
      const data = await res.json();

      // Check authoritative busy state
      if (data.hasActiveTrip === true) {
        isBusyRef.current = true;
        setIsBusy(true);
        setActiveOffer(null);
        setOfferQueue([]);
        setAvailableOffers([]);
        return;
      }

      // Driver is available
      isBusyRef.current = false;
      setIsBusy(false);

      const offers: any[] = data.offers || [];
      const validOffers = offers.filter((o) => {
        const bId = (o.bookingId || o._id)?.toString();
        return !rejectedBookingIdsRef.current.has(bId);
      });

      setAvailableOffers(validOffers);

      if (!activeOfferRef.current && validOffers.length > 0) {
        setActiveOffer(validOffers[0]);
        setOfferQueue(validOffers.slice(1));
      } else if (activeOfferRef.current) {
        const currentBId = (activeOfferRef.current.bookingId || activeOfferRef.current._id)?.toString();
        const stillValid = validOffers.some(
          (o) => (o.bookingId || o._id)?.toString() === currentBId
        );
        if (!stillValid) {
          if (validOffers.length > 0) {
            setActiveOffer(validOffers[0]);
            setOfferQueue(validOffers.slice(1));
          } else {
            setActiveOffer(null);
            setOfferQueue([]);
          }
        }
      }
    } catch (err: any) {
      console.warn("[IncomingRideProvider] Refresh active offers error:", err.message);
    } finally {
      isFetchingRef.current = false;
    }
  }, [isDriver]);

  // Initial fetch on driver mount
  useEffect(() => {
    if (isDriver) {
      refreshActiveOffers();
    }
  }, [isDriver, refreshActiveOffers]);

  // Handle socket reconnect recovery
  useEffect(() => {
    if (!isDriver) return;
    return registerReconnectHandler(() => {
      refreshActiveOffers();
    });
  }, [isDriver, registerReconnectHandler, refreshActiveOffers]);

  // Realtime listeners for direct socket updates
  useEffect(() => {
    if (!isDriver || !socket) return;

    const handleRideOffer = (offer: any) => {
      if (!offer || !offer.bookingId) return;

      // DO NOT send, return, display, queue, or ring new offers for a busy driver
      if (isBusyRef.current) {
        return;
      }

      const bId = offer.bookingId.toString();
      const offerId = offer.offerId || `offer_${bId}`;

      // Reconcile late socket events against saved rejections
      if (rejectedBookingIdsRef.current.has(bId)) {
        return;
      }

      // Deduplicate by offer ID
      if (processedOfferIds.current.has(offerId)) {
        return;
      }
      processedOfferIds.current.add(offerId);

      setAvailableOffers((prev) => {
        if (prev.some((item) => (item.bookingId || item._id).toString() === bId)) {
          return prev;
        }
        return [offer, ...prev];
      });

      if (!activeOfferRef.current) {
        setActiveOffer(offer);
      } else {
        setOfferQueue((q) => {
          if (q.some((item) => (item.bookingId || item._id).toString() === bId)) {
            return q;
          }
          return [...q, offer];
        });
      }
    };

    const handleRideOfferWithdrawn = (data: any) => {
      if (!data?.bookingId) return;
      const bId = data.bookingId.toString();

      setOfferQueue((q) => q.filter((item) => (item.bookingId || item._id).toString() !== bId));
      setAvailableOffers((prev) =>
        prev.filter((item) => (item.bookingId || item._id).toString() !== bId)
      );

      if (
        activeOfferRef.current &&
        (activeOfferRef.current.bookingId || activeOfferRef.current._id).toString() === bId
      ) {
        setWithdrawalAlert("This ride has already been accepted or cancelled");
        setTimeout(() => setWithdrawalAlert(null), 5000);
        setActiveOffer(null);
        dequeueNextOffer();
      }
    };

    const handleRideOfferExpired = (data: any) => {
      if (!data?.bookingId) return;
      const bId = data.bookingId.toString();

      setOfferQueue((q) => q.filter((item) => (item.bookingId || item._id).toString() !== bId));
      setAvailableOffers((prev) =>
        prev.filter((item) => (item.bookingId || item._id).toString() !== bId)
      );

      if (
        activeOfferRef.current &&
        (activeOfferRef.current.bookingId || activeOfferRef.current._id).toString() === bId
      ) {
        setActiveOffer(null);
        dequeueNextOffer();
      }
    };

    // Listen for trip assignments or status transitions affecting this driver
    const handleStatusChanged = (data: any) => {
      if (!data?.bookingId) return;
      const assignedDriverId = data.driverId || data.booking?.driverId;
      const isAssignedToThisDriver =
        assignedDriverId &&
        (assignedDriverId._id || assignedDriverId).toString() === currentUserId;

      if (isAssignedToThisDriver) {
        if (ACTIVE_TRIP_STATUSES.includes(data.status)) {
          // Driver became busy
          isBusyRef.current = true;
          setIsBusy(true);
          setActiveOffer(null);
          setOfferQueue([]);
          setAvailableOffers([]);
        } else if (data.status === "COMPLETED" || data.status === "CANCELLED") {
          // Driver completed or cancelled active assignment: release busy state and immediately refresh offers!
          isBusyRef.current = false;
          setIsBusy(false);
          refreshActiveOffers();
        }
      }
    };

    const handleDriverAccepted = (data: any) => {
      const acceptedDriverId = data.driver?.id || data.driver?._id || data.booking?.driverId;
      if (acceptedDriverId && acceptedDriverId.toString() === currentUserId) {
        // Driver accepted a trip
        isBusyRef.current = true;
        setIsBusy(true);
        setActiveOffer(null);
        setOfferQueue([]);
        setAvailableOffers([]);
      }
    };

    socket.on("ride:offer", handleRideOffer);
    socket.on("ride:offer_withdrawn", handleRideOfferWithdrawn);
    socket.on("ride:offer_expired", handleRideOfferExpired);
    socket.on("booking:status_changed", handleStatusChanged);
    socket.on("booking:driver_accepted", handleDriverAccepted);

    return () => {
      socket.off("ride:offer", handleRideOffer);
      socket.off("ride:offer_withdrawn", handleRideOfferWithdrawn);
      socket.off("ride:offer_expired", handleRideOfferExpired);
      socket.off("booking:status_changed", handleStatusChanged);
      socket.off("booking:driver_accepted", handleDriverAccepted);
    };
  }, [isDriver, socket, currentUserId, dequeueNextOffer, refreshActiveOffers]);

  // Lightweight polling fallback while online driver page is visible
  useEffect(() => {
    if (!isDriver) return;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted || document.hidden || isFetchingRef.current) return;
      await refreshActiveOffers();
    };

    // If socket is disconnected, poll every 3.5s; if connected, periodic sync every 15s
    const pollIntervalMs = isConnected ? 15000 : 3500;
    const interval = setInterval(poll, pollIntervalMs);

    const handleVisibility = () => {
      if (!document.hidden && isMounted) {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isDriver, isConnected, refreshActiveOffers]);

  // Offers stay active on screen until the driver slides to decline (rejects) or accepts
  // No automatic timeout clearing: the card remains visible and audible until driver decision.

  // Handle successful acceptance
  const handleAccepted = (acceptedBooking: any) => {
    const bId = acceptedBooking._id || acceptedBooking.id || activeOffer?.bookingId;
    if (bId) {
      soundManager.stopRinging(bId);
    }
    isBusyRef.current = true;
    setIsBusy(true);
    setActiveOffer(null);
    setOfferQueue([]);
    setAvailableOffers((prev) =>
      prev.filter((o) => (o.bookingId || o._id).toString() !== bId?.toString())
    );
    if (bId) {
      router.push(`/driver/booking/${bId}`);
    }
  };

  const contextValue: DriverOfferContextValue = {
    activeOffer,
    offerQueue,
    availableOffers,
    isBusy,
    isDriverOnline,
    hasFreshGps,
    isUpdatingLocation,
    locationError,
    isInsecureContext,
    dismissActiveOffer,
    rejectOffer,
    dequeueNextOffer,
    refreshActiveOffers,
    reportDriverLocation,
    simulateDriverLocation,
    toggleDriverOnline,
  };

  return (
    <DriverOfferContext.Provider value={contextValue}>
      {children}

      {/* Persistent global Incoming Trip Popup for drivers across all driver pages (Suppressed when driver is busy) */}
      {isDriver && !isBusy && activeOffer && (
        <IncomingTripModal
          trip={activeOffer}
          onDismiss={dismissActiveOffer}
          onAccepted={handleAccepted}
          onRejected={async () => {
            const bId = (activeOffer.bookingId || activeOffer._id)?.toString();
            if (bId) {
              await rejectOffer(bId);
            }
          }}
        />
      )}

      {/* Withdrawal Notification Banner */}
      {withdrawalAlert && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 border border-amber-500/80 text-amber-300 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300 text-xs font-bold">
          <span>{withdrawalAlert}</span>
        </div>
      )}
    </DriverOfferContext.Provider>
  );
}

// Backward compatibility aliases
export const DriverOfferProvider = IncomingRideProvider;
export default IncomingRideProvider;
