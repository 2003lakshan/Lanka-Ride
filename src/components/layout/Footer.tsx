"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Mail, Phone, MapPin, MessageSquare, Shield, Compass, Car, Package, Search } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

export default function Footer() {
  const pathname = usePathname();

  // Hide public customer footer on all admin operations routes
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="bg-[#102A43] text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo variant="full" theme="dark" size="lg" />
            
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Premium, reliable Sri Lanka travel operations. Book verified airport transfers, design custom multi-day journeys, and explore curated chauffeur-driven itineraries with real-time GPS tracking.
            </p>

            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium">
                <Shield size={13} className="text-[#E5A72C]" /> Verified Chauffeurs
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium">
                <Search size={13} className="text-[#2563EB]" /> Live Ride Tracking
              </span>
            </div>
          </div>
          
          {/* Services Column */}
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider text-[#E5A72C]">
              Travel Services
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/booking" className="hover:text-white transition-colors flex items-center gap-2">
                  <Car size={14} className="text-[#2563EB]" />
                  <span>Airport Transfers</span>
                </Link>
              </li>
              <li>
                <Link href="/trip-builder" className="hover:text-white transition-colors flex items-center gap-2">
                  <Compass size={14} className="text-[#E5A72C]" />
                  <span>Custom Trip Builder</span>
                </Link>
              </li>
              <li>
                <Link href="/packages" className="hover:text-white transition-colors flex items-center gap-2">
                  <Package size={14} className="text-emerald-400" />
                  <span>Tour Packages</span>
                </Link>
              </li>
              <li>
                <Link href="/track" className="hover:text-white transition-colors flex items-center gap-2">
                  <Search size={14} className="text-cyan-400" />
                  <span>Track Active Ride</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Driver Network Column */}
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider text-[#E5A72C]">
              Driver Network
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/driver/register" className="hover:text-white transition-colors font-semibold text-blue-300 flex items-center gap-1.5">
                  <span>Become a Driver</span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 rounded font-bold">Join</span>
                </Link>
              </li>
              <li>
                <Link href="/driver" className="hover:text-white transition-colors">
                  Driver Dashboard
                </Link>
              </li>
              <li>
                <Link href="/driver/login" className="hover:text-white transition-colors">
                  Driver Login
                </Link>
              </li>
              <li>
                <Link href="/driver/packages" className="hover:text-white transition-colors">
                  Driver Package Management
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider text-[#E5A72C]">
              Support &amp; Contact
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="text-[#E5A72C] mt-0.5 shrink-0" />
                <span className="text-slate-300">123 Airport Road, Katunayake, Sri Lanka</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={16} className="text-[#2563EB] shrink-0" />
                <a href="tel:+94771234567" className="hover:text-white transition-colors">
                  +94 77 123 4567
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={16} className="text-emerald-400 shrink-0" />
                <a href="mailto:bookings@lankaairportride.com" className="hover:text-white transition-colors truncate">
                  bookings@lankaairportride.com
                </a>
              </li>
              <li className="pt-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition-colors"
                >
                  <MessageSquare size={14} className="text-[#E5A72C]" />
                  <span>Send an Enquiry</span>
                </Link>
              </li>
            </ul>
          </div>

        </div>
        
        {/* Bottom Legal Bar */}
        <div className="border-t border-slate-800/80 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <p>
            &copy; {new Date().getFullYear()} <strong className="text-slate-200">At Your Service – Powered by Pexora</strong>. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
