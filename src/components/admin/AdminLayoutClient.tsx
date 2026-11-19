"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Navigation, 
  CalendarCheck, 
  MapPin, 
  ShieldCheck, 
  Car, 
  Users, 
  Package, 
  Menu, 
  X, 
  PanelLeftClose, 
  PanelLeftOpen,
  ChevronRight,
  Shield,
  IdCard
} from "lucide-react";

export const adminNavItems = [
  { name: "Overview", href: "/admin", icon: Home },
  { name: "Bookings & Assignments", href: "/admin/trips", icon: CalendarCheck },
  { name: "PickMe", href: "/admin/pickme", icon: Navigation },
  { name: "Live Tracking", href: "/admin/active-trips", icon: MapPin },
  { name: "Driver Approvals", href: "/admin/approvals", icon: ShieldCheck },
  { name: "Identity Reviews", href: "/admin/identity-reviews", icon: IdCard },
  { name: "Drivers", href: "/admin/users?role=DRIVER", icon: Car },
  { name: "Riders", href: "/admin/users?role=TOURIST", icon: Users },
  { name: "Tour Packages", href: "/admin/packages", icon: Package },
];

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Desktop collapsed state: default false on server to prevent hydration mismatch
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  // Read saved preference from localStorage after mounting
  useEffect(() => {
    setHasMounted(true);
    try {
      const saved = localStorage.getItem("lar_admin_sidebar_collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
      closeButtonRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  // Toggle desktop sidebar collapse
  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("lar_admin_sidebar_collapsed", String(next));
      } catch {}

      // Notify window and Leaflet maps to resize / recalculate bounds
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lar:sidebar-toggle", { detail: { collapsed: next } }));
        window.dispatchEvent(new Event("resize"));
        // Additional resize trigger after CSS transition ends
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
          window.dispatchEvent(new CustomEvent("lar:sidebar-toggle", { detail: { collapsed: next } }));
        }, 320);
      }
      return next;
    });
  };

  // Find active nav item for mobile header label
  const activeItem = adminNavItems.find((item) => {
    if (item.href === "/admin") return pathname === "/admin";
    return pathname.startsWith(item.href.split("?")[0]);
  });

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] overflow-hidden bg-slate-50 w-full">
      {/* Mobile Sub-Header (< lg screens) */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 z-30 shrink-0 shadow-xs">
        <button
          ref={mobileMenuButtonRef}
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-colors cursor-pointer touch-manipulation focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          aria-label="Open Admin Menu"
          aria-expanded={isMobileOpen}
          aria-controls="admin-mobile-drawer"
        >
          <Menu size={18} className="text-slate-700 shrink-0" />
          <span>Admin Menu</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
            {activeItem?.name || "Admin Portal"}
          </span>
        </div>
      </div>

      {/* Main Container: Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative w-full">
        
        {/* Desktop Collapsible Sidebar (lg+ screens) */}
        <aside
          id="admin-desktop-sidebar"
          aria-label="Admin Navigation"
          className={`
            hidden lg:flex flex-col h-full bg-white border-r border-slate-200 z-20 shrink-0
            transition-[width] duration-300 ease-in-out motion-reduce:transition-none
            ${isCollapsed ? "w-16" : "w-60"}
          `}
        >
          {/* Sidebar Top Header & Collapse Toggle */}
          <div className={`
            flex items-center border-b border-slate-100 h-16 shrink-0 px-3
            ${isCollapsed ? "justify-center" : "justify-between"}
          `}>
            {/* Expanded Portal Brand Badge */}
            {!isCollapsed && (
              <div className="flex items-center gap-2 min-w-0 pl-1">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Shield size={18} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-slate-900 truncate">Admin Portal</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Management</span>
                </div>
              </div>
            )}

            {/* Toggle Button (Always visible in both expanded & collapsed states) */}
            <button
              type="button"
              onClick={handleToggleCollapse}
              className={`
                p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer
                focus:outline-hidden focus:ring-2 focus:ring-blue-500
                ${isCollapsed ? "w-10 h-10 flex items-center justify-center" : ""}
              `}
              aria-label={isCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
              aria-expanded={!isCollapsed}
              aria-controls="admin-desktop-sidebar"
              title={isCollapsed ? "Expand sidebar (240px)" : "Collapse sidebar (64px)"}
            >
              {isCollapsed ? (
                <PanelLeftOpen size={18} className="text-slate-600 hover:text-blue-600 transition-transform" />
              ) : (
                <PanelLeftClose size={18} className="text-slate-500 hover:text-blue-600 transition-transform" />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
            <nav className="space-y-1.5" role="navigation">
              {adminNavItems.map((item) => {
                const isActive = item.href === "/admin" 
                  ? pathname === "/admin" 
                  : pathname.startsWith(item.href.split("?")[0]);
                const Icon = item.icon;

                return (
                  <div key={item.name} className="relative group">
                    <Link
                      href={item.href}
                      className={`
                        flex items-center rounded-xl transition-all duration-200 cursor-pointer
                        ${isCollapsed 
                          ? "justify-center w-12 h-11 mx-auto" 
                          : "px-3 py-2.5 gap-3 w-full"
                        }
                        ${isActive 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold" 
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
                        }
                      `}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.name}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <Icon
                        className={`shrink-0 h-5 w-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700"}`}
                        aria-hidden="true"
                      />
                      
                      {!isCollapsed && (
                        <span className="truncate text-sm transition-opacity duration-200">
                          {item.name}
                        </span>
                      )}
                    </Link>

                    {/* Pop-out Hover Tooltip for Collapsed State */}
                    {isCollapsed && (
                      <div
                        role="tooltip"
                        className="
                          absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 
                          bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl 
                          whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 
                          group-focus-within:opacity-100 transition-opacity duration-150
                        "
                      >
                        {item.name}
                        {/* Tooltip Arrow */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile Backdrop Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Navigation Drawer */}
        <div
          id="admin-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Navigation Drawer"
          className={`
            fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col lg:hidden
            transform transition-transform duration-300 ease-in-out motion-reduce:transition-none
            ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Shield size={18} />
              </div>
              <span className="font-bold text-slate-900 text-base">Admin Portal</span>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              aria-label="Close Admin Menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Links */}
          <div className="flex-1 overflow-y-auto p-4">
            <nav className="space-y-1.5">
              {adminNavItems.map((item) => {
                const isActive = item.href === "/admin" 
                  ? pathname === "/admin" 
                  : pathname.startsWith(item.href.split("?")[0]);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer touch-manipulation min-h-[44px]
                      ${isActive 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                        : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                      }
                    `}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.name}</span>
                    {isActive && <ChevronRight size={16} className="ml-auto opacity-70" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content Area (Automatically fills remaining width without gaps) */}
        <main 
          id="admin-main-content"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden w-full flex flex-col bg-slate-50"
        >
          <div className="p-4 sm:p-6 lg:p-8 flex-1 w-full max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
