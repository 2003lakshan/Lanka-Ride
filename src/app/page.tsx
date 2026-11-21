import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import dbConnect from "@/lib/mongodb";
import PackageModel from "@/models/Package";
import PickMeBookingCard from "@/components/booking/PickMeBookingCard";
import PackageImage from "@/components/packages/PackageImage";
import FaqAccordion from "@/components/home/FaqAccordion";
import { 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  ThumbsUp, 
  CreditCard, 
  Phone, 
  Mail, 
  MessageSquare, 
  Package, 
  Compass, 
  Car, 
  Plane, 
  Search, 
  Share2, 
  CheckCircle2, 
  Sparkles, 
  UserCheck, 
  Navigation,
  HelpCircle,
  ExternalLink
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "At Your Service – Powered by Pexora | Premium Sri Lanka Travel & Airport Transfers",
  description: "Official Sri Lanka airport transfers, custom multi-day island trip planning, and verified driver tour packages with real-time GPS tracking. Powered by Pexora.",
};

export default async function Home() {
  await dbConnect();

  // Query only admin-approved, published packages (Requirement 3)
  const rawPackages = await PackageModel.find({ status: "PUBLISHED" })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const publishedPackages = rawPackages.map((pkg: any) => ({
    id: pkg._id.toString(),
    title: pkg.title || "Sri Lanka Tour Package",
    category: pkg.category || "Tour Package",
    coverPhoto: pkg.coverPhoto || null,
    startingCity: pkg.startingCity || "Colombo",
    days: pkg.days || 1,
    nights: pkg.nights || 0,
    shortDescription: pkg.shortDescription || "",
    totalStartingPrice: pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || 0,
    currency: pkg.costs?.currency || "LKR",
    priceType: pkg.costs?.priceType || "PER_VEHICLE",
  }));

  const POPULAR_DESTINATIONS = [
    { name: "Kandy", desc: "Sacred Temple & Cultural Capital", img: "/images/kandy.jpg", tag: "Culture" },
    { name: "Galle", desc: "Historic Dutch Fort & Ocean Promenade", img: "/images/galle.jpg", tag: "Heritage" },
    { name: "Ella", desc: "Scenic Hill Country, Tea & Viaducts", img: "/images/ella.jpg", tag: "Highlands" },
    { name: "Mirissa", desc: "Pristine Beaches & Whale Watching", img: "/images/mirissa.jpg", tag: "Coastline" }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-slate-800 overflow-x-hidden w-full">
      
      {/* =========================================================================
          SECTION 1: HERO & LIVE INSTANT ESTIMATOR / BOOKING WIDGET
          ========================================================================= */}
      <section className="relative min-h-[640px] lg:min-h-[760px] flex items-center justify-center bg-[#102A43] overflow-hidden">
        {/* Background Hero Image with Deep Navy & Gold Overlays */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/images/hero.jpg" 
            alt="Scenic Sri Lanka landscape with train crossing historic viaduct at sunset" 
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#102A43]/95 via-[#102A43]/85 to-[#102A43]/50"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#102A43] via-transparent to-[#102A43]/40"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Hero Column: Headline & Direct CTAs */}
            <div className="lg:col-span-6 xl:col-span-6 text-center lg:text-left text-white max-w-2xl mx-auto lg:mx-0">
              
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[#E5A72C] text-xs sm:text-sm font-bold mb-6 shadow-sm">
                <Sparkles size={16} className="text-[#E5A72C]" />
                <span>At Your Service &bull; Powered by Pexora</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black leading-[1.12] mb-6 tracking-tight drop-shadow-md">
                Sri Lanka Travel, <br className="hidden sm:block" />
                Tailored <span className="text-[#E5A72C]">At Your Service</span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-slate-200 mb-8 font-medium leading-relaxed drop-shadow-sm">
                Book verified airport transfers, design custom multi-day journeys, and explore chauffeur-driven tour packages across Sri Lanka with live GPS trip tracking.
              </p>

              {/* Action Buttons: Airport Transfers, Trip Builder, Tour Packages */}
              <div className="flex flex-col sm:flex-row gap-3.5 justify-center lg:justify-start mb-8">
                <Link 
                  href="/booking" 
                  className="bg-[#2563EB] hover:bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2.5 min-h-[48px]"
                >
                  <Car size={18} className="text-[#E5A72C]" />
                  <span>Book Airport Transfer</span>
                </Link>

                <Link 
                  href="/trip-builder" 
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 text-white px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 min-h-[48px]"
                >
                  <Compass size={18} className="text-[#E5A72C]" />
                  <span>Custom Trip Builder</span>
                </Link>
              </div>

              {/* Service Highlights Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/15 text-xs text-slate-300 font-semibold text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#E5A72C] shrink-0" />
                  <span>Vetted Drivers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation size={16} className="text-[#2563EB] shrink-0" />
                  <span>Live GPS Tracking</span>
                </div>
                <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                  <CreditCard size={16} className="text-emerald-400 shrink-0" />
                  <span>Fixed Transparent Rates</span>
                </div>
              </div>

            </div>

            {/* Right Hero Column: Interactive Route & Transfer Booking Card */}
            <div id="transfer-estimator" className="lg:col-span-6 xl:col-span-6 w-full min-w-0 max-w-xl mx-auto transform lg:translate-y-2">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-1 sm:p-2 shadow-2xl border-2 border-white/40 ring-1 ring-black/10">
                <PickMeBookingCard />
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* =========================================================================
          SECTION 2: SERVICE CARDS (Airport Transfers, Custom Trips, Tour Packages)
          ========================================================================= */}
      <section id="services" className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-xs font-bold uppercase tracking-wider mb-3">
              <span>Operations &amp; Travel Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#102A43] tracking-tight">
              Three Seamless Ways to Travel Sri Lanka
            </h2>
            <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed">
              Whether you need a prompt airport pickup, a bespoke island circuit planned day-by-day, or an all-inclusive driver package, At Your Service delivers full operational support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Card 1: Airport Transfers */}
            <div className="bg-[#F8FAFC] rounded-3xl p-8 border border-slate-200/90 hover:border-[#2563EB]/50 transition-all duration-300 hover:shadow-xl flex flex-col group relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Plane size={28} />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2563EB] mb-2">
                Fixed &amp; Reliable
              </span>
              <h3 className="text-2xl font-black text-[#102A43] mb-3 group-hover:text-[#2563EB] transition-colors">
                Airport Transfers
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Direct pickup and drop-off service connecting Bandaranaike International Airport (CMB) and Mattala (HRI) with any hotel or city across Sri Lanka.
              </p>
              
              <ul className="space-y-2.5 text-xs font-semibold text-slate-700 mb-8 mt-auto">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Flight tracking with delay adaptation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Meet &amp; greet in arrivals terminal</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Air-conditioned sedans, vans &amp; KDHs</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <Link 
                  href="/booking" 
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-[#2563EB] hover:text-blue-800 transition-colors"
                >
                  <span>Book Airport Ride</span>
                  <ArrowRight size={16} />
                </Link>
                <a 
                  href="#transfer-estimator"
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Estimate Fare
                </a>
              </div>
            </div>

            {/* Card 2: Custom Trips */}
            <div className="bg-[#F8FAFC] rounded-3xl p-8 border-2 border-[#102A43]/10 hover:border-[#E5A72C] transition-all duration-300 hover:shadow-xl flex flex-col group relative overflow-hidden ring-1 ring-black/5">
              <div className="absolute top-4 right-4 bg-[#E5A72C]/15 text-[#D97706] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                Interactive Builder
              </div>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Compass size={28} />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D97706] mb-2">
                Personalized Itineraries
              </span>
              <h3 className="text-2xl font-black text-[#102A43] mb-3 group-hover:text-[#D97706] transition-colors">
                Custom Multi-Day Trips
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Build your bespoke island circuit day by day. Select your dates, overnight stops, preferred vehicle category, and receive verified driver proposals.
              </p>
              
              <ul className="space-y-2.5 text-xs font-semibold text-slate-700 mb-8 mt-auto">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Interactive day-by-day routing</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Choose preferred vehicle capacity</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Dedicated tourist chauffeurs</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-200">
                <Link 
                  href="/trip-builder" 
                  className="w-full bg-[#102A43] hover:bg-slate-900 text-white py-3 px-4 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Compass size={16} className="text-[#E5A72C]" />
                  <span>Open Trip Builder</span>
                </Link>
              </div>
            </div>

            {/* Card 3: Tour Packages */}
            <div className="bg-[#F8FAFC] rounded-3xl p-8 border border-slate-200/90 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl flex flex-col group relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Package size={28} />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 mb-2">
                Driver Curated &amp; Approved
              </span>
              <h3 className="text-2xl font-black text-[#102A43] mb-3 group-hover:text-emerald-700 transition-colors">
                Tour Packages
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Discover pre-planned journeys crafted and driven by vetted local chauffeurs — cultural heritage, wildlife safaris, hill country tea, and coastal routes.
              </p>
              
              <ul className="space-y-2.5 text-xs font-semibold text-slate-700 mb-8 mt-auto">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Admin-approved pricing &amp; routes</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Vehicle, fuel &amp; driver included</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Transparent inclusion &amp; amenity lists</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <Link 
                  href="/packages" 
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  <span>Explore Tour Packages</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* =========================================================================
          SECTION 3: FEATURED TOUR PACKAGES (From MongoDB, Approved/Published Only)
          ========================================================================= */}
      <section className="py-16 sm:py-24 bg-[#F8FAFC] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200 text-[#2563EB] text-xs font-bold uppercase tracking-wider mb-3">
                <Package size={14} className="text-[#2563EB]" />
                <span>Admin-Approved Curated Tours</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-[#102A43] tracking-tight">
                Featured Driver Packages
              </h2>
              <p className="mt-2 text-slate-600 max-w-2xl text-sm sm:text-base">
                Authentic Sri Lanka itineraries published by our verified drivers with transparent vehicle and pricing terms.
              </p>
            </div>
            
            <Link 
              href="/packages" 
              className="inline-flex items-center gap-2 text-[#2563EB] hover:text-blue-800 font-extrabold text-sm sm:text-base self-start md:self-auto group"
            >
              <span>View All Published Packages</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Published Packages Grid with graceful empty state and PackageImage fallbacks */}
          {publishedPackages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {publishedPackages.map((pkg) => (
                <div 
                  key={pkg.id} 
                  className="bg-white rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200/80 overflow-hidden flex flex-col group"
                >
                  {/* Package Cover Image with graceful fallback */}
                  <div className="relative h-56 w-full overflow-hidden bg-slate-100">
                    <PackageImage
                      src={pkg.coverPhoto}
                      alt={pkg.title}
                      category={pkg.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-[#102A43]/90 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider border border-white/20">
                      {pkg.category}
                    </div>
                  </div>

                  {/* Package Content */}
                  <div className="p-6 sm:p-7 flex flex-col flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-[#2563EB] transition-colors leading-snug">
                      {pkg.title}
                    </h3>
                    
                    {pkg.shortDescription && (
                      <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                        {pkg.shortDescription}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 mb-6 mt-auto pt-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100">
                        <Calendar size={14} className="text-[#2563EB]" />
                        <span>{pkg.days} {pkg.days === 1 ? "Day" : "Days"} {pkg.nights > 0 ? `(${pkg.nights}N)` : ""}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100">
                        <MapPin size={14} className="text-[#E5A72C]" />
                        <span>From {pkg.startingCity}</span>
                      </span>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                          Starting From ({pkg.priceType === "PER_PERSON" ? "Per Person" : "Per Vehicle"})
                        </p>
                        <p className="font-black text-[#102A43] text-lg sm:text-xl">
                          {pkg.currency} {pkg.totalStartingPrice.toLocaleString()}
                        </p>
                      </div>

                      <Link 
                        href={`/packages/${pkg.id}`}
                        aria-label={`View details for ${pkg.title}`}
                        className="bg-slate-100 hover:bg-[#2563EB] hover:text-white text-[#102A43] w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                      >
                        <ArrowRight size={18} />
                      </Link>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 max-w-lg mx-auto shadow-sm">
              <div className="w-16 h-16 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Published Packages Available</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Our drivers are continually updating curated packages. In the meantime, use our Custom Trip Builder to create a bespoke itinerary.
              </p>
              <Link
                href="/trip-builder"
                className="inline-flex items-center gap-2 bg-[#102A43] hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                <Compass size={16} className="text-[#E5A72C]" />
                <span>Build a Custom Trip</span>
              </Link>
            </div>
          )}

        </div>
      </section>


      {/* =========================================================================
          SECTION 4: HOW IT WORKS (Actual Application Flow)
          ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3">
              <span>Simple 4-Step Process</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#102A43] tracking-tight">
              How Booking Works With Us
            </h2>
            <p className="mt-4 text-slate-600 text-base sm:text-lg">
              Transparent, accountable travel management from your first inquiry to your final destination.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Step 1 */}
            <div className="bg-[#F8FAFC] p-6 sm:p-8 rounded-3xl border border-slate-200 relative flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-[#102A43] text-[#E5A72C] font-black text-xl flex items-center justify-center mb-6 shadow-sm">
                1
              </div>
              <h3 className="text-lg font-bold text-[#102A43] mb-2">Choose Travel Service</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Select an airport pickup/drop-off, use the interactive Trip Builder for a multi-day itinerary, or pick an approved tour package.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#F8FAFC] p-6 sm:p-8 rounded-3xl border border-slate-200 relative flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-[#102A43] text-[#E5A72C] font-black text-xl flex items-center justify-center mb-6 shadow-sm">
                2
              </div>
              <h3 className="text-lg font-bold text-[#102A43] mb-2">Review Fare &amp; Route</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Input your passenger count, luggage details, and schedule. View guaranteed fare estimates with no hidden surge fees.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#F8FAFC] p-6 sm:p-8 rounded-3xl border border-slate-200 relative flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-[#102A43] text-[#E5A72C] font-black text-xl flex items-center justify-center mb-6 shadow-sm">
                3
              </div>
              <h3 className="text-lg font-bold text-[#102A43] mb-2">Meet Your Verified Driver</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Receive your assigned chauffeur's verified identification, contact phone, and vehicle registration before your trip begins.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-[#F8FAFC] p-6 sm:p-8 rounded-3xl border border-slate-200 relative flex flex-col">
              <div className="w-12 h-12 rounded-2xl bg-[#102A43] text-[#E5A72C] font-black text-xl flex items-center justify-center mb-6 shadow-sm">
                4
              </div>
              <h3 className="text-lg font-bold text-[#102A43] mb-2">Track &amp; Share Live</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Monitor your vehicle en route in real-time, and generate a secure shareable tracking link for friends and family without needing a login.
              </p>
            </div>

          </div>

        </div>
      </section>


      {/* =========================================================================
          SECTION 5: DRIVER VERIFICATION, TRIP TRACKING & PLATFORM CAPABILITIES
          ========================================================================= */}
      <section className="py-16 sm:py-24 bg-[#102A43] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-[#E5A72C] text-xs font-bold uppercase tracking-wider border border-white/15">
                <ShieldCheck size={16} />
                <span>Verified Standards &bull; Real Capabilities</span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                Safety, Transparency &amp; Live Tracking Built-in
              </h2>

              <p className="text-slate-300 text-base leading-relaxed">
                We only promise what our application and operations actually deliver. Every feature is designed for foreign travellers navigating Sri Lanka comfortably and safely.
              </p>

              <div className="space-y-4 pt-4">
                
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Administrative Driver Vetting</h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      Drivers must submit government NIC or passport, commercial driving licence, vehicle revenue license, and insurance for manual admin approval before taking rides.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-[#E5A72C] text-[#102A43] flex items-center justify-center shrink-0 font-bold">
                    <Share2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Shareable Live Tracking Links</h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      Passengers can create an unguessable cryptographic tracking link to share via WhatsApp with loved ones so they can follow the trip live without creating an account.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">WhatsApp Click-to-Chat Operations</h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      Instant message prep with booking references and trip dates, opening the official WhatsApp client for direct communication with support or drivers.
                    </p>
                  </div>
                </div>

              </div>

              <div className="pt-2">
                <Link
                  href="/track"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-sm transition-colors shadow-md"
                >
                  <Search size={16} />
                  <span>Lookup Ride Tracking</span>
                </Link>
              </div>

            </div>

            {/* Right Visual Image */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-white/10 aspect-[4/3]">
                <Image 
                  src="/images/galle.jpg" 
                  alt="Historic Sri Lanka coastline and lighthouse" 
                  fill 
                  className="object-cover" 
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#102A43] via-[#102A43]/40 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-[#102A43]/80 backdrop-blur-md border border-white/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live System Active</span>
                  </div>
                  <p className="text-white font-black text-lg">
                    Real-time WebSocket Vehicle Tracking &amp; Monitoring
                  </p>
                  <p className="text-slate-300 text-xs mt-1">
                    Powered by At Your Service operations platform.
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* =========================================================================
          POPULAR SRI LANKA DESTINATIONS
          ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3">
                <MapPin size={14} className="text-[#E5A72C]" />
                <span>Island Destinations</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-[#102A43] tracking-tight">
                Popular Sri Lanka Routes
              </h2>
              <p className="mt-2 text-slate-600 text-sm sm:text-base max-w-xl">
                Direct airport transfer and custom tour connections from Katunayake to the island's most iconic regions.
              </p>
            </div>

            <Link 
              href="/packages" 
              className="text-[#2563EB] hover:text-blue-800 font-extrabold text-sm flex items-center gap-1.5 self-start sm:self-auto group"
            >
              <span>Explore packages</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {POPULAR_DESTINATIONS.map((dest, i) => (
              <Link 
                key={i} 
                href={`/packages?q=${encodeURIComponent(dest.name)}`}
                className="group relative rounded-3xl overflow-hidden aspect-[4/5] shadow-md hover:shadow-2xl transition-all duration-500 border border-slate-200/80"
              >
                <Image 
                  src={dest.img} 
                  alt={dest.name} 
                  fill 
                  className="object-cover group-hover:scale-110 transition-transform duration-700" 
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#102A43] via-[#102A43]/40 to-transparent opacity-85 group-hover:opacity-95 transition-opacity"></div>
                
                <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-white/20">
                  {dest.tag}
                </div>

                <div className="absolute bottom-0 left-0 p-6 w-full transform group-hover:-translate-y-1 transition-transform duration-300">
                  <h3 className="text-2xl font-black text-white mb-1.5">{dest.name}</h3>
                  <p className="text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                    <MapPin size={13} className="text-[#E5A72C] shrink-0" />
                    <span>{dest.desc}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </section>


      {/* =========================================================================
          SECTION 6: BECOME A DRIVER (Actual Driver Onboarding & Registration)
          ========================================================================= */}
      <section className="py-16 sm:py-24 bg-[#F8FAFC] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-gradient-to-br from-[#102A43] to-slate-900 rounded-3xl p-8 sm:p-12 lg:p-16 text-white shadow-xl relative overflow-hidden">
            
            {/* Background Accent Rings */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-[#2563EB]/20 blur-3xl pointer-events-none"></div>
            <div className="absolute top-0 right-1/3 w-64 h-64 rounded-full bg-[#E5A72C]/10 blur-3xl pointer-events-none"></div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-[#E5A72C] text-xs font-bold uppercase tracking-wider border border-white/20">
                  <Car size={15} />
                  <span>Driver &amp; Chauffeur Network</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                  Drive with At Your Service &bull; Join Our Platform
                </h2>

                <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
                  Are you a professional tourist chauffeur or licensed vehicle owner in Sri Lanka? Register to receive verified airport pickups, custom trip offers, and publish your own tour packages upon approval.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#E5A72C] shrink-0" />
                    <span>Direct traveller bookings &amp; enquiries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#E5A72C] shrink-0" />
                    <span>Create &amp; publish your own tour packages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#E5A72C] shrink-0" />
                    <span>Dedicated mobile driver portal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#E5A72C] shrink-0" />
                    <span>Transparent admin approval process</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4 justify-center">
                <Link
                  href="/driver/register"
                  className="bg-[#2563EB] hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-extrabold text-base transition-colors shadow-lg shadow-blue-900/40 text-center flex items-center justify-center gap-2"
                >
                  <span>Apply as a Driver</span>
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/driver/login"
                  className="bg-white/10 hover:bg-white/20 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors border border-white/20 text-center"
                >
                  Driver Sign In
                </Link>
              </div>

            </div>

          </div>

        </div>
      </section>


      {/* =========================================================================
          SECTION 7: FAQS & WHATSAPP BUSINESS SUPPORT
          ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-xs font-bold uppercase tracking-wider mb-3">
              <HelpCircle size={14} />
              <span>Frequently Asked Questions</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#102A43] tracking-tight">
              Essential Information for Travellers
            </h2>
            <p className="mt-4 text-slate-600 text-base sm:text-lg">
              Everything you need to know about airport pickups, custom trip planning, and tracking in Sri Lanka.
            </p>
          </div>

          {/* Accessible FAQ Accordion */}
          <FaqAccordion />

          {/* WhatsApp Support CTA Card */}
          <div className="mt-16 max-w-4xl mx-auto rounded-3xl bg-[#F8FAFC] border-2 border-slate-200 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-left">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <MessageSquare size={28} />
              </div>
              <div>
                <h4 className="text-xl font-black text-[#102A43]">
                  Have a Special Request or Need Fast Help?
                </h4>
                <p className="text-slate-600 text-sm mt-1">
                  Connect directly with our 24/7 operations team on official WhatsApp Business.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <Link
                href="/contact"
                className="flex-1 md:flex-initial text-center px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm border border-slate-300 transition-colors"
              >
                Contact Form
              </Link>
              
              <a
                href="https://wa.me/94771234567?text=Hello%20At%20Your%20Service%2C%20I%20would%20like%20assistance%20with%20a%20booking"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-initial text-center px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm inline-flex items-center justify-center gap-2"
              >
                <MessageSquare size={16} />
                <span>Open WhatsApp</span>
              </a>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
