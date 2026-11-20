import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import Link from "next/link";
import { Plus, Package as PackageIcon, Clock, CheckCircle, XCircle, PauseCircle, AlertTriangle, MapPin, Calendar, Users } from "lucide-react";
import PackageImage from "@/components/packages/PackageImage";

export const dynamic = "force-dynamic";

export default async function DriverPackagesPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "DRIVER") {
    redirect("/login");
  }

  await dbConnect();
  
  const packages = await Package.find({ driverId: (session.user as any).id })
    .sort({ createdAt: -1 })
    .lean();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200 flex items-center gap-1 shadow-xs">
            <Clock size={12} /> Draft
          </span>
        );
      case "PENDING_REVIEW":
        return (
          <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold border border-amber-300 flex items-center gap-1 shadow-xs animate-pulse">
            <Clock size={12} /> Pending Review
          </span>
        );
      case "CHANGES_REQUESTED":
        return (
          <span className="px-3 py-1 bg-orange-100 text-orange-900 rounded-full text-xs font-bold border border-orange-300 flex items-center gap-1 shadow-xs">
            <AlertTriangle size={12} className="text-orange-600" /> Changes Requested
          </span>
        );
      case "PUBLISHED":
        return (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-300 flex items-center gap-1 shadow-xs">
            <CheckCircle size={12} className="text-emerald-600" /> Published
          </span>
        );
      case "PAUSED":
        return (
          <span className="px-3 py-1 bg-slate-200 text-slate-800 rounded-full text-xs font-bold border border-slate-300 flex items-center gap-1 shadow-xs">
            <PauseCircle size={12} /> Paused
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-3 py-1 bg-rose-100 text-rose-900 rounded-full text-xs font-bold border border-rose-300 flex items-center gap-1 shadow-xs">
            <XCircle size={12} className="text-rose-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">My Travel Packages</h1>
            <p className="text-slate-600">Create, publish, and manage your custom tourist travel itineraries.</p>
          </div>
          <Link
            href="/driver/packages/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow"
          >
            <Plus size={20} />
            Create Package
          </Link>
        </div>

        {packages.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm max-w-xl mx-auto">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <PackageIcon className="text-blue-500" size={36} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">No Packages Yet</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">
              Design your first custom travel itinerary to attract tourists visiting Sri Lanka. Showcase your preferred routes, vehicle comfort, and local experiences.
            </p>
            <Link
              href="/driver/packages/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition-colors shadow-sm"
            >
              <Plus size={18} />
              Create Your First Package
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg: any) => {
              const currency = pkg.costs?.currency || "LKR";
              const price = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || pkg.price || 0;
              const pricingBasis = pkg.costs?.priceType ? pkg.costs.priceType.replace(/_/g, " ") : "Per Vehicle";

              return (
                <div
                  key={pkg._id.toString()}
                  className="bg-white rounded-3xl shadow-sm hover:shadow-md border border-slate-200 overflow-hidden flex flex-col transition-all group"
                >
                  <div className="h-52 relative overflow-hidden bg-slate-100">
                    <PackageImage
                      src={pkg.coverPhoto}
                      alt={pkg.title}
                      category={pkg.category}
                    />
                    <div className="absolute top-4 left-4 bg-blue-600/90 backdrop-blur-xs text-white text-[11px] font-extrabold px-3 py-1 rounded-lg uppercase tracking-wider">
                      {pkg.category || "Tour"}
                    </div>
                    <div className="absolute top-4 right-4">
                      {getStatusBadge(pkg.status)}
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-700 transition-colors">
                      {pkg.title}
                    </h3>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-1">
                      {pkg.shortDescription}
                    </p>

                    {pkg.status === "CHANGES_REQUESTED" && (
                      <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-900 font-semibold flex items-center gap-2">
                        <AlertTriangle size={16} className="text-orange-600 shrink-0" />
                        <span>Admin requested changes. Click Manage to view feedback.</span>
                      </div>
                    )}

                    {pkg.destinations && pkg.destinations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {pkg.destinations.slice(0, 3).map((d: string) => (
                          <span key={d} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1">
                            <MapPin size={10} className="text-blue-500" /> {d}
                          </span>
                        ))}
                        {pkg.destinations.length > 3 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[11px] font-semibold">
                            +{pkg.destinations.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center py-4 border-t border-slate-100 mt-auto">
                      <div>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" /> Duration
                        </p>
                        <p className="font-extrabold text-slate-900 text-sm">
                          {pkg.days} Days / {pkg.nights ?? Math.max(0, pkg.days - 1)} Nights
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-medium">From ({pricingBasis})</p>
                        <p className="font-extrabold text-blue-700 text-base">
                          {currency} {price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <Link
                      href={`/driver/packages/${pkg._id.toString()}/edit`}
                      className={`w-full mt-4 text-center py-3 rounded-xl font-bold text-sm transition-colors ${
                        pkg.status === "CHANGES_REQUESTED"
                          ? "bg-orange-600 hover:bg-orange-700 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                      }`}
                    >
                      {pkg.status === "CHANGES_REQUESTED" ? "Review Feedback & Edit" : "Manage Package"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
