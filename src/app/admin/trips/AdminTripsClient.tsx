"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  MapPin, 
  Navigation, 
  Car, 
  Calendar, 
  CheckCircle, 
  CheckCircle2,
  Clock, 
  History,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  User,
  CreditCard,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  X,
  ExternalLink,
  Phone,
  Sparkles,
  Info
} from "lucide-react";
import { useSocket } from "@/components/providers/SocketProvider";
import { useRouter } from "next/navigation";
import { formatSriLankanDate, formatSriLankanLKR, formatSriLankanDateTime } from "@/lib/dateTime";

type TripTab = "ALL" | "AWAITING_CONFIRMATION" | "ACTIVE" | "COMPLETED";

export default function AdminTripsClient({ initialBookings }: { initialBookings: any[] }) {
  const { socket, registerReconnectHandler } = useSocket();
  const [bookings, setBookings] = useState<any[]>(initialBookings);
  const [activeTab, setActiveTab] = useState<TripTab>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const router = useRouter();

  // Slide-over Details panel state
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Read URL query parameter for status tab on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        const statusParam = sp.get("status")?.toUpperCase();
        if (statusParam === "COMPLETED") {
          setActiveTab("COMPLETED");
          setStatusFilter("COMPLETED");
        } else if (statusParam === "ACTIVE") {
          setActiveTab("ACTIVE");
        } else if (statusParam === "PENDING_ADMIN_CONFIRMATION" || statusParam === "AWAITING_CONFIRMATION") {
          setActiveTab("AWAITING_CONFIRMATION");
          setStatusFilter("PENDING_ADMIN_CONFIRMATION");
        }
      } catch (e) {
        console.warn("Could not parse query params", e);
      }
    }
  }, []);

  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  useEffect(() => {
    let mounted = true;
    const unregister = registerReconnectHandler(() => {
      if (!mounted) return;
      setTimeout(() => {
        if (!mounted) return;
        try {
          router.refresh();
        } catch (e) {
          console.warn("[AdminTrips] Reconnect refresh skipped:", e);
        }
      }, 50);
    });
    return () => {
      mounted = false;
      unregister();
    };
  }, [registerReconnectHandler, router]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, statusFilter, assignmentFilter, dateFilter]);

  // Handle Escape key to close details panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedBooking) {
        setSelectedBooking(null);
        setActionMessage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBooking]);

  // Realtime updates
  useEffect(() => {
    if (!socket) return;

    const handleBookingAvailable = (data: any) => {
      if (data.booking) {
        setBookings((prev) => {
          const exists = prev.some((b) => b._id === data.booking._id);
          if (exists) return prev.map((b) => (b._id === data.booking._id ? { ...b, ...data.booking } : b));
          return [data.booking, ...prev];
        });
      }
    };

    const handleDriverAccepted = (data: any) => {
      if (data.booking) {
        setBookings((prev) =>
          prev.map((b) =>
            b._id === data.booking._id
              ? { ...b, ...data.booking, driverId: data.driver, status: "DRIVER_ASSIGNED" }
              : b
          )
        );
      }
    };

    const handleStatusChanged = (data: any) => {
      if (data.bookingId) {
        setBookings((prev) =>
          prev.map((b) => (b._id === data.bookingId ? {
            ...b,
            status: data.status,
            approvedAt: data.approvedAt || b.approvedAt,
            paymentStatus: data.paymentStatus || b.paymentStatus,
            completedAt: data.completedAt || (data.status === "COMPLETED" ? (b.completedAt || new Date().toISOString()) : b.completedAt),
          } : b))
        );

        setSelectedBooking((prev: any) => {
          if (prev && prev._id === data.bookingId) {
            return {
              ...prev,
              status: data.status,
              approvedAt: data.approvedAt || prev.approvedAt,
              paymentStatus: data.paymentStatus || prev.paymentStatus,
            };
          }
          return prev;
        });
      }
    };

    const handlePaymentVerified = (data: any) => {
      if (data.bookingId) {
        setBookings((prev) =>
          prev.map((b) => (b._id === data.bookingId ? {
            ...b,
            paymentStatus: data.paymentStatus || "PAID",
            status: data.status || b.status,
          } : b))
        );

        setSelectedBooking((prev: any) => {
          if (prev && prev._id === data.bookingId) {
            return {
              ...prev,
              paymentStatus: data.paymentStatus || "PAID",
              status: data.status || prev.status,
            };
          }
          return prev;
        });
      }
    };

    const handleLocationUpdated = (data: any) => {
      if (data.bookingId) {
        setBookings((prev) =>
          prev.map((b) =>
            b._id === data.bookingId
              ? {
                  ...b,
                  driverLocation: {
                    lat: data.lat,
                    lng: data.lng,
                    accuracy: data.accuracy,
                    updatedAt: data.updatedAt,
                  },
                }
              : b
          )
        );
      }
    };

    socket.on("booking:available", handleBookingAvailable);
    socket.on("booking:driver_accepted", handleDriverAccepted);
    socket.on("booking:status_changed", handleStatusChanged);
    socket.on("booking:payment_verified", handlePaymentVerified);
    socket.on("driver:location_updated", handleLocationUpdated);

    return () => {
      socket.off("booking:available", handleBookingAvailable);
      socket.off("booking:driver_accepted", handleDriverAccepted);
      socket.off("booking:status_changed", handleStatusChanged);
      socket.off("booking:payment_verified", handlePaymentVerified);
      socket.off("driver:location_updated", handleLocationUpdated);
    };
  }, [socket]);

  // Tab counts
  const awaitingConfirmationCount = useMemo(() => {
    return bookings.filter(b => b.status === "PENDING_ADMIN_CONFIRMATION" || (b.paymentStatus === "PAID" && b.status === "PENDING_ADMIN_CONFIRMATION")).length;
  }, [bookings]);

  const activeCount = useMemo(() => {
    return bookings.filter(b => ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS", "PENDING", "CONFIRMED"].includes(b.status)).length;
  }, [bookings]);

  const completedCount = useMemo(() => {
    return bookings.filter(b => b.status === "COMPLETED").length;
  }, [bookings]);

  // Tab filtering logic
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      // 1. Tab filter
      if (activeTab === "AWAITING_CONFIRMATION") {
        const isAwaiting = booking.status === "PENDING_ADMIN_CONFIRMATION" || (booking.paymentStatus === "PAID" && booking.status === "PENDING_ADMIN_CONFIRMATION");
        if (!isAwaiting) return false;
      } else if (activeTab === "ACTIVE") {
        const isActive = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS", "PENDING", "CONFIRMED"].includes(booking.status);
        if (!isActive) return false;
      } else if (activeTab === "COMPLETED") {
        if (booking.status !== "COMPLETED") return false;
      }

      // 2. Status dropdown filter
      if (statusFilter !== "ALL" && booking.status !== statusFilter) {
        return false;
      }

      // 3. Assignment filter
      if (assignmentFilter === "ASSIGNED" && !booking.driverId) return false;
      if (assignmentFilter === "UNASSIGNED" && booking.driverId) return false;

      // 4. Date filter (matches arrivalDate, custom startDate, or completedAt date string YYYY-MM-DD)
      if (dateFilter) {
        const arrivalStr = booking.arrivalDate ? booking.arrivalDate.slice(0, 10) : "";
        const startStr = booking.customTripDetails?.startDate ? booking.customTripDetails.startDate.slice(0, 10) : "";
        const completedStr = booking.completedAt ? booking.completedAt.slice(0, 10) : "";
        if (arrivalStr !== dateFilter && startStr !== dateFilter && completedStr !== dateFilter) {
          return false;
        }
      }

      // 5. Search text filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const ref = (booking.bookingReference || "").toLowerCase();
        const rider = (booking.rider?.fullName || booking.passengerDetails?.fullName || booking.touristId?.name || "").toLowerCase();
        const driver = (booking.driverId?.name || "").toLowerCase();
        const vehicle = (booking.driverId?.vehicleDetails?.registrationNumber || booking.vehicleTypeId?.name || "").toLowerCase();
        const pickup = (booking.pickupAddress || booking.airportId?.name || "").toLowerCase();
        const dest = (booking.destinationAddress || "").toLowerCase();

        return (
          ref.includes(q) ||
          rider.includes(q) ||
          driver.includes(q) ||
          vehicle.includes(q) ||
          pickup.includes(q) ||
          dest.includes(q)
        );
      }

      return true;
    }).sort((a, b) => {
      // If viewing completed trips, sort newest completion first
      if (activeTab === "COMPLETED" || statusFilter === "COMPLETED") {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        return timeB - timeA;
      }
      return 0; // Default sort from server
    });
  }, [bookings, activeTab, statusFilter, assignmentFilter, dateFilter, searchTerm]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage) || 1;
  const paginatedBookings = useMemo(() => {
    return filteredBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredBookings, currentPage, itemsPerPage]);

  const getStatusColor = (status: string) => {
    if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    if (status.includes("DRIVER") || status.includes("PROGRESS")) return "bg-indigo-100 text-indigo-800 animate-pulse border border-indigo-200";
    if (status === "PENDING") return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    if (status === "PENDING_APPROVAL") return "bg-amber-100 text-amber-800 border border-amber-200";
    if (status === "AWAITING_PAYMENT") return "bg-purple-100 text-purple-800 border border-purple-200";
    if (status === "PENDING_ADMIN_CONFIRMATION") return "bg-amber-100 text-amber-800 border-2 border-amber-400 font-bold animate-pulse";
    if (status === "CANCELLED" || status === "REFUNDED") return "bg-rose-100 text-rose-800 border border-rose-200";
    return "bg-slate-100 text-slate-800 border border-slate-200";
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "PAID":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "VERIFYING_PAYMENT":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "FAILED":
      case "REFUNDED":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "PENDING":
      default:
        return "bg-amber-100 text-amber-800 border-amber-300";
    }
  };

  // Handler for "Approve & Publish to Drivers"
  const handleApproveAndPublish = async (bookingId: string) => {
    setIsConfirming(true);
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          action: "APPROVE_AND_PUBLISH"
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setActionMessage({
          type: "error",
          text: data.error || "Failed to confirm and publish trip"
        });
      } else {
        setActionMessage({
          type: "success",
          text: data.alreadyConfirmed 
            ? "Trip was already approved and is available for drivers." 
            : "Trip approved! Verified payment confirmed and published to eligible drivers."
        });

        const nowIso = new Date().toISOString();

        // Update local state in table immediately
        setBookings((prev) =>
          prev.map((b) =>
            b._id === bookingId
              ? {
                  ...b,
                  status: "PENDING",
                  paymentStatus: "PAID",
                  approvedAt: nowIso,
                  driverId: null,
                }
              : b
          )
        );

        // Update selectedBooking in-place
        setSelectedBooking((prev: any) =>
          prev && prev._id === bookingId
            ? {
                ...prev,
                status: "PENDING",
                paymentStatus: "PAID",
                approvedAt: nowIso,
                driverId: null,
              }
            : prev
        );
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "An unexpected network error occurred."
      });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Platform Trips</h1>
          <p className="text-slate-600 mt-1">Manage all platform bookings, review custom tours, assign drivers, and monitor live rides.</p>
        </div>

        {/* Global Stats / Quick count */}
        <div className="flex items-center gap-2">
          {awaitingConfirmationCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("AWAITING_CONFIRMATION")}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/20 font-bold text-xs transition-all cursor-pointer animate-pulse"
            >
              <ShieldAlert size={15} />
              <span>{awaitingConfirmationCount} Awaiting Admin Approval</span>
            </button>
          )}

          <Link
            href="/admin/active-trips"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 font-bold text-xs transition-colors cursor-pointer"
          >
            <Navigation size={14} />
            <span>Live Tracking Map</span>
          </Link>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Layers size={16} />
          <span>All Trips</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
            {bookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("AWAITING_CONFIRMATION")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "AWAITING_CONFIRMATION"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "text-amber-800 hover:bg-amber-50 bg-amber-50/60 border border-amber-200"
          }`}
        >
          <ShieldAlert size={16} className={awaitingConfirmationCount > 0 ? "text-amber-300 animate-bounce" : ""} />
          <span>Awaiting Admin Approval</span>
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
            activeTab === "AWAITING_CONFIRMATION" ? "bg-amber-700 text-white" : "bg-amber-200 text-amber-900"
          }`}>
            {awaitingConfirmationCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ACTIVE")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "ACTIVE"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Activity size={16} />
          <span>Active Trips</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "ACTIVE" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMPLETED")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "COMPLETED"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <History size={16} />
          <span>Completed History</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "COMPLETED" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>
            {completedCount}
          </span>
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input 
            type="text" 
            placeholder="Search by ref, rider, driver, vehicle reg, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown Filter */}
          <div className="relative">
            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_ADMIN_CONFIRMATION">Paid — Awaiting Admin Approval</option>
              <option value="PENDING">Pending Driver</option>
              <option value="AWAITING_PAYMENT">Awaiting Payment</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="DRIVER_ASSIGNED">Driver Assigned</option>
              <option value="DRIVER_EN_ROUTE">Driver En Route</option>
              <option value="DRIVER_ARRIVED">Driver Arrived</option>
              <option value="PASSENGER_PICKED_UP">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Driver Assignment Dropdown Filter */}
          <div className="relative">
            <select
              aria-label="Filter by Driver Assignment"
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Drivers</option>
              <option value="ASSIGNED">Assigned Only</option>
              <option value="UNASSIGNED">Unassigned Only</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="relative flex items-center">
            <input 
              type="date"
              aria-label="Filter by Date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {dateFilter && (
              <button 
                type="button"
                onClick={() => setDateFilter("")}
                className="ml-1 text-slate-400 hover:text-slate-600 p-1"
                title="Clear date"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Trips Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Trip & Rider</th>
                <th className="px-5 py-3.5">Route & Stops</th>
                <th className="px-5 py-3.5">Schedule / Date</th>
                <th className="px-5 py-3.5">Assigned Driver</th>
                <th className="px-5 py-3.5">Fare & Payment</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <p className="font-bold text-slate-700 text-base mb-1">No trips found</p>
                    <p className="text-xs text-slate-400">Try adjusting your filters, search keywords, or selected tab.</p>
                  </td>
                </tr>
              ) : paginatedBookings.map((booking) => {
                const isCompleted = booking.status === "COMPLETED";
                const isCustom = Boolean(booking.customTripDetails?.isCustomTrip);
                const isPendingFinalConfirmation = booking.status === "PENDING_ADMIN_CONFIRMATION" && booking.paymentStatus === "PAID";
                const vehicleReg = booking.driverId?.vehicleDetails?.registrationNumber;
                const vehicleModel = booking.driverId?.vehicleDetails?.model || booking.vehicleTypeId?.name || "Standard Vehicle";
                
                const confirmedFare = isCustom
                  ? (booking.customTripDetails?.confirmedAmount
                      ? `${booking.customTripDetails.confirmedCurrency || "USD"} ${Number(booking.customTripDetails.confirmedAmount).toLocaleString()}`
                      : null)
                  : (booking.fareBreakdown?.totalEstimatedFare
                      ? formatSriLankanLKR(booking.fareBreakdown.totalEstimatedFare)
                      : null);

                return (
                  <tr 
                    key={booking._id} 
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isPendingFinalConfirmation ? "bg-amber-50/30" : ""
                    }`}
                  >
                    {/* 1. Trip & Rider */}
                    <td className="px-5 py-4">
                      <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{booking.bookingReference}</span>
                        {isCustom ? (
                          <span className="bg-purple-100 text-purple-800 text-[10px] uppercase px-1.5 py-0.5 rounded font-bold border border-purple-200">
                            Custom
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-[10px] uppercase px-1.5 py-0.5 rounded font-bold border border-slate-200">
                            Transfer
                          </span>
                        )}
                        {isPendingFinalConfirmation && (
                          <span className="bg-amber-500 text-white text-[10px] uppercase px-2.5 py-0.5 rounded-full font-black animate-pulse flex items-center gap-1 shadow-xs">
                            <ShieldAlert size={12} />
                            <span>Paid — Awaiting Admin Approval</span>
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-800 mt-1">
                        {booking.rider?.fullName || booking.passengerDetails?.fullName || booking.touristId?.name || "Rider name unavailable"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {booking.rider?.whatsappNumber || booking.passengerDetails?.whatsappNumber || booking.rider?.email || booking.passengerDetails?.email || ""}
                      </div>
                    </td>

                    {/* 2. Route & Stops */}
                    <td className="px-5 py-4 text-xs">
                      <div className="space-y-1 max-w-[240px]">
                        <div className="flex items-start gap-1.5">
                          <span className="text-emerald-600 font-bold shrink-0 mt-0.5">●</span>
                          <span className="text-slate-800 font-medium truncate" title={booking.pickupAddress || booking.airportId?.name}>
                            {booking.pickupAddress || booking.airportId?.name || (isCustom ? "Custom Pickup" : "Airport")}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-rose-600 font-bold shrink-0 mt-0.5">■</span>
                          <span className="text-slate-600 truncate" title={booking.destinationAddress}>
                            {booking.destinationAddress || (isCustom ? `${booking.customTripDetails?.itinerary?.length || 1} Days Itinerary` : "Destination")}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. Schedule / Date */}
                    <td className="px-5 py-4 text-xs">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>
                            {isCustom && booking.customTripDetails?.startDate
                              ? formatSriLankanDate(booking.customTripDetails.startDate)
                              : booking.arrivalDate
                              ? formatSriLankanDate(booking.arrivalDate)
                              : "Flexible"}
                          </span>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {booking.arrivalTime || (isCustom ? `${booking.customTripDetails?.itinerary?.length || 1} Day Tour` : "")}
                        </div>
                      </div>
                    </td>

                    {/* 4. Assigned Driver */}
                    <td className="px-5 py-4">
                      {booking.driverId ? (
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 text-sm">{booking.driverId.name}</div>
                          <div className="text-slate-600 flex items-center gap-1 text-xs">
                            <Car size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]" title={vehicleModel}>{vehicleModel}</span>
                          </div>
                          {vehicleReg && (
                            <div className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                              {vehicleReg}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs font-bold">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* 5. Confirmed Fare & Payment */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            {isCompleted ? "Confirmed Fare" : "Fare / Budget"}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {confirmedFare || (booking.customTripDetails?.budget ? `${booking.customTripDetails.budgetCurrency || "USD"} ${booking.customTripDetails.budget}` : "N/A")}
                          </span>
                        </div>
                        <div>
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${getPaymentStatusBadge(booking.paymentStatus)}`}>
                            {booking.paymentStatus || "PENDING"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 6. Action */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPendingFinalConfirmation && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setActionMessage(null);
                            }}
                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl transition-all text-xs shadow-sm shadow-emerald-600/20 cursor-pointer"
                          >
                            <ShieldCheck size={14} />
                            <span>Confirm</span>
                          </button>
                        )}

                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setActionMessage(null);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors text-xs shadow-sm cursor-pointer"
                        >
                          <MapPin size={13} />
                          <span>Details</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-600">
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-bold text-slate-900">
                {Math.min(currentPage * itemsPerPage, filteredBookings.length)}
              </span>{" "}
              of <span className="font-bold text-slate-900">{filteredBookings.length}</span> trips
            </span>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-slate-700 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                type="button"
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SLIDE-OVER TRIP DETAILS PANEL (DRAWER) */}
      {/* ========================================================================= */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => {
              setSelectedBooking(null);
              setActionMessage(null);
            }}
            aria-hidden="true"
          />

          {/* Slide-over Panel Content */}
          <aside 
            role="dialog"
            aria-modal="true"
            aria-label={`Trip Details ${selectedBooking.bookingReference}`}
            className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col z-50 animate-in slide-in-from-right duration-300 overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono font-black text-lg text-slate-900 truncate">
                  {selectedBooking.bookingReference}
                </span>
                {selectedBooking.customTripDetails?.isCustomTrip ? (
                  <span className="bg-purple-100 text-purple-800 text-xs uppercase px-2 py-0.5 rounded-full font-bold border border-purple-200 shrink-0">
                    Custom Tour
                  </span>
                ) : (
                  <span className="bg-blue-100 text-blue-800 text-xs uppercase px-2 py-0.5 rounded-full font-bold border border-blue-200 shrink-0">
                    Transfer
                  </span>
                )}
                {selectedBooking.status === "PENDING_ADMIN_CONFIRMATION" && selectedBooking.paymentStatus === "PAID" && (
                  <span className="bg-amber-100 text-amber-900 text-xs uppercase px-2.5 py-1 rounded-full font-extrabold border border-amber-300 animate-pulse shrink-0 flex items-center gap-1">
                    <ShieldAlert size={13} className="text-amber-600" />
                    <span>Paid — Awaiting Admin Approval</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/trips/${selectedBooking._id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-xs"
                >
                  <span>Full Tracking Page</span>
                  <ExternalLink size={12} />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBooking(null);
                    setActionMessage(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close Details Panel"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Notification / Toast inside Panel */}
            {actionMessage && (
              <div className={`p-4 border-b flex items-start gap-2.5 text-sm font-semibold shrink-0 ${
                actionMessage.type === "success" 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}>
                {actionMessage.type === "success" ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{actionMessage.text}</span>
              </div>
            )}

            {/* Drawer Body Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* 1. FINAL ADMIN CONFIRMATION ACTION BOX (Highlighted when PAID & PENDING_ADMIN_CONFIRMATION) */}
              {selectedBooking.status === "PENDING_ADMIN_CONFIRMATION" && selectedBooking.paymentStatus === "PAID" && (
                <div className="bg-linear-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldAlert size={22} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-amber-950 text-base">
                        Final Admin Confirmation Required
                      </h3>
                      <p className="text-xs text-amber-800 mt-1">
                        The rider has successfully paid the confirmed amount of{" "}
                        <strong className="text-amber-950 font-black">
                          {selectedBooking.customTripDetails?.confirmedCurrency || "USD"}{" "}
                          {selectedBooking.customTripDetails?.confirmedAmount || selectedBooking.customTripDetails?.budget || 0}
                        </strong>
                        . Click below to confirm and broadcast this custom tour to all eligible drivers.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isConfirming}
                    onClick={() => handleApproveAndPublish(selectedBooking._id)}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 text-sm"
                  >
                    {isConfirming ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Publishing to Drivers...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Approve & Publish to Drivers</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Already Approved & Published Banner */}
              {selectedBooking.status === "PENDING" && selectedBooking.paymentStatus === "PAID" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-900">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">Approved & Published to Drivers</p>
                      <p className="text-xs text-emerald-700">
                        {selectedBooking.approvedAt ? `Confirmed on ${formatSriLankanDateTime(selectedBooking.approvedAt)}` : "Awaiting an eligible driver to accept."}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-emerald-200/60 text-emerald-800 px-2.5 py-1 rounded-full">
                    Awaiting Driver
                  </span>
                </div>
              )}

              {/* 2. VERIFIED PAYMENT INFORMATION CARD */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <CreditCard size={17} className="text-blue-600" />
                    <span>Verified Payment Information</span>
                  </h3>
                  <span className={`inline-flex px-2.5 py-0.5 text-xs font-black rounded-full uppercase border ${getPaymentStatusBadge(selectedBooking.paymentStatus)}`}>
                    {selectedBooking.paymentStatus || "PENDING"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Confirmed Paid Amount</span>
                    <span className="font-black text-slate-900 text-lg">
                      {selectedBooking.customTripDetails?.confirmedAmount
                        ? `${selectedBooking.customTripDetails.confirmedCurrency || "USD"} ${Number(selectedBooking.customTripDetails.confirmedAmount).toLocaleString()}`
                        : selectedBooking.fareBreakdown?.totalEstimatedFare
                        ? formatSriLankanLKR(selectedBooking.fareBreakdown.totalEstimatedFare)
                        : "N/A"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Verification</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs mt-1">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      <span>{selectedBooking.paymentStatus === "PAID" ? "Verified & Paid" : "Pending Payment"}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Trip Type</span>
                    <span className="font-bold text-slate-800 text-xs mt-1 block">
                      {selectedBooking.customTripDetails?.isCustomTrip ? "Custom Multi-Day Tour" : "Airport Transfer"}
                    </span>
                  </div>
                </div>

                {selectedBooking.customTripDetails?.budgetCovers && (
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                    Budget covers: <strong>{selectedBooking.customTripDetails.budgetCovers}</strong> • Flexibility: <strong>{selectedBooking.customTripDetails.budgetFlexibility || "Fixed"}</strong>
                  </p>
                )}
              </div>

              {/* 3. PASSENGER & CONTACT DETAILS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User size={17} className="text-slate-600" />
                  <span>Passenger Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block">Full Name</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedBooking.rider?.fullName || selectedBooking.passengerDetails?.fullName || selectedBooking.touristId?.name || "Rider name unavailable"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block">Email Address</span>
                    <span className="font-medium text-slate-800 break-all">
                      {selectedBooking.rider?.email || (selectedBooking.passengerDetails?.email !== "No email provided" ? selectedBooking.passengerDetails?.email : null) || selectedBooking.touristId?.email || "No email provided"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block">WhatsApp / Phone</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                      <Phone size={12} className="text-emerald-600" />
                      <span>{selectedBooking.rider?.whatsappNumber || (selectedBooking.passengerDetails?.whatsappNumber !== "No contact provided" ? selectedBooking.passengerDetails?.whatsappNumber : null) || selectedBooking.touristId?.phoneNumber || "No contact provided"}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block">Party Size</span>
                    <span className="font-medium text-slate-800">
                      {(selectedBooking.rider?.adults ?? selectedBooking.passengerDetails?.adults) || 1} Adults, {(selectedBooking.rider?.children ?? selectedBooking.passengerDetails?.children) || 0} Children, {(selectedBooking.rider?.luggage ?? selectedBooking.passengerDetails?.luggage) || 0} Luggage
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. DRIVER & VEHICLE ASSIGNMENT STATUS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Car size={17} className="text-indigo-600" />
                  <span>Driver & Vehicle Assignment</span>
                </h3>

                {selectedBooking.driverId ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block">Assigned Driver</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedBooking.driverId.name}</span>
                      <span className="text-slate-500 block">{selectedBooking.driverId.phoneNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">Vehicle Details</span>
                      <span className="font-bold text-slate-900">
                        {selectedBooking.driverId.vehicleDetails?.model || selectedBooking.vehicleTypeId?.name || "Standard"}
                      </span>
                      {selectedBooking.driverId.vehicleDetails?.registrationNumber && (
                        <span className="inline-block mt-1 font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                          {selectedBooking.driverId.vehicleDetails.registrationNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                      <Car size={18} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="font-bold text-xs text-slate-700">Currently Unassigned</p>
                        <p className="text-[11px] text-slate-500">
                          {selectedBooking.status === "PENDING"
                            ? "This trip is available for any eligible approved driver to accept on their dashboard."
                            : "This trip will become visible to eligible drivers once approved & published."}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <span className="font-bold uppercase text-[10px] text-slate-400">Vehicle Requirements</span>
                        <span className="font-extrabold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {selectedBooking.vehicleTypeId?.name || "Standard Vehicle"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-600 pt-0.5">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Passenger Capacity:</span>
                          <span className="font-bold text-slate-800">
                            {((selectedBooking.rider?.adults ?? selectedBooking.passengerDetails?.adults) || 1) + ((selectedBooking.rider?.children ?? selectedBooking.passengerDetails?.children) || 0)} Seats
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Luggage Capacity:</span>
                          <span className="font-bold text-slate-800">
                            {(selectedBooking.rider?.luggage ?? selectedBooking.passengerDetails?.luggage) || 0} Bags
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. FULL ROUTE & ITINERARY */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MapPin size={17} className="text-rose-600" />
                  <span>Full Itinerary & Route</span>
                </h3>

                {selectedBooking.customTripDetails?.isCustomTrip && selectedBooking.customTripDetails?.itinerary?.length > 0 ? (
                  <div className="space-y-4">
                    {selectedBooking.customTripDetails.itinerary.map((day: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            Day {day.dayNumber}: {day.date ? formatSriLankanDate(day.date) : `Day ${day.dayNumber}`}
                          </span>
                          {day.departureTime && (
                            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              <Clock size={11} className="text-blue-500" />
                              <span>Dep: {day.departureTime}</span>
                            </span>
                          )}
                        </div>

                        {/* Starting Location */}
                        {day.startingLocation?.address && (
                          <div className="text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Starting Location</span>
                            <span className="font-semibold text-slate-800">{day.startingLocation.address}</span>
                          </div>
                        )}

                        {/* Places to Visit */}
                        {day.placesToVisit?.length > 0 && (
                          <div className="text-xs space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Places to Visit</span>
                            <div className="flex flex-wrap gap-1.5">
                              {day.placesToVisit.map((p: any, pIdx: number) => (
                                <span key={pIdx} className="bg-white border border-slate-200 text-slate-700 font-medium px-2 py-1 rounded-lg text-xs">
                                  {p.name || p.location?.address} {p.activityTime ? `(${p.activityTime})` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Overnight Stay */}
                        {day.overnightLocation?.hotel && (
                          <div className="text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Overnight Stay</span>
                            <span className="font-bold text-indigo-900">
                              🏨 {day.overnightLocation.hotel} {day.overnightLocation.city ? `(${day.overnightLocation.city})` : ""}
                            </span>
                          </div>
                        )}

                        {/* Day notes or driving time */}
                        {(day.drivingTimeMins || day.distanceKm || day.notes) && (
                          <div className="text-[11px] text-slate-500 flex flex-wrap gap-3 pt-1 border-t border-slate-200/40">
                            {day.distanceKm && <span>Distance: ~{Math.round(day.distanceKm)} km</span>}
                            {day.drivingTimeMins && <span>Drive time: ~{Math.round(day.drivingTimeMins)} mins</span>}
                            {day.notes && <span>Notes: {day.notes}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs space-y-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Pickup Location</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {selectedBooking.pickupAddress || selectedBooking.airportId?.name || "Colombo Airport (CMB)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Destination</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {selectedBooking.destinationAddress || "Designated Destination"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
