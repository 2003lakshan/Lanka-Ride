"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Calendar,
  Users,
  Car,
  Clock,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  X,
  CreditCard,
  Banknote,
  MapPin,
  Send,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

interface PackageBookingModalProps {
  pkg: {
    _id: string;
    title: string;
    category: string;
    days: number;
    nights: number;
    startingCity: string;
    pickupOptions: string;
    pickupTime?: string;
    dropoffLocation?: string;
    minPassengers: number;
    maxPassengers: number;
    advanceNoticeDays?: number;
    childSeatAvailable?: boolean;
    costs?: {
      basePrice: number;
      totalStartingPrice?: number;
      priceType?: "PER_PERSON" | "PER_VEHICLE" | "ENTIRE_PACKAGE";
      currency?: "LKR" | "USD";
      passengerCountCovered?: number;
      extraPersonRate?: number;
      depositRequired?: number;
    };
    vehicleTypeId?: {
      _id: string;
      name: string;
      category: string;
      maxPassengers: number;
      maxLuggage: number;
    };
    driverId?: {
      _id: string;
      name: string;
      email?: string;
    };
  };
}

export default function PackageBookingModal({ pkg }: PackageBookingModalProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    reference: string;
    bookingId: string;
  } | null>(null);

  // Compute minimum selectable date based on advanceNoticeDays
  const advanceDays = pkg.advanceNoticeDays ?? 2;
  const minDateObj = new Date();
  minDateObj.setDate(minDateObj.getDate() + advanceDays);
  const minDateStr = minDateObj.toISOString().split("T")[0];

  const currency = pkg.costs?.currency || "LKR";
  const pricingBasis = pkg.costs?.priceType || "PER_VEHICLE";
  const basePrice = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || 0;
  const coveredPax = pkg.costs?.passengerCountCovered || pkg.minPassengers || 1;
  const extraRate = pkg.costs?.extraPersonRate || 0;
  const vehicleMaxPassengers = pkg.vehicleTypeId?.maxPassengers || pkg.maxPassengers || 4;
  const vehicleMaxLuggage = pkg.vehicleTypeId?.maxLuggage || 4;

  const [travelDate, setTravelDate] = useState(minDateStr);
  const [passengers, setPassengers] = useState(pkg.minPassengers || 1);
  const [luggage, setLuggage] = useState(Math.min(2, vehicleMaxLuggage));
  const [pickupAddress, setPickupAddress] = useState(pkg.pickupOptions || pkg.startingCity);
  const [dropoffAddress, setDropoffAddress] = useState(pkg.dropoffLocation || "Starting city hotel or airport");
  const [pickupTime, setPickupTime] = useState(pkg.pickupTime || "08:00 AM");
  const [childSeatRequired, setChildSeatRequired] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [specialRequests, setSpecialRequests] = useState("");

  const [contactDetails, setContactDetails] = useState({
    fullName: session?.user?.name || "",
    email: session?.user?.email || "",
    phone: (session?.user as any)?.phoneNumber || "",
    country: "Sri Lanka"
  });

  // Calculate live total fare
  let totalFare = basePrice;
  let extraCharge = 0;
  if (pricingBasis === "PER_PERSON") {
    totalFare = basePrice * passengers;
  } else {
    if (passengers > coveredPax && extraRate > 0) {
      extraCharge = extraRate * (passengers - coveredPax);
      totalFare = basePrice + extraCharge;
    }
  }

  const handleOpen = () => {
    if (!session) {
      router.push(`/login?callbackUrl=/packages/${pkg._id}`);
      return;
    }
    if ((session.user as any).role !== "TOURIST") {
      alert("Booking travel packages is available for tourist accounts. Please sign in as a tourist.");
      return;
    }
    // Prefill user details if available
    if (session.user) {
      setContactDetails(prev => ({
        ...prev,
        fullName: prev.fullName || session.user?.name || "",
        email: prev.email || session.user?.email || ""
      }));
    }
    setIsOpen(true);
    setError(null);
    setBookingResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contactDetails.fullName.trim()) {
      setError("Please provide your full name.");
      return;
    }
    if (!contactDetails.email.trim() || !contactDetails.email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }
    if (!contactDetails.phone.trim() || contactDetails.phone.length < 7) {
      setError("Please provide a valid mobile or WhatsApp phone number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/bookings/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: pkg._id,
          travelDate,
          passengers,
          luggage,
          pickupAddress,
          dropoffAddress,
          pickupTime,
          childSeatRequired,
          paymentMethod,
          specialRequests,
          contactDetails
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to book package.");

      setBookingResult({
        reference: data.bookingReference,
        bookingId: data.bookingId
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
      >
        <Calendar size={20} />
        Book This Tour Package
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-400 bg-blue-900/60 px-2.5 py-1 rounded-md">
                  {pkg.category}
                </span>
                <h3 className="text-xl font-extrabold mt-2 text-white">{pkg.title}</h3>
                <p className="text-slate-300 text-xs mt-1">
                  {pkg.days} Days / {pkg.nights} Nights • Driver: {pkg.driverId?.name || "Verified Local Driver"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Booking Confirmed State */}
            {bookingResult ? (
              <div className="p-8 text-center space-y-5">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={36} />
                </div>
                <h4 className="text-2xl font-black text-slate-900">Booking Confirmed!</h4>
                <p className="text-slate-600 text-sm max-w-md mx-auto">
                  Your reservation has been confirmed directly with your driver. A confirmation notification has been sent.
                </p>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block text-left text-xs space-y-1">
                  <div>
                    <span className="text-slate-500 font-bold">Booking Reference: </span>
                    <span className="font-mono font-bold text-blue-700 text-sm">{bookingResult.reference}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold">Travel Date: </span>
                    <span className="font-semibold text-slate-800">{new Date(travelDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold">Confirmed Total: </span>
                    <span className="font-extrabold text-emerald-700">{currency} {totalFare.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/my-bookings"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-xs"
                  >
                    View in My Bookings <ArrowRight size={16} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Booking Form */
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                {error && (
                  <div className="bg-rose-50 text-rose-800 p-4 rounded-2xl border border-rose-200 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Date & Group Size */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Travel Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={minDateStr}
                      value={travelDate}
                      onChange={e => setTravelDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 text-xs bg-slate-50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Requires {advanceDays}d advance notice</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Passengers <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={pkg.minPassengers || 1}
                      max={vehicleMaxPassengers}
                      value={passengers}
                      onChange={e => setPassengers(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 text-xs bg-slate-50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Max {vehicleMaxPassengers} in vehicle</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Luggage Pieces
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={vehicleMaxLuggage}
                      value={luggage}
                      onChange={e => setLuggage(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 text-xs bg-slate-50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Max {vehicleMaxLuggage} bags</p>
                  </div>
                </div>

                {/* Pickup & Dropoff Logistics */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin size={14} className="text-blue-600" /> Pickup & Drop-off Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Pickup Hotel / Location</label>
                      <input
                        type="text"
                        required
                        value={pickupAddress}
                        onChange={e => setPickupAddress(e.target.value)}
                        placeholder="e.g. Cinnamon Grand or BIA Airport"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Drop-off Location</label>
                      <input
                        type="text"
                        required
                        value={dropoffAddress}
                        onChange={e => setDropoffAddress(e.target.value)}
                        placeholder="e.g. Colombo hotel or BIA Airport"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Preferred Pickup Time</label>
                    <input
                      type="text"
                      value={pickupTime}
                      onChange={e => setPickupTime(e.target.value)}
                      placeholder="e.g. 08:00 AM"
                      className="w-full sm:w-1/2 px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" /> Primary Traveller Contact
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={contactDetails.fullName}
                        onChange={e => setContactDetails({ ...contactDetails, fullName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={contactDetails.email}
                        onChange={e => setContactDetails({ ...contactDetails, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Mobile / WhatsApp Number</label>
                      <input
                        type="tel"
                        required
                        value={contactDetails.phone}
                        onChange={e => setContactDetails({ ...contactDetails, phone: e.target.value })}
                        placeholder="+94 77 123 4567"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Country of Residence</label>
                      <input
                        type="text"
                        value={contactDetails.country}
                        onChange={e => setContactDetails({ ...contactDetails, country: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Options */}
                <div className="space-y-3 text-xs">
                  {pkg.childSeatAvailable && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="modalChildSeat"
                        checked={childSeatRequired}
                        onChange={e => setChildSeatRequired(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded-sm"
                      />
                      <label htmlFor="modalChildSeat" className="text-slate-700 font-semibold cursor-pointer">
                        Require child safety seat
                      </label>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Special Requests or Dietary Requirements (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={specialRequests}
                      onChange={e => setSpecialRequests(e.target.value)}
                      placeholder="e.g. Vegetarian meals preferred, flight arrival details..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CASH")}
                        className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                          paymentMethod === "CASH"
                            ? "border-blue-600 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <Banknote size={16} /> Pay Driver (Cash)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CARD")}
                        className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                          paymentMethod === "CARD"
                            ? "border-blue-600 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <CreditCard size={16} /> Card / Online
                      </button>
                    </div>
                  </div>
                </div>

                {/* Price Breakdown Footer */}
                <div className="p-4 bg-slate-100 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total Guaranteed Fare
                    </span>
                    <span className="text-2xl font-black text-slate-900">
                      {currency} {totalFare.toLocaleString()}
                    </span>
                    {extraCharge > 0 && (
                      <span className="text-[10px] text-slate-500 block">
                        Includes {currency} {extraCharge.toLocaleString()} for extra passenger(s)
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-sm transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? "Confirming..." : "Confirm Booking"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

