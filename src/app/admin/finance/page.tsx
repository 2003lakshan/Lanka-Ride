import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import "@/models/Airport";
import "@/models/VehicleType";
import Link from "next/link";
import { 
  Wallet, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  ArrowLeft, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  Building,
  Car,
  PieChart
} from "lucide-react";
import { formatSriLankanLKR, formatSriLankanDate, formatSriLankanDateTime } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    method?: string;
  }>;
}

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();

  const { range = "all", from, to, method } = await searchParams;

  const now = new Date();
  const dateQuery: any = {};

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

  // Fetch all bookings for financial ledger
  const allBookings = await Booking.find(dateQuery)
    .populate('driverId', 'name phoneNumber')
    .populate('airportId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  let grossBookingValue = 0;
  let platformCommissionRevenue = 0;
  let driverPayable = 0;
  let collectedAmount = 0;
  let pendingAmount = 0;
  let cancelledAmount = 0;
  let cancelledCount = 0;

  const paymentMethodBreakdown: Record<string, { count: number; volume: number }> = {};
  const monthlyRevenueMap: Record<string, { month: string; gross: number; commission: number; trips: number }> = {};

  for (const b of allBookings as any[]) {
    const fare = Number(b.fareBreakdown?.totalEstimatedFare || b.totalFare || b.customTripDetails?.estimatedCost || 0);
    const m = b.paymentMethod || "CASH_ON_ARRIVAL";

    if (!paymentMethodBreakdown[m]) {
      paymentMethodBreakdown[m] = { count: 0, volume: 0 };
    }
    paymentMethodBreakdown[m].count += 1;
    paymentMethodBreakdown[m].volume += fare;

    // Monthly bucket
    const dateObj = new Date(b.createdAt);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = dateObj.toLocaleString("en-US", { month: "short", year: "numeric" });
    if (!monthlyRevenueMap[monthKey]) {
      monthlyRevenueMap[monthKey] = { month: monthLabel, gross: 0, commission: 0, trips: 0 };
    }

    if (b.status === "CANCELLED") {
      cancelledCount += 1;
      cancelledAmount += fare;
    } else {
      grossBookingValue += fare;
      const commission = Math.round(fare * 0.15);
      platformCommissionRevenue += commission;
      driverPayable += (fare - commission);

      monthlyRevenueMap[monthKey].gross += fare;
      monthlyRevenueMap[monthKey].commission += commission;
      monthlyRevenueMap[monthKey].trips += 1;

      if (b.paymentStatus === "PAID") {
        collectedAmount += fare;
      } else {
        pendingAmount += fare;
      }
    }
  }

  const monthlyTrends = Object.values(monthlyRevenueMap).slice(-6);

  // Filtered list by method if chosen
  const filteredLedger = method && method !== "ALL"
    ? allBookings.filter((b: any) => (b.paymentMethod || "CASH_ON_ARRIVAL") === method)
    : allBookings;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link 
              href="/admin" 
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to Overview
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight flex items-center gap-2.5">
            <Wallet className="text-[#E5A72C]" size={28} /> Financial Operations Hub
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real booking revenue, 15% platform commission accounting, and driver settlement ledger.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-center">
          {[
            { label: "All Time", val: "all" },
            { label: "Last 30 Days", val: "30d" },
            { label: "Last 7 Days", val: "7d" },
            { label: "Today", val: "today" },
          ].map((item) => (
            <Link
              key={item.val}
              href={`/admin/finance?range=${item.val}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === item.val
                  ? "bg-[#102A43] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 4 Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Gross Booking Value */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>Gross Booking Value</span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#102A43] mt-2">
            {formatSriLankanLKR(grossBookingValue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total non-cancelled trip fares
          </p>
        </div>

        {/* 2. Platform Commission (15%) */}
        <div className="bg-white rounded-2xl p-5 border border-blue-200/80 shadow-xs bg-linear-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between text-blue-900 text-[11px] font-bold uppercase tracking-wider">
            <span>Platform Revenue (15%)</span>
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Building size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-2">
            {formatSriLankanLKR(platformCommissionRevenue)}
          </div>
          <p className="text-[11px] text-blue-600/80 mt-1">
            Net commission earned by platform
          </p>
        </div>

        {/* 3. Driver Payables (85%) */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs bg-linear-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-900 text-[11px] font-bold uppercase tracking-wider">
            <span>Driver Payables (85%)</span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Car size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
            {formatSriLankanLKR(driverPayable)}
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">
            Net payable to partner drivers
          </p>
        </div>

        {/* 4. Collected vs Pending */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <span>Collections Status</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-emerald-700 font-bold">Collected:</span>
              <span className="font-extrabold text-slate-900">{formatSriLankanLKR(collectedAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-amber-700 font-bold">Outstanding:</span>
              <span className="font-extrabold text-slate-900">{formatSriLankanLKR(pendingAmount)}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 border-t border-slate-100 pt-1">
            Cancelled fares: {formatSriLankanLKR(cancelledAmount)} ({cancelledCount})
          </p>
        </div>

      </div>

      {/* Monthly Revenue Trends & Payment Method Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Revenue Trends */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-extrabold text-[#102A43] text-base">Monthly Operational Trends</h2>
              <p className="text-xs text-slate-500">Gross volume and 15% platform commission comparison</p>
            </div>
            <TrendingUp className="text-blue-600" size={20} />
          </div>

          {monthlyTrends.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No monthly historical volume data available.</p>
          ) : (
            <div className="space-y-4">
              {monthlyTrends.map((m) => {
                const maxGross = Math.max(...monthlyTrends.map((t) => t.gross), 1);
                const widthPercent = Math.min(100, Math.round((m.gross / maxGross) * 100));

                return (
                  <div key={m.month} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>{m.month} ({m.trips} trips)</span>
                      <div className="space-x-3">
                        <span className="text-slate-500">Gross: {formatSriLankanLKR(m.gross)}</span>
                        <span className="text-blue-600">Commission: {formatSriLankanLKR(m.commission)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-500" 
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Methods Breakdown */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-extrabold text-[#102A43] text-base">Payment Methods</h2>
                <p className="text-xs text-slate-500">Breakdown by channel</p>
              </div>
              <PieChart className="text-[#E5A72C]" size={20} />
            </div>

            <div className="space-y-3">
              {Object.entries(paymentMethodBreakdown).map(([key, data]) => (
                <div key={key} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800 uppercase">{key.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-slate-500">{data.count} bookings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{formatSriLankanLKR(data.volume)}</p>
                    <span className="text-[10px] text-slate-400">
                      {grossBookingValue > 0 ? `${Math.round((data.volume / grossBookingValue) * 100)}%` : "0%"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl text-xs text-blue-800">
            <strong>Settlement Policy:</strong> All cash transfers are settled weekly with driver commission reconciliation.
          </div>
        </div>

      </div>

      {/* Financial Ledger Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-[#102A43] text-base">Booking Settlement Ledger</h2>
            <p className="text-xs text-slate-500">Transaction records, commission deductions, and payment status</p>
          </div>
          <span className="text-xs font-bold text-slate-500 self-start sm:self-auto">
            Showing {filteredLedger.length} transaction{filteredLedger.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3.5">Reference &amp; Date</th>
                <th className="px-6 py-3.5">Passenger</th>
                <th className="px-6 py-3.5">Assigned Driver</th>
                <th className="px-6 py-3.5">Gross Fare</th>
                <th className="px-6 py-3.5">Commission (15%)</th>
                <th className="px-6 py-3.5">Driver Share (85%)</th>
                <th className="px-6 py-3.5">Payment</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                    No transactions recorded for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.slice(0, 50).map((b: any) => {
                  const fare = Number(b.fareBreakdown?.totalEstimatedFare || b.totalFare || b.customTripDetails?.estimatedCost || 0);
                  const isCancelled = b.status === "CANCELLED";
                  const commission = isCancelled ? 0 : Math.round(fare * 0.15);
                  const driverShare = isCancelled ? 0 : Math.max(0, fare - commission);
                  const passengerName = b.passengerDetails?.fullName || b.rider?.fullName || "Guest Passenger";

                  return (
                    <tr key={b._id.toString()} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <Link 
                          href={`/admin/trips/${b._id.toString()}`}
                          className="font-mono font-bold text-blue-600 hover:underline"
                        >
                          {b.bookingReference}
                        </Link>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatSriLankanDate(b.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {passengerName}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {b.driverId?.name || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {formatSriLankanLKR(fare)}
                      </td>
                      <td className="px-6 py-4 font-bold text-blue-700">
                        {formatSriLankanLKR(commission)}
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-700">
                        {formatSriLankanLKR(driverShare)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          b.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.paymentStatus || 'PENDING'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 uppercase">
                          {b.paymentMethod || 'CASH'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          b.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                          b.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                          b.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500 line-through' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {b.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredLedger.length > 50 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
            Showing top 50 recent ledger transactions. Use the search and date filters to narrow results.
          </div>
        )}
      </div>

    </div>
  );
}

