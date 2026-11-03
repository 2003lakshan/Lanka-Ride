"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Bell, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Play, 
  ShieldAlert,
  Info,
  Trash2
} from "lucide-react";
import { useNotificationSound } from "@/components/notifications/NotificationSoundProvider";
import SwipeableNotificationItem from "@/components/notifications/SwipeableNotificationItem";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const { soundEnabled, audioUnlocked, audioBlocked, setSoundEnabled, testSound, unlockAudio } = useNotificationSound();

  const fetchNotifications = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?page=${p}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setTotalPages(data.pagination?.pages || 1);
        setUnreadCount(data.unreadCount || 0);
      } else {
        setError("Failed to load notifications.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(page);
  }, [page]);

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
      fetchNotifications(page);
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
      fetchNotifications(page);
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
      fetchNotifications(page);
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
      fetchNotifications(page);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="text-blue-600" /> Notifications
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Stay updated with live booking alerts and trip requests</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => fetchNotifications(page)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-blue-600" : ""} />
            </button>
            
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs sm:text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:text-blue-600 px-3 sm:px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check size={16} /> Mark all read
              </button>
            )}

            {notifications.length > 0 && (
              <button 
                onClick={clearAllNotifications}
                className="text-xs sm:text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:text-rose-600 px-3 sm:px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Trash2 size={16} /> Clear all
              </button>
            )}
          </div>
        </div>

        {/* Audio Notification Settings Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              soundEnabled ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
            }`}>
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Notification Sounds</h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  soundEnabled 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}>
                  {soundEnabled ? "Enabled" : "Muted"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Play an audible chime when new trips or updates arrive while active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            {soundEnabled && (!audioUnlocked || audioBlocked) && (
              <button
                type="button"
                onClick={async () => {
                  await unlockAudio();
                  await testSound();
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <ShieldAlert size={14} className="text-amber-600" />
                <span>Enable Browser Audio</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => testSound()}
              className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              title="Test audio chime"
            >
              <Play size={12} className="fill-current text-blue-600" />
              <span>Test Sound</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer ${
                soundEnabled
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {soundEnabled ? "Mute" : "Unmute"}
            </button>
          </div>
        </div>

        {/* Browser Policy Disclaimer Note */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-600">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p>
            Sound alerts play while this browser tab or window is open and active. When the browser is closed or your device is locked, visual notifications are saved to your account.
          </p>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          {loading && notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <Loader2 size={32} className="animate-spin text-blue-600 mb-4" />
              <p>Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-500">
              <p>{error}</p>
              <button onClick={() => fetchNotifications(page)} className="mt-4 text-sm font-bold underline cursor-pointer">Try Again</button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Bell size={32} className="text-slate-300" />
              </div>
              <p className="text-lg font-medium text-slate-900 mb-1">No notifications yet</p>
              <p className="text-sm">We'll notify you when there's an update on your bookings or account.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <SwipeableNotificationItem
                  key={notif._id}
                  notification={notif}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-blue-600 disabled:opacity-50 transition-colors bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-blue-600 disabled:opacity-50 transition-colors bg-slate-50 cursor-pointer"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
