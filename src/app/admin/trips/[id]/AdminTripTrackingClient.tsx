"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  MapPin,
  User,
  Car,
  DollarSign,
  Calendar,
  Navigation,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Phone,
  Mail,
  Luggage,
  Users
} from "lucide-react";
import RiderTrackingMap from "@/components/booking/RiderTrackingMap";
import { useSocket } from "@/components/providers/SocketProvider";
import { AdminTripViewModel } from "@/lib/tripViewModel";

export default function AdminTripTrackingClient({
  initialBooking,
  bookingId
}: {
  initialBooking: AdminTripViewModel;
  bookingId: string;
}) {
  const { socket, isConnected, subscribeToBooking, unsubscribeFromBooking, registerReconnectHandler } = useSocket();
  const [booking, setBooking] = useState<AdminTripViewModel>(initialBooking);
  const [followDriver, setFollowDriver] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Subscribe to booking room
  useEffect(() => {
    if (!bookingId) return;
    subscribeToBooking(bookingId);
    return () => {
      unsubscribeFromBooking(bookingId);
    };
  }, [bookingId, subscribeToBooking, unsubscribeFromBooking]);

  // Realtime listeners
  useEffect(() => {
    if (!socket || !bookingId) return;

    const handleLocationUpdate = (data: any) => {
      if (data.bookingId !== bookingId) return;
      setBooking((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          driverLocation: {
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy ?? null,
            updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : null,
          },
        };
      });
    };

    const handleStatusChanged = (data: any) => {
      if (data.bookingId !== bookingId) return;
      setBooking((prev) => (prev ? {
        ...prev,
        status: data.status,
        arrivalSource: data.arrivalSource ?? prev.arrivalSource,
        arrivedAt: data.arrivedAt ?? prev.arrivedAt,
      } : prev));
    };

    socket.on("driver:location_updated", handleLocationUpdate);
    socket.on("booking:status_changed", handleStatusChanged);

    return () => {
      socket.off("driver:location_updated", handleLocationUpdate);
      socket.off("booking:status_changed", handleStatusChanged);
    };
  }, [socket, bookingId]);

  // Re-fetch on reconnect
  useEffect(() => {
    return registerReconnectHandler(() => {
      fetch(`/api/admin/bookings/${bookingId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setBooking(data.data);
          }
        })
        .catch(console.error);
    });
  }, [registerReconnectHandler, bookingId]);

  // Polling fallback during disconnection for active trips
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const activeStatuses = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"];

    if (booking && activeStatuses.includes(booking.status)) {
      if (isConnected) return; // Realtime active; disable polling

      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/bookings/${bookingId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.data) setBooking(data.data);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [booking?.status, bookingId, isConnected]);

  // Handler for Approve & Publish to Drivers
  const handleApproveAndPublish = async () => {
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
        setBooking((prev) => ({
          ...prev,
          status: "PENDING",
          paymentStatus: "PAID",
          approvedAt: new Date().toISOString(),
          driverId: null
        }));
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

  const isCustomTrip = booking.isCustomTrip;

  // Extract itinerary locations safely for tracking map
  const itineraryLocations = isCustomTrip
    ? (booking.customTripDetails?.itinerary || []).flatMap((day) =>
        (day.placesToVisit || []).map((place) => ({
          lat: place.lat || 0,
          lng: place.lng || 0,
          name: place.name
        }))
      )
    : [];

  const getStatusColor = (status: string) => {
    if (status === "COMPLETED") return "bg-green-100 text-green-800 border-green-200";
    if (status === "PENDING_ADMIN_CONFIRMATION") return "bg-amber-100 text-amber-900 border-amber-300 font-bold";
    if (status.includes("DRIVER") || status.includes("PROGRESS"))
      return "bg-indigo-100 text-indigo-800 border-indigo-200 font-bold animate-pulse";
    if (status === "PENDING") return "bg-yellow-100 text-yellow-800 border-yellow-200 font-bold";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const riderName = booking.rider?.fullName || booking.passengerDetails?.fullName || "Rider name unavailable";
  const riderEmail = booking.rider?.email || (booking.passengerDetails?.email !== "No email provided" ? booking.passengerDetails?.email : null);
  const riderPhone = booking.rider?.whatsappNumber || (booking.passengerDetails?.whatsappNumber !== "No contact provided" ? booking.passengerDetails?.whatsappNumber : null);
  const adultsCount = (booking.rider?.adults ?? booking.passengerDetails?.adults) || 1;
  const childrenCount = (booking.rider?.children ?? booking.passengerDetails?.children) || 0;
  const luggageCount = (booking.rider?.luggage ?? booking.passengerDetails?.luggage) || 0;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div>
        <Link
          href="/admin/trips"
          className="text-blue-600 hover:underline flex items-center gap-1 text-sm font-bold mb-4 w-fit"
        >
          <ArrowLeft size={16} /> Back to Platform Trips
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              Trip Details & Tracking
              <span className={`text-xs px-3 py-1 rounded-full uppercase border ${getStatusColor(booking.status)}`}>
                {booking.status === "PENDING_ADMIN_CONFIRMATION" && booking.paymentStatus === "PAID"
                  ? "Paid — Awaiting Admin Approval"
                  : booking.status === "DRIVER_ARRIVED" && booking.arrivalSource === "GPS"
                  ? "Driver Arrived (GPS Auto)"
                  : booking.status.replace(/_/g, " ")}
              </span>
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-mono">
              <span>Ref: {booking.bookingReference}</span>
              <span>•</span>
              <span className="uppercase font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {booking.tripType} TRIP
              </span>
              {booking.createdAt && (
                <>
                  <span>•</span>
                  <span>Booked: {new Date(booking.createdAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="font-bold text-sm">{actionMessage.text}</span>
        </div>
      )}

      {/* 1. Final Admin Confirmation Required Banner */}
      {booking.status === "PENDING_ADMIN_CONFIRMATION" && booking.paymentStatus === "PAID" && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-300 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h2 className="text-lg font-black text-amber-950">Final Admin Confirmation Required</h2>
                <p className="text-xs text-amber-900 mt-1 max-w-2xl">
                  The rider has successfully paid the confirmed amount of{" "}
                  <strong className="font-black text-slate-950">
                    {booking.customTripDetails?.confirmedCurrency || "USD"}{" "}
                    {booking.customTripDetails?.confirmedAmount || booking.customTripDetails?.budget || 0}
                  </strong>
                  . Payment is verified PAID. Click below to approve and publish this trip so eligible drivers can accept it.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isConfirming}
              onClick={handleApproveAndPublish}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all text-sm shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isConfirming ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        </div>
      )}

      {/* 2. Approved & Published Banner */}
      {booking.status === "PENDING" && booking.paymentStatus === "PAID" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-900">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">Approved & Published to Drivers</p>
              <p className="text-xs text-emerald-700">
                {booking.approvedAt
                  ? `Approved on ${new Date(booking.approvedAt).toLocaleString()} • Awaiting driver acceptance`
                  : "Published to drivers and awaiting acceptance."}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-emerald-200/60 text-emerald-800 px-3 py-1 rounded-full">
            Awaiting Driver Acceptance
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Trip Details */}
        <div className="space-y-6">
          {/* Passenger Details Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <User size={18} className="text-blue-500" />
              <span>Rider Information</span>
            </h3>

            <div className="space-y-3.5 text-sm">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase">Name</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="font-extrabold text-slate-900 text-base">{riderName}</p>
                  {booking.rider?.isRegisteredUser && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                      Account
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase">Email</p>
                  <p className="text-slate-900 text-xs break-all mt-0.5 flex items-center gap-1">
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    <span>{riderEmail || "No email provided"}</span>
                  </p>
                </div>

                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase">Phone / WA</p>
                  <p className="text-slate-900 text-xs mt-0.5 flex items-center gap-1 font-mono">
                    <Phone size={12} className="text-emerald-600 shrink-0" />
                    <span>{riderPhone || "No contact provided"}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase">Travelers</p>
                  <p className="text-slate-900 text-xs font-medium mt-0.5 flex items-center gap-1">
                    <Users size={12} className="text-slate-400 shrink-0" />
                    <span>{adultsCount} Adults, {childrenCount} Children</span>
                  </p>
                </div>

                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase">Luggage</p>
                  <p className="text-slate-900 text-xs font-medium mt-0.5 flex items-center gap-1">
                    <Luggage size={12} className="text-slate-400 shrink-0" />
                    <span>{luggageCount} Bags</span>
                  </p>
                </div>
              </div>

              {booking.rider?.nationality && (
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span className="text-slate-400 font-bold uppercase mr-1">Nationality:</span>
                  <span>{booking.rider.nationality}</span>
                </div>
              )}

              {booking.rider?.specialRequests && (
                <div className="pt-2 border-t border-slate-100 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold uppercase block mb-0.5">Special Requests:</span>
                  <p className="text-slate-700 italic">{booking.rider.specialRequests}</p>
                </div>
              )}
            </div>
          </div>

          {/* Driver & Vehicle Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <Car size={18} className="text-indigo-500" />
              <span>Driver & Vehicle</span>
            </h3>

            {booking.driverId ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase">Assigned Driver</p>
                  <p className="font-bold text-slate-900 text-base">{booking.driverId.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-xs font-bold uppercase">Contact</p>
                    <p className="text-slate-900 font-mono text-xs">{booking.driverId.phoneNumber || "No phone provided"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-bold uppercase">Vehicle</p>
                    <p className="text-slate-900 font-medium text-xs">
                      {booking.driverId.vehicleModel || booking.vehicleTypeId?.name || "Standard Vehicle"}
                    </p>
                    {booking.driverId.vehicleRegistration && (
                      <span className="inline-block mt-1 font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                        {booking.driverId.vehicleRegistration}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-800 border border-amber-200 p-4 rounded-xl text-sm font-bold text-center space-y-1">
                <p>No driver assigned yet</p>
                <span className="block text-xs font-normal text-amber-700">
                  {booking.status === "PENDING"
                    ? "Visible on driver dashboard for eligible drivers to accept."
                    : "Awaiting final admin confirmation to publish to drivers."}
                </span>
              </div>
            )}
          </div>

          {/* Financials & Payment Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <DollarSign size={18} className="text-emerald-500" />
              <span>Financials & Payment</span>
            </h3>

            <div className="space-y-4">
              {isCustomTrip ? (
                <>
                  <div>
                    <p className="text-slate-400 font-bold uppercase text-[10px]">Rider Proposed Budget</p>
                    <p className="font-bold text-slate-900 text-lg">
                      {booking.customTripDetails?.budget
                        ? `${booking.customTripDetails.budgetCurrency} ${booking.customTripDetails.budget.toLocaleString()}`
                        : "Flexible"}
                    </p>
                    {booking.customTripDetails?.budget && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {booking.customTripDetails.budgetCovers} • {booking.customTripDetails.budgetFlexibility}
                      </p>
                    )}
                  </div>

                  {typeof booking.customTripDetails?.confirmedAmount === "number" ? (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-slate-400 font-bold uppercase text-[10px]">Confirmed Paid Fare</p>
                      <p className="font-black text-emerald-700 text-2xl">
                        {booking.customTripDetails.confirmedCurrency} {booking.customTripDetails.confirmedAmount.toLocaleString()}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1.5">
                        <ShieldCheck size={13} className="text-emerald-600" />
                        <span>Payment Verified: PAID</span>
                      </span>
                    </div>
                  ) : booking.fareBreakdown?.totalEstimatedFare ? (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-slate-400 font-bold uppercase text-[10px]">Estimated Fare</p>
                      <p className="font-bold text-emerald-700 text-xl">
                        LKR {booking.fareBreakdown.totalEstimatedFare.toLocaleString()}
                      </p>
                    </div>
                  ) : null}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 font-bold uppercase text-[10px]">Payment Status</p>
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-extrabold rounded uppercase mt-1 ${
                          booking.paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {booking.paymentStatus}
                      </span>
                    </div>
                    {booking.paymentMethod && (
                      <div className="text-right">
                        <p className="text-slate-400 font-bold uppercase text-[10px]">Method</p>
                        <p className="text-slate-800 text-xs font-bold uppercase mt-1">{booking.paymentMethod}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-slate-400 font-bold uppercase text-[10px]">Total Fare</p>
                    <p className="font-black text-slate-900 text-2xl">
                      {booking.fareBreakdown?.totalEstimatedFare
                        ? `LKR ${booking.fareBreakdown.totalEstimatedFare.toLocaleString()}`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 font-bold uppercase text-[10px]">Payment Status</p>
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-extrabold rounded uppercase mt-1 ${
                          booking.paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {booking.paymentStatus}
                      </span>
                    </div>
                    {booking.paymentMethod && (
                      <div className="text-right">
                        <p className="text-slate-400 font-bold uppercase text-[10px]">Method</p>
                        <p className="text-slate-800 text-xs font-bold uppercase mt-1">{booking.paymentMethod}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Tracking Map & Route */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          {/* Tracking Map Box */}
          <div
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col"
            style={{ minHeight: "500px" }}
          >
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center z-10 relative">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Navigation size={18} className="text-blue-500" /> Live Driver Tracking
              </h3>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-slate-600 flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={followDriver}
                    onChange={(e) => setFollowDriver(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Follow Driver
                </label>
              </div>
            </div>

            <div className="flex-1 relative bg-slate-100">
              <RiderTrackingMap
                status={booking.status}
                driverLat={booking.driverLocation?.lat}
                driverLng={booking.driverLocation?.lng}
                driverLocationUpdatedAt={booking.driverLocation?.updatedAt || undefined}
                pickupLat={booking.pickupLat}
                pickupLng={booking.pickupLng}
                dropoffLat={booking.destinationLat}
                dropoffLng={booking.destinationLng}
                itineraryLocations={itineraryLocations}
                followDriver={followDriver}
              />
            </div>
          </div>

          {/* Detailed Itinerary & Route */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <MapPin size={18} className="text-rose-500" />
              <span>Route & Itinerary</span>
            </h3>

            {isCustomTrip ? (
              booking.customTripDetails?.itinerary && booking.customTripDetails.itinerary.length > 0 ? (
                <div className="space-y-6">
                  {booking.customTripDetails.itinerary.map((day, dayIdx) => (
                    <details key={dayIdx} className="bg-slate-50 rounded-xl border border-slate-100 group" open>
                      <summary className="font-bold text-slate-800 flex justify-between items-center p-4 cursor-pointer select-none">
                        <span>
                          Day {day.dayNumber} {day.date && `- ${new Date(day.date).toLocaleDateString()}`}
                        </span>
                        <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                      </summary>

                      <div className="relative px-4 pb-4 pl-6 space-y-4">
                        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-300" />

                        {day.startingLocation && (
                          <div className="relative">
                            <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                            <p className="text-xs font-bold text-slate-400 uppercase">Start</p>
                            <p className="font-medium text-slate-900">{day.startingLocation.name}</p>
                          </div>
                        )}

                        {day.placesToVisit?.map((place, placeIdx) => (
                          <div key={placeIdx} className="relative">
                            <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-slate-500 ring-4 ring-slate-100" />
                            <p className="font-medium text-slate-800">{place.name}</p>
                            {place.activityTime && (
                              <p className="text-xs text-slate-500">Duration: {place.activityTime}</p>
                            )}
                          </div>
                        ))}

                        {day.overnightLocation && (
                          <div className="relative">
                            <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-slate-800 ring-4 ring-slate-200" />
                            <p className="text-xs font-bold text-slate-400 uppercase">Overnight</p>
                            <p className="font-medium text-slate-900">{day.overnightLocation.hotel || day.overnightLocation.name}</p>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="relative pl-6 space-y-6">
                  <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-300" />
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                    <p className="text-xs font-bold text-slate-400 uppercase">Pickup Location</p>
                    <p className="font-medium text-slate-900">{booking.pickupAddress}</p>
                    <p className="text-sm text-slate-500">
                      {booking.arrivalDate ? new Date(booking.arrivalDate).toLocaleString() : booking.arrivalTime || "TBD"}
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-slate-800 ring-4 ring-slate-200" />
                    <p className="text-xs font-bold text-slate-400 uppercase">Destination</p>
                    <p className="font-medium text-slate-900">{booking.destinationAddress}</p>
                  </div>
                </div>
              )
            ) : (
              <div className="relative pl-6 space-y-6">
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-300" />

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                  <p className="text-xs font-bold text-slate-400 uppercase">Pickup</p>
                  <p className="font-medium text-slate-900">{booking.pickupAddress}</p>
                  <p className="text-sm text-slate-500">
                    {booking.arrivalDate ? new Date(booking.arrivalDate).toLocaleString() : booking.arrivalTime || "N/A"}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-slate-800 ring-4 ring-slate-200" />
                  <p className="text-xs font-bold text-slate-400 uppercase">Drop-off</p>
                  <p className="font-medium text-slate-900">{booking.destinationAddress}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
