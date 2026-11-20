import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Package from "@/models/Package";
import RiderIdentity from "@/models/RiderIdentity";
import "@/models/Airport";
import "@/models/VehicleType";
import Link from "next/link";
import { 
  Users, 
  AlertTriangle, 
  Activity, 
  CalendarCheck, 
  ArrowRight, 
  MapPin, 
  CheckCircle, 
  Clock, 
  IdCard, 
  Package as PackageIcon, 
  DollarSign, 
  Wallet, 
  Car, 
  Radio, 
  ShieldAlert, 
  ShieldCheck, 
  AlertCircle,
  FileText,
  Calendar,
  Sparkles,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  XCircle,
  ExternalLink
} from "lucide-react";
import CustomTripRequestsSection from "@/components/admin/CustomTripRequestsSection";
import { formatSriLankanLKR, formatSriLankanDateTime, formatSriLankanDate } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AdminOverview({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  const { range = "all", from, to } = await searchParams;

  // Build date query for time-filtered metrics
  const dateQuery: any = {};
  const now = new Date();

  if (range === "today") {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    dateQuery.createdAt = { $gte: startOfToday };
  } else if (range === "7d") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dateQuery.createdAt = { $gte: sevenDaysAgo };
  } else if (range === "30d") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    dateQuery.createdAt = { $gte: thirtyDaysAgo };
  } else if (range === "custom" && from && to) {
    dateQuery.createdAt = {
      $gte: new Date(from),
      $lte: new Date(`${to}T23:59:59.999Z`),
    };
  }

  // 1. Operational Counts
  const pendingDriversCount = await User.countDocuments({ role: "DRIVER", isApproved: false });
  const pendingPackagesCount = await Package.countDocuments({ status: "PENDING_REVIEW" });
  const pendingIdentitiesCount = await RiderIdentity.countDocuments({ status: "PENDING_REVIEW" });
  
  const unassignedBookingsCount = await Booking.countDocuments({ 
    driverId: { $exists: false },
    status: { $in: ["PENDING", "CONFIRMED", "PENDING_APPROVAL"] }
  });
  
  const activeStatuses = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"];
  const activeTripsCount = await Booking.countDocuments({ status: { $in: activeStatuses as any } });
  
  // Date filtered operational metrics
  const completedTripsCount = await Booking.countDocuments({ status: "COMPLETED", ...dateQuery });
  const cancelledBookingsCount = await Booking.countDocuments({ status: "CANCELLED", ...dateQuery });

  // Driver Availability
  const totalDriversCount = await User.countDocuments({ role: "DRIVER" });
  const onlineDriversCount = await User.countDocuments({ role: "DRIVER", isOnline: true });

  // Payment Verification Requests
  const verifyingPaymentCount = await Booking.countDocuments({ paymentStatus: "VERIFYING_PAYMENT" });

  // 2. Financial Metrics (calculated from real booking documents)
  const financialBookings = await Booking.find({
    ...dateQuery,
    status: { $ne: "CANCELLED" }
  }).select('fareBreakdown totalFare status paymentStatus paymentMethod customTripDetails').lean();

  let grossBookingValue = 0;
  let platformCommission = 0;
  let collectedPayments = 0;
  let pendingPayments = 0;

  for (const b of financialBookings as any[]) {
    const fare = Number(b.fareBreakdown?.totalEstimatedFare || b.totalFare || b.customTripDetails?.estimatedCost || 0);
    if (fare > 0) {
      grossBookingValue += fare;
      if (b.status === "COMPLETED" || b.status === "CONFIRMED" || activeStatuses.includes(b.status)) {
        platformCommission += Math.round(fare * 0.15); // 15% platform commission
      }
      if (b.paymentStatus === "PAID") {
        collectedPayments += fare;
      } else {
        pendingPayments += fare;
      }
    }
  }

  const driverPayable = Math.max(0, grossBookingValue - platformCommission);

  // 3. Stale GPS Tracking (Active trips with missing or > 5 min old pings)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const staleTrips = await Booking.find({
    status: { $in: activeStatuses as any },
    $or: [
      { driverLocation: { $exists: false } },
      { "driverLocation.updatedAt": { $lt: fiveMinutesAgo } }
    ]
  }).select('bookingReference status driverLocation updatedAt').lean();

  // 4. Custom Trips Feed
  const customTrips = await Booking.find({
    "customTripDetails.isCustomTrip": true,
    status: { $ne: "DRAFT" }
  })
    .populate('touristId', 'name fullName email')
    .populate('driverId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const serializedCustomTrips = JSON.parse(JSON.stringify(customTrips));

  // 5. Recent Bookings (All types)
  const recentBookings = await Booking.find()
    .populate('airportId', 'name')
    .populate('driverId', 'name phoneNumber')
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  // Range pill URLs helper
  const rangeOptions = [
    { label: "All Time", value: "all" },
    { label: "Last 30 Days", value: "30d" },
    { label: "Last 7 Days", value: "7d" },
    { label: "Today", value: "today" },
  ];

  const totalNeedsAttention = 
    unassignedBookingsCount + 
    staleTrips.length + 
    pendingDriversCount + 
    pendingPackagesCount + 
    pendingIdentitiesCount + 
    verifyingPaymentCount;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
      
      {/* Page Title & Date Range Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              Operations Command Center
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Fleet Active
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Real-time travel logistics, urgent operational alerts, and financial metrics.
          </p>
        </div>

        {/* Date Range Selector Pills */}
        <div className="flex items-center flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-center">
          {rangeOptions.map((opt) => {
            const isSelected = range === opt.value;
            return (
              <Link
                key={opt.value}
                href={`/admin?range=${opt.value}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-[#102A43] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Top Operational KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* 1. Unassigned Bookings */}
        <Link 
          href="/admin/trips" 
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-rose-300 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unassigned</span>
            <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${unassignedBookingsCount > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black ${unassignedBookingsCount > 0 ? "text-rose-600" : "text-slate-800"}`}>
              {unassignedBookingsCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Need driver assignment</p>
          </div>
        </Link>

        {/* 2. Active Trips */}
        <Link 
          href="/admin/active-trips" 
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Trips</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Activity size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-blue-600">{activeTripsCount}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Live on the road</p>
          </div>
        </Link>

        {/* 3. Driver Approvals */}
        <Link 
          href="/admin/approvals" 
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Driver Apps</span>
            <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${pendingDriversCount > 0 ? "bg-amber-50 text-[#D97706]" : "bg-slate-100 text-slate-400"}`}>
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black ${pendingDriversCount > 0 ? "text-[#D97706]" : "text-slate-800"}`}>
              {pendingDriversCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Pending onboarding</p>
          </div>
        </Link>

        {/* 4. Tour Packages */}
        <Link 
          href="/admin/packages" 
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Packages</span>
            <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${pendingPackagesCount > 0 ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
              <PackageIcon size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black ${pendingPackagesCount > 0 ? "text-indigo-600" : "text-slate-800"}`}>
              {pendingPackagesCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting review</p>
          </div>
        </Link>

        {/* 5. Driver Availability */}
        <Link 
          href="/admin/users?role=DRIVER" 
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fleet Online</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <Car size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              {onlineDriversCount}<span className="text-sm font-normal text-slate-400">/{totalDriversCount}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Ready for dispatch</p>
          </div>
        </Link>

        {/* 6. Completed Trips */}
        <Link 
          href="/admin/trips?status=COMPLETED" 
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{completedTripsCount}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{range === "all" ? "All time trips" : "In selected period"}</p>
          </div>
        </Link>

      </div>

      {/* Main Operations Split: Alert Center + Financial Performance Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Needs Attention Panel (Alert Center) */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className={totalNeedsAttention > 0 ? "text-rose-500" : "text-emerald-500"} size={20} />
                <h2 className="font-extrabold text-[#102A43] text-base">Needs Attention</h2>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                totalNeedsAttention > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
              }`}>
                {totalNeedsAttention} {totalNeedsAttention === 1 ? "alert" : "alerts"}
              </span>
            </div>

            <div className="p-5 flex-1 space-y-3">
              
              {/* Alert 1: Unassigned Bookings (HIGH) */}
              {unassignedBookingsCount > 0 && (
                <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <CalendarCheck size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-200 text-rose-900">
                          High
                        </span>
                        <p className="font-bold text-slate-900 text-xs truncate">
                          {unassignedBookingsCount} unassigned trip{unassignedBookingsCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500">Awaiting driver assignment</p>
                    </div>
                  </div>
                  <Link 
                    href="/admin/trips" 
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shrink-0 transition-colors"
                  >
                    Assign
                  </Link>
                </div>
              )}

              {/* Alert 2: Stale GPS tracking on active trips (HIGH) */}
              {staleTrips.length > 0 && (
                <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                          High
                        </span>
                        <p className="font-bold text-slate-900 text-xs truncate">
                          {staleTrips.length} stale GPS signal{staleTrips.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500">Location inactive &gt; 5 minutes</p>
                    </div>
                  </div>
                  <Link 
                    href="/admin/active-trips" 
                    className="px-2.5 py-1.5 rounded-lg bg-[#D97706] text-white text-xs font-bold hover:bg-amber-700 shrink-0 transition-colors"
                  >
                    Inspect
                  </Link>
                </div>
              )}

              {/* Alert 3: Pending Driver Applications (MEDIUM) */}
              {pendingDriversCount > 0 && (
                <div className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0">
                      <Users size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {pendingDriversCount} driver application{pendingDriversCount > 1 ? "s" : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">Documents awaiting verification</p>
                    </div>
                  </div>
                  <Link 
                    href="/admin/approvals" 
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold shrink-0 transition-colors"
                  >
                    Review
                  </Link>
                </div>
              )}

              {/* Alert 4: Pending Tour Package Reviews (MEDIUM) */}
              {pendingPackagesCount > 0 && (
                <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100/70 text-indigo-600 flex items-center justify-center shrink-0">
                      <PackageIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {pendingPackagesCount} package submission{pendingPackagesCount > 1 ? "s" : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">Requires itinerary approval</p>
                    </div>
                  </div>
                  <Link 
                    href="/admin/packages" 
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold shrink-0 transition-colors"
                  >
                    Review
                  </Link>
                </div>
              )}

              {/* Alert 5: Pending Rider Identity Reviews (MEDIUM) */}
              {pendingIdentitiesCount > 0 && (
                <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                      <IdCard size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {pendingIdentitiesCount} rider identity review{pendingIdentitiesCount > 1 ? "s" : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">Passport / NIC verification</p>
                    </div>
                  </div>
                  <Link 
                    href="/admin/identity-reviews" 
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold shrink-0 transition-colors"
                  >
                    Verify
                  </Link>
                </div>
              )}

              {/* Alert 6: Verifying Payments */}
              {verifyingPaymentCount > 0 && (
                <div className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CreditCard size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {verifyingPaymentCount} payment{verifyingPaymentCount > 1 ? "s" : ""} verifying
                      </p>
                      <p className="text-[11px] text-slate-500">Slip uploaded / pending confirmation</p>
                    </div>
                  </div>
                  <Link 
                    href="/admin/finance" 
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold shrink-0 transition-colors"
                  >
                    Check
                  </Link>
                </div>
              )}

              {/* All clear state */}
              {totalNeedsAttention === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="font-bold text-slate-900 text-sm">Operations All Clear!</p>
                  <p className="text-xs text-slate-500 mt-1">No pending unassigned trips or approval bottlenecks.</p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Financial Performance Operations Card */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wallet className="text-[#E5A72C]" size={20} />
                <div>
                  <h2 className="font-extrabold text-[#102A43] text-base">Financial Operations</h2>
                  <p className="text-[11px] text-slate-500">Real booking values &amp; 15% platform commission</p>
                </div>
              </div>
              <Link 
                href="/admin/finance" 
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 group"
              >
                Financial Hub <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between space-y-6">
              
              {/* 3 Major Financial Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Gross Booking Value */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Booking Value</span>
                  <div className="text-xl sm:text-2xl font-black text-[#102A43] mt-1 truncate">
                    {formatSriLankanLKR(grossBookingValue)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {range === "all" ? "Cumulative non-cancelled" : `In timeframe (${range})`}
                  </span>
                </div>

                {/* Platform Commission Revenue (15%) */}
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Platform Revenue</span>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-200/80 text-blue-900">15%</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-blue-700 mt-1 truncate">
                    {formatSriLankanLKR(platformCommission)}
                  </div>
                  <span className="text-[10px] text-blue-600/80 mt-0.5 block">Net platform earnings</span>
                </div>

                {/* Driver Payables */}
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Driver Payables</span>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 truncate">
                    {formatSriLankanLKR(driverPayable)}
                  </div>
                  <span className="text-[10px] text-emerald-600/80 mt-0.5 block">Net fleet earnings (85%)</span>
                </div>

              </div>

              {/* Payment Flow Progress Bar & Summary */}
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Payment Collection Breakdown</span>
                  <span className="text-slate-500 font-normal">
                    {collectedPayments > 0 ? `${Math.round((collectedPayments / Math.max(1, grossBookingValue)) * 100)}% collected` : "Cash on arrival pending"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-2.5 transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.round((collectedPayments / Math.max(1, grossBookingValue)) * 100))}%` }} 
                    title={`Paid: ${formatSriLankanLKR(collectedPayments)}`}
                  />
                  <div 
                    className="bg-amber-400 h-2.5 transition-all duration-500" 
                    style={{ width: `${Math.max(0, 100 - Math.round((collectedPayments / Math.max(1, grossBookingValue)) * 100))}%` }} 
                    title={`Pending: ${formatSriLankanLKR(pendingPayments)}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <span className="text-slate-500 text-[11px]">Paid / Collected: </span>
                      <span className="font-bold text-slate-800">{formatSriLankanLKR(collectedPayments)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <span className="text-slate-500 text-[11px]">Pending Settlement: </span>
                      <span className="font-bold text-slate-800">{formatSriLankanLKR(pendingPayments)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Cancelled Bookings:</span>
                  <span className="font-bold text-rose-600">{cancelledBookingsCount}</span>
                </div>
                <Link
                  href="/admin/finance"
                  className="font-bold text-[#102A43] hover:text-blue-700 underline underline-offset-2"
                >
                  Inspect Settlement Statements &rarr;
                </Link>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Realtime Custom Trip Requests Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <CustomTripRequestsSection customTrips={serializedCustomTrips} />
      </div>

      {/* Recent Bookings Feed (Responsive: Desktop Table + Mobile Cards) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-[#102A43] text-base">Recent Bookings &amp; Transfers</h2>
            <p className="text-slate-500 text-xs">Latest customer bookings across airport transfers and packages</p>
          </div>
          <Link 
            href="/admin/trips" 
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            View all bookings <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3.5">Reference &amp; Route</th>
                <th className="px-6 py-3.5">Passenger</th>
                <th className="px-6 py-3.5">Assigned Driver</th>
                <th className="px-6 py-3.5">Fare &amp; Payment</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    No recent bookings recorded.
                  </td>
                </tr>
              ) : (
                recentBookings.map((booking: any) => {
                  const fare = booking.fareBreakdown?.totalEstimatedFare || booking.totalFare || 0;
                  const passengerName = booking.passengerDetails?.fullName || booking.rider?.fullName || "Guest Passenger";
                  const driverName = booking.driverId?.name || "Unassigned";

                  return (
                    <tr key={booking._id.toString()} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-[#102A43]">{booking.bookingReference}</span>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {booking.airportId?.name || "Airport"} → {booking.destinationAddress?.split(',')[0]}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{passengerName}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatSriLankanDate(booking.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {booking.driverId ? (
                          <div className="font-medium text-slate-800">{driverName}</div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{formatSriLankanLKR(fare)}</div>
                        <span className={`text-[10px] font-bold uppercase ${
                          booking.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {booking.paymentStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase
                          ${booking.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                            booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                            booking.status === 'PENDING' ? 'bg-rose-100 text-rose-800' :
                            booking.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600 line-through' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                          {booking.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/admin/trips/${booking._id.toString()}`} 
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors inline-block"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< md screens) */}
        <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {recentBookings.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-500">No recent bookings recorded.</p>
          ) : (
            recentBookings.map((booking: any) => {
              const fare = booking.fareBreakdown?.totalEstimatedFare || booking.totalFare || 0;
              const passengerName = booking.passengerDetails?.fullName || booking.rider?.fullName || "Guest Passenger";
              const driverName = booking.driverId?.name || "Unassigned";

              return (
                <div key={booking._id.toString()} className="p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#102A43] text-xs">{booking.bookingReference}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase
                      ${booking.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                        booking.status === 'PENDING' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                      {booking.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-800 line-clamp-1">
                    {booking.airportId?.name || "Airport"} → {booking.destinationAddress?.split(',')[0]}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>{passengerName}</span>
                    <span className="font-bold text-slate-900">{formatSriLankanLKR(fare)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] text-slate-400">
                      Driver: <strong className="text-slate-700">{driverName}</strong>
                    </span>
                    <Link
                      href={`/admin/trips/${booking._id.toString()}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Details &rarr;
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
}
