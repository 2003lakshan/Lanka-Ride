import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import PackageEnquiry from "@/models/PackageEnquiry";
import Link from "next/link";
import { Package as PackageIcon, Eye, CheckCircle, XCircle } from "lucide-react";
import AdminPackageActions from "@/components/admin/AdminPackageActions";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  if (Package && PackageEnquiry) {
    // No-op to ensure models are registered
  }
  
  const enquiries = await PackageEnquiry.find()
    .populate('riderId', 'name email phoneNumber')
    .populate('driverId', 'name email')
    .populate('packageId', 'title category')
    .sort({ createdAt: -1 })
    .lean();

  const packages = await Package.find()
    .populate('driverId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <PackageIcon className="text-blue-600" size={32} /> Tour Packages
        </h1>
        <p className="text-slate-600">Review driver-created packages and oversee package enquiries.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            Driver Created Packages
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Package Details</th>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Duration / Price</th>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packages.map((pkg: any) => (
                <tr key={pkg._id.toString()} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 line-clamp-1">{pkg.title}</div>
                    <div className="text-xs font-bold text-slate-500 uppercase mt-1">{pkg.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{pkg.driverId?.name || "Unknown"}</div>
                    <div className="text-xs text-slate-500">{pkg.driverId?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{pkg.days} Days / {pkg.nights} Nights</div>
                    <div className="text-xs font-bold text-green-600 mt-1">LKR {pkg.price?.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                      pkg.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 
                      pkg.status === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-800' :
                      pkg.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {pkg.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/packages/${pkg._id.toString()}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                      <Eye size={14} /> Review
                    </Link>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No driver packages created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            Package Enquiries & Bookings
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Date & Package</th>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Rider</th>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Status</th>
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
                    <span className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                      enquiry.status === 'BOOKED' ? 'bg-green-100 text-green-800' : 
                      enquiry.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                      enquiry.status === 'DECLINED' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {enquiry.status}
                    </span>
                  </td>
                </tr>
              ))}
              {enquiries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No package enquiries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
