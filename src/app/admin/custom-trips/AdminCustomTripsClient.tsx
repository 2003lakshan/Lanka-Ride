"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Car, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Search, 
  IdCard, 
  ExternalLink,
  ChevronRight,
  Luggage,
  Sparkles,
  HelpCircle
} from "lucide-react";
import { formatSriLankanDate } from "@/lib/dateTime";

interface CustomTripItem {
  _id: string;
  bookingReference: string;
  status: string;
  createdAt: string;
  arrivalDate?: string;
  arrivalTime?: string;
  pickupAddress?: string;
  destinationAddress?: string;
  approvedAt?: string;
  touristId?: {
    _id: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    nationality?: string;
  } | null;
  driverId?: {
    _id: string;
    name?: string;
    phoneNumber?: string;
  } | null;
  vehicleTypeId?: {
    _id: string;
    name?: string;
    capacity?: number;
  } | null;
  passengerDetails?: {
    fullName?: string;
    email?: string;
    country?: string;
    whatsappNumber?: string;
    adults?: number;
    children?: number;
    luggage?: number;
  } | null;
  customTripDetails?: {
    startDate?: string;
    endDate?: string;
    budget?: number;
    budgetCurrency?: string;
    budgetCovers?: string;
    confirmedAmount?: number;
    confirmedCurrency?: string;
    revision?: number;
    approvedRevision?: number;
    changeRequest?: {
      feedback?: string;
      affectedFields?: string[];
      affectedDays?: number[];
      requestedAt?: string;
      requestedByName?: string;
      revision?: number;
    } | null;
    bookingContact?: {
      fullName?: string;
      country?: string;
      email?: string;
      phone?: string;
      isBookingForSomeoneElse?: boolean;
      passenger?: {
        fullName?: string;
        phone?: string;
      };
    } | null;
    identityVerification?: {
      identityId?: string;
      documentType?: "NATIONAL_ID" | "PASSPORT";
      status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
      version?: number;
      rejectionReason?: string;
    } | null;
    itinerary?: any[];
  } | null;
}

interface AdminCustomTripsClientProps {
  trips: CustomTripItem[];
  counts: {
    pendingApproval: number;
    changesRequested: number;
    approved: number;
    completed: number;
    all: number;
  };
  activeTab: string;
}

