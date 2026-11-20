"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Plane, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Compass, 
  Package, 
  Car, 
  Phone, 
  Shield, 
  CheckCircle, 
  Users, 
  Calendar,
  Search,
  Bell,
  LogIn
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { RealtimeIndicator } from "@/components/providers/SocketProvider";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on resize to desktop breakpoint (>= 1280px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mobileMenuOpen]);

  const isActive = (path: string) => {
    if (path === "/" && pathname !== "/") return false;
    return pathname.startsWith(path);
  };

  const navLinkClass = (path: string) => `
    font-semibold text-xs 2xl:text-sm transition-all px-2 2xl:px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0 whitespace-nowrap
    ${isActive(path) 
      ? "text-blue-700 bg-blue-50 font-bold" 
      : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
    }
  `;

  const mobileNavLinkClass = (path: string) => `
    font-semibold text-base transition-all px-4 py-3 rounded-xl flex items-center gap-3 touch-manipulation min-h-[48px]
    ${isActive(path) 
      ? "text-blue-700 bg-blue-50 font-bold border-l-4 border-blue-600" 
      : "text-slate-700 hover:text-blue-600 hover:bg-slate-50 active:bg-slate-100"
    }
  `;

  const userRole = (session?.user as any)?.role;

  return (
    <header className="bg-white/95 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100 shadow-xs relative w-full">
      <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 xl:px-8">
        <div className="flex justify-between items-center h-20 gap-2 sm:gap-4 min-w-0">
          {/* Logo on the left */}
          <div className="shrink-0 flex items-center min-w-0">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group min-w-0">
              <div className="bg-linear-to-br from-blue-600 to-blue-800 text-white p-2 sm:p-2.5 rounded-xl shadow-md group-hover:shadow-blue-500/30 transition-all shrink-0">
                <Plane size={22} className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="font-extrabold text-base sm:text-lg xl:text-xl tracking-tight text-slate-900 ml-1 truncate">
                <span className="hidden min-[420px]:inline">Lanka Airport </span>
                <span className="min-[420px]:hidden">Lanka </span>
                <span className="text-blue-600">Ride</span>
              </span>
            </Link>
          </div>
          
          {/* Desktop Navigation (visible on xl screens >= 1280px) */}
          <nav className="hidden xl:flex items-center gap-0.5 2xl:gap-1.5 shrink-0">
            <Link href="/" className={navLinkClass("/")}>Home</Link>
            <Link href="/packages" className={navLinkClass("/packages")}>Tour Packages</Link>
            
            {userRole === "TOURIST" && (
              <>
                <Link href="/trip-builder" className={navLinkClass("/trip-builder")}>Custom Trip</Link>
                <Link href="/my-bookings" className={navLinkClass("/my-bookings")}>My Bookings</Link>
              </>
            )}

            {userRole === "DRIVER" && (
              <>
                <Link href="/driver" className={navLinkClass("/driver")}>Driver Dashboard</Link>
                <Link href="/driver/packages" className={navLinkClass("/driver/packages")}>My Packages</Link>
              </>
            )}

            {userRole === "ADMIN" && (
              <>
                <Link href="/admin" className={navLinkClass("/admin")}>Admin Panel</Link>
                <Link href="/admin/active-trips" className={navLinkClass("/admin/active-trips")}>Active Trips</Link>
              </>
            )}
            
            <Link href="/track" className={navLinkClass("/track")}>Track Ride</Link>
            <Link href="/contact" className={navLinkClass("/contact")}>Contact</Link>
          </nav>
          
          {/* Desktop Right Actions (visible on xl screens >= 1280px) */}
          <div className="hidden xl:flex items-center gap-1.5 xl:gap-2 2xl:gap-3 shrink-0">
            {session ? (
              <>
                <RealtimeIndicator />
                <NotificationBell />
                <Link 
                  href="/profile" 
                  className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 font-bold bg-slate-50 px-2.5 2xl:px-3 py-1.5 rounded-full border border-slate-200/80 transition-colors text-xs 2xl:text-sm shrink-0 min-w-0"
                  title={session.user?.name || "Profile"}
                >
                  <User size={15} className="text-blue-600 shrink-0" />
                  <span className="max-w-[85px] xl:max-w-[105px] 2xl:max-w-[125px] truncate block">{session.user?.name || "Profile"}</span>
                </Link>
                <button 
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })} 
                  className="flex items-center gap-1 text-slate-500 hover:text-red-600 font-bold text-xs 2xl:text-sm transition-colors cursor-pointer px-1.5 py-1 shrink-0"
                  title="Logout"
                >
                  <LogOut size={16} className="shrink-0" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <Link href="/login" className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-bold text-xs 2xl:text-sm transition-colors px-2.5 py-1.5 shrink-0">
                <User size={16} className="shrink-0" />
                <span>Login</span>
              </Link>
            )}
            
            {(!session || userRole === "TOURIST") && (
              <Link 
                href="/booking" 
                className="bg-slate-900 hover:bg-blue-700 text-white px-3.5 2xl:px-4 py-2 rounded-xl font-bold text-xs 2xl:text-sm transition-all shadow-xs hover:shadow-md flex items-center gap-1.5 shrink-0"
              >
                Book Now
              </Link>
            )}
          </div>

          {/* Mobile / Tablet Right Action Bar (visible on screens < 1280px) */}
          <div className="xl:hidden flex items-center gap-1.5 sm:gap-2.5 relative z-50 shrink-0">
            {session && (
              <>
                <RealtimeIndicator />
                <NotificationBell />
                {/* Tablet quick profile shortcut */}
                <Link 
                  href="/profile" 
                  className="hidden sm:flex items-center gap-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 font-bold bg-slate-50 px-2.5 py-1.5 rounded-full border border-slate-200/80 transition-colors text-xs shrink-0"
                  title={session.user?.name || "Profile"}
                >
                  <User size={14} className="text-blue-600 shrink-0" />
                  <span className="max-w-[70px] md:max-w-[100px] truncate block">{session.user?.name || "Profile"}</span>
                </Link>
              </>
            )}

            {!session && (
              <Link
                href="/login"
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0"
              >
                <LogIn size={14} />
                <span>Login</span>
              </Link>
            )}

            {/* Hamburger Menu Toggle Button */}
            <button 
              type="button"
              id="mobile-menu-button"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="min-w-[40px] min-h-[40px] p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 active:bg-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center touch-manipulation cursor-pointer select-none shrink-0"
            >
              {mobileMenuOpen ? (
                <X size={24} className="text-slate-900 transition-transform duration-200" />
              ) : (
                <Menu size={24} className="text-slate-900 transition-transform duration-200" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Menu Backdrop Overlay (< 1280px) */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 xl:hidden transition-opacity duration-200" 
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile / Tablet Menu Drawer (< 1280px) */}
      {mobileMenuOpen && (
        <div 
          id="mobile-navigation-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          className="fixed top-20 left-0 right-0 bg-white border-b border-slate-200 shadow-2xl py-4 px-4 sm:px-6 md:px-8 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain z-50 xl:hidden animate-in slide-in-from-top-2 duration-200"
        >
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-1">
          {session ? (
            /* User Profile Header Card */
            <Link 
              href="/profile" 
              onClick={() => setMobileMenuOpen(false)} 
              className="flex items-center gap-3 text-slate-800 hover:text-blue-600 font-bold px-4 py-3 bg-blue-50/70 border border-blue-100 rounded-xl transition-colors min-h-[52px] mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0">
                {session.user?.name ? session.user.name.charAt(0).toUpperCase() : <User size={20} />}
              </div>
              <div className="flex flex-col text-left overflow-hidden">
                <span className="text-sm font-bold text-slate-900 truncate">{session.user?.name}</span>
                <span className="text-xs text-blue-700 font-semibold uppercase tracking-wider">
                  {userRole || "User"} Dashboard
                </span>
              </div>
            </Link>
          ) : (
            /* Logged-Out Header Card with Login/Register action */
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Welcome to Lanka Ride</p>
                <p className="text-xs text-slate-500">Sign in to book rides & track trips</p>
              </div>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shrink-0"
              >
                Sign In
              </Link>
            </div>
          )}

          {/* Role-Specific Dashboard & Management Links */}
          {userRole === "TOURIST" && (
            <>
              <Link href="/trip-builder" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/trip-builder")}>
                <Compass size={20} className="text-purple-600 shrink-0" />
                <span>Custom Trip Builder</span>
              </Link>
              <Link href="/my-bookings" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/my-bookings")}>
                <Calendar size={20} className="text-blue-600 shrink-0" />
                <span>My Bookings &amp; Trips</span>
              </Link>
              <Link href="/booking" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/booking")}>
                <Car size={20} className="text-emerald-600 shrink-0" />
                <span>Book New Ride</span>
              </Link>
            </>
          )}

          {userRole === "DRIVER" && (
            <>
              <Link href="/driver" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/driver")}>
                <Car size={20} className="text-blue-600 shrink-0" />
                <span>Driver Dashboard</span>
              </Link>
              <Link href="/driver/packages" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/driver/packages")}>
                <Package size={20} className="text-indigo-600 shrink-0" />
                <span>My Tour Packages</span>
              </Link>
              <Link href="/driver/enquiries" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/driver/enquiries")}>
                <Calendar size={20} className="text-purple-600 shrink-0" />
                <span>Trip Enquiries</span>
              </Link>
            </>
          )}

          {userRole === "ADMIN" && (
            <>
              <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/admin")}>
                <Shield size={20} className="text-blue-600 shrink-0" />
                <span>Admin Dashboard</span>
              </Link>
              <Link href="/admin/active-trips" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/admin/active-trips")}>
                <Compass size={20} className="text-indigo-600 shrink-0" />
                <span>Active Trips &amp; Live Tracking</span>
              </Link>
              <Link href="/admin/custom-trips" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/admin/custom-trips")}>
                <Calendar size={20} className="text-purple-600 shrink-0" />
                <span>Custom Trip Requests</span>
              </Link>
              <Link href="/admin/approvals" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/admin/approvals")}>
                <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                <span>Driver Approvals</span>
              </Link>
              <Link href="/admin/users" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/admin/users")}>
                <Users size={20} className="text-amber-600 shrink-0" />
                <span>Users Management</span>
              </Link>
            </>
          )}

          {/* Notifications link for logged in */}
          {session && (
            <Link href="/notifications" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/notifications")}>
              <Bell size={20} className="text-amber-600 shrink-0" />
              <span>Notifications</span>
            </Link>
          )}

          {/* General Common Links */}
          <div className="border-t border-slate-100 my-1 pt-1">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/")}>
              <Plane size={20} className="text-blue-600 shrink-0" />
              <span>Home</span>
            </Link>
            
            <Link href="/packages" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/packages")}>
              <Package size={20} className="text-indigo-600 shrink-0" />
              <span>Tour Packages</span>
            </Link>

            {(!session || userRole === "TOURIST") && (
              <Link href="/booking" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/booking")}>
                <Car size={20} className="text-emerald-600 shrink-0" />
                <span>Book a Ride</span>
              </Link>
            )}
            
            <Link href="/track" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/track")}>
              <Search size={20} className="text-slate-500 shrink-0" />
              <span>Track Ride</span>
            </Link>

            <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className={mobileNavLinkClass("/contact")}>
              <Phone size={20} className="text-slate-500 shrink-0" />
              <span>Contact &amp; Support</span>
            </Link>
          </div>

          {/* Action Footer */}
          <div className="border-t border-slate-100 my-2 pt-3 flex flex-col gap-2">
            {session ? (
              <button 
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: "/" });
                }} 
                className="flex items-center gap-3 text-red-600 font-bold px-4 py-3 bg-red-50 rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors w-full text-left min-h-[48px] cursor-pointer touch-manipulation"
              >
                <LogOut size={20} className="shrink-0" />
                <span>Logout</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2.5 font-bold text-sm text-slate-700 bg-slate-100 rounded-xl"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2.5 font-bold text-sm text-white bg-blue-600 rounded-xl shadow-xs"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </header>
  );
}
