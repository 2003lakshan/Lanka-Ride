import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import Link from "next/link";
import { MapPin, Calendar, Users, DollarSign, Clock, MessageCircle, ChevronRight, ShieldCheck, Camera } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PackageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  // Requirement: MUST be logged in
  if (!session) {
    redirect(`/login?callbackUrl=/packages/${id}`);
  }

  // Requirement: ONLY allowed for TOURIST
  if ((session.user as any).role !== "TOURIST") {
    return (
      <div className="bg-slate-50 min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="bg-white p-10 md:p-16 rounded-3xl shadow-xl border border-red-100 max-w-lg text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
             <ShieldCheck className="text-red-500" size={32} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Tourists Only</h2>
          <p className="text-slate-600 mb-8 text-lg">
            This page is exclusively for tourists to browse and book travel packages.
          </p>
          <Link href="/" className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-medium transition-colors">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  await dbConnect();
  
  const pkg = await Package.findById(id).populate('driverId', 'name email').lean();

  if (!pkg || pkg.status !== 'PUBLISHED') {
    return (
      <div className="min-h-screen bg-slate-50 py-20 text-center flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-4">Package Not Found</h1>
        <p className="text-slate-500 mb-8 max-w-md">The travel package you are looking for does not exist or is no longer available.</p>
        <Link href="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      
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
            
            {/* We will build out full itinerary components later. For now, a placeholder. */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <Clock size={24} className="text-blue-600" />
                 Sample Itinerary
              </h2>
              <div className="border-l-2 border-slate-200 ml-4 pl-6 py-2">
                <div className="relative">
                  <div className="absolute -left-[35px] top-1 w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow-sm"></div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Detailed Itinerary Coming Soon</h3>
                  <p className="text-slate-600">The driver is available to discuss exact stops, timings, and routes based on your preferences.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking / Contact Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 sticky top-8">
              <div className="text-center pb-6 border-b border-slate-100 mb-6">
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mb-2">Estimated Total</p>
                <h3 className="text-4xl font-extrabold text-slate-900 mb-2">LKR {pkg.costs?.totalStartingPrice?.toLocaleString()}</h3>
                <p className="text-sm text-slate-500 font-medium">Price is per {pkg.costs?.priceType === 'PER_VEHICLE' ? 'vehicle' : 'person'} ({pkg.costs?.passengerCountCovered} pax)</p>
              </div>

              <div className="space-y-4 mb-8 text-sm">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-green-600" />
                  <span className="text-slate-700">Verified Local Driver</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-green-600" />
                  <span className="text-slate-700">100% Customizable Itinerary</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-green-600" />
                  <span className="text-slate-700">Secure Online Payments</span>
                </div>
              </div>

              <button className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2">
                <MessageCircle size={20} />
                Contact Driver
              </button>
              
              <p className="text-center text-xs text-slate-500 mt-4 px-4 leading-relaxed">
                You will not be charged yet. Contact the driver to finalize your itinerary and receive a customized quote.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
