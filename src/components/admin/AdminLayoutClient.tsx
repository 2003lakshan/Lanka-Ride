"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  IdCard,
  Wallet,
  Search,
  Activity,
  Layers
} from "lucide-react";

export const adminNavItems = [
  { name: "Overview", href: "/admin", icon: Home, category: "Operations" },
  { name: "Bookings & Trips", href: "/admin/trips", icon: CalendarCheck, category: "Operations" },
  { name: "Live Tracking", href: "/admin/active-trips", icon: MapPin, category: "Operations" },
  { name: "PickMe Fleet", href: "/admin/pickme", icon: Navigation, category: "Operations" },
  { name: "Drivers", href: "/admin/users?role=DRIVER", icon: Car, category: "Fleet & People" },
  { name: "Driver Approvals", href: "/admin/approvals", icon: ShieldCheck, category: "Fleet & People" },
  { name: "Riders", href: "/admin/users?role=TOURIST", icon: Users, category: "Fleet & People" },
  { name: "Identity Reviews", href: "/admin/identity-reviews", icon: IdCard, category: "Fleet & People" },
  { name: "Custom Trips", href: "/admin/custom-trips", icon: Layers, category: "Travel & Catalog" },
  { name: "Tour Packages", href: "/admin/packages", icon: Package, category: "Travel & Catalog" },
  { name: "Financial Hub", href: "/admin/finance", icon: Wallet, category: "Finance" },
];

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Desktop collapsed state: default false on server to prevent hydration mismatch
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");

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
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
          window.dispatchEvent(new CustomEvent("lar:sidebar-toggle", { detail: { collapsed: next } }));
        }, 320);
      }
      return next;
    });
  };

  // Find active nav item for mobile header label
  const isItemActive = (href: string, name: string) => {
    if (href === "/admin") return pathname === "/admin";
    if (name === "Custom Trips") {
      return pathname.startsWith("/admin/custom-trips");
    }
    if (name === "Identity Reviews") {
      return pathname.startsWith("/admin/identity-reviews");
    }
    return pathname.startsWith(href.split("?")[0]);
  };

  const activeItem = adminNavItems.find((item) => isItemActive(item.href, item.name));

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = quickSearch.trim();
    if (!query) return;
    router.push(`/admin/trips?search=${encodeURIComponent(query)}`);
    setQuickSearch("");
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] overflow-hidden bg-[#F8FAFC] w-full text-slate-800">
      
      {/* Top Operations Header Bar (Desktop & Mobile) */}
      <header className="bg-[#102A43] text-white border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 hidden sm:inline">
              Operations Hub
            </span>
          </div>

          <span className="text-slate-500 hidden sm:inline">/</span>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-extrabold text-white truncate">
              {activeItem?.name || "Dashboard"}
            </span>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E5A72C]/20 text-[#E5A72C] border border-[#E5A72C]/40">
              Pexora Ops
            </span>
          </div>
        </div>

        {/* Global Quick Search + Action Shortcuts */}
        <div className="flex items-center gap-2 sm:gap-3">
          <form onSubmit={handleQuickSearchSubmit} className="relative hidden md:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, rider, phone..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="w-48 lg:w-64 pl-8 pr-3 py-1.5 bg-slate-900/60 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
            />
          </form>

          <Link
            href="/admin/active-trips"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/30 transition-colors"
            title="Live Fleet Map"
          >
            <Activity size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Live Fleet</span>
          </Link>

          <Link
            href="/admin/finance"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#E5A72C]/20 hover:bg-[#E5A72C]/30 text-[#E5A72C] border border-[#E5A72C]/30 transition-colors"
            title="Finance Dashboard"
          >
            <Wallet size={14} />
            <span className="hidden sm:inline">Finance</span>
          </Link>

          {/* Mobile drawer toggle */}
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
            aria-label="Open Admin Menu Drawer"
            aria-expanded={isMobileOpen}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Main Container: Sidebar + Scrollable Content + Mobile Nav */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative w-full">
        
        {/* Desktop Collapsible Sidebar (lg+ screens) */}
        <aside
          id="admin-desktop-sidebar"
          aria-label="Admin Navigation"
          className={`
            hidden lg:flex flex-col h-full bg-[#102A43] border-r border-slate-800/80 z-20 shrink-0
            transition-[width] duration-300 ease-in-out motion-reduce:transition-none
            ${isCollapsed ? "w-20" : "w-64"}
          `}
        >
          {/* Sidebar Top Header & Collapse Toggle */}
          <div className={`
            flex items-center border-b border-slate-800/80 h-16 shrink-0 px-3
            ${isCollapsed ? "justify-center" : "justify-between"}
          `}>
            {/* Expanded Portal Brand Badge */}
            {!isCollapsed && (
              <div className="flex items-center gap-2.5 min-w-0 pl-1">
                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Shield size={18} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white tracking-tight truncate">At Your Service</span>
                  </div>
                  <span className="text-[10px] text-[#E5A72C] font-semibold uppercase tracking-wider">Travel Operations</span>
                </div>
              </div>
            )}

            {/* Toggle Button */}
            <button
              type="button"
              onClick={handleToggleCollapse}
              className={`
                p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 active:bg-slate-700 transition-colors cursor-pointer
                focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]
                ${isCollapsed ? "w-10 h-10 flex items-center justify-center" : ""}
              `}
              aria-label={isCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
              aria-expanded={!isCollapsed}
              aria-controls="admin-desktop-sidebar"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <PanelLeftOpen size={18} className="text-slate-300 hover:text-white transition-transform" />
              ) : (
                <PanelLeftClose size={18} className="text-slate-400 hover:text-white transition-transform" />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-1">
            <nav className="space-y-1" role="navigation">
              {adminNavItems.map((item, index) => {
                const isActive = isItemActive(item.href, item.name);
                const Icon = item.icon;

                // Category separators when expanded
                const showCategoryHeading = !isCollapsed && (
                  index === 0 || adminNavItems[index - 1].category !== item.category
                );

                return (
                  <React.Fragment key={item.name}>
                    {showCategoryHeading && (
                      <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.category}
                      </div>
                    )}
                    <div className="relative group">
                      <Link
                        href={item.href}
                        className={`
                          flex items-center rounded-xl transition-all duration-200 cursor-pointer
                          ${isCollapsed 
                            ? "justify-center w-12 h-11 mx-auto" 
                            : "px-3 py-2.5 gap-3 w-full"
                          }
                          ${isActive 
                            ? "bg-[#2563EB] text-white font-bold shadow-lg shadow-blue-900/40" 
                            : "text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium"
                          }
                        `}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={item.name}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <Icon
                          className={`shrink-0 h-5 w-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}
                          aria-hidden="true"
                        />
                        
                        {!isCollapsed && (
                          <span className="truncate text-sm transition-opacity duration-200">
                            {item.name}
                          </span>
                        )}

                        {!isCollapsed && isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E5A72C]" />
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
                            group-focus-within:opacity-100 transition-opacity duration-150 border border-slate-700
                          "
                        >
                          {item.name}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer System Info */}
          {!isCollapsed && (
            <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-300">Operations Console</span>
                <p className="text-[10px] text-slate-400">v2.4 Production</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
            </div>
          )}
        </aside>

        {/* Mobile Slide-Up Menu Drawer */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 lg:hidden transition-opacity duration-200"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <div
          id="admin-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Navigation Drawer"
          className={`
            fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-[#102A43] text-white z-50 shadow-2xl flex flex-col lg:hidden
            transform transition-transform duration-300 ease-in-out motion-reduce:transition-none
            ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#0C2033]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Shield size={18} />
              </div>
              <div>
                <span className="font-bold text-white text-base">At Your Service</span>
                <p className="text-[10px] text-[#E5A72C] font-semibold uppercase">Operations Hub</p>
              </div>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Close Admin Menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Search in Mobile Drawer */}
          <div className="p-3 border-b border-slate-800/80">
            <form onSubmit={handleQuickSearchSubmit} className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search bookings or references..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>
          </div>

          {/* Drawer Links */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 pb-24">
            {adminNavItems.map((item) => {
              const isActive = isItemActive(item.href, item.name);
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
                      : "text-slate-300 hover:bg-slate-800 active:bg-slate-700"
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
          </div>
        </div>

        {/* Main Content Area */}
        <main 
          id="admin-main-content"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden w-full flex flex-col bg-[#F8FAFC]"
        >
          {/* Container with safe bottom padding on mobile for the bottom nav bar */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 w-full max-w-full pb-24 lg:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* Dedicated Mobile-First Bottom Navigation Bar (< lg screens) */}
      <nav 
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-lg safe-area-pb"
      >
        {/* 1. Overview */}
        <Link
          href="/admin"
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-h-[44px] min-w-[56px] ${
            pathname === "/admin" ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Home size={20} className={pathname === "/admin" ? "text-blue-600 stroke-[2.5]" : "text-slate-500"} />
          <span className="text-[10px] mt-0.5">Overview</span>
        </Link>

        {/* 2. Bookings */}
        <Link
          href="/admin/trips"
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-h-[44px] min-w-[56px] ${
            pathname.startsWith("/admin/trips") ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarCheck size={20} className={pathname.startsWith("/admin/trips") ? "text-blue-600 stroke-[2.5]" : "text-slate-500"} />
          <span className="text-[10px] mt-0.5">Bookings</span>
        </Link>

        {/* 3. Live Tracking */}
        <Link
          href="/admin/active-trips"
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-h-[44px] min-w-[56px] ${
            pathname.startsWith("/admin/active-trips") ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MapPin size={20} className={pathname.startsWith("/admin/active-trips") ? "text-blue-600 stroke-[2.5]" : "text-slate-500"} />
          <span className="text-[10px] mt-0.5">Tracking</span>
        </Link>

        {/* 4. Drivers */}
        <Link
          href="/admin/users?role=DRIVER"
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-h-[44px] min-w-[56px] ${
            pathname.startsWith("/admin/users") ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Car size={20} className={pathname.startsWith("/admin/users") ? "text-blue-600 stroke-[2.5]" : "text-slate-500"} />
          <span className="text-[10px] mt-0.5">Drivers</span>
        </Link>

        {/* 5. More Menu Sheet */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors min-h-[44px] min-w-[56px] ${
            isMobileOpen ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
          aria-label="More navigation options"
        >
          <Menu size={20} className="text-slate-500" />
          <span className="text-[10px] mt-0.5">More</span>
        </button>
      </nav>

    </div>
  );
}
