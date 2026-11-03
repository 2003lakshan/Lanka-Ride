import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import Link from "next/link";
import { MapPin, Calendar, Users, DollarSign, Clock, Camera, ArrowLeft } from "lucide-react";
import AdminPackageActions from "@/components/admin/AdminPackageActions";

export const dynamic = "force-dynamic";

export default async function AdminPackageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  const pkg = await Package.findById(id).populate('driverId', 'name email phoneNumber').lean();

  if (!pkg) {
    return (
      <div className="min-h-screen bg-slate-50 py-20 text-center flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-4">Package Not Found</h1>
        <Link href="/admin" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      
      {/* Top Bar for Admin */}
      <div className="bg-white border-b border-slate-200 py-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                Admin Package Review
                <span className={`text-xs px-2 py-1 rounded uppercase tracking-wider ${
                  pkg.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                  pkg.status === 'PENDING_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>{pkg.status.replace('_', ' ')}</span>
              </h1>
              <div className="text-xs text-slate-500 font-medium">Created by: {pkg.driverId?.name} ({pkg.driverId?.email})</div>
            </div>
          </div>
          <AdminPackageActions packageId={id} status={pkg.status} />
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-[40vh] md:h-[50vh] w-full bg-slate-900">
        {pkg.coverPhoto ? (
          <img src={pkg.coverPhoto} alt={pkg.title} className="w-full h-full object-cover opacity-70" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={64} className="text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full p-8 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider mb-4">
              {pkg.category}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2">{pkg.title}</h1>
            <p className="text-blue-100 text-lg max-w-2xl flex items-center gap-2">
              <MapPin size={18} /> Starting from {pkg.startingCity}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">About This Journey</h2>
              <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap">{pkg.shortDescription}</p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">At a Glance</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><Calendar size={24}/></div>
                  <span className="text-sm text-slate-500 font-bold">Duration</span>
                  <span className="font-bold text-slate-900">{pkg.days} Days / {pkg.nights} Nights</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600"><Users size={24}/></div>
                  <span className="text-sm text-slate-500 font-bold">Group Size</span>
                  <span className="font-bold text-slate-900">{pkg.minPassengers} - {pkg.maxPassengers} People</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600"><MapPin size={24}/></div>
                  <span className="text-sm text-slate-500 font-bold">Pickup</span>
                  <span className="font-bold text-slate-900">{pkg.pickupOptions}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-600"><DollarSign size={24}/></div>
                  <span className="text-sm text-slate-500 font-bold">Starting Price</span>
                  <span className="font-bold text-slate-900">LKR {pkg.costs?.totalStartingPrice?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Pricing Breakdown</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Base Price</span>
                  <span className="font-bold">LKR {pkg.costs?.basePrice?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Accommodation Cost</span>
                  <span className="font-bold">LKR {pkg.costs?.accommodationCost?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2">
                  <span className="text-slate-900">Total Starting Price</span>
                  <span className="text-blue-600">LKR {pkg.costs?.totalStartingPrice?.toLocaleString()}</span>
                </div>
                <div className="pt-4 text-slate-500">
                  <p>Price Type: <strong className="text-slate-800">{pkg.costs?.priceType}</strong></p>
                  <p>Covers: <strong className="text-slate-800">{pkg.costs?.passengerCountCovered} Passengers</strong></p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Inclusions</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">
                {pkg.costs?.inclusions?.map((inc: string, i: number) => (
                  <li key={i}>{inc}</li>
                )) || <li>None specified</li>}
              </ul>
              
              <h3 className="text-xl font-bold text-slate-900 mb-4 mt-6">Exclusions</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">
                {pkg.costs?.exclusions?.map((exc: string, i: number) => (
                  <li key={i}>{exc}</li>
                )) || <li>None specified</li>}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
