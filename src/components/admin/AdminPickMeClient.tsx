"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bike,
  Car,
  Truck,
  MapPin,
  Clock,
  Phone,
  User,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  DollarSign,
  ShieldAlert,
  Sliders,
  ChevronRight,
  Sparkles,
  Info,
  X,
  Package,
  Calendar,
  Filter,
  XCircle,
  RotateCcw,
  FileText,
  BadgeAlert,
} from "lucide-react";
import { CANCELLATION_REASONS } from "@/lib/cancellation";

export interface SerializedCategory {
  _id: string;
  category: "Bike" | "Three-wheeler" | "Car" | "Mini Van" | "Van" | "Lorry";
  displayName: string;
  description: string;
  passengerCapacity: number;
  luggageCapacity: number;
  isGoodsTransport: boolean;
  baseFare: number;
  ratePerKm: number;
  minimumFare: number;
  isActive: boolean;
  iconName?: string;
  sortOrder: number;
  updatedAt?: string | null;
}

export interface SerializedTrip {
  _id: string;
  bookingReference: string;
  bookingType: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationAddress: string;
  pickupInstructions?: string;
  intermediateStops?: Array<{ address: string; lat: number; lng: number; stopOrder: number; visited?: boolean; visitedAt?: string; notes?: string; }>;
  destinationLat?: number;
  destinationLng?: number;
  distanceKm: number;
  durationMins: number;
  createdAt: string | null;
  updatedAt: string | null;
  assignedAt?: string | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: {
    userId?: string;
    role: "TOURIST" | "DRIVER" | "ADMIN";
    name?: string;
  } | null;
  cancellationReasonCode?: string | null;
  cancellationReasonText?: string | null;
  cancellationComments?: string | null;
  statusBeforeCancellation?: string | null;
  refundReviewStatus?: "NOT_APPLICABLE" | "PENDING_REVIEW" | "REFUNDED" | "RESOLVED" | null;
  rider: {
    fullName: string;
    whatsappNumber: string;
    email: string;
  };
  driver: {
    id: string;
    name: string;
    phoneNumber: string;
    vehicleRegistration: string;
    vehicleCategory?: string;
  } | null;
  pickMeDetails: {
    isPickMe: boolean;
    vehicleCategory: string;
    goodsDescription?: string | null;
    baseFare: number;
    ratePerKm: number;
    minimumFare: number;
    estimatedFare: number;
    pricingSnapshot?: any;
    rideNow: boolean;
  } | null;
  fareBreakdown?: any;
}

interface AdminPickMeClientProps {
  initialCategories: SerializedCategory[];
  initialTrips: SerializedTrip[];
}

