import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import VehicleType from "@/models/VehicleType";
import Link from "next/link";
import { 
  MapPin, 
  Calendar, 
  Users, 
  DollarSign, 
  Clock, 
  Car, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Globe,
  Briefcase,
  Luggage,
  Sparkles,
  Info
} from "lucide-react";
import AdminPackageActions from "@/components/admin/AdminPackageActions";
import PackageImage from "@/components/packages/PackageImage";

export const dynamic = "force-dynamic";

export default async function AdminPackageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  const pkg = await Package.findById(id)
    .populate('driverId', 'name email phoneNumber vehicleRegistration vehicleCategory driverDetails')
    .populate('vehicleTypeId', 'name maxPassengers maxLuggage fuelType')
    .lean();

  if (!pkg) {
    return (
      <div className="min-h-screen bg-slate-50 py-20 text-center flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-4">Package Not Found</h1>
        <Link href="/admin/packages" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Back to Packages</Link>
      </div>
    );
  }

  const currency = pkg.costs?.currency || "LKR";
  const pricingBasis = pkg.costs?.pricingBasis || (pkg.costs?.priceType === "PER_PERSON" ? "PER_PERSON" : "PER_VEHICLE");
  const revision = pkg.revision || 1;

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "PUBLISHED":
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Published</span>;
      case "PENDING_REVIEW":
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Pending Review</span>;
      case "CHANGES_REQUESTED":
        return <span className="bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Changes Requested</span>;
      case "REJECTED":
        return <span className="bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Rejected</span>;
      case "PAUSED":
        return <span className="bg-orange-100 text-orange-800 border border-orange-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Paused</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{st}</span>;
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      
      {/* Top Sticky Admin Control Header */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-200 py-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/packages" className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors">
              <ArrowLeft size={22} />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                  {pkg.title}
                </h1>
                {getStatusBadge(pkg.status)}
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Revision {revision}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                Driver: <strong className="text-slate-700">{pkg.driverId?.name || "Driver"}</strong> ({pkg.driverId?.email}) &bull; Phone: {pkg.driverId?.phoneNumber || "N/A"}
              </div>
            </div>
          </div>
          <AdminPackageActions packageId={id} status={pkg.status} revision={revision} />
        </div>
      </div>

      {/* Hero Banner with Resilient Package Image */}
      <div className="relative h-64 sm:h-80 md:h-96 w-full bg-slate-900 overflow-hidden">
        <PackageImage
          src={pkg.coverPhoto}
          alt={pkg.title}
          category={pkg.category}
          className="opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider mb-2">
              {pkg.category}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-2">{pkg.title}</h1>
            <p className="text-blue-100 text-sm sm:text-base flex items-center gap-2">
              <MapPin size={16} /> Starting from <strong className="text-white">{pkg.startingCity}</strong> &bull; Pickup: {pkg.pickupOptions}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Change Request Banner (if in CHANGES_REQUESTED state) */}
        {pkg.status === "CHANGES_REQUESTED" && pkg.changeRequest && (
          <div className="mb-8 p-5 bg-purple-50 border-2 border-purple-200 rounded-2xl flex items-start gap-4">
            <AlertTriangle className="text-purple-600 shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-bold text-purple-900 text-base">Active Changes Requested from Driver</h3>
              <p className="text-purple-800 text-sm mt-1 whitespace-pre-wrap">{pkg.changeRequest.feedback}</p>
              <p className="text-xs text-purple-500 mt-2">Requested on: {new Date(pkg.changeRequest.requestedAt).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Rejection Banner */}
        {pkg.status === "REJECTED" && pkg.rejectionReason && (
          <div className="mb-8 p-5 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-start gap-4">
            <XCircle className="text-rose-600 shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-bold text-rose-900 text-base">Rejection Reason</h3>
              <p className="text-rose-800 text-sm mt-1 whitespace-pre-wrap">{pkg.rejectionReason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Details (2 cols) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Overview & Description */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-3">Trip Overview</h2>
              <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap mb-4">{pkg.shortDescription}</p>
              
              {pkg.fullDescription && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Detailed Description</h3>
                  <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">{pkg.fullDescription}</p>
                </div>
              )}

              {pkg.destinations && pkg.destinations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Key Destinations:</span>
                  {pkg.destinations.map((dest: string, idx: number) => (
                    <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                      {dest}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Logistics & Capacity</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Calendar size={20} className="text-blue-600 mb-2" />
                  <span className="text-xs text-slate-500 font-bold block">Duration</span>
                  <span className="font-extrabold text-slate-900 text-sm sm:text-base">{pkg.days} Days / {pkg.nights} Nights</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Users size={20} className="text-emerald-600 mb-2" />
                  <span className="text-xs text-slate-500 font-bold block">Group Capacity</span>
                  <span className="font-extrabold text-slate-900 text-sm sm:text-base">{pkg.minPassengers} - {pkg.maxPassengers} Pax</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Clock size={20} className="text-amber-600 mb-2" />
                  <span className="text-xs text-slate-500 font-bold block">Pickup Time</span>
                  <span className="font-extrabold text-slate-900 text-sm sm:text-base">{pkg.pickupTime || "08:00 AM"}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <MapPin size={20} className="text-purple-600 mb-2" />
                  <span className="text-xs text-slate-500 font-bold block">Drop-off</span>
                  <span className="font-extrabold text-slate-900 text-sm sm:text-base truncate block">{pkg.dropoffLocation || "Flexible"}</span>
                </div>
              </div>
            </div>

            {/* Day-by-day Itinerary */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Calendar className="text-blue-600" size={22} />
                Day-by-Day Itinerary ({pkg.itinerary?.length || 0} Days)
              </h2>

              <div className="space-y-6">
                {pkg.itinerary && pkg.itinerary.length > 0 ? (
                  pkg.itinerary.map((day: any, idx: number) => (
                    <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          Day {day.dayNumber || idx + 1}
                        </span>
                        {day.overnightLocation && (
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                            <MapPin size={14} className="text-blue-500" /> Overnight: <strong className="text-slate-800">{day.overnightLocation}</strong>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mb-2">
                        {day.title || `Day ${day.dayNumber || idx + 1} Itinerary`}
                      </h3>

                      {day.placesToVisit && day.placesToVisit.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Places to Visit:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {day.placesToVisit.map((place: string, pIdx: number) => (
                              <span key={pIdx} className="bg-white border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-medium">
                                {place}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100 my-2">
                        <div>
                          <strong className="text-slate-800">Est. Driving Time:</strong> {day.travelTime || "~2 hours"}
                        </div>
                        <div>
                          <strong className="text-slate-800">Stop Duration:</strong> {day.stopDuration || "~1 hour"}
                        </div>
                        <div>
                          <strong className="text-slate-800">Accommodation:</strong> {day.accommodationDetails || "Not included / By traveller"}
                        </div>
                      </div>

                      {day.notes && (
                        <p className="text-xs text-slate-500 italic mt-2">
                          <Info size={12} className="inline mr-1 text-slate-400" />
                          {day.notes}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm italic">No day-by-day itinerary provided.</p>
                )}
              </div>
            </div>

            {/* Gallery Photos */}
            {pkg.gallery && pkg.gallery.length > 0 && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Tour Gallery ({pkg.gallery.length})</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {pkg.gallery.map((imgUrl: string, idx: number) => (
                    <div key={idx} className="h-36 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                      <PackageImage src={imgUrl} alt={`${pkg.title} photo ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions & Exclusions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={18} /> Inclusions
                </h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {(pkg.inclusionsList && pkg.inclusionsList.length > 0 ? pkg.inclusionsList : pkg.costs?.inclusions || []).map((inc: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">&check;</span>
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2 text-rose-700">
                  <XCircle size={18} /> Exclusions
                </h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {(pkg.exclusionsList && pkg.exclusionsList.length > 0 ? pkg.exclusionsList : pkg.costs?.exclusions || []).map((exc: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-rose-500 font-bold">&times;</span>
                      <span>{exc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

          {/* Right Sidebar: Vehicle & Pricing & Terms (1 col) */}
          <div className="space-y-6">
            
            {/* Vehicle Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Car className="text-blue-600" size={20} /> Assigned Vehicle
              </h3>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Vehicle Type:</span>
                  <span className="font-bold text-slate-900">{pkg.vehicleTypeId?.name || pkg.vehicleDetails?.category || "Standard Car"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Registration:</span>
                  <span className="font-bold text-slate-800">{pkg.vehicleDetails?.registration || pkg.driverId?.vehicleRegistration || "Registered"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Air Conditioning:</span>
                  <span className="font-bold text-emerald-600">Equipped (AC)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Passenger Limit:</span>
                  <span className="font-bold text-slate-900">{pkg.vehicleTypeId?.maxPassengers || pkg.maxPassengers} Persons</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Luggage Limit:</span>
                  <span className="font-bold text-slate-900">{pkg.vehicleTypeId?.maxLuggage || 3} Bags</span>
                </div>
              </div>
            </div>

            {/* Pricing Breakdown Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign className="text-emerald-600" size={20} /> Pricing Structure
              </h3>

              <div className="space-y-3 text-sm">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider block">Total Starting Price</span>
                    <span className="text-2xl font-black text-emerald-700">
                      {currency} {pkg.costs?.totalStartingPrice?.toLocaleString()}
                    </span>
                  </div>
                  <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase">
                    {pricingBasis.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Base Price:</span>
                  <span className="font-bold text-slate-800">{currency} {pkg.costs?.basePrice?.toLocaleString()}</span>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Covers:</span>
                  <span className="font-bold text-slate-800">{pkg.costs?.passengerCountCovered || 1} Passengers</span>
                </div>

                {pkg.costs?.extraPersonRate ? (
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Extra Person Rate:</span>
                    <span className="font-bold text-slate-800">{currency} {pkg.costs.extraPersonRate.toLocaleString()}</span>
                  </div>
                ) : null}

                {pkg.costs?.depositRequired ? (
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Deposit Required:</span>
                    <span className="font-bold text-slate-800">{currency} {pkg.costs.depositRequired.toLocaleString()}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Availability & Policies */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Globe className="text-blue-600" size={20} /> Policies & Terms
              </h3>

              <div className="text-xs text-slate-600 space-y-3">
                <div>
                  <strong className="text-slate-800 block mb-0.5">Availability:</strong>
                  <p>{pkg.availableDates || "Year-round availability"}</p>
                </div>
                <div>
                  <strong className="text-slate-800 block mb-0.5">Advance Notice:</strong>
                  <p>{pkg.advanceNoticeDays || 2} Days prior notice required</p>
                </div>
                <div>
                  <strong className="text-slate-800 block mb-0.5">Cancellation Policy:</strong>
                  <p>{pkg.cancellationPolicy || pkg.costs?.cancellationTerms || "Standard cancellation terms apply."}</p>
                </div>
                <div>
                  <strong className="text-slate-800 block mb-0.5">Weather Policy:</strong>
                  <p>{pkg.weatherPolicy || "Alternative routes provided in case of severe weather."}</p>
                </div>
              </div>
            </div>

            {/* Review History */}
            {pkg.reviewHistory && pkg.reviewHistory.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-3">Review History</h3>
                <div className="space-y-3 text-xs">
                  {pkg.reviewHistory.map((item: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold uppercase text-slate-800">{item.action}</span>
                        <span className="text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                      {item.feedback && <p className="text-slate-600 italic">&ldquo;{item.feedback}&rdquo;</p>}
                      <div className="text-[10px] text-slate-400 mt-1">by {item.actorName || item.actorRole} &bull; rev {item.revision || 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
