"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSocket } from "@/components/providers/SocketProvider";
import { soundManager, SoundState } from "@/lib/sound";
import { Volume2, VolumeX, X, Play, Bell, ShieldCheck, Car, Package, ExternalLink } from "lucide-react";
import Link from "next/link";

interface NotificationToast {
  id: string;
  title: string;
  message: string;
  link?: string;
  category?: "admin" | "driver" | "system";
  bookingId?: string;
  isRideAlert?: boolean;
  createdAt: number;
}

// Self-initiated submission events that must remain silent for the user (no chime or ringtone)
const SILENT_NOTIFICATION_TYPES = new Set([
  "BOOKING_SUBMITTED",
  "PACKAGE_ENQUIRY_SUBMITTED",
  "REGISTRATION_RECEIVED",
]);

/**
 * Determines whether a notification is an incoming ride or trip alert intended for drivers.
 * Ride alerts ring with the physical ring bell rather than standard chimes.
 */
function isRideAlertNotification(notif: any, userRole?: string): boolean {
  if (userRole !== "DRIVER") return false;
  const type = String(notif?.type || "");
  const title = String(notif?.title || "").toLowerCase();
  const message = String(notif?.message || "").toLowerCase();
  const link = String(notif?.link || "");

  if (
    type === "NEW_AVAILABLE_TRIP" ||
    type === "NEW_PICKME_RIDE" ||
    type === "RIDE_OFFER" ||
    type === "BOOKING_AVAILABLE" ||
    type === "LOCAL_RIDE"
  ) {
    return true;
  }

  if (
    title.includes("ride available") ||
    title.includes("trip available") ||
    title.includes("new ride") ||
    title.includes("new trip") ||
    message.includes("ride available") ||
    message.includes("available for acceptance") ||
    link.includes("/driver")
  ) {
    return true;
  }

  return false;
}

interface NotificationSoundContextValue {
  soundEnabled: boolean;
  audioUnlocked: boolean;
  audioBlocked: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  unlockAudio: () => Promise<boolean>;
  testSound: () => Promise<boolean>;
}

const NotificationSoundContext = createContext<NotificationSoundContextValue>({
  soundEnabled: true,
  audioUnlocked: false,
  audioBlocked: false,
  setSoundEnabled: () => {},
  unlockAudio: async () => false,
  testSound: async () => false,
});

export const useNotificationSound = () => useContext(NotificationSoundContext);

