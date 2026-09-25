import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import Link from "next/link";
import { Plus, Package as PackageIcon, Clock, CheckCircle, XCircle, PauseCircle } from "lucide-react";

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
    switch(status) {
      case 'DRAFT': return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200 flex items-center gap-1"><Clock size={12}/> Draft</span>;
      case 'PENDING_REVIEW': return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold border border-yellow-200 flex items-center gap-1"><Clock size={12}/> Review Pending</span>;
      case 'PUBLISHED': return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1"><CheckCircle size={12}/> Published</span>;
      case 'PAUSED': return <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold border border-orange-200 flex items-center gap-1"><PauseCircle size={12}/> Paused</span>;
      case 'REJECTED': return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1"><XCircle size={12}/> Rejected</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">My Travel Packages</h1>
            <p className="text-slate-600">Create and manage your custom travel itineraries.</p>
          </div>
          <Link href="/driver/packages/new" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm">
            <Plus size={20} />
            Create Package
          </Link>
        </div>

        {packages.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <PackageIcon className="text-blue-500" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">No Packages Yet</h3>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">Create your first custom travel package to attract tourists looking for unique Sri Lankan experiences.</p>
            <Link href="/driver/packages/new" className="inline-flex bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors">
              Create Your First Package
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg: any) => (
              <div key={pkg._id.toString()} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="h-48 relative overflow-hidden bg-slate-100">
                  {pkg.coverPhoto ? (
                    <img src={pkg.coverPhoto} alt={pkg.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <PackageIcon size={40} />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    {getStatusBadge(pkg.status)}
                  </div>
                </div>
                
                <div className="p-6 flex flex-col flex-1">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">{pkg.category}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">{pkg.title}</h3>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-1">{pkg.shortDescription}</p>
                  
                  <div className="flex justify-between items-center py-4 border-t border-slate-100 mt-auto">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Duration</p>
                      <p className="font-bold text-slate-800">{pkg.days} Days / {pkg.nights} Nights</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-medium">From</p>
                      <p className="font-bold text-blue-700">LKR {pkg.costs?.totalStartingPrice?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                  
                  <Link href={`/driver/packages/${pkg._id}/edit`} className="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-center py-2.5 rounded-xl font-medium transition-colors">
                    Manage Package
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