export default function AdminCustomTripsClient({
  trips,
  counts,
  activeTab,
}: AdminCustomTripsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTrips = useMemo(() => {
    if (!searchQuery.trim()) return trips;
    const q = searchQuery.toLowerCase().trim();

    return trips.filter((t) => {
      const ref = (t.bookingReference || "").toLowerCase();
      const contactName = (
        t.customTripDetails?.bookingContact?.fullName ||
        t.passengerDetails?.fullName ||
        t.touristId?.name ||
        ""
      ).toLowerCase();
      const email = (
        t.customTripDetails?.bookingContact?.email ||
        t.passengerDetails?.email ||
        t.touristId?.email ||
        ""
      ).toLowerCase();
      const phone = (
        t.customTripDetails?.bookingContact?.phone ||
        t.passengerDetails?.whatsappNumber ||
        t.touristId?.phoneNumber ||
        ""
      ).toLowerCase();
      const pickup = (t.pickupAddress || "").toLowerCase();
      const dropoff = (t.destinationAddress || "").toLowerCase();

      return (
        ref.includes(q) ||
        contactName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        pickup.includes(q) ||
        dropoff.includes(q)
      );
    });
  }, [trips, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sparkles className="text-blue-600 shrink-0" size={30} />
            Custom Trips Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review custom private itineraries, request changes, approve pricing, and publish tours to the driver network.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/identity-reviews"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <IdCard size={16} className="text-blue-600" />
            <span>Rider Identity Reviews</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
          <Link
            href="/admin/custom-trips?status=PENDING_APPROVAL"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "PENDING_APPROVAL"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Clock size={14} />
            <span>Awaiting Review</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "PENDING_APPROVAL"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {counts.pendingApproval}
            </span>
          </Link>

          <Link
            href="/admin/custom-trips?status=CHANGES_REQUESTED"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "CHANGES_REQUESTED"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <AlertCircle size={14} />
            <span>Changes Requested</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "CHANGES_REQUESTED"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {counts.changesRequested}
            </span>
          </Link>

          <Link
            href="/admin/custom-trips?status=APPROVED"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "APPROVED"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Approved / Active</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "APPROVED"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {counts.approved}
            </span>
          </Link>

          <Link
            href="/admin/custom-trips?status=COMPLETED"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "COMPLETED"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Completed</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "COMPLETED"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {counts.completed}
            </span>
          </Link>

          <Link
            href="/admin/custom-trips?status=ALL"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "ALL"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>All Trips</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "ALL"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {counts.all}
            </span>
          </Link>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search ref, rider, route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* Trips Listing */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No custom trips found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No custom trips matching "${searchQuery}". Try a different keyword.`
              : "No custom trips found under this filter status."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrips.map((trip) => {
            const contact = trip.customTripDetails?.bookingContact || trip.passengerDetails;
            const isBookingForSomeoneElse = Boolean(
              trip.customTripDetails?.bookingContact?.isBookingForSomeoneElse
            );
            const passenger = trip.customTripDetails?.bookingContact?.passenger;
            const idVerification = trip.customTripDetails?.identityVerification;
            const changeReq = trip.customTripDetails?.changeRequest;
            const revision = trip.customTripDetails?.revision || 1;
            const itineraryDays = trip.customTripDetails?.itinerary?.length || 0;

            const isApproved = Boolean(
              trip.approvedAt ||
              trip.status === "CONFIRMED" ||
              trip.status === "DRIVER_ASSIGNED" ||
              (trip.status === "PENDING" && trip.approvedAt)
            );

            return (
              <div
                key={trip._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition-all p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  {/* Left: Ref, Revision, Dates */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-extrabold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-lg">
                      {trip.bookingReference}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                      Rev {revision}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Submitted {formatSriLankanDate(trip.createdAt)}
                    </span>
                  </div>

                  {/* Right: Dual Status Badges (Trip Status & Identity Status) */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Identity Status Badge */}
                    {idVerification?.status === "APPROVED" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={13} />
                        ID Approved
                      </span>
                    ) : idVerification?.status === "REJECTED" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                        <XCircle size={13} />
                        ID Rejected
                      </span>
                    ) : idVerification?.status === "PENDING_REVIEW" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <AlertCircle size={13} />
                        ID Pending Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        ID Not Submitted
                      </span>
                    )}

                    {/* Trip Status Badge */}
                    {trip.status === "PENDING_APPROVAL" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500 text-white shadow-xs">
                        <Clock size={13} />
                        Awaiting Admin Review
                      </span>
                    ) : trip.status === "CHANGES_REQUESTED" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-orange-600 text-white shadow-xs">
                        <AlertCircle size={13} />
                        Changes Requested
                      </span>
                    ) : trip.status === "DRIVER_ASSIGNED" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-xs">
                        <Car size={13} />
                        Driver Assigned
                      </span>
                    ) : trip.status === "COMPLETED" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-800 text-white shadow-xs">
                        <CheckCircle2 size={13} />
                        Completed
                      </span>
                    ) : trip.status === "CANCELLED" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-xs">
                        <XCircle size={13} />
                        Cancelled
                      </span>
                    ) : isApproved ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                        <CheckCircle2 size={13} />
                        Approved • Available to Drivers
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {trip.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                  {/* Column 1: Contact & Passenger Details */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <p className="font-bold text-slate-800 text-sm">
                      {trip.customTripDetails?.bookingContact?.fullName || trip.passengerDetails?.fullName || trip.touristId?.name || "Rider Contact"}
                    </p>
                    <p className="text-slate-500">
                      {trip.customTripDetails?.bookingContact?.email || trip.passengerDetails?.email || trip.touristId?.email || "No email"}
                    </p>
                    <p className="text-slate-500">
                      {trip.customTripDetails?.bookingContact?.phone || trip.passengerDetails?.whatsappNumber || trip.touristId?.phoneNumber || "No phone"}
                    </p>
                    <p className="text-slate-500">
                      Country: {trip.customTripDetails?.bookingContact?.country || trip.passengerDetails?.country || trip.touristId?.nationality || "N/A"}
                    </p>
                    {isBookingForSomeoneElse && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                        <span className="font-bold block">Travelling Passenger:</span>
                        <span>{passenger?.fullName || "Not specified"} ({passenger?.phone || "No phone"})</span>
                      </div>
                    )}
                  </div>

                  {/* Column 2: Logistics & Schedule */}
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                      <Calendar size={14} className="text-blue-600 shrink-0" />
                      <span>
                        {trip.customTripDetails?.startDate
                          ? formatSriLankanDate(trip.customTripDetails.startDate)
                          : trip.arrivalDate
                          ? formatSriLankanDate(trip.arrivalDate)
                          : "Date not specified"}
                        {trip.customTripDetails?.endDate && (
                          <> &rarr; {formatSriLankanDate(trip.customTripDetails.endDate)}</>
                        )}
                      </span>
                      {itineraryDays > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                          {itineraryDays} Days
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-900 font-medium truncate max-w-xs">
                          <strong className="text-slate-500 font-normal">From: </strong>
                          {trip.pickupAddress || "Pickup not set"}
                        </p>
                        <p className="text-slate-900 font-medium truncate max-w-xs">
                          <strong className="text-slate-500 font-normal">To: </strong>
                          {trip.destinationAddress || "Dropoff not set"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {(trip.passengerDetails?.adults || 0) + (trip.passengerDetails?.children || 0)} Pax
                      </span>
                      <span className="flex items-center gap-1">
                        <Luggage size={13} />
                        {trip.passengerDetails?.luggage || 0} Bags
                      </span>
                      <span className="flex items-center gap-1">
                        <Car size={13} />
                        {trip.vehicleTypeId?.name || "Vehicle not selected"}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: Pricing & Review Status */}
                  <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Budget &amp; Pricing
                      </span>
                      {trip.customTripDetails?.confirmedAmount ? (
                        <div className="mt-1">
                          <span className="text-base font-extrabold text-emerald-700">
                            {trip.customTripDetails.confirmedCurrency || "USD"} {trip.customTripDetails.confirmedAmount}
                          </span>
                          <span className="text-[10px] text-emerald-800 font-medium block">
                            Confirmed Pricing
                          </span>
                        </div>
                      ) : trip.customTripDetails?.budget ? (
                        <div className="mt-1">
                          <span className="text-base font-extrabold text-slate-800">
                            {trip.customTripDetails.budgetCurrency || "USD"} {trip.customTripDetails.budget}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Rider Budget ({trip.customTripDetails.budgetCovers || "Transport"})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic mt-1 block">No budget specified</span>
                      )}
                    </div>

                    {trip.driverId?.name && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-blue-900">
                        <strong>Assigned Driver:</strong> {trip.driverId.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Change Request Note Banner if applicable */}
                {trip.status === "CHANGES_REQUESTED" && changeReq?.feedback && (
                  <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-950 flex items-start gap-2">
                    <AlertCircle size={15} className="text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Pending Rider Changes:</strong> &ldquo;{changeReq.feedback}&rdquo;
                      {changeReq.requestedByName && (
                        <span className="text-orange-700 ml-1 text-[11px]">
                          (Requested by {changeReq.requestedByName})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {idVerification?.identityId ? (
                      <Link
                        href={`/admin/identity-reviews/${idVerification.identityId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                      >
                        <ShieldCheck size={14} className="text-blue-600" />
                        <span>Review Rider Identity</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No identity document attached</span>
                    )}
                  </div>

                  <Link
                    href={`/admin/custom-trips/${trip._id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    <span>Review Complete Trip</span>
                    <ChevronRight size={15} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