export function NotificationSoundProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const { socket, isConnected } = useSocket();

  const [soundState, setSoundState] = useState<SoundState>(soundManager.getState());
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [dismissedUnlockBanner, setDismissedUnlockBanner] = useState<boolean>(false);

  // Event deduplication sets
  const seenEventIds = useRef<Set<string>>(new Set());
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const isInitialPollDone = useRef<boolean>(false);
  const lastKnownNotificationTime = useRef<number>(Date.now());
  const activeRideToastIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to SoundManager state
  useEffect(() => {
    return soundManager.subscribe((state) => {
      setSoundState(state);
      // If audio becomes blocked, un-dismiss the unlock banner so user can tap to re-enable
      if (state.audioBlocked) {
        setDismissedUnlockBanner(false);
      }
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target?.isRideAlert || activeRideToastIdsRef.current.has(id)) {
        activeRideToastIdsRef.current.delete(id);
        soundManager.stopRinging(id);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(0);
          } catch {}
        }
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const addToast = useCallback((toast: NotificationToast) => {
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== toast.id);
      return [toast, ...filtered.slice(0, 4)];
    });

    if (toast.isRideAlert) {
      activeRideToastIdsRef.current.add(toast.id);
      soundManager.startRinging(toast.id);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([400, 250, 400, 250, 400]);
        } catch {}
      }
    }

    // Auto dismiss: 22s for ride offers (sufficient time to hear ringing & respond), 10s for general alerts
    const dismissDurationMs = toast.isRideAlert ? 22000 : 10000;
    setTimeout(() => {
      removeToast(toast.id);
    }, dismissDurationMs);
  }, [removeToast]);

  // -------------------------------------------------------------
  // REALTIME WEBSOCKET EVENT LISTENERS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!socket || sessionStatus !== "authenticated" || !session?.user) return;

    const userRole = (session?.user as any)?.role;

    // 1. Direct Notification Delivery
    const handleLiveNotification = (data: any) => {
      const notif = data?.notification;
      if (!notif) return;
      const notifId = notif._id || `notif_${Date.now()}`;
      if (seenNotificationIds.current.has(notifId)) return;
      seenNotificationIds.current.add(notifId);
      seenEventIds.current.add(notifId);

      lastKnownNotificationTime.current = Math.max(
        lastKnownNotificationTime.current,
        new Date(notif.createdAt || Date.now()).getTime()
      );

      const isRide = isRideAlertNotification(notif, userRole);

      // Ride offers trigger ringing bell in addToast. For general non-silent notifications, play standard chime
      if (!isRide && !SILENT_NOTIFICATION_TYPES.has(notif.type)) {
        soundManager.playNotificationSound(notifId);
      }

      addToast({
        id: notifId,
        title: notif.title || (isRide ? "New Ride Available!" : "New Notification"),
        message: notif.message || "",
        link: notif.link || (isRide ? "/driver" : undefined),
        category: userRole === "ADMIN" ? "admin" : userRole === "DRIVER" ? "driver" : "system",
        isRideAlert: isRide,
        createdAt: Date.now(),
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lar:notifications-updated"));
      }
    };

    // 2. Admin: Rider submitted a new custom trip
    const handleCustomTripSubmitted = (data: any) => {
      if (userRole !== "ADMIN") return;
      const booking = data?.booking;
      const eventId = `admin_custom_submit_${booking?._id || Date.now()}`;
      if (seenEventIds.current.has(eventId)) return;
      seenEventIds.current.add(eventId);

      soundManager.playNotificationSound(eventId);

      addToast({
        id: eventId,
        title: "New Custom Trip Request",
        message: `Rider requested custom trip ${booking?.bookingReference || ""}. Approval and pricing required.`,
        link: booking?._id ? `/admin/custom-trips/${booking._id}` : "/admin/trips",
        category: "admin",
        bookingId: booking?._id,
        createdAt: Date.now(),
      });
    };

    // 3. Admin: Rider updated custom trip
    const handleCustomTripUpdated = (data: any) => {
      if (userRole !== "ADMIN") return;
      const booking = data?.booking;
      const eventId = `admin_custom_update_${booking?._id || Date.now()}_${booking?.updatedAt || Date.now()}`;
      if (seenEventIds.current.has(eventId)) return;
      seenEventIds.current.add(eventId);

      soundManager.playNotificationSound(eventId);

      addToast({
        id: eventId,
        title: "Trip Request Updated",
        message: `Rider modified custom trip ${booking?.bookingReference || ""}.`,
        link: booking?._id ? `/admin/custom-trips/${booking._id}` : "/admin/trips",
        category: "admin",
        bookingId: booking?._id,
        createdAt: Date.now(),
      });
    };

    // 4. Admin / Driver: Standard booking submitted or updated
    const handleBookingUpdated = (data: any) => {
      const booking = data?.booking;
      if (!booking) return;

      if (userRole === "ADMIN" && booking.status === "CONFIRMED") {
        const eventId = `admin_booking_confirmed_${booking._id}`;
        if (seenEventIds.current.has(eventId)) return;
        seenEventIds.current.add(eventId);

        soundManager.playNotificationSound(eventId);

        addToast({
          id: eventId,
          title: "New Booking Confirmed",
          message: `Booking ${booking.bookingReference} has been paid and confirmed.`,
          link: `/admin/trips/${booking._id}`,
          category: "admin",
          createdAt: Date.now(),
        });
      }
    };

    // 5. Driver: Trip becomes available to eligible drivers (Realtime Socket broadcast)
    const handleBookingAvailable = (data: any) => {
      if (userRole !== "DRIVER") return;
      const booking = data?.booking;
      if (!booking) return;

      const eventId = `driver_available_${booking._id}`;
      if (seenEventIds.current.has(eventId)) return;
      seenEventIds.current.add(eventId);

      addToast({
        id: eventId,
        title: `New ${booking.vehicleCategory || "Ride"} Available!`,
        message: `${booking.pickupAddress || "Pickup"} → ${booking.destinationAddress || "Dropoff"}. Tap to review and accept.`,
        link: `/driver`,
        category: "driver",
        bookingId: booking._id,
        isRideAlert: true,
        createdAt: Date.now(),
      });
    };

    // 6. Driver: Enquiry / package request
    const handleEnquiryNew = (data: any) => {
      if (userRole !== "DRIVER") return;
      const eventId = `driver_enquiry_${data?.enquiryId || Date.now()}`;
      if (seenEventIds.current.has(eventId)) return;
      seenEventIds.current.add(eventId);

      soundManager.playNotificationSound(eventId);

      addToast({
        id: eventId,
        title: "New Package Request",
        message: `${data?.riderName || "A rider"} submitted an enquiry for your package "${data?.packageTitle || "Tour Package"}".`,
        link: `/driver/enquiries/${data?.enquiryId}`,
        category: "driver",
        createdAt: Date.now(),
      });
    };

    socket.on("notification:new", handleLiveNotification);
    socket.on("booking:custom_submitted", handleCustomTripSubmitted);
    socket.on("booking:custom_updated", handleCustomTripUpdated);
    socket.on("booking:updated", handleBookingUpdated);
    socket.on("booking:available", handleBookingAvailable);
    socket.on("enquiry:new", handleEnquiryNew);

    return () => {
      socket.off("notification:new", handleLiveNotification);
      socket.off("booking:custom_submitted", handleCustomTripSubmitted);
      socket.off("booking:custom_updated", handleCustomTripUpdated);
      socket.off("booking:updated", handleBookingUpdated);
      socket.off("booking:available", handleBookingAvailable);
      socket.off("enquiry:new", handleEnquiryNew);
    };
  }, [socket, session, sessionStatus, addToast]);

  // -------------------------------------------------------------
  // POLLING FALLBACK WHEN DISCONNECTED / OFFLINE
  // Detects newly received notifications, deduplicates, and rings bell for rides
  // -------------------------------------------------------------
  const pollNotifications = useCallback(async () => {
    if (sessionStatus !== "authenticated" || !session?.user) return;

    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      const notifs: any[] = data.notifications || [];

      // Initial load: populate seen IDs, do not play old sounds
      if (!isInitialPollDone.current) {
        notifs.forEach((n) => {
          seenNotificationIds.current.add(n._id);
        });
        if (notifs.length > 0) {
          lastKnownNotificationTime.current = new Date(notifs[0].createdAt).getTime();
        }
        isInitialPollDone.current = true;
        return;
      }

      // Subsequent polls: check for unread notifications not yet seen
      const userRole = (session?.user as any)?.role;
      const thresholdTime = lastKnownNotificationTime.current - 5000;

      const newNotifs = notifs.filter(
        (n) =>
          !n.isRead &&
          !seenNotificationIds.current.has(n._id) &&
          new Date(n.createdAt).getTime() >= thresholdTime
      );

      if (newNotifs.length > 0) {
        newNotifs.forEach((notif) => {
          seenNotificationIds.current.add(notif._id);
          seenEventIds.current.add(notif._id);
          lastKnownNotificationTime.current = Math.max(
            lastKnownNotificationTime.current,
            new Date(notif.createdAt).getTime()
          );

          const isRide = isRideAlertNotification(notif, userRole);

          // For ride alerts, addToast handles ringing bell and vibration.
          // For other non-silent notifications, play standard chime.
          if (!isRide && !SILENT_NOTIFICATION_TYPES.has(notif.type)) {
            soundManager.playNotificationSound(notif._id);
          }

          addToast({
            id: notif._id,
            title: notif.title || (isRide ? "New Ride Available!" : "New Notification"),
            message: notif.message || "",
            link: notif.link || (isRide ? "/driver" : undefined),
            category: userRole === "ADMIN" ? "admin" : userRole === "DRIVER" ? "driver" : "system",
            isRideAlert: isRide,
            createdAt: Date.now(),
          });
        });

        // Notify UI components of unread changes
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("lar:notifications-updated"));
        }
      }
    } catch {
      // Quietly ignore polling network glitches
    }
  }, [sessionStatus, session, addToast]);

  // Start polling when disconnected or on visibility/focus
  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      isInitialPollDone.current = false;
      seenNotificationIds.current.clear();
      seenEventIds.current.clear();
      setToasts([]);
      return;
    }

    // Always run initial poll to seed seen IDs without sound
    pollNotifications();

    // If connected via WebSocket, realtime handles events; poll rarely as backup
    // If disconnected (offline indicator), poll actively every 7 seconds
    const intervalMs = isConnected ? 45000 : 7000;
    const interval = setInterval(pollNotifications, intervalMs);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        pollNotifications();
      }
    };
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [sessionStatus, isConnected, pollNotifications]);

  // -------------------------------------------------------------
  // AUDIO UNLOCK CONTROLS
  // -------------------------------------------------------------
  const handleUnlockClick = async () => {
    await soundManager.unlockAudio();
    await soundManager.testRingtone();
    setDismissedUnlockBanner(true);
  };

  const handleTestClick = async () => {
    await soundManager.testRingtone();
  };

  const contextValue: NotificationSoundContextValue = {
    soundEnabled: soundState.soundEnabled,
    audioUnlocked: soundState.audioUnlocked,
    audioBlocked: soundState.audioBlocked,
    setSoundEnabled: (enabled) => soundManager.setSoundEnabled(enabled),
    unlockAudio: () => soundManager.unlockAudio(),
    testSound: () => soundManager.testRingtone(),
  };

  return (
    <NotificationSoundContext.Provider value={contextValue}>
      {children}

      {/* Sound Autoplay Unlock Banner (Non-intrusive bottom banner when audio is blocked) */}
      {!soundState.audioUnlocked && !dismissedUnlockBanner && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-sm bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                soundState.audioBlocked ? "bg-amber-500 text-slate-950" : "bg-blue-600 text-white"
              }`}
            >
              <Volume2 size={18} className={soundState.audioBlocked ? "text-slate-950" : "text-white"} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-100 truncate">
                {soundState.audioBlocked ? "Audio Autoplay Blocked" : "Ride Sound Alerts"}
              </p>
              <p className="text-[11px] text-slate-300 line-clamp-1">
                {soundState.audioBlocked
                  ? "Tap to enable incoming ride ringing on this device"
                  : "Tap to enable real-time ride ringtones"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleUnlockClick}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-all cursor-pointer whitespace-nowrap touch-manipulation focus:outline-hidden focus:ring-2 focus:ring-blue-400"
              aria-label="Enable notification sounds"
            >
              {soundState.audioBlocked ? "Tap to enable" : "Enable"}
            </button>
            <button
              type="button"
              onClick={handleTestClick}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold px-2 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap touch-manipulation hidden sm:inline-flex items-center gap-1"
              title="Test ringtone bell"
              aria-label="Test ringtone bell"
            >
              <Play size={10} className="fill-current" />
              <span>Test Ring</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissedUnlockBanner(true)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md cursor-pointer transition-colors"
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        </aside>
      )}

      {/* Interactive Toast Notifications Stack */}
      <div 
        aria-live="polite" 
        className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-2 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-2xl p-4 shadow-2xl transition-all animate-in slide-in-from-top-3 fade-in duration-200 ${
              toast.isRideAlert
                ? "bg-gradient-to-r from-amber-500/15 via-white to-amber-500/10 border-2 border-amber-500 shadow-amber-500/30"
                : "bg-white/98 backdrop-blur-xl border border-slate-200 hover:border-blue-400"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  toast.isRideAlert
                    ? "bg-amber-500 text-slate-950 animate-bounce"
                    : toast.category === "admin"
                    ? "bg-purple-100 text-purple-700"
                    : toast.category === "driver"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {toast.isRideAlert ? (
                  <Bell size={20} className="fill-current animate-pulse text-slate-950" />
                ) : toast.category === "admin" ? (
                  <ShieldCheck size={20} />
                ) : toast.category === "driver" ? (
                  <Car size={20} />
                ) : toast.title.includes("Package") ? (
                  <Package size={20} />
                ) : (
                  <Bell size={20} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      toast.isRideAlert
                        ? "bg-amber-500 text-slate-950 flex items-center gap-1 shadow-xs"
                        : toast.category === "admin"
                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                        : toast.category === "driver"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {toast.isRideAlert ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
                        Ringing • Ride Alert
                      </>
                    ) : toast.category === "admin" ? (
                      "Admin Alert"
                    ) : toast.category === "driver" ? (
                      "Driver Alert"
                    ) : (
                      "New Alert"
                    )}
                  </span>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
                    aria-label="Dismiss alert"
                  >
                    <X size={15} />
                  </button>
                </div>

                <h4 className="font-extrabold text-sm text-slate-900 mt-1">{toast.title}</h4>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{toast.message}</p>

                {toast.isRideAlert ? (
                  <Link
                    href={toast.link || "/driver"}
                    onClick={() => removeToast(toast.id)}
                    className="inline-flex items-center justify-center gap-1.5 w-full mt-2.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                  >
                    <span>Accept & View Ride</span>
                    <ExternalLink size={13} />
                  </Link>
                ) : toast.link ? (
                  <Link
                    href={toast.link}
                    onClick={() => removeToast(toast.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 mt-2.5 transition-colors"
                  >
                    View Details <ExternalLink size={12} />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </NotificationSoundContext.Provider>
  );
}