export default function AdminPickMeClient({
  initialCategories,
  initialTrips,
}: AdminPickMeClientProps) {
  const [activeTab, setActiveTab] = useState<"trips" | "cancelled" | "pricing">("trips");
  const [categories, setCategories] = useState<SerializedCategory[]>(initialCategories);
  const [trips, setTrips] = useState<SerializedTrip[]>(initialTrips);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [cancellationReasonFilter, setCancellationReasonFilter] = useState("ALL");
  const [cancellationDateFilter, setCancellationDateFilter] = useState("");
  const [refundReviewFilter, setRefundReviewFilter] = useState("ALL");
  const [resolvingRefundId, setResolvingRefundId] = useState<string | null>(null);

  // Per-category editing state
  const [editingForms, setEditingForms] = useState<Record<string, {
    baseFare: number;
    ratePerKm: number;
    minimumFare: number;
    isActive: boolean;
    saving: boolean;
    successMessage: string | null;
    errorMessage: string | null;
  }>>(() => {
    const map: any = {};
    initialCategories.forEach((c) => {
      map[c.category] = {
        baseFare: c.baseFare,
        ratePerKm: c.ratePerKm,
        minimumFare: c.minimumFare,
        isActive: c.isActive,
        saving: false,
        successMessage: null,
        errorMessage: null,
      };
    });
    return map;
  });

  // Modal for trip details
  const [selectedTrip, setSelectedTrip] = useState<SerializedTrip | null>(null);

  // Refresh trips and pricing from server
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [tripsRes, pricingRes] = await Promise.all([
        fetch("/api/admin/pickme/trips"),
        fetch("/api/admin/pickme/pricing"),
      ]);

      if (tripsRes.ok) {
        const data = await tripsRes.json();
        if (data.trips) setTrips(data.trips);
      }

      if (pricingRes.ok) {
        const data = await pricingRes.json();
        if (data.categories) {
          setCategories(data.categories);
          const map: any = {};
          data.categories.forEach((c: SerializedCategory) => {
            map[c.category] = {
              baseFare: c.baseFare,
              ratePerKm: c.ratePerKm,
              minimumFare: c.minimumFare,
              isActive: c.isActive,
              saving: false,
              successMessage: null,
              errorMessage: null,
            };
          });
          setEditingForms(map);
        }
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle pricing form change
  const handleFormChange = (
    category: string,
    field: "baseFare" | "ratePerKm" | "minimumFare" | "isActive",
    value: any
  ) => {
    setEditingForms((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
        successMessage: null,
        errorMessage: null,
      },
    }));
  };

  // Save single category pricing
  const handleSaveCategory = async (category: string) => {
    const form = editingForms[category];
    if (!form) return;

    if (form.baseFare < 0 || form.ratePerKm < 0 || form.minimumFare < 0) {
      setEditingForms((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          errorMessage: "Fares and rates must be non-negative numbers.",
          successMessage: null,
        },
      }));
      return;
    }

    setEditingForms((prev) => ({
      ...prev,
      [category]: { ...prev[category], saving: true, errorMessage: null, successMessage: null },
    }));

    try {
      const res = await fetch("/api/admin/pickme/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          baseFare: Number(form.baseFare),
          ratePerKm: Number(form.ratePerKm),
          minimumFare: Number(form.minimumFare),
          isActive: Boolean(form.isActive),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update pricing.");
      }

      setEditingForms((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          saving: false,
          successMessage: `Saved! Rate: LKR ${form.ratePerKm}/km, Base: LKR ${form.baseFare}, Min: LKR ${form.minimumFare}`,
          errorMessage: null,
        },
      }));

      // Update local categories list
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err: any) {
      setEditingForms((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          saving: false,
          errorMessage: err.message || "Network error while saving.",
          successMessage: null,
        },
      }));
    }
  };

  // Helper icon renderer
  const renderCategoryIcon = (category: string, className = "w-6 h-6") => {
    switch (category) {
      case "Bike":
        return <Bike className={className} />;
      case "Three-wheeler":
        return <Car className={className} />;
      case "Car":
        return <Car className={className} />;
      case "Mini Van":
      case "Van":
        return <Truck className={className} />;
      case "Lorry":
        return <Truck className={className} />;
      default:
        return <Car className={className} />;
    }
  };

  // Filter trips
  const filteredTrips = trips.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    if (!matchesStatus) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.bookingReference.toLowerCase().includes(q) ||
      (t.rider?.fullName && t.rider.fullName.toLowerCase().includes(q)) ||
      (t.rider?.whatsappNumber && t.rider.whatsappNumber.includes(q)) ||
      (t.pickupAddress && t.pickupAddress.toLowerCase().includes(q)) ||
      (t.destinationAddress && t.destinationAddress.toLowerCase().includes(q)) ||
      (t.pickMeDetails?.vehicleCategory && t.pickMeDetails.vehicleCategory.toLowerCase().includes(q)) ||
      (t.driver?.name && t.driver.name.toLowerCase().includes(q))
    );
  });

  // Dedicated Cancelled Trips
  const cancelledTrips = trips.filter((t) => t.status === "CANCELLED");

  // Admin action for resolving or refunding flagged cancellations
  const handleResolveRefund = async (tripId: string, action: "RESOLVE" | "REFUND") => {
    setResolvingRefundId(tripId);
    try {
      const res = await fetch(`/api/admin/pickme/trips/${tripId}/refund-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update refund review.");
        return;
      }
      setTrips((prev) =>
        prev.map((t) =>
          t._id === tripId
            ? {
                ...t,
                refundReviewStatus: action === "REFUND" ? "REFUNDED" : "RESOLVED",
                paymentStatus: action === "REFUND" ? "REFUNDED" : t.paymentStatus,
              }
            : t
        )
      );
      if (selectedTrip && selectedTrip._id === tripId) {
        setSelectedTrip((prev) =>
          prev
            ? {
                ...prev,
                refundReviewStatus: action === "REFUND" ? "REFUNDED" : "RESOLVED",
                paymentStatus: action === "REFUND" ? "REFUNDED" : prev.paymentStatus,
              }
            : null
        );
      }
    } catch (err: any) {
      alert(err.message || "Network error while updating refund review.");
    } finally {
      setResolvingRefundId(null);
    }
  };

  // Filter cancelled trips by date, reason, refund status, and search query
  const filteredCancelledTrips = cancelledTrips.filter((t) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        t.bookingReference.toLowerCase().includes(q) ||
        (t.rider?.fullName && t.rider.fullName.toLowerCase().includes(q)) ||
        (t.driver?.name && t.driver.name.toLowerCase().includes(q)) ||
        (t.pickupAddress && t.pickupAddress.toLowerCase().includes(q)) ||
        (t.destinationAddress && t.destinationAddress.toLowerCase().includes(q)) ||
        (t.cancellationReasonText && t.cancellationReasonText.toLowerCase().includes(q)) ||
        (t.cancellationComments && t.cancellationComments.toLowerCase().includes(q)) ||
        (t.cancelledBy?.name && t.cancelledBy.name.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    if (cancellationReasonFilter !== "ALL") {
      if (t.cancellationReasonCode !== cancellationReasonFilter) return false;
    }

    if (cancellationDateFilter) {
      if (!t.cancelledAt) return false;
      const tripDate = t.cancelledAt.slice(0, 10);
      if (tripDate !== cancellationDateFilter) return false;
    }

    if (refundReviewFilter !== "ALL") {
      if (refundReviewFilter === "NEEDS_REVIEW") {
        if (t.refundReviewStatus !== "PENDING_REVIEW") return false;
      } else if (t.refundReviewStatus !== refundReviewFilter) {
        return false;
      }
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "TRIP_IN_PROGRESS":
      case "PASSENGER_PICKED_UP":
        return "bg-blue-100 text-blue-800 border-blue-200 animate-pulse";
      case "DRIVER_EN_ROUTE":
      case "DRIVER_ARRIVED":
      case "DRIVER_ASSIGNED":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      case "PENDING":
      default:
        return "bg-purple-100 text-purple-800 border-purple-200";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sliders size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">PickMe Local Rides</h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin Portal
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Real-time ride management, vehicle rate configuration, and driver dispatch monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs">
        <button
          onClick={() => setActiveTab("trips")}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "trips"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span>All Trips & Requests</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "trips" ? "bg-amber-400 text-slate-900" : "bg-slate-200 text-slate-700"
            }`}
          >
            {trips.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("cancelled")}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "cancelled"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <XCircle size={16} className={activeTab === "cancelled" ? "text-rose-400" : "text-rose-600"} />
          <span>Cancelled Trips</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "cancelled" ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-800"
            }`}
          >
            {cancelledTrips.length}
          </span>
          {cancelledTrips.some((t) => t.refundReviewStatus === "PENDING_REVIEW") && (
            <span
              className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse ml-0.5"
              title="Refund reviews pending"
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("pricing")}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "pricing"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <DollarSign size={16} />
          <span>Vehicle Pricing</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === "pricing" ? "bg-amber-400 text-slate-900" : "bg-slate-200 text-slate-700"
            }`}
          >
            {categories.length}
          </span>
        </button>
      </div>

      {/* TAB 1: RIDE REQUESTS */}
      {activeTab === "trips" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search reference, rider, vehicle, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:border-amber-500 focus:outline-hidden bg-slate-50 focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {["ALL", "PENDING", "DRIVER_ASSIGNED", "TRIP_IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      statusFilter === st
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st === "ALL" ? "All Trips" : st.replace(/_/g, " ")}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Trips List / Table */}
          {filteredTrips.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
                <Car size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No Local Rides Found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                No PickMe ride requests match your current search or status filter. New bookings made from the homepage will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredTrips.map((trip) => {
                const category = trip.pickMeDetails?.vehicleCategory || "Car";
                const isLorry = category === "Lorry";

                return (
                  <div
                    key={trip._id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    {/* Left: Info */}
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {trip.bookingReference}
                        </span>

                        <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-amber-200">
                          {renderCategoryIcon(category, "w-3.5 h-3.5 text-amber-700")}
                          {category}
                        </span>

                        {isLorry && trip.pickMeDetails?.goodsDescription && (
                          <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-orange-200">
                            <Package size={12} /> Goods Transport
                          </span>
                        )}

                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadge(
                            trip.status
                          )}`}
                        >
                          {trip.status.replace(/_/g, " ")}
                        </span>

                        <span className="text-xs text-slate-400 ml-auto">
                          {trip.createdAt ? new Date(trip.createdAt).toLocaleString("en-GB") : "Recently"}
                        </span>
                      </div>

                      {/* Route Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <MapPin size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Pickup Location
                            </span>
                            <span className="text-slate-800 font-medium truncate block">
                              {trip.pickupAddress}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Dropoff Destination
                            </span>
                            <span className="text-slate-800 font-medium truncate block">
                              {trip.destinationAddress}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lorry Goods Description if any */}
                      {isLorry && trip.pickMeDetails?.goodsDescription && (
                        <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                          <Package size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Goods Description: </span>
                            <span>{trip.pickMeDetails.goodsDescription}</span>
                          </div>
                        </div>
                      )}

                      {/* Rider & Driver row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-slate-400" />
                          <span className="font-bold text-slate-800">{trip.rider.fullName}</span>
                          <span className="text-slate-400">({trip.rider.whatsappNumber})</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Car size={14} className="text-slate-400" />
                          {trip.driver ? (
                            <span className="font-bold text-slate-800">
                              Driver: {trip.driver.name} ({trip.driver.vehicleRegistration})
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Waiting for Driver Acceptance
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-slate-400" />
                          <span>{trip.distanceKm} km (~{trip.durationMins} mins)</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Fare & Action Buttons */}
                    <div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="text-left lg:text-right">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Estimated Fare
                        </span>
                        <span className="text-xl font-black text-slate-900">
                          LKR {(trip.pickMeDetails?.estimatedFare || 0).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-0.5">
                          <span>{trip.paymentMethod}</span>
                          <span>•</span>
                          <span className={trip.paymentStatus === "PAID" ? "text-emerald-600 font-bold" : "text-amber-600"}>
                            {trip.paymentStatus}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedTrip(trip)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Details
                        </button>

                        <Link
                          href={`/track?ref=${trip.bookingReference}`}
                          target="_blank"
                          className="flex items-center gap-1 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <span>Live Tracking</span>
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CANCELLED TRIPS */}
      {activeTab === "cancelled" && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Cancelled</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">{cancelledTrips.length}</span>
              <span className="text-[11px] text-slate-500">PickMe local rides</span>
            </div>

            <div className={`p-4 rounded-2xl border shadow-xs ${
              cancelledTrips.filter((t) => t.refundReviewStatus === "PENDING_REVIEW").length > 0
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : "bg-white border-slate-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Needs Refund Review</span>
                {cancelledTrips.filter((t) => t.refundReviewStatus === "PENDING_REVIEW").length > 0 && (
                  <BadgeAlert size={16} className="text-amber-600 animate-pulse" />
                )}
              </div>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                {cancelledTrips.filter((t) => t.refundReviewStatus === "PENDING_REVIEW").length}
              </span>
              <span className="text-[11px] text-slate-500">Paid cancellations pending admin action</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">During Driver Search</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">
                {cancelledTrips.filter((t) => !t.driver && (!t.statusBeforeCancellation || t.statusBeforeCancellation === "PENDING")).length}
              </span>
              <span className="text-[11px] text-slate-500">Pre-assignment cancellations</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">After Driver Assigned</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">
                {cancelledTrips.filter((t) => t.driver || (t.statusBeforeCancellation && t.statusBeforeCancellation !== "PENDING")).length}
              </span>
              <span className="text-[11px] text-slate-500">En route or arrived at pickup</span>
            </div>
          </div>

          {/* Filters Bar for Cancelled Trips */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="relative w-full lg:w-72">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ref, rider, driver, reason, comments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-rose-500 focus:outline-hidden bg-slate-50 focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Reason Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Filter size={14} className="text-slate-400" />
                <select
                  value={cancellationReasonFilter}
                  onChange={(e) => setCancellationReasonFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Reasons</option>
                  {CANCELLATION_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={cancellationDateFilter}
                  onChange={(e) => setCancellationDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                  title="Filter by cancellation date"
                />
                {cancellationDateFilter && (
                  <button
                    onClick={() => setCancellationDateFilter("")}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-bold ml-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Refund Review Filter */}
              <select
                value={refundReviewFilter}
                onChange={(e) => setRefundReviewFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Refund States</option>
                <option value="NEEDS_REVIEW">Needs Review (Paid)</option>
                <option value="RESOLVED">Resolved</option>
                <option value="REFUNDED">Refunded</option>
              </select>

              {(cancellationReasonFilter !== "ALL" || cancellationDateFilter || refundReviewFilter !== "ALL" || searchTerm) && (
                <button
                  onClick={() => {
                    setCancellationReasonFilter("ALL");
                    setCancellationDateFilter("");
                    setRefundReviewFilter("ALL");
                    setSearchTerm("");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Cancelled Trips Cards / Table */}
          {filteredCancelledTrips.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No Cancelled Trips Matching Criteria</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                No local ride cancellations match your current search, reason, date, or refund filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCancelledTrips.map((trip) => {
                const category = trip.pickMeDetails?.vehicleCategory || "Car";
                const isPaid = trip.paymentStatus === "PAID";
                const needsRefund = trip.refundReviewStatus === "PENDING_REVIEW";
                const hasStops = Array.isArray(trip.intermediateStops) && trip.intermediateStops.length > 0;

                return (
                  <div
                    key={trip._id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
                      needsRefund ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
                    }`}
                  >
                    {/* Left: Info */}
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {trip.bookingReference}
                        </span>

                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border bg-rose-100 text-rose-800 border-rose-200">
                          {trip.cancellationReasonText || trip.cancellationReasonCode || "Cancelled"}
                        </span>

                        {trip.cancelledBy && (
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                            By: <strong className="text-slate-900">{trip.cancelledBy.name || trip.cancelledBy.role}</strong> ({trip.cancelledBy.role})
                          </span>
                        )}

                        {trip.statusBeforeCancellation && (
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Before: {trip.statusBeforeCancellation.replace(/_/g, " ")}
                          </span>
                        )}

                        {needsRefund && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <BadgeAlert size={12} className="text-amber-700" />
                            Needs Refund Review (Paid)
                          </span>
                        )}

                        {trip.refundReviewStatus === "RESOLVED" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Refund Resolved
                          </span>
                        )}

                        {trip.refundReviewStatus === "REFUNDED" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Refunded
                          </span>
                        )}
                      </div>

                      {/* Route */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-start gap-2">
                          <MapPin size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-slate-700 font-medium truncate">{trip.pickupAddress}</span>
                        </div>
                        {hasStops && (
                          <div className="pl-6 text-[11px] text-purple-700 font-medium">
                            + {trip.intermediateStops!.length} intermediate stop(s)
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <MapPin size={15} className="text-rose-500 shrink-0 mt-0.5" />
                          <span className="text-slate-700 font-medium truncate">{trip.destinationAddress}</span>
                        </div>
                      </div>

                      {/* Explanation quote if any */}
                      {trip.cancellationComments && (
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 italic">
                          &ldquo;{trip.cancellationComments}&rdquo;
                        </div>
                      )}

                      {/* Sub-details (Rider, Driver, Time) */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <User size={14} className="text-slate-400" />
                          <span>{trip.rider?.fullName || "Guest Rider"}</span>
                          {trip.rider?.whatsappNumber && (
                            <span className="text-slate-400">({trip.rider.whatsappNumber})</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {trip.driver ? (
                            <span className="font-bold text-slate-800">
                              Driver: {trip.driver.name} ({trip.driver.vehicleRegistration})
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned (Cancelled while searching)</span>
                          )}
                        </div>

                        {trip.cancelledAt && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Clock size={14} className="text-rose-500" />
                            <span>Cancelled: {new Date(trip.cancelledAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Fare, Payment & Actions */}
                    <div className="flex lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="text-left lg:text-right">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Fare
                        </span>
                        <span className="text-xl font-black text-slate-900">
                          LKR {(trip.pickMeDetails?.estimatedFare || trip.fareBreakdown?.totalEstimatedFare || 0).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-0.5">
                          <span>{trip.paymentMethod}</span>
                          <span>•</span>
                          <span className={isPaid ? "text-emerald-600 font-bold" : "text-slate-600"}>
                            {trip.paymentStatus}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {needsRefund && (
                          <>
                            <button
                              onClick={() => handleResolveRefund(trip._id, "RESOLVE")}
                              disabled={resolvingRefundId === trip._id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                              title="Resolve review without issuing automated refund"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleResolveRefund(trip._id, "REFUND")}
                              disabled={resolvingRefundId === trip._id}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                              title="Mark ride as refunded"
                            >
                              Refund
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setSelectedTrip(trip)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <FileText size={13} />
                          <span>Trip Details & Timeline</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRICING MANAGEMENT */}
      {activeTab === "pricing" && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
            <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 space-y-1">
              <p className="font-bold">Server-Enforced Fare Calculation & Snapshot Policy</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Fare formula: <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">estimatedFare = max(minimumFare, baseFare + distanceKm × ratePerKm)</code>.
                Distance is calculated using exact driving roads from the routing engine, never straight-line air distance.
                Every confirmed booking stores an immutable pricing snapshot so subsequent admin rate changes will not alter an existing ride.
                Categories marked <strong>Inactive</strong> or lacking valid rates show as <em>&quot;Currently unavailable&quot;</em> to riders.
              </p>
            </div>
          </div>

          {/* 6 Category Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => {
              const form = editingForms[cat.category] || {
                baseFare: cat.baseFare,
                ratePerKm: cat.ratePerKm,
                minimumFare: cat.minimumFare,
                isActive: cat.isActive,
                saving: false,
                successMessage: null,
                errorMessage: null,
              };

              const sample10kmFare = Math.max(
                form.minimumFare,
                form.baseFare + 10 * form.ratePerKm
              );

              return (
                <div
                  key={cat.category}
                  className={`bg-white rounded-3xl border transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-md ${
                    form.isActive
                      ? "border-slate-200"
                      : "border-slate-200 opacity-80 bg-slate-50/50"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            form.isActive
                              ? "bg-amber-100 text-amber-800 shadow-sm"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {renderCategoryIcon(cat.category, "w-6 h-6")}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-lg leading-tight">
                            {cat.displayName}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono">
                            {cat.category}
                          </span>
                        </div>
                      </div>

                      {/* Active Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) =>
                            handleFormChange(cat.category, "isActive", e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span
                          className={`text-xs font-bold ${
                            form.isActive ? "text-emerald-700" : "text-slate-400"
                          }`}
                        >
                          {form.isActive ? "Active" : "Inactive"}
                        </span>
                      </label>
                    </div>

                    <p className="text-xs text-slate-500">{cat.description}</p>

                    {/* Capacity Specs */}
                    <div className="flex items-center gap-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium text-slate-600">
                      {cat.isGoodsTransport ? (
                        <div className="flex items-center gap-1.5 text-orange-700">
                          <Package size={14} />
                          <span>Goods Transport (Brief goods description required)</span>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="text-slate-400">Seats:</span>{" "}
                            <span className="font-bold text-slate-800">{cat.passengerCapacity}</span>
                          </div>
                          <div>•</div>
                          <div>
                            <span className="text-slate-400">Luggage:</span>{" "}
                            <span className="font-bold text-slate-800">{cat.luggageCapacity} bags</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Rate Inputs */}
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Rate Per Kilometer (LKR / km)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            LKR
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={form.ratePerKm}
                            onChange={(e) =>
                              handleFormChange(
                                cat.category,
                                "ratePerKm",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full pl-12 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Base Fare (LKR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={form.baseFare}
                            onChange={(e) =>
                              handleFormChange(
                                cat.category,
                                "baseFare",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Minimum Fare (LKR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={form.minimumFare}
                            onChange={(e) =>
                              handleFormChange(
                                cat.category,
                                "minimumFare",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* 10km Preview Calculation */}
                      <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Sample 10 km estimate:</span>
                        <span className="font-black text-amber-900 text-sm">
                          LKR {Math.round(sample10kmFare).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Feedback Messages */}
                    {form.successMessage && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>{form.successMessage}</span>
                      </div>
                    )}

                    {form.errorMessage && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-600 shrink-0" />
                        <span>{form.errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleSaveCategory(cat.category)}
                      disabled={form.saving}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {form.saving ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Save Pricing & Availability</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRIP DETAILS MODAL */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-amber-600">PICKME LOCAL RIDE</span>
                <h3 className="text-xl font-black text-slate-900">{selectedTrip.bookingReference}</h3>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Rider & Driver */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Rider Info</span>
                <p className="font-bold text-slate-900 text-sm">{selectedTrip.rider.fullName}</p>
                <p className="text-slate-600">{selectedTrip.rider.whatsappNumber}</p>
                <p className="text-slate-500">{selectedTrip.rider.email}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider block">Driver & Vehicle</span>
                {selectedTrip.driver ? (
                  <>
                    <p className="font-bold text-slate-900 text-sm">{selectedTrip.driver.name}</p>
                    <p className="text-slate-600">Reg: {selectedTrip.driver.vehicleRegistration}</p>
                    <p className="text-slate-500">Phone: {selectedTrip.driver.phoneNumber}</p>
                  </>
                ) : (
                  <p className="text-amber-600 font-bold pt-1">Unassigned (Awaiting driver)</p>
                )}
              </div>
            </div>

            {/* Route & Distance */}
            <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="font-bold text-slate-400 uppercase tracking-wider block">Trip Route</span>
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-800 block">{selectedTrip.pickupAddress}</span>
                  {selectedTrip.pickupInstructions && (
                    <span className="text-[11px] text-emerald-700 italic block mt-0.5">Note: {selectedTrip.pickupInstructions}</span>
                  )}
                </div>
              </div>
              {Array.isArray(selectedTrip.intermediateStops) && selectedTrip.intermediateStops.map((st, i) => (
                <div key={i} className="flex items-start gap-2 pl-2">
                  <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {st.stopOrder || i + 1}
                  </span>
                  <div>
                    <span className="text-slate-700 block font-medium">Stop {st.stopOrder || i + 1}: {st.address}</span>
                    {st.notes && <span className="text-slate-400 italic block text-[10px]">Note: {st.notes}</span>}
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="font-medium text-slate-800">{selectedTrip.destinationAddress}</span>
              </div>
              <div className="pt-2 flex items-center gap-4 text-slate-500 border-t border-slate-200">
                <span>Distance: <strong>{selectedTrip.distanceKm} km</strong></span>
                <span>Duration: <strong>~{selectedTrip.durationMins} mins</strong></span>
              </div>
            </div>

            {/* Pricing Snapshot */}
            {selectedTrip.pickMeDetails?.pricingSnapshot && (
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 uppercase">Confirmed Pricing Snapshot</span>
                  <span className="text-slate-500 text-[10px]">
                    {selectedTrip.pickMeDetails.pricingSnapshot.calculatedAt
                      ? new Date(selectedTrip.pickMeDetails.pricingSnapshot.calculatedAt).toLocaleString()
                      : ""}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Category</span>
                    <strong className="text-slate-900">{selectedTrip.pickMeDetails.pricingSnapshot.vehicleCategory}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Rate/km</span>
                    <strong className="text-slate-900">LKR {selectedTrip.pickMeDetails.pricingSnapshot.ratePerKm}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Base Fare</span>
                    <strong className="text-slate-900">LKR {selectedTrip.pickMeDetails.pricingSnapshot.baseFare}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Min Fare</span>
                    <strong className="text-slate-900">LKR {selectedTrip.pickMeDetails.pricingSnapshot.minimumFare}</strong>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200 flex items-center justify-between">
                  <span className="font-bold text-amber-900">Total Confirmed Fare:</span>
                  <span className="text-lg font-black text-amber-950">
                    LKR {(selectedTrip.pickMeDetails.estimatedFare || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Cancellation Details & Status Timeline */}
            {selectedTrip.status === "CANCELLED" && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                  <span className="font-extrabold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <XCircle size={14} className="text-rose-600" />
                    Cancellation Details
                  </span>
                  {selectedTrip.cancelledAt && (
                    <span className="text-rose-700 font-semibold">
                      {new Date(selectedTrip.cancelledAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Reason Code & Label</span>
                    <strong className="text-rose-950 font-bold block mt-0.5">
                      {selectedTrip.cancellationReasonText || selectedTrip.cancellationReasonCode || "Passenger Cancelled"}
                    </strong>
                    {selectedTrip.cancellationReasonCode && (
                      <span className="text-[10px] text-slate-400 font-mono">[{selectedTrip.cancellationReasonCode}]</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Cancelled By</span>
                    <strong className="text-slate-900 font-bold block mt-0.5">
                      {selectedTrip.cancelledBy?.name || selectedTrip.cancelledBy?.role || "Passenger"}
                    </strong>
                    {selectedTrip.cancelledBy?.role && (
                      <span className="text-[10px] text-slate-500">Role: {selectedTrip.cancelledBy.role}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Status Prior to Cancellation</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-rose-200 inline-block mt-0.5">
                      {selectedTrip.statusBeforeCancellation || "PENDING"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Refund Review Status</span>
                    <span className={`font-bold inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] border ${
                      selectedTrip.refundReviewStatus === "PENDING_REVIEW"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : selectedTrip.refundReviewStatus === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : selectedTrip.refundReviewStatus === "REFUNDED"
                        ? "bg-purple-100 text-purple-800 border-purple-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {selectedTrip.refundReviewStatus || "NOT_APPLICABLE"}
                    </span>
                  </div>
                </div>

                {selectedTrip.cancellationComments && (
                  <div className="p-3 bg-white/90 rounded-xl border border-rose-200 text-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Passenger / Admin Comments
                    </span>
                    <p className="italic text-slate-800 text-xs">&ldquo;{selectedTrip.cancellationComments}&rdquo;</p>
                  </div>
                )}

                {/* Status Timeline */}
                <div className="pt-2 border-t border-rose-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Trip Lifecycle Timeline
                  </span>
                  <div className="space-y-1.5 pl-2 border-l-2 border-rose-300">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">1. Booking Created:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedTrip.createdAt ? new Date(selectedTrip.createdAt).toLocaleString() : "N/A"}
                      </span>
                    </div>
                    {selectedTrip.assignedAt && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">2. Driver Assigned:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {new Date(selectedTrip.assignedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedTrip.arrivedAt && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">3. Driver Arrived at Pickup:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {new Date(selectedTrip.arrivedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-rose-800 font-bold">
                      <span>{selectedTrip.assignedAt ? (selectedTrip.arrivedAt ? "4." : "3.") : "2."} Cancelled:</span>
                      <span className="font-mono">
                        {selectedTrip.cancelledAt ? new Date(selectedTrip.cancelledAt).toLocaleString() : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Admin Actions if review pending */}
                {selectedTrip.refundReviewStatus === "PENDING_REVIEW" && (
                  <div className="pt-2 border-t border-rose-200 flex items-center justify-between gap-2">
                    <span className="text-amber-900 font-bold text-[11px]">Admin Action:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={resolvingRefundId === selectedTrip._id}
                        onClick={() => handleResolveRefund(selectedTrip._id, "RESOLVE")}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        Mark Resolved
                      </button>
                      <button
                        type="button"
                        disabled={resolvingRefundId === selectedTrip._id}
                        onClick={() => handleResolveRefund(selectedTrip._id, "REFUND")}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        Mark Refunded
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedTrip(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>

              <Link
                href={`/track?ref=${selectedTrip.bookingReference}`}
                target="_blank"
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <span>Open Live Tracking</span>
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
