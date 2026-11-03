"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, MapPin, Calendar, CheckCircle, Clock, Eye, AlertCircle, Sparkles } from "lucide-react";
import { useSocket } from "@/components/providers/SocketProvider";
import { useRouter } from "next/navigation";

export default function CustomTripRequestsSection({ customTrips }: { customTrips: any[] }) {
  const { socket, registerReconnectHandler } = useSocket();
  const [trips, setTrips] = useState<any[]>(customTrips);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [newTripBanner, setNewTripBanner] = useState<string | null>(null);
  const itemsPerPage = 5;
  const router = useRouter();
  const processedEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setTrips(customTrips);
  }, [customTrips]);

  useEffect(() => {
    return registerReconnectHandler(() => {
      router.refresh();
    });
  }, [registerReconnectHandler, router]);

  useEffect(() => {
    if (!socket) return;

    // 1. Rider custom trip submitted -> admin dashboard
    const handleCustomSubmitted = (data: any) => {
      if (data.eventId) {
        if (processedEventIds.current.has(data.eventId)) return;
        processedEventIds.current.add(data.eventId);
      }

      if (data.booking) {
        setTrips((prev) => {
          const exists = prev.some((t) => t._id === data.booking._id);
          if (exists) {
            return prev.map((t) => (t._id === data.booking._id ? { ...t, ...data.booking } : t));
          }
          return [data.booking, ...prev];
        });

        setNewTripBanner(`New custom trip received: ${data.booking.bookingReference}`);
        setTimeout(() => setNewTripBanner(null), 8000);
      }
    };

    // 2. Verified payment received -> admin dashboard
    const handlePaymentVerified = (data: any) => {
      if (!data.bookingId) return;

      setTrips((prev) =>
        prev.map((t) =>
          t._id === data.bookingId
            ? {
                ...t,
                status: "PENDING_ADMIN_CONFIRMATION",
                paymentStatus: "PAID",
              }
            : t
        )
      );

      setNewTripBanner(`Payment verified for trip ${data.bookingReference || data.bookingId}`);
      setTimeout(() => setNewTripBanner(null), 8000);
    };

    // 3. Status changes
    const handleStatusChanged = (data: any) => {
      if (!data.bookingId) return;
      setTrips((prev) =>
        prev.map((t) => (t._id === data.bookingId ? { ...t, status: data.status } : t))
      );
    };

    socket.on("booking:custom_submitted", handleCustomSubmitted);
    socket.on("booking:payment_verified", handlePaymentVerified);
    socket.on("booking:status_changed", handleStatusChanged);

    return () => {
      socket.off("booking:custom_submitted", handleCustomSubmitted);
      socket.off("booking:payment_verified", handlePaymentVerified);
      socket.off("booking:status_changed", handleStatusChanged);
    };
  }, [socket]);

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      // 1. Search term
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const refMatch = trip.bookingReference?.toLowerCase().includes(lowerSearch);
        const riderMatch = trip.touristId?.name?.toLowerCase().includes(lowerSearch) || trip.touristId?.fullName?.toLowerCase().includes(lowerSearch);
        const destinationMatch = trip.destinationAddress?.toLowerCase().includes(lowerSearch);
        
        if (!refMatch && !riderMatch && !destinationMatch) {
          return false;
        }
      }

      // 2. Status
      if (statusFilter !== "ALL" && trip.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [trips, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);
  const paginatedTrips = filteredTrips.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status: string, paymentStatus: string) => {
    if (status === 'PENDING_APPROVAL') return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">Needs Approval</span>;
    if (status === 'AWAITING_PAYMENT') return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">Awaiting Payment</span>;
    if (status === 'PENDING_ADMIN_CONFIRMATION') return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">Confirm Payment</span>;
    if (status === 'PENDING') return <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">Published</span>;
    if (status === 'REJECTED' || status === 'CANCELLED') return <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded text-xs font-bold">Cancelled</span>;
    
    return <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs font-bold">{status}</span>;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
      {newTripBanner && (
        <div className="p-3.5 bg-purple-50 border-b border-purple-100 text-purple-900 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-600 animate-spin" /> {newTripBanner}
          </span>
          <button onClick={() => setNewTripBanner(null)} className="text-purple-600 hover:text-purple-900 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="text-purple-600" size={20} />
            Custom Trip Requests
          </h3>
          <p className="text-sm text-slate-500 mt-1">Review and approve custom itineraries submitted by riders.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search reference, rider..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_APPROVAL">Needs Approval</option>
            <option value="AWAITING_PAYMENT">Awaiting Payment</option>
            <option value="PENDING_ADMIN_CONFIRMATION">Confirm Payment</option>
            <option value="PENDING">Published to Drivers</option>
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 font-semibold">Trip Details</th>
              <th className="px-6 py-4 font-semibold">Itinerary Info</th>
              <th className="px-6 py-4 font-semibold">Budget & Price</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedTrips.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <AlertCircle size={32} className="text-slate-300 mb-3" />
                    <p>No custom trips found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTrips.map((trip: any) => (
                <tr key={trip._id.toString()} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-slate-900">{trip.bookingReference}</div>
                    <div className="text-slate-600 font-medium mt-1">{trip.touristId?.fullName || trip.touristId?.name || "Unknown Rider"}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock size={12} />
                      Submitted {new Date(trip.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {trip.customTripDetails?.itinerary?.length || 0} Days
                    </div>
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-[200px]">
                      {trip.pickupAddress || trip.airportId?.name || 'Unknown'} → {trip.destinationAddress || 'Various'}
                    </div>
                    {trip.vehicleTypeId && (
                       <div className="text-xs text-purple-600 mt-1 font-medium">Vehicle Required</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <span className="text-slate-500 text-xs uppercase block">Rider Budget</span>
                      <span className="font-medium text-slate-900">
                        {trip.customTripDetails?.estimatedBudget ? `$${trip.customTripDetails.estimatedBudget}` : 'Not specified'}
                      </span>
                    </div>
                    {(trip.status === 'AWAITING_PAYMENT' || trip.status === 'PENDING_ADMIN_CONFIRMATION' || trip.status === 'PENDING') && (
                      <div className="text-sm mt-2 pt-2 border-t border-slate-100">
                        <span className="text-slate-500 text-xs uppercase block">Confirmed Price</span>
                        <span className="font-bold text-emerald-600">
                          {trip.customTripDetails?.confirmedCurrency} {trip.customTripDetails?.confirmedAmount}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(trip.status, trip.paymentStatus)}
                    {trip.driverId && (
                      <div className="mt-2 text-xs font-medium text-blue-600">
                        Assigned: {trip.driverId.name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/admin/custom-trips/${trip._id.toString()}`} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 hover:text-purple-600 transition-colors shadow-sm"
                    >
                      <Eye size={14} /> View Full Trip
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-sm text-slate-500">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTrips.length)} of {filteredTrips.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-200 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 bg-white"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-slate-200 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 bg-white"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
