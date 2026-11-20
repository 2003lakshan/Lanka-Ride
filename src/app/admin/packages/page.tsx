import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import PackageEnquiry from "@/models/PackageEnquiry";
import Link from "next/link";
import { 
  Package as PackageIcon, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Filter, 
  Archive 
} from "lucide-react";
import PackageImage from "@/components/packages/PackageImage";
import AdminPackageRowActions from "@/components/admin/AdminPackageRowActions";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const statusFilter = resolvedParams.status;

  await dbConnect();
  
  if (Package && PackageEnquiry) {
    // No-op to ensure models are registered
  }
  
  const query: any = {};
  if (statusFilter && statusFilter !== "ALL") {
    query.status = statusFilter;
  }

  const enquiries = await PackageEnquiry.find()
    .populate("riderId", "name email phoneNumber")
    .populate("driverId", "name email")
    .populate("packageId", "title category")
    .sort({ createdAt: -1 })
    .lean();

  const packages = await Package.find(query)
    .populate("driverId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  const counts = {
    all: await Package.countDocuments(),
    pending: await Package.countDocuments({ status: "PENDING_REVIEW" }),
    changes: await Package.countDocuments({ status: "CHANGES_REQUESTED" }),
    published: await Package.countDocuments({ status: "PUBLISHED" }),
    rejected: await Package.countDocuments({ status: "REJECTED" }),
    archived: await Package.countDocuments({ status: "ARCHIVED" })
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2 flex items-center gap-3">
          <PackageIcon className="text-blue-600" size={32} /> Tour Packages
        </h1>
        <p className="text-slate-600">Review driver-created packages, manage publishing approvals, archive old packages, and oversee enquiries.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Link
          href="/admin/packages"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            !statusFilter || statusFilter === "ALL"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Packages ({counts.all})
        </Link>
        <Link
          href="/admin/packages?status=PENDING_REVIEW"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            statusFilter === "PENDING_REVIEW"
              ? "bg-amber-600 text-white"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
          }`}
        >
          <Clock size={12} /> Pending Review ({counts.pending})
        </Link>
        <Link
          href="/admin/packages?status=CHANGES_REQUESTED"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            statusFilter === "CHANGES_REQUESTED"
              ? "bg-orange-600 text-white"
              : "bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200"
          }`}
        >
          <AlertTriangle size={12} /> Changes Requested ({counts.changes})
        </Link>
        <Link
          href="/admin/packages?status=PUBLISHED"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            statusFilter === "PUBLISHED"
              ? "bg-emerald-600 text-white"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
          }`}
        >
          <CheckCircle size={12} /> Published ({counts.published})
        </Link>
        <Link
          href="/admin/packages?status=ARCHIVED"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            statusFilter === "ARCHIVED"
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
          }`}
        >
          <Archive size={12} /> Archived ({counts.archived})
        </Link>
        <Link
          href="/admin/packages?status=REJECTED"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            statusFilter === "REJECTED"
              ? "bg-rose-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Rejected ({counts.rejected})
        </Link>
      </div>

      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            Driver Created Packages
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            Showing {packages.length} package{packages.length !== 1 ? "s" : ""}
          </span>
        </div>
        
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Package Details</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Driver</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Duration & Price</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 text-right font-bold uppercase tracking-wider text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packages.map((pkg: any) => {
                const currency = pkg.costs?.currency || "LKR";
                const price = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || pkg.price || 0;
                const pricingBasis = pkg.costs?.priceType ? pkg.costs.priceType.replace(/_/g, " ") : "Per Vehicle";

                return (
                  <tr key={pkg._id.toString()} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                          <PackageImage
                            src={pkg.coverPhoto}
                            alt={pkg.title}
                            category={pkg.category}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 line-clamp-1">{pkg.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase">
                              {pkg.category}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              Rev {pkg.revision || 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{pkg.driverId?.name || "Unknown"}</div>
                      <div className="text-xs text-slate-500">{pkg.driverId?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{pkg.days} Days / {pkg.nights ?? Math.max(0, pkg.days - 1)} Nights</div>
                      <div className="text-xs font-bold text-emerald-700 mt-0.5">
                        {currency} {price.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">({pricingBasis})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full uppercase ${
                        pkg.status === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800"
                          : pkg.status === "PENDING_REVIEW"
                          ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                          : pkg.status === "CHANGES_REQUESTED"
                          ? "bg-orange-100 text-orange-900 border border-orange-300"
                          : pkg.status === "ARCHIVED"
                          ? "bg-slate-200 text-slate-800 border border-slate-300"
                          : pkg.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-800"
                      }`}>
                        {pkg.status === "PENDING_REVIEW" && <Clock size={12} />}
                        {pkg.status === "CHANGES_REQUESTED" && <AlertTriangle size={12} />}
                        {pkg.status === "PUBLISHED" && <CheckCircle size={12} />}
                        {pkg.status === "ARCHIVED" && <Archive size={12} />}
                        {pkg.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <AdminPackageRowActions
                        packageId={pkg._id.toString()}
                        title={pkg.title}
                        category={pkg.category}
                        coverPhoto={pkg.coverPhoto}
                        driverName={pkg.driverId?.name}
                        status={pkg.status}
                        revision={pkg.revision}
                      />
                    </td>
                  </tr>
                );
              })}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No packages match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {packages.map((pkg: any) => {
            const currency = pkg.costs?.currency || "LKR";
            const price = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || pkg.price || 0;
            const pricingBasis = pkg.costs?.priceType ? pkg.costs.priceType.replace(/_/g, " ") : "Per Vehicle";

            return (
              <div key={pkg._id.toString()} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                    <PackageImage
                      src={pkg.coverPhoto}
                      alt={pkg.title}
                      category={pkg.category}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{pkg.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase">
                        {pkg.category}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        Rev {pkg.revision || 1}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      By <span className="font-semibold text-slate-700">{pkg.driverId?.name || "Driver"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="font-semibold text-slate-700">
                    {pkg.days}D / {pkg.nights ?? Math.max(0, pkg.days - 1)}N &bull; <span className="text-emerald-700 font-bold">{currency} {price.toLocaleString()}</span> <span className="text-[10px] text-slate-400">({pricingBasis})</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                    pkg.status === "PUBLISHED"
                      ? "bg-emerald-100 text-emerald-800"
                      : pkg.status === "PENDING_REVIEW"
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : pkg.status === "CHANGES_REQUESTED"
                      ? "bg-orange-100 text-orange-900 border border-orange-300"
                      : pkg.status === "ARCHIVED"
                      ? "bg-slate-200 text-slate-800 border border-slate-300"
                      : pkg.status === "REJECTED"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-800"
                  }`}>
                    {pkg.status === "ARCHIVED" && <Archive size={10} />}
                    {pkg.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <AdminPackageRowActions
                    packageId={pkg._id.toString()}
                    title={pkg.title}
                    category={pkg.category}
                    coverPhoto={pkg.coverPhoto}
                    driverName={pkg.driverId?.name}
                    status={pkg.status}
                    revision={pkg.revision}
                  />
                </div>
              </div>
            );
          })}
          {packages.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No packages match the current filter.
            </div>
          )}
        </div>
      </div>

      {/* Package Enquiries & Bookings Table */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            Package Enquiries & Bookings
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Date & Package</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Rider</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Driver</th>
                <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enquiries.map((enquiry: any) => (
                <tr key={enquiry._id.toString()} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 line-clamp-1">{enquiry.packageId?.title || "Unknown Package"}</div>
                    <div className="text-xs text-slate-500 mt-1">{new Date(enquiry.createdAt).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{enquiry.riderId?.name || "Unknown"}</div>
                    <div className="text-xs text-slate-500">{enquiry.riderId?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{enquiry.driverId?.name || "Unknown"}</div>
                    <div className="text-xs text-slate-500">{enquiry.driverId?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full uppercase ${
                      enquiry.status === "BOOKED" ? "bg-green-100 text-green-800" : 
                      enquiry.status === "ACCEPTED" ? "bg-blue-100 text-blue-800" :
                      enquiry.status === "DECLINED" ? "bg-rose-100 text-rose-800" :
                      "bg-amber-100 text-amber-800"
                    }`}>
                      {enquiry.status}
                    </span>
                  </td>
                </tr>
              ))}
              {enquiries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No package enquiries recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
