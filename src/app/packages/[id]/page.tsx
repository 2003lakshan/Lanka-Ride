import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import VehicleType from "@/models/VehicleType";
import User from "@/models/User";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Clock,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Car,
  Sparkles,
  ChevronLeft,
  Info,
  AlertTriangle,
  Compass,
  Coffee,
  Check,
  X,
  Luggage,
  Languages,
  Footprints,
  Baby
} from "lucide-react";
import PackageImage from "@/components/packages/PackageImage";
import ContactDriverButton from "@/components/packages/ContactDriverButton";
import PackageBookingModal from "@/components/packages/PackageBookingModal";

export const dynamic = "force-dynamic";

export default async function PackageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  await dbConnect();
  
  // Ensure models are registered for population
  if (VehicleType && User) {
    // no-op
  }

  const pkg = await Package.findById(id)
    .populate("driverId", "name email phoneNumber")
    .populate("vehicleTypeId")
    .lean();

  if (!pkg) {
    notFound();
  }

  // Only allow public viewing if PUBLISHED, or if the user is the package author or admin
  const isOwner = session && (session.user as any).id === pkg.driverId?._id?.toString();
  const isAdmin = session && (session.user as any).role === "ADMIN";

  if (pkg.status !== "PUBLISHED" && !isOwner && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 py-20 text-center flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
          <Clock size={32} />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Package Not Yet Published</h1>
        <p className="text-slate-500 mb-6 max-w-md text-sm">
          This travel package is currently under review or draft status and is not yet publicly visible.
        </p>
        <Link href="/packages" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">
          Browse Available Tours
        </Link>
      </div>
    );
  }

  const serializedPkg = JSON.parse(JSON.stringify(pkg));

  const currency = pkg.costs?.currency || "LKR";
  const price = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || pkg.price || 0;
  const pricingBasis = pkg.costs?.priceType
    ? pkg.costs.priceType === "PER_PERSON"
      ? "per person"
      : pkg.costs.priceType === "PER_VEHICLE"
      ? "per vehicle"
      : "entire package"
    : "per vehicle";

  const vehicle = pkg.vehicleTypeId;

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      {/* Top Banner if viewing unpublished package as driver/admin */}
      {pkg.status !== "PUBLISHED" && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2.5 text-center text-xs flex items-center justify-center gap-2">
          <AlertTriangle size={16} />
          <span>
            Preview Mode: This package is currently {pkg.status?.replace(/_/g, " ")}. Visible only to you and administrators.
          </span>
        </div>
      )}

      {/* Hero Cover Section */}
      <div className="relative h-[45vh] md:h-[55vh] w-full bg-slate-900 overflow-hidden">
        <PackageImage
          src={pkg.coverPhoto}
          alt={pkg.title}
          category={pkg.category}
          className="opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        {/* Back Link */}
        <div className="absolute top-6 left-6 z-20">
          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            <ChevronLeft size={16} /> All Tours
          </Link>
        </div>

        {/* Hero Title & Badges */}
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="bg-blue-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg uppercase tracking-wider">
                {pkg.category}
              </span>
              <span className="bg-white/20 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-lg">
                {pkg.days} Days / {pkg.nights ?? Math.max(0, pkg.days - 1)} Nights
              </span>
              <span className="bg-white/20 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1">
                <MapPin size={12} /> From {pkg.startingCity}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white max-w-4xl tracking-tight leading-tight">
              {pkg.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (Tour Details) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Quick At-a-Glance Badges */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Duration</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {pkg.days}D / {pkg.nights ?? Math.max(0, pkg.days - 1)}N
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Group Size</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {pkg.minPassengers || 1} - {pkg.maxPassengers || 4} Pax
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <Car size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Vehicle</span>
                  <span className="font-extrabold text-slate-900 text-sm truncate block max-w-[120px]">
                    {vehicle?.name || "Private AC Car"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Advance Notice</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {pkg.advanceNoticeDays ?? 2} Days
                  </span>
                </div>
              </div>
            </div>

            {/* Destinations Chips */}
            {pkg.destinations && pkg.destinations.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Key Destinations & Highlights</h3>
                <div className="flex flex-wrap gap-2">
                  {pkg.destinations.map((d: string) => (
                    <span key={d} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-blue-100">
                      <MapPin size={13} className="text-blue-500" /> {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery Photos */}
            {pkg.galleryPhotos && pkg.galleryPhotos.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-500" /> Tour Gallery
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pkg.galleryPhotos.map((imgUrl: string, idx: number) => (
                    <div key={idx} className="h-36 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                      <img src={imgUrl} alt={`Tour Scene ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* About Journey & Narrative */}
            <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 space-y-4">
              <h2 className="text-2xl font-black text-slate-900">About This Journey</h2>
              <p className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap font-medium">
                {pkg.fullDescription || pkg.shortDescription}
              </p>
            </div>

            {/* Day-by-Day Itinerary */}
            <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <Clock size={24} className="text-blue-600" />
                    Day-by-Day Itinerary
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Route values are estimates and can be tailored with your driver.
                  </p>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                  {pkg.itinerary?.length || pkg.days} Days Total
                </span>
              </div>

              <div className="space-y-6 relative border-l-2 border-blue-200 ml-4 pl-6 pt-2">
                {(pkg.itinerary && pkg.itinerary.length > 0 ? pkg.itinerary : [1]).map((day: any, idx: number) => {
                  const dayNum = day.dayNumber || idx + 1;
                  return (
                    <div key={idx} className="relative group">
                      {/* Circle on timeline */}
                      <div className="absolute -left-[35px] top-1 w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center border-4 border-white shadow-xs">
                        {dayNum}
                      </div>

                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/90 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h3 className="font-extrabold text-slate-900 text-base">
                            {day.title || `Day ${dayNum}: Exploration & Discovery`}
                          </h3>
                          {day.travelTime && (
                            <span className="text-xs font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-md inline-block self-start sm:self-auto">
                              {day.travelTime}
                            </span>
                          )}
                        </div>

                        {/* Attractions & Places */}
                        {day.placesToVisit && day.placesToVisit.length > 0 && (
                          <div className="text-xs text-slate-700">
                            <span className="font-bold text-slate-900">Key Stops: </span>
                            {day.placesToVisit.join(" • ")}
                          </div>
                        )}

                        {/* Activities */}
                        {day.activities && day.activities.length > 0 && (
                          <div className="text-xs text-slate-700">
                            <span className="font-bold text-slate-900">Activities: </span>
                            {day.activities.join(", ")}
                          </div>
                        )}

                        {/* Stop Duration & Overnight */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                          {day.stopDuration && (
                            <div className="text-slate-600">
                              <span className="font-bold text-slate-800">Stop Duration: </span>
                              {day.stopDuration}
                            </div>
                          )}
                          {day.overnightLocation && (
                            <div className="text-slate-600">
                              <span className="font-bold text-slate-800">Overnight: </span>
                              {day.overnightLocation}
                            </div>
                          )}
                        </div>

                        {/* Meals */}
                        {day.meals && (day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
                          <div className="flex items-center gap-3 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                            <Coffee size={14} className="text-amber-600" />
                            <span>
                              <strong>Meals:</strong> Breakfast ({day.meals.breakfast || "Included"}) • Lunch ({day.meals.lunch || "Optional stop"}) • Dinner ({day.meals.dinner || "Local stop"})
                            </span>
                          </div>
                        )}

                        {/* Day notes */}
                        {day.notes && (
                          <p className="text-xs text-slate-500 italic mt-1">
                            Note: {day.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 space-y-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Car size={24} className="text-blue-600" />
                Vehicle & Comfort
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Vehicle Model</span>
                  <span className="font-black text-slate-900 text-base">{vehicle?.name || "Comfort Tour Vehicle"}</span>
                  <span className="text-xs text-slate-600 block mt-0.5">{vehicle?.category || "Standard Car"}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Capacity</span>
                  <span className="font-black text-slate-900 text-base">{vehicle?.maxPassengers || pkg.maxPassengers || 4} Passengers</span>
                  <span className="text-xs text-slate-600 block mt-0.5">Luggage: {vehicle?.maxLuggage || 4} bags</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold uppercase block">Features</span>
                  <span className="font-black text-emerald-700 text-base flex items-center gap-1">
                    <CheckCircle size={16} /> Air Conditioned
                  </span>
                  <span className="text-xs text-slate-600 block mt-0.5">Private sanitized interior</span>
                </div>
              </div>
            </div>

            {/* Inclusions & Exclusions */}
            <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 space-y-6">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck size={24} className="text-blue-600" />
                What's Included & Excluded
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inclusions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <CheckCircle size={16} className="text-emerald-600" /> Included Services
                  </h3>
                  <ul className="space-y-2 text-xs font-semibold text-slate-700">
                    {(pkg.inclusionsList || pkg.costs?.inclusions || []).map((inc: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exclusions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-rose-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <XCircle size={16} className="text-rose-600" /> Not Included
                  </h3>
                  <ul className="space-y-2 text-xs font-semibold text-slate-700">
                    {(pkg.exclusionsList || pkg.costs?.exclusions || []).map((exc: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <X size={14} className="text-rose-600 shrink-0 mt-0.5" />
                        <span>{exc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Service Details Breakdown */}
              {pkg.includedServicesDetails && (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                  <h4 className="font-bold text-slate-900">Service Breakdown Specifics</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                    {pkg.includedServicesDetails.accommodation && (
                      <div>
                        <span className="font-bold text-slate-900 block">Accommodation:</span>
                        <span>{pkg.includedServicesDetails.accommodation}</span>
                      </div>
                    )}
                    {pkg.includedServicesDetails.meals && (
                      <div>
                        <span className="font-bold text-slate-900 block">Meals:</span>
                        <span>{pkg.includedServicesDetails.meals}</span>
                      </div>
                    )}
                    {pkg.includedServicesDetails.tickets && (
                      <div>
                        <span className="font-bold text-slate-900 block">Entry Tickets:</span>
                        <span>{pkg.includedServicesDetails.tickets}</span>
                      </div>
                    )}
                    {pkg.includedServicesDetails.guide && (
                      <div>
                        <span className="font-bold text-slate-900 block">Driver Guide:</span>
                        <span>{pkg.includedServicesDetails.guide}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Traveller Info & Requirements */}
            <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 space-y-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Info size={24} className="text-blue-600" />
                Traveller Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {pkg.languages && pkg.languages.length > 0 && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <Languages size={18} className="text-blue-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block">Tour Languages</span>
                      <span className="text-slate-600">{pkg.languages.join(", ")}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <Footprints size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 block">Activity Level</span>
                    <span className="text-slate-600">{pkg.activityLevel || "Easy (Relaxed pace)"}</span>
                  </div>
                </div>

                {pkg.accessibility && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <CheckCircle size={18} className="text-purple-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block">Accessibility</span>
                      <span className="text-slate-600">{pkg.accessibility}</span>
                    </div>
                  </div>
                )}

                {pkg.childSeatAvailable && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <Baby size={18} className="text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block">Child Safety Seat</span>
                      <span className="text-slate-600">Available upon request</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Things to bring */}
              {pkg.thingsToBring && pkg.thingsToBring.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-900">Recommended Things to Bring:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.thingsToBring.map((item: string) => (
                      <span key={item} className="px-3 py-1 bg-white text-slate-800 rounded-lg text-xs font-medium border border-slate-200">
                        • {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Terms, Cancellation & Policies */}
            <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 space-y-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck size={24} className="text-blue-600" />
                Policies & Terms
              </h2>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Cancellation & Refund Policy</span>
                  <p>{pkg.cancellationPolicy || pkg.costs?.cancellationTerms || "Free cancellation up to 48 hours prior to pickup."}</p>
                </div>

                {pkg.weatherPolicy && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="font-bold text-slate-900 block mb-1">Weather & Route Flexibility</span>
                    <p>{pkg.weatherPolicy}</p>
                  </div>
                )}

                {pkg.extraChargeConditions && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="font-bold text-slate-900 block mb-1">Extra Charges & Conditions</span>
                    <p>{pkg.extraChargeConditions}</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Sticky Booking & Driver Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 sticky top-8 space-y-6">
              
              {/* Pricing Header */}
              <div className="text-center pb-6 border-b border-slate-100">
                <p className="text-slate-400 font-extrabold uppercase tracking-widest text-[11px] mb-1">
                  Guaranteed Starting Price
                </p>
                <div className="text-4xl font-black text-slate-900">
                  {currency} {price.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-1 capitalize">
                  Pricing basis: {pricingBasis}
                  {pkg.costs?.passengerCountCovered ? ` (covers up to ${pkg.costs.passengerCountCovered} pax)` : ""}
                </p>
              </div>

              {/* Logistics Summary */}
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <MapPin size={16} className="text-blue-600 shrink-0" />
                  <span>Pickup: {pkg.pickupOptions || pkg.startingCity}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar size={16} className="text-blue-600 shrink-0" />
                  <span>Advance notice: {pkg.advanceNoticeDays ?? 2} day(s) required</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>Verified local driver with official license</span>
                </div>
              </div>

              {/* Driver Card */}
              {pkg.driverId && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-base">
                    {pkg.driverId.name?.[0] || "D"}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tour Host</span>
                    <span className="font-extrabold text-slate-900 text-sm">{pkg.driverId.name}</span>
                    <span className="text-[11px] text-emerald-600 font-bold block flex items-center gap-1">
                      <CheckCircle size={12} /> Verified Driver
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <PackageBookingModal pkg={serializedPkg} />

                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-2">Want to customize or discuss dates first?</p>
                  <ContactDriverButton packageId={id} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
