"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Check, Trash2, ArrowLeft } from "lucide-react";
import { NotificationItem } from "./NotificationBell";

interface SwipeableNotificationItemProps {
  notification: NotificationItem;
  onRead: (id: string, e?: React.MouseEvent) => void;
  onDelete: (id: string) => Promise<void> | void;
  onNavigate?: () => void;
}

export default function SwipeableNotificationItem({
  notification,
  onRead,
  onDelete,
  onNavigate,
}: SwipeableNotificationItemProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isHorizontalGestureRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const handleDelete = async () => {
    if (isRemoving) return;
    setIsRemoving(true);
    // Smooth collapse animation
    setTimeout(async () => {
      await onDelete(notification._id);
    }, 250);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRemoving) return;
    // Don't intercept if clicking an action button directly
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) {
      return;
    }

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isTrackingRef.current = true;
    isHorizontalGestureRef.current = false;
    activePointerIdRef.current = e.pointerId;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTrackingRef.current || activePointerIdRef.current !== e.pointerId) return;

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    // Check gesture direction lock
    if (!isHorizontalGestureRef.current) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // If vertical scroll dominates, release gesture so user can scroll page smoothly
      if (absY > absX && absY > 7) {
        isTrackingRef.current = false;
        activePointerIdRef.current = null;
        return;
      }

      // If horizontal swipe dominates (swiping left or right past 6px), lock into horizontal drag
      if (absX > absY && absX > 6) {
        isHorizontalGestureRef.current = true;
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

    // Allow dragging left (deltaX < 0) up to -140px, or slightly right (max 20px bounce)
    const boundedX = Math.max(-140, Math.min(20, deltaX));
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
      // If dragged left past 70px threshold, confirm deletion!
      if (dragX <= -70) {
        handleDelete();
      } else {
        // Released early -> spring back smoothly
        setDragX(0);
      }
    }
  };

  const handleClickItem = (e: React.MouseEvent) => {
    // If was dragging horizontally, prevent navigation
    if (Math.abs(dragX) > 10) {
      e.preventDefault();
      e.stopPropagation();
      setDragX(0);
      return;
    }

    if (!notification.isRead) {
      onRead(notification._id);
    }
    if (onNavigate) {
      onNavigate();
    }
  };

  // Drag ratio for visual feedback
  const dragRatio = Math.min(1, Math.abs(Math.min(0, dragX)) / 70);

  return (
    <div
      className={`relative overflow-hidden transition-all duration-250 ease-out select-none ${
        isRemoving ? "max-h-0 opacity-0 py-0 my-0 border-0 pointer-events-none" : "max-h-[160px] opacity-100"
      }`}
    >
      {/* Background Action: Revealed when swiping left */}
      <div 
        className="absolute inset-0 bg-rose-600 flex items-center justify-end px-5 z-0 transition-colors"
        aria-hidden="true"
      >
        <div 
          className="flex items-center gap-1.5 text-white font-bold text-xs"
          style={{
            transform: `scale(${0.8 + dragRatio * 0.2})`,
            opacity: dragRatio,
          }}
        >
          <Trash2 size={16} className="animate-pulse shrink-0" />
          <span>Delete</span>
        </div>
      </div>

      {/* Foreground Notification Row */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        className={`relative z-10 bg-white p-3 sm:p-3.5 hover:bg-slate-50 transition-colors ${
          !notification.isRead ? "bg-blue-50/35" : ""
        } ${isDragging ? "transition-none" : "transition-transform duration-200 ease-out"}`}
        style={{
          transform: isRemoving
            ? "translateX(-100%)"
            : `translateX(${dragX}px)`,
          touchAction: "pan-y",
        }}
      >
        <div className="flex gap-3 items-start min-w-0">
          {/* Main content link */}
          <Link
            href={notification.link || "#"}
            onClick={handleClickItem}
            className="flex-1 min-w-0 block group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <p
                className={`text-xs sm:text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 ${
                  !notification.isRead ? "font-bold" : "font-medium"
                }`}
              >
                {notification.title}
              </p>
              {!notification.isRead && (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
              )}
            </div>
            
            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
              {notification.message}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {new Date(notification.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] text-slate-400 font-medium">Swipe left to remove</span>
            </div>
          </Link>

          {/* Quick Action Buttons (Mark as read & Delete) */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
            {!notification.isRead && (
              <button
                type="button"
                onClick={(e) => onRead(notification._id, e)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Mark as read"
                aria-label="Mark as read"
              >
                <Check size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer opacity-70 hover:opacity-100"
              title="Delete notification"
              aria-label="Delete notification"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
