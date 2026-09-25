"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Menu, X, User, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/' && pathname !== '/') return false;
    return pathname.startsWith(path);
  };

  const navLinkClass = (path: string) => `
    font-semibold text-sm transition-all px-3 py-2 rounded-lg
    ${isActive(path) 
      ? "text-blue-700 bg-blue-50" 
      : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
    }
  `;

  return (
    <header className="bg-white/95 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-2.5 rounded-xl shadow-md group-hover:shadow-blue-500/30 transition-all">
                <Plane size={24} />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-slate-900 ml-1">
                Lanka Airport <span className="text-blue-600">Ride</span>
              </span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-1 items-center">
            <Link href="/" className={navLinkClass("/")}>Home</Link>
            
            <Link href="/packages" className={navLinkClass("/packages")}>Tour Packages</Link>
            
            {session?.user && (session.user as any).role === "TOURIST" && (
              <Link href="/my-bookings" className={navLinkClass("/my-bookings")}>My Bookings</Link>
            )}

            {session?.user && (session.user as any).role === "DRIVER" && (
              <Link href="/driver" className={navLinkClass("/driver")}>Driver Dashboard</Link>
            )}

            {session?.user && (session.user as any).role === "ADMIN" && (
              <Link href="/admin" className={navLinkClass("/admin")}>Admin Panel</Link>
            )}
            
            <Link href="/contact" className={navLinkClass("/contact")}>Contact</Link>
          </nav>
          
          <div className="hidden lg:flex items-center space-x-4">
            {session ? (
              <>
                <div className="flex items-center gap-2 text-slate-700 font-bold mr-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                  <User size={18} className="text-blue-600" />
                  <span>{session.user?.name}</span>
                </div>
                <button 
                  onClick={() => signOut({ callbackUrl: "/" })} 
                  className="flex items-center gap-2 text-slate-500 hover:text-red-600 font-bold text-sm transition-colors"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <Link href="/login" className="flex items-center gap-2 text-slate-700 hover:text-blue-600 font-bold transition-colors">
                <User size={18} />
                <span>Login</span>
              </Link>
            )}
            
            {(!session || (session.user as any).role === "TOURIST") && (
              <Link href="/booking" className="bg-slate-900 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 transform hover:-translate-y-0.5">
                Book Now
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded-lg focus:outline-none transition-colors"
            >
              {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-white border-b border-slate-200 shadow-2xl py-4 px-4 flex flex-col gap-2 max-h-[calc(100vh-5rem)] overflow-y-auto">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className={navLinkClass("/")}>Home</Link>
          
          <Link href="/packages" onClick={() => setMobileMenuOpen(false)} className={navLinkClass("/packages")}>Tour Packages</Link>
          
          {session?.user && (session.user as any).role === "TOURIST" && (
            <Link href="/my-bookings" onClick={() => setMobileMenuOpen(false)} className={navLinkClass("/my-bookings")}>My Bookings</Link>
          )}

          {session?.user && (session.user as any).role === "DRIVER" && (
            <Link href="/driver" onClick={() => setMobileMenuOpen(false)} className={navLinkClass("/driver")}>Driver Dashboard</Link>
          )}

          {session?.user && (session.user as any).role === "ADMIN" && (
            <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className={navLinkClass("/admin")}>Admin Panel</Link>
          )}
          
          <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className={navLinkClass("/contact")}>Contact</Link>

          <div className="border-t border-slate-100 my-2 pt-4 flex flex-col gap-3">
            {session ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold px-3 py-2 bg-slate-50 rounded-lg">
                  <User size={18} className="text-blue-600" />
                  <span>{session.user?.name}</span>
                </div>
                <button 
                  onClick={() => signOut({ callbackUrl: "/" })} 
                  className="flex items-center gap-2 text-red-600 font-bold px-3 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors w-full text-left"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-slate-700 font-bold px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <User size={18} />
                <span>Login</span>
              </Link>
            )}

            {(!session || (session.user as any).role === "TOURIST") && (
              <Link href="/booking" onClick={() => setMobileMenuOpen(false)} className="bg-slate-900 text-white px-4 py-3 rounded-xl font-bold flex justify-center mt-2 shadow-lg">
                Book Now
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
