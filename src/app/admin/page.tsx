import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Link from "next/link";
import { Users, AlertTriangle, Activity, CalendarCheck, ArrowRight, MapPin, CheckCircle, Clock } from "lucide-react";
import CustomTripRequestsSection from "@/components/admin/CustomTripRequestsSection";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  // Real data fetching
  const pendingDriversCount = await User.countDocuments({ role: "DRIVER", isApproved: false });
  const unassignedBookingsCount = await Booking.countDocuments({ 
    driverId: { $exists: false },
    status: { $in: ["PENDING", "CONFIRMED"] }
  });
  
  const activeStatuses = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"];
  const activeTripsCount = await Booking.countDocuments({ status: { $in: activeStatuses as any } });
  
  const completedTripsCount = await Booking.countDocuments({ status: "COMPLETED" });

  const recentBookings = await Booking.find()
    .populate('airportId', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  // Find trips with stale tracking (last updated > 5 mins ago)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const staleTrips = await Booking.find({
    status: { $in: activeStatuses as any },
    $or: [
      { driverLocation: { $exists: false } },
      { "driverLocation.updatedAt": { $lt: fiveMinutesAgo } }
    ]
  }).select('bookingReference status').lean();

  const customTrips = await Booking.find({
    "customTripDetails.isCustomTrip": true,
    status: { $ne: "DRAFT" }
  })
    .populate('touristId', 'name fullName email')
    .populate('driverId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const serializedCustomTrips = customTrips.map((b: any) => ({
    ...b,
    _id: b._id.toString(),
    touristId: b.touristId ? { ...b.touristId, _id: b.touristId._id.toString() } : null,
    driverId: b.driverId ? { ...b.driverId, _id: b.driverId._id.toString() } : null,
    airportId: b.airportId ? { ...b.airportId, _id: b.airportId._id.toString() } : null,
    vehicleTypeId: b.vehicleTypeId ? { ...b.vehicleTypeId, _id: b.vehicleTypeId._id.toString() } : null,
    createdAt: b.createdAt ? b.createdAt.toISOString() : null,
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
        <p className="text-slate-500 mt-1">Monitor the pulse of your operations.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/admin/approvals" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Pending Approvals</p>
              <h2 className="text-4xl font-black text-amber-500">{pendingDriversCount}</h2>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
          </div>
        </Link>
        
        <Link href="/admin/trips" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Unassigned Bookings</p>
              <h2 className="text-4xl font-black text-rose-500">{unassignedBookingsCount}</h2>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
              <AlertTriangle size={24} />
            </div>
          </div>
        </Link>

        <Link href="/admin/active-trips" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Active Trips</p>
              <h2 className="text-4xl font-black text-blue-500">{activeTripsCount}</h2>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Activity size={24} />
            </div>
          </div>
        </Link>

        <Link href="/admin/trips?status=COMPLETED" className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Completed Trips</p>
              <h2 className="text-4xl font-black text-emerald-500">{completedTripsCount}</h2>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <CheckCircle size={24} />
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Needs Attention Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <AlertTriangle className="text-rose-500" size={20} />
              <h3 className="font-bold text-slate-900">Needs Attention</h3>
            </div>
            <div className="p-5 flex-1 space-y-4">
              {pendingDriversCount > 0 && (
                <div className="flex items-center justify-between p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Users size={16} /></div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{pendingDriversCount} driver(s) pending</p>
                      <p className="text-xs text-slate-500">Awaiting approval</p>
                    </div>
                  </div>
                  <Link href="/admin/approvals" className="text-xs font-bold text-amber-600 hover:text-amber-700">Review</Link>
                </div>
              )}

              {unassignedBookingsCount > 0 && (
                <div className="flex items-center justify-between p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><CalendarCheck size={16} /></div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{unassignedBookingsCount} unassigned</p>
                      <p className="text-xs text-slate-500">Bookings missing drivers</p>
                    </div>
                  </div>
                  <Link href="/admin/trips" className="text-xs font-bold text-rose-600 hover:text-rose-700">Assign</Link>
                </div>
              )}

              {staleTrips.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-200 text-slate-600 rounded-lg"><MapPin size={16} /></div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{staleTrips.length} stale tracking</p>
                      <p className="text-xs text-slate-500">Location lost in active trips</p>
                    </div>
                  </div>
                  <Link href="/admin/active-trips" className="text-xs font-bold text-slate-600 hover:text-slate-900">Check</Link>
                </div>
              )}

              {pendingDriversCount === 0 && unassignedBookingsCount === 0 && staleTrips.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle size={24} />
                  </div>
                  <p className="font-medium text-slate-900">All clear!</p>
                  <p className="text-sm text-slate-500">Nothing requires immediate attention.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Trip Requests */}
        <div className="lg:col-span-3">
          <CustomTripRequestsSection customTrips={serializedCustomTrips} />
        </div>

        {/* Recent Bookings */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Recent Bookings</h3>
              <Link href="/admin/trips" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View all <ArrowRight size={16} />
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Reference</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBookings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No recent bookings found.</td>
                    </tr>
                  ) : (
                    recentBookings.map((booking: any) => (
                      <tr key={booking._id.toString()} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{booking.bookingReference}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {booking.airportId?.name || 'Airport'} → {booking.destinationAddress?.split(',')[0]}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock size={14} className="text-slate-400" />
                            {new Date(booking.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                            ${booking.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                              booking.status === 'PENDING' ? 'bg-rose-100 text-rose-700' :
                              booking.status.includes('DRIVER') ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                            {booking.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/admin/trips/${booking._id.toString()}`} className="text-blue-600 font-medium hover:underline text-sm">
                            View details
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
