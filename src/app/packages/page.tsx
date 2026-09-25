import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import Link from "next/link";
import { MapPin, Calendar, ArrowRight, Package as PackageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPackagesDirectory() {
  await dbConnect();
  
  // Show all published packages to anyone
  const packages = await Package.find({ status: 'PUBLISHED' }).sort({ createdAt: -1 }).lean();

  return (
    <div className="bg-slate-50 min-h-screen py-16 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-blue-600 font-bold mb-4 bg-blue-100 px-4 py-2 rounded-full">
            <PackageIcon size={20} />
            <span>CUSTOM TRAVEL PACKAGES</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Explore Sri Lanka</h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">Browse unique, customizable itineraries curated by our verified local professional drivers.</p>
        </div>

        {packages.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-slate-200 shadow-sm">
            <p className="text-slate-500 text-lg">No travel packages are currently published. Please check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {packages.map((pkg: any) => (
              <div key={pkg._id.toString()} className="bg-white rounded-3xl shadow-md hover:shadow-xl transition-all border border-slate-100 overflow-hidden flex flex-col group">
                <div className="relative h-56 w-full overflow-hidden">
                  <img src={pkg.coverPhoto} alt={pkg.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-4 left-4 bg-blue-600/90 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
                    {pkg.category}
                  </div>
                </div>
                <div className="p-8 flex flex-col flex-1">
                  <h3 className="text-2xl font-bold text-slate-900 mb-3 line-clamp-2 group-hover:text-blue-700 transition-colors">{pkg.title}</h3>
                  <p className="text-slate-600 text-sm mb-6 line-clamp-3 leading-relaxed">{pkg.shortDescription}</p>
                  
                  <div className="flex items-center gap-6 text-sm font-bold text-slate-500 mb-6 mt-auto">
                    <span className="flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> {pkg.days} Days</span>
                    <span className="flex items-center gap-2"><MapPin size={16} className="text-slate-400"/> {pkg.startingCity}</span>
                  </div>
                  
                  <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">From</p>
                      <p className="font-black text-slate-900 text-xl">LKR {pkg.costs?.totalStartingPrice?.toLocaleString()}</p>
                    </div>
                    <Link href={`/packages/${pkg._id}`} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md flex items-center gap-2">
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
