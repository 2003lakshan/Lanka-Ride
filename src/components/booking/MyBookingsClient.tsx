"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, Clock, MapPin, Car, Info, Package as PackageIcon, ArrowRight, MessageCircle } from "lucide-react";
import PaymentActionClient from "@/components/booking/PaymentActionClient";
import { useSocket } from "@/components/providers/SocketProvider";
import { useRouter } from "next/navigation";
import type { MyBookingDTO, MyPackageEnquiryDTO } from "@/lib/bookingDto";
import { formatSriLankanDate } from "@/lib/dateTime";

interface MyBookingsClientProps {
  initialBookings: MyBookingDTO[];
  initialEnquiries: MyPackageEnquiryDTO[];
}

export default function MyBookingsClient({ initialBookings, initialEnquiries }: MyBookingsClientProps) {
  const { socket, registerReconnectHandler } = useSocket();
  const [bookings, setBookings] = useState<MyBookingDTO[]>(initialBookings);
  const [enquiries, setEnquiries] = useState<MyPackageEnquiryDTO[]>(initialEnquiries);
  const router = useRouter();

  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  useEffect(() => {
    setEnquiries(initialEnquiries);
  }, [initialEnquiries]);

  // Re-fetch on reconnect
  useEffect(() => {
    return registerReconnectHandler(() => {
      router.refresh();
    });
  }, [registerReconnectHandler, router]);

  // Realtime updates for rider's bookings
  useEffect(() => {
    if (!socket) return;

    const handleDriverAccepted = (data: any) => {
      if (data.booking?._id) {
        setBookings((prev) =>
          prev.map((b) =>
            b._id === data.booking._id
              ? {
                  ...b,
                  status: "DRIVER_ASSIGNED",
                  driverId: data.driver,
                }
              : b
          )
        );
      }
    };

    const handleStatusChanged = (data: any) => {
      if (data.bookingId) {
        setBookings((prev) =>
          prev.map((b) =>
            b._id === data.bookingId
              ? {
                  ...b,
                  status: data.status,
                  customTripDetails: data.confirmedAmount
                    ? {
                        ...(b.customTripDetails || {}),
                        confirmedAmount: data.confirmedAmount,
                        confirmedCurrency: data.confirmedCurrency,
                      }
                    : b.customTripDetails,
                }
              : b
          )
        );
      }
    };

    const handleChatMessage = (data: any) => {
      if (data.enquiryId) {
        setEnquiries((prev) =>
          prev.map((e) =>
            e._id === data.enquiryId
              ? {
                  ...e,
                  riderUnread: true,
                  messages: [...(e.messages || []), data.message],
                }
              : e
          )
        );
      }
    };

    socket.on("booking:driver_accepted", handleDriverAccepted);
    socket.on("booking:status_changed", handleStatusChanged);
    socket.on("chat:message", handleChatMessage);

    return () => {
      socket.off("booking:driver_accepted", handleDriverAccepted);
      socket.off("booking:status_changed", handleStatusChanged);
      socket.off("chat:message", handleChatMessage);
    };
  }, [socket]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "CONFIRMED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "DRIVER_ASSIGNED":
      case "DRIVER_EN_ROUTE":
      case "DRIVER_ARRIVED":
      case "TRIP_IN_PROGRESS":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "AWAITING_PAYMENT":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div>
      {bookings.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="text-slate-400" size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No bookings found</h3>
          <p className="text-slate-500 mb-6">You haven't made any bookings yet.</p>
          <a
            href="/booking"
            className="inline-flex bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Book a Ride
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking: MyBookingDTO) => (
            <div
              key={booking._id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row animate-in fade-in duration-300"
            >
              {/* Status Column */}
              <div className="md:w-64 bg-slate-900 p-6 flex flex-col justify-between text-white shrink-0">
                <div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Reference</div>
                  <div className="font-mono text-lg font-bold mb-6">{booking.bookingReference}</div>

                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Status</div>
                  <div
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(
                      booking.status
                    )}`}
                  >
                    {booking.status.replace(/_/g, " ")}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-800">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    {booking.customTripDetails?.isCustomTrip ? "Budget" : "Total Fare"}
                  </div>
                  <div className="text-xl font-bold">
                    {booking.customTripDetails?.isCustomTrip
                      ? booking.customTripDetails.confirmedAmount
                        ? `${booking.customTripDetails.confirmedCurrency || "USD"} ${booking.customTripDetails.confirmedAmount.toLocaleString()}`
                        : booking.customTripDetails.budget
                        ? `${booking.customTripDetails.budgetCurrency || "USD"} ${booking.customTripDetails.budget.toLocaleString()}`
                        : "Flexible"
                      : booking.pickMeDetails?.estimatedFare
                        ? `LKR ${booking.pickMeDetails.estimatedFare.toLocaleString()}`
                        : `LKR ${booking.fareBreakdown?.totalEstimatedFare?.toLocaleString() || "N/A"}`}
                  </div>
                  {!booking.customTripDetails?.isCustomTrip && (
                    <div className="text-xs text-slate-500 mt-1 capitalize">
                      {booking.paymentMethod?.replace(/_/g, " ") || ""}
                    </div>
                  )}
                </div>
              </div>

              {/* Details Column */}
              <div className="p-6 md:p-8 flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                      <MapPin size={16} className="text-blue-600" /> Route Details
                    </h4>
                    <div className="relative pl-6 space-y-4">
                      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200"></div>
                      <div className="relative">
                        <div className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></div>
                        <p className="text-xs text-emerald-600 font-bold uppercase">Pickup</p>
                        <p className="font-medium text-slate-800 text-sm">
                          {booking.pickupAddress || (booking.customTripDetails?.isCustomTrip ? "Custom Tour Pickup" : booking.airportId?.name || "Pickup Point")}
                        </p>
                        {booking.pickupInstructions && (
                          <p className="text-xs text-emerald-700 italic mt-0.5">Note: {booking.pickupInstructions}</p>
                        )}
                      </div>

                      {Array.isArray(booking.intermediateStops) && booking.intermediateStops.map((stop: any, sIdx: number) => (
                        <div key={sIdx} className="relative">
                          <div className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"></div>
                          <p className="text-xs text-amber-600 font-bold uppercase">Stop {stop.stopOrder || sIdx + 1}</p>
                          <p className="font-medium text-slate-800 text-sm">{stop.address}</p>
                          {stop.notes && <p className="text-xs text-slate-400 italic mt-0.5">Note: {stop.notes}</p>}
                        </div>
                      ))}
                      <div className="relative">
                        <div className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-slate-800 ring-2 ring-white"></div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Drop-off</p>
                        <p className="font-medium text-slate-800 text-sm">{booking.destinationAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Date</p>
                      <p className="text-sm font-medium text-slate-800 flex items-center gap-1" suppressHydrationWarning>
                        <Calendar size={14} className="text-slate-400" />{" "}
                        {booking.arrivalDate
                          ? formatSriLankanDate(booking.arrivalDate)
                          : booking.customTripDetails?.startDate
                          ? formatSriLankanDate(booking.customTripDetails.startDate)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Time</p>
                      <p className="text-sm font-medium text-slate-800 flex items-center gap-1">
                        <Clock size={14} className="text-slate-400" /> {booking.arrivalTime || "N/A"}
                      </p>
                    </div>
                  </div>

                  {booking.customTripDetails?.isCustomTrip && booking.customTripDetails.itinerary && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">
                        Custom Itinerary ({booking.customTripDetails.itinerary.length} Days)
                      </h5>
                      <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {booking.customTripDetails.itinerary.map((day) => (
                          <div key={day.dayNumber} className="relative pl-4 border-l-2 border-slate-200">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-4 border-blue-500"></div>
                            <p className="text-xs font-bold text-slate-900">Day {day.dayNumber}</p>
                            <p className="text-xs text-slate-600 mt-1">
                              {day.startingLocation?.address?.split(",")[0] || "Start"}
                              {day.placesToVisit && day.placesToVisit.length > 0 && ` • ${day.placesToVisit.length} Stops`}
                              {" • "}
                              {day.overnightLocation?.hotel || day.overnightLocation?.city || "Overnight"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                      <Car size={16} className="text-blue-600" /> Vehicle & Passengers
                    </h4>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="font-medium text-slate-800 mb-1">
                        {booking.pickMeDetails?.vehicleCategory || booking.vehicleTypeId?.name || "Standard Vehicle"}
                      </p>
                      {booking.pickMeDetails?.goodsDescription && (
                        <p className="text-xs text-orange-900 bg-orange-50 border border-orange-200 p-2 rounded-lg mb-2">
                          <strong>Goods:</strong> {booking.pickMeDetails.goodsDescription}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 mb-3">
                        {booking.passengerDetails?.adults || 1} Adults, {booking.passengerDetails?.children || 0} Children,{" "}
                        {booking.passengerDetails?.luggage || 0} Bags
                      </p>

                      {(booking.passengerDetails?.childSeatRequired ||
                        booking.passengerDetails?.meetAndGreetRequired) && (
                        <div className="text-xs text-slate-500 pt-3 border-t border-slate-200">
                          <strong>Add-ons:</strong>
                          {booking.passengerDetails?.childSeatRequired && " Child Seat"}
                          {booking.passengerDetails?.childSeatRequired &&
                            booking.passengerDetails?.meetAndGreetRequired &&
                            " • "}
                          {booking.passengerDetails?.meetAndGreetRequired && " Meet & Greet"}
                        </div>
                      )}
                    </div>
                  </div>

                  {booking.status === "DRIVER_ASSIGNED" ||
                  booking.status === "DRIVER_EN_ROUTE" ||
                  booking.status === "DRIVER_ARRIVED" ||
                  booking.status === "PASSENGER_PICKED_UP" ||
                  booking.status === "TRIP_IN_PROGRESS" ? (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex flex-col gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                          </span>
                          <span>
                            {booking.status === "PASSENGER_PICKED_UP" || booking.status === "TRIP_IN_PROGRESS"
                              ? "Trip in progress"
                              : "Driver coming to pick you up"}
                          </span>
                        </h4>
                        <p className="text-xs text-blue-800">
                          {booking.status === "PASSENGER_PICKED_UP" || booking.status === "TRIP_IN_PROGRESS"
                            ? "Your trip is underway. Follow your live journey."
                            : "Your driver is assigned and coming to pick you up. Track live location in real time."}
                        </p>
                      </div>
                      <Link
                        href={`/track?ref=${booking.bookingReference}&email=${encodeURIComponent(
                          booking.passengerDetails?.email || ""
                        )}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-center text-sm font-bold py-2.5 rounded-lg transition-colors w-full shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MapPin size={16} />
                        <span>Track Driver</span>
                      </Link>
                    </div>
                  ) : booking.status === "NEEDS_REVISION" || booking.status === "DRAFT" ? (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex flex-col gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-amber-900 mb-1">
                          {booking.status === "DRAFT" ? "Draft Saved" : "Action Required"}
                        </h4>
                        <p className="text-xs text-amber-800">
                          {booking.status === "DRAFT"
                            ? "Finish your trip request when you're ready."
                            : "The admin requested changes to your trip plan."}
                        </p>
                      </div>
                      <a
                        href={`/trip-builder?edit=${booking._id}`}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-center text-sm font-bold py-2.5 rounded-lg transition-colors w-full shadow-md shadow-amber-500/20"
                      >
                        Edit Trip Request
                      </a>
                    </div>
                  ) : booking.status === "AWAITING_PAYMENT" ||
                    booking.status === "PENDING_ADMIN_CONFIRMATION" ? (
                    <PaymentActionClient
                      bookingId={booking._id}
                      paymentStatus={booking.paymentStatus}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <Info size={16} /> Driver assignment pending
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package Enquiries Section */}
      {enquiries.length > 0 && (
        <div className="mt-16">
          <div className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-4">
            <PackageIcon className="text-blue-600" size={24} />
            <h2 className="text-2xl font-bold text-slate-900">Package Requests</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enquiries.map((enq: MyPackageEnquiryDTO) => (
              <div
                key={enq._id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg line-clamp-1">
                      {enq.packageId?.title || "Custom Package"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1" suppressHydrationWarning>
                      Requested {enq.createdAt ? formatSriLankanDate(enq.createdAt) : "Recently"}
                    </p>
                  </div>
                  <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {enq.status}
                  </span>
                </div>

                <div className="flex-1"></div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {enq.riderUnread && <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></div>}
                    <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
                      <MessageCircle size={14} />
                      {enq.messages?.length || 0} Messages
                    </span>
                  </div>
                  <Link
                    href={`/my-bookings/enquiries/${enq._id}`}
                    className="text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center gap-1 group"
                  >
                    View Chat <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
