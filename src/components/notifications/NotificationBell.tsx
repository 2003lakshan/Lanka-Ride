import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, ExternalLink, Volume2, VolumeX, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSocket } from "@/components/providers/SocketProvider";
import { useNotificationSound } from "./NotificationSoundProvider";
import SwipeableNotificationItem from "./SwipeableNotificationItem";

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  resourceId?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const { socket, isConnected, registerReconnectHandler } = useSocket();
  const { soundEnabled, audioUnlocked, audioBlocked, setSoundEnabled, testSound, unlockAudio } = useNotificationSound();

  const processedEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  // Re-fetch on socket reconnect
  useEffect(() => {
    return registerReconnectHandler(() => {
      fetchNotifications();
    });
  }, [registerReconnectHandler]);

  // Listen to custom notification update event dispatched by NotificationSoundProvider
  useEffect(() => {
    const handleUpdate = () => {
      fetchNotifications();
    };
    window.addEventListener("lar:notifications-updated", handleUpdate);
    return () => window.removeEventListener("lar:notifications-updated", handleUpdate);
  }, []);

  // Automatically close open notification dropdown when an incoming ride offer appears
  useEffect(() => {
    const handleClose = () => {
      setIsOpen(false);
    };
    window.addEventListener("lar:close-notifications", handleClose);
    return () => window.removeEventListener("lar:close-notifications", handleClose);
  }, []);

  // Initial fetch and smart polling fallback when disconnected
  useEffect(() => {
    fetchNotifications();

    if (isConnected) {
      return;
    }

    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Realtime listeners for direct socket updates
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: any) => {
      if (data.eventId) {
        if (processedEventIds.current.has(data.eventId)) return;
        processedEventIds.current.add(data.eventId);
      }

      if (data.notification) {
        setNotifications((prev) => {
          const exists = prev.some((n) => n._id === data.notification._id);
          if (exists) return prev;
          return [data.notification, ...prev.slice(0, 9)];
        });
      }

      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount);
      } else {
        setUnreadCount((prev) => prev + 1);
      }
    };

    const handleNotificationUpdated = (data: any) => {
      if (data.clearAll) {
        setNotifications([]);
        setUnreadCount(0);
      } else if (data.deletedId) {
        setNotifications((prev) => prev.filter((n) => n._id !== data.deletedId));
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } else if (data.markAll) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      } else if (data.readId) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === data.readId ? { ...n, isRead: true } : n))
        );
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        } else {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("notification:updated", handleNotificationUpdated);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:updated", handleNotificationUpdated);
    };
  }, [socket]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!mobilePanelRef.current || !mobilePanelRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id })
      });
    } catch {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true })
      });
    } catch {
      fetchNotifications();
    }
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    
    try {
      await fetch("/api/notifications?clearAll=true", {
        method: "DELETE",
      });
    } catch {
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    const target = notifications.find((n) => n._id === id);
    const wasUnread = target ? !target.isRead : false;

    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: "DELETE",
      });
    } catch {
      fetchNotifications();
    }
  };

  const renderPanelBody = (isMobileView: boolean) => (
    <>
      {/* Header - fixed/shrink-0 */}
      <div className="p-3 sm:p-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-bold text-slate-800 text-sm truncate">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Sound Controls */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                soundEnabled 
                  ? "text-blue-600 hover:bg-blue-50" 
                  : "text-slate-400 hover:bg-slate-100"
              }`}
              title={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
              aria-label={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>

            {soundEnabled && (
              <button
                type="button"
                onClick={() => testSound()}
                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                title="Test chime sound"
                aria-label="Test chime sound"
              >
                <Play size={10} className="fill-current" />
              </button>
            )}
          </div>

          {unreadCount > 0 && (
            <button 
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] sm:text-xs text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded-md hover:bg-blue-50 transition-colors"
              title="Mark all as read"
            >
              <Check size={12} /> Read all
            </button>
          )}

          {notifications.length > 0 && (
            <button 
              type="button"
              onClick={clearAllNotifications}
              className="text-[11px] sm:text-xs text-slate-500 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded-md hover:bg-rose-50 transition-colors"
              title="Clear all notifications"
            >
              <Trash2 size={12} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Browser Audio Unlock Banner in Dropdown (if audio is blocked) - shrink-0 */}
      {soundEnabled && (!audioUnlocked || audioBlocked) && (
        <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800 shrink-0">
          <span className="truncate">Browser audio locked</span>
          <button
            type="button"
            onClick={async () => {
              await unlockAudio();
              await testSound();
            }}
            className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold px-2.5 py-1 rounded-md text-[11px] shrink-0 ml-2 cursor-pointer shadow-xs"
          >
            Tap to enable sound
          </button>
        </div>
      )}
      
      {/* Notifications List - scrollable body with Swipeable Rows */}
      <div className={`overflow-y-auto overscroll-contain divide-y divide-slate-100 ${isMobileView ? "flex-1" : "max-h-[380px]"}`}>
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <Bell size={32} className="text-slate-300 mb-2" />
            <p className="text-sm font-medium">You&apos;re all caught up!</p>
            <p className="text-xs text-slate-400 mt-1">No active notifications</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <SwipeableNotificationItem
              key={notif._id}
              notification={notif}
              onRead={markAsRead}
              onDelete={deleteNotification}
              onNavigate={() => setIsOpen(false)}
            />
          ))
        )}
      </div>
      
      {/* Footer - fixed/shrink-0 */}
      <div className="p-2.5 sm:p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-slate-500 text-[11px] shrink-0 px-3">
        <span className="text-slate-400 font-medium hidden sm:inline">
          Swipe left to remove
        </span>
        <Link 
          href="/notifications" 
          onClick={() => setIsOpen(false)}
          className="text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1.5 ml-auto"
        >
          View all <ExternalLink size={12} />
        </Link>
      </div>
    </>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors focus:outline-hidden cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Render Dropdown / Panel */}
      {isOpen && (
        isMobile && mounted ? (
          /* Mobile Viewport-Centered Panel rendered via Portal */
          createPortal(
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9998]"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />
              {/* Viewport-Centered Panel */}
              <div
                ref={mobilePanelRef}
                role="dialog"
                aria-label="Notifications"
                aria-modal="true"
                className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-left animate-in slide-in-from-top-2 fade-in duration-200"
                style={{
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "min(420px, calc(100vw - 24px))",
                  top: "calc(env(safe-area-inset-top, 0px) + 68px)",
                  maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 80px)",
                }}
              >
                {renderPanelBody(true)}
              </div>
            </>,
            document.body
          )
        ) : (
          /* Desktop Dropdown anchored to navbar bell */
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200 text-left">
            {renderPanelBody(false)}
          </div>
        )
      )}
    </div>
  );
}
