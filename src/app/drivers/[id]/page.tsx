import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Package from "@/models/Package";
import Booking from "@/models/Booking";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ShieldCheck,
  MapPin,
  Calendar,
  Car,
  Star,
  Award,
  Languages,
  CheckCircle,
  Package as PackageIcon,
  ChevronLeft,
  Info,
  Clock,
  Sparkles
} from "lucide-react";
import PackageImage from "@/components/packages/PackageImage";

export const dynamic = "force-dynamic";

export default async function PublicDriverProfilePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await dbConnect();

  const driver = await User.findById(id).select("-password").lean();

  if (!driver || driver.role !== "DRIVER") {
    notFound();
  }

  // Count actual completed trips on the platform
  const completedTripsCount = await Booking.countDocuments({
    driverId: driver._id,
    status: "COMPLETED"
  });

  // Fetch published travel packages created by this driver
  const driverPackages = await Package.find({
    driverId: driver._id,
    status: "PUBLISHED"
  }).sort({ createdAt: -1 }).lean();

  const details = driver.driverDetails || {};
  const specialities = Array.isArray(details.specialities)
    ? details.specialities
    : typeof details.specialities === "string"
    ? details.specialities.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  const languages = Array.isArray(details.languagesSpoken)
    ? details.languagesSpoken
    : typeof details.languagesSpoken === "string"
    ? details.languagesSpoken.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [driver.preferredLanguage || "English"];

  const memberSince = driver.createdAt
    ? new Date(driver.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Recently joined";

  return (
    <div className="bg-slate-50 min-h-screen py-12 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Back navigation */}
        <div>
          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-bold transition-colors"
          >
            <ChevronLeft size={16} /> Back to Tour Packages
          </Link>
        </div>

        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-400 font-black text-3xl">
              {driver.profilePhoto ? (
                <img src={driver.profilePhoto} alt={driver.name} className="w-full h-full object-cover" />
              ) : (
                <span>{driver.name ? driver.name[0] : "D"}</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {driver.name}
                </h1>
                {driver.isApproved ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                    <CheckCircle size={13} className="text-emerald-600" /> Verified Host Driver
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                    Host Driver
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-semibold pt-1">
                {details.homeCity && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-blue-500" /> Based in {details.homeCity}
                  </span>
                )}
                {details.areasServed && (
                  <span className="flex items-center gap-1">
                    <Sparkles size={14} className="text-amber-500" /> Serves {details.areasServed}
                  </span>
                )}
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar size={14} /> Member since {memberSince}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Platform Metrics */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 self-stretch sm:self-auto justify-around">
            <div className="text-center px-2">
              <span className="block text-xl font-black text-slate-900">{completedTripsCount}</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Trips</span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center px-2">
              <span className="flex items-center justify-center gap-1 text-xl font-black text-amber-600">
                <Star size={18} className="fill-amber-500 text-amber-500" />
                {driver.rating ? Number(driver.rating).toFixed(1) : "5.0"}
              </span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {driver.reviewCount ? `${driver.reviewCount} Reviews` : "Top Rated"}
              </span>
            </div>
          </div>
        </div>

        {/* Introduction & Bio */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Info size={20} className="text-blue-600" /> About Your Host
          </h2>
          <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap font-medium">
            {details.shortBio || `${driver.name} is a dedicated professional driver welcoming travellers to discover Sri Lanka's richest landscapes, temples, and coastal escapes with warmth and comfort.`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
            {details.yearsOfExperience !== undefined && details.yearsOfExperience !== "" && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-slate-500 font-semibold block">Experience</span>
                <span className="font-extrabold text-blue-900 text-sm">
                  {details.yearsOfExperience} Years Experience
                </span>
                <span className="text-[10px] text-blue-600 block mt-0.5 font-medium">
                  (Self-reported driving & guide experience)
                </span>
              </div>
            )}

            {languages.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block flex items-center gap-1">
                  <Languages size={13} className="text-blue-500" /> Languages Spoken
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {languages.join(", ")}
                </span>
              </div>
            )}

            {driver.isApproved && (
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-slate-500 font-semibold block flex items-center gap-1">
                  <Award size={13} className="text-emerald-600" /> Platform Verification
                </span>
                <span className="font-bold text-emerald-900 text-sm">
                  Admin Verified Identity & Vehicle
                </span>
              </div>
            )}
          </div>

          {/* Specialities */}
          {specialities.length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-700 block mb-2">Tour Specialities & Local Knowledge</span>
              <div className="flex flex-wrap gap-2">
                {specialities.map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold">
                    • {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Registered Vehicle Comfort */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Car size={20} className="text-blue-600" /> Approved Tour Vehicle
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 font-bold uppercase block text-[10px]">Model & Type</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                {details.vehicleMake ? `${details.vehicleMake} ` : ""}{details.vehicleModel || driver.vehicleCategory || "Standard Tour Car"}
              </span>
              <span className="text-slate-500">{driver.vehicleCategory || "Comfort Passenger Vehicle"}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 font-bold uppercase block text-[10px]">Features</span>
              <span className="font-bold text-emerald-700 text-sm mt-0.5 block flex items-center gap-1">
                <CheckCircle size={14} /> Full Air Conditioning
              </span>
              <span className="text-slate-500">Regularly inspected & sanitized</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 font-bold uppercase block text-[10px]">Passenger & Luggage</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                Up to {details.passengerCapacity || 4} Passengers
              </span>
              <span className="text-slate-500">{details.luggageCapacity || 4} Luggage pieces capacity</span>
            </div>
          </div>
        </div>

        {/* Tour Packages Curated by This Driver */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <PackageIcon size={22} className="text-blue-600" /> Travel Packages by {driver.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Explore approved custom itineraries hosted by this driver.</p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {driverPackages.length} Tour{driverPackages.length !== 1 ? "s" : ""}
            </span>
          </div>

          {driverPackages.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl text-center border border-slate-200 text-slate-500 text-sm">
              This driver does not have any publicly published packages at the moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {driverPackages.map((pkg: any) => {
                const currency = pkg.costs?.currency || "LKR";
                const price = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || 0;
                return (
                  <div key={pkg._id.toString()} className="bg-white rounded-3xl shadow-sm hover:shadow-md transition-all border border-slate-200 overflow-hidden flex flex-col group">
                    <div className="h-44 relative bg-slate-100 overflow-hidden">
                      <PackageImage src={pkg.coverPhoto} alt={pkg.title} category={pkg.category} />
                      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase">
                        {pkg.category}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-slate-900 text-base mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {pkg.title}
                      </h3>
                      <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                        {pkg.shortDescription}
                      </p>
                      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Starting</span>
                          <span className="font-black text-slate-900 text-sm">
                            {currency} {price.toLocaleString()}
                          </span>
                        </div>
                        <Link
                          href={`/packages/${pkg._id.toString()}`}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          View Tour
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Passenger Safety & Privacy Notice */}
        <div className="bg-slate-100 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-3 border border-slate-200/80">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
          <span>
            <strong>Passenger Safety & Privacy Guarantee:</strong> Official driving licences, national identity documents, and personal contact details are securely verified by our administrators and kept strictly private. Contact details are shared with passengers only upon confirmed booking.
          </span>
        </div>

      </div>
    </div>
  );
}

