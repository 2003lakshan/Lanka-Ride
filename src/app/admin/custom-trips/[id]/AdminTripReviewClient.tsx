"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Send, ArrowLeft, FileText, ExternalLink, ShieldCheck, AlertCircle, XCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatSriLankanDate } from "@/lib/dateTime";

export default function AdminTripReviewClient({ booking }: { booking: any }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>(booking.adminNotes || {});
  const [loading, setLoading] = useState(false);
  const proposedBudget = booking.customTripDetails?.budget;
  const proposedCurrency = booking.customTripDetails?.budgetCurrency || "USD";
  const hasValidTransportBudget = proposedBudget && Number(proposedBudget) > 0 && booking.customTripDetails?.budgetCovers === "Transport only";

  const [priceMode, setPriceMode] = useState<"ACCEPT_BUDGET" | "CUSTOM_PRICE">(hasValidTransportBudget ? "ACCEPT_BUDGET" : "CUSTOM_PRICE");
  const [confirmedAmount, setConfirmedAmount] = useState<string>("");
  const [confirmedCurrency, setConfirmedCurrency] = useState<string>("USD");

  const effectiveAmount = priceMode === "ACCEPT_BUDGET" ? proposedBudget : confirmedAmount;
  const effectiveCurrency = priceMode === "ACCEPT_BUDGET" ? proposedCurrency : confirmedCurrency;

  // Identity review state
  const idVerification = booking.customTripDetails?.identityVerification;
  const [identityStatus, setIdentityStatus] = useState<string>(
    idVerification?.status || "NOT_SUBMITTED"
  );
  const [identityVersion, setIdentityVersion] = useState<number>(
    Number(idVerification?.version) || 1
  );
  const [identityRejectionReason, setIdentityRejectionReason] = useState<string>(
    idVerification?.rejectionReason || ""
  );
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectInput, setRejectInput] = useState<string>("");
  const [identityReviewLoading, setIdentityReviewLoading] = useState<boolean>(false);
  const [identityReviewMsg, setIdentityReviewMsg] = useState<string>("");

  const handleReviewIdentity = async (action: "APPROVE" | "REJECT", reason?: string) => {
    const identityId = idVerification?.identityId;
    if (!identityId) {
      alert("No identity document record ID found.");
      return;
    }
    if (action === "REJECT" && (!reason || !reason.trim())) {
      alert("Please provide a reason for rejecting the document.");
      return;
    }

    setIdentityReviewLoading(true);
    setIdentityReviewMsg("");
    try {
      const res = await fetch("/api/admin/identity-documents/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId,
          action,
          rejectionReason: reason,
          bookingId: booking._id,
          expectedVersion: identityVersion,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIdentityStatus(data.status);
        if (data.version) setIdentityVersion(data.version);
        if (action === "REJECT") {
          setIdentityRejectionReason(reason || "");
          setShowRejectModal(false);
          setRejectInput("");
        } else {
          setIdentityRejectionReason("");
        }
        setIdentityReviewMsg(`Identity document ${data.status.toLowerCase()} successfully!`);
        router.refresh();
      } else if (res.status === 409) {
        alert(data.error || "The rider updated their document. Refreshing page to display the latest version.");
        router.refresh();
      } else {
        alert(data.error || "Failed to update identity review status.");
      }
    } catch {
      alert("Network error while submitting identity review.");
    } finally {
      setIdentityReviewLoading(false);
    }
  };

  const handleNoteChange = (key: string, value: string) => {
    setNotes(prev => ({ ...prev, [key]: value }));
  };

  const submitReview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking._id,
          action: "SEND_REVIEW",
          notes
        })
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        alert("Failed to send review");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveTrip = async () => {
    if (!effectiveAmount || isNaN(Number(effectiveAmount)) || Number(effectiveAmount) <= 0) {
      alert("Please enter a valid confirmed amount.");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking._id,
          action: "APPROVE",
          confirmedAmount: Number(effectiveAmount),
          confirmedCurrency: effectiveCurrency,
          useRiderBudget: priceMode === "ACCEPT_BUDGET"
        })
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to approve");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const rejectTrip = async () => {
    const reason = prompt("Enter reason for rejection:");
    if (!reason) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking._id,
          action: "REJECT",
          notes: { rejectionReason: reason }
        })
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        alert("Failed to reject");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const NoteField = ({ sectionKey, label }: { sectionKey: string, label: string }) => (
    <div className="mt-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
      <label className="block text-xs font-bold text-amber-900 mb-2">Admin Note for {label}</label>
      <textarea
        value={notes[sectionKey] || ""}
        onChange={(e) => handleNoteChange(sectionKey, e.target.value)}
        className="w-full p-2 border border-amber-300 rounded text-sm bg-white focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
        placeholder={`Add a note or change request for ${label}...`}
        rows={2}
      />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/admin" className="text-blue-600 hover:underline flex items-center gap-1 text-sm font-bold mb-4">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Review Trip Plan</h1>
        <p className="text-slate-600">Review the custom trip details and add notes if changes are needed.</p>
      </div>

      <div className="space-y-8">
        {/* Booking Contact & Passenger Details */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2 flex items-center justify-between">
            <span>Booking Contact & Passenger</span>
            {booking.customTripDetails?.bookingContact?.isBookingForSomeoneElse && (
              <span className="text-xs font-extrabold uppercase px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                Booked For Someone Else
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm mb-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Booking Contact (Account Holder)</p>
              <div><span className="text-slate-500">Name:</span> <span className="font-bold text-slate-900">{booking.customTripDetails?.bookingContact?.fullName || booking.passengerDetails?.fullName || "N/A"}</span></div>
              <div><span className="text-slate-500">Country:</span> <span className="font-medium text-slate-900">{booking.customTripDetails?.bookingContact?.country || booking.passengerDetails?.country || "N/A"}</span></div>
              <div><span className="text-slate-500">Verified Email:</span> <span className="font-medium text-slate-900">{booking.customTripDetails?.bookingContact?.email || booking.passengerDetails?.email || "N/A"}</span></div>
              <div><span className="text-slate-500">Contact Phone:</span> <span className="font-medium text-slate-900">{booking.customTripDetails?.bookingContact?.phone || booking.passengerDetails?.whatsappNumber || "N/A"}</span></div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Travelling Passenger</p>
              {booking.customTripDetails?.bookingContact?.isBookingForSomeoneElse ? (
                <>
                  <div><span className="text-slate-500">Passenger Name:</span> <span className="font-bold text-slate-900">{booking.customTripDetails.bookingContact.passenger?.fullName || "N/A"}</span></div>
                  <div><span className="text-slate-500">Passenger Mobile:</span> <span className="font-bold text-slate-900">{booking.customTripDetails.bookingContact.passenger?.phone || "N/A"}</span></div>
                  <p className="text-xs text-slate-500 mt-2">Driver should coordinate pickups with this passenger.</p>
                </>
              ) : (
                <div className="py-2">
                  <p className="font-medium text-slate-800">Primary contact is also the travelling passenger.</p>
                </div>
              )}
            </div>
          </div>
          <NoteField sectionKey="contact" label="Contact & Passenger" />
        </section>

        {/* Identity Document Verification Review */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={22} />
              Identity Document Verification
            </h2>
            <div>
              {identityStatus === "APPROVED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={14} /> Approved
                </span>
              ) : identityStatus === "REJECTED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-700 border border-red-200">
                  <XCircle size={14} /> Rejected
                </span>
              ) : identityStatus === "PENDING_REVIEW" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle size={14} /> Pending Review
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                  Not Submitted
                </span>
              )}
            </div>
          </div>

          {identityReviewMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{identityReviewMsg}</span>
            </div>
          )}

          {idVerification ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500">Document Type</span>
                  <div className="text-sm font-extrabold text-slate-900">
                    {idVerification.documentType === "NATIONAL_ID" ? "National ID Card" : "Passport"}
                  </div>
                </div>
                {identityVersion && (
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-200/80 px-2.5 py-1 rounded-md">
                    Version {identityVersion}
                  </span>
                )}
              </div>

              {identityRejectionReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  <strong>Rejection Reason:</strong> {identityRejectionReason}
                </div>
              )}

              {/* Uploaded Files Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {idVerification.documentType === "NATIONAL_ID" ? (
                  <>
                    <div className="p-4 border rounded-xl bg-slate-50 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase">National ID — Front</span>
                        <p className="text-sm font-medium text-slate-900 mt-1 truncate">
                          {idVerification.files?.front?.originalName || "No file uploaded"}
                        </p>
                        {idVerification.files?.front?.size && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {(idVerification.files.front.size / (1024 * 1024)).toFixed(2)} MB • {idVerification.files.front.mimeType}
                          </p>
                        )}
                      </div>
                      {idVerification.files?.front?.fileId && (
                        <a
                          href={`/api/identity-documents/view?fileId=${idVerification.files.front.fileId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
                        >
                          <ExternalLink size={13} />
                          <span>View Document</span>
                        </a>
                      )}
                    </div>

                    <div className="p-4 border rounded-xl bg-slate-50 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase">National ID — Back</span>
                        <p className="text-sm font-medium text-slate-900 mt-1 truncate">
                          {idVerification.files?.back?.originalName || "No file uploaded"}
                        </p>
                        {idVerification.files?.back?.size && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {(idVerification.files.back.size / (1024 * 1024)).toFixed(2)} MB • {idVerification.files.back.mimeType}
                          </p>
                        )}
                      </div>
                      {idVerification.files?.back?.fileId && (
                        <a
                          href={`/api/identity-documents/view?fileId=${idVerification.files.back.fileId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
                        >
                          <ExternalLink size={13} />
                          <span>View Document</span>
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 p-4 border rounded-xl bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase">Passport Photo & Details Page</span>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {idVerification.files?.photoPage?.originalName || "No file uploaded"}
                      </p>
                      {idVerification.files?.photoPage?.size && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {(idVerification.files.photoPage.size / (1024 * 1024)).toFixed(2)} MB • {idVerification.files.photoPage.mimeType}
                        </p>
                      )}
                    </div>
                    {idVerification.files?.photoPage?.fileId && (
                      <a
                        href={`/api/identity-documents/view?fileId=${idVerification.files.photoPage.fileId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
                      >
                        <ExternalLink size={13} />
                        <span>View Document</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Review Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={identityReviewLoading || identityStatus === "APPROVED"}
                  onClick={() => handleReviewIdentity("APPROVE")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {identityReviewLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Approve Document</span>
                </button>

                <button
                  type="button"
                  disabled={identityReviewLoading}
                  onClick={() => setShowRejectModal(!showRejectModal)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle size={14} />
                  <span>Reject with Reason</span>
                </button>
              </div>

              {/* Rejection Reason Form */}
              {showRejectModal && (
                <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-red-900">
                    Rejection Reason (Displayed to Rider for Re-upload) *
                  </label>
                  <textarea
                    rows={2}
                    value={rejectInput}
                    onChange={(e) => setRejectInput(e.target.value)}
                    placeholder="e.g. The photo is blurry and document text is unreadable. Please provide a clear scan."
                    className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={identityReviewLoading || !rejectInput.trim()}
                      onClick={() => handleReviewIdentity("REJECT", rejectInput)}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-xs italic">
              No identity document on record for this trip request.
            </p>
          )}
        </section>

        {/* Basics */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">Trip Basics</h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div suppressHydrationWarning><span className="text-slate-500">Start Date:</span> <span className="font-medium text-slate-900">{booking.customTripDetails?.startDate ? formatSriLankanDate(booking.customTripDetails.startDate) : 'N/A'}</span></div>
            <div suppressHydrationWarning><span className="text-slate-500">End Date:</span> <span className="font-medium text-slate-900">{booking.customTripDetails?.endDate ? formatSriLankanDate(booking.customTripDetails.endDate) : 'N/A'}</span></div>
            <div>
              <span className="text-slate-500">Budget:</span> 
              <span className="font-medium text-slate-900 ml-1">
                {booking.customTripDetails?.budget ? `${booking.customTripDetails.budgetCurrency || 'USD'} ${booking.customTripDetails.budget}` : 'Flexible'}
              </span>
              {booking.customTripDetails?.budget && (
                <div className="text-xs text-slate-500 mt-1">
                  Covers: {booking.customTripDetails.budgetCovers} | {booking.customTripDetails.budgetFlexibility}
                  {booking.customTripDetails.budgetNotes && <p className="italic text-amber-700 mt-1 bg-amber-50 p-1 rounded">"{booking.customTripDetails.budgetNotes}"</p>}
                </div>
              )}
            </div>
            <div><span className="text-slate-500">Vehicle Type:</span> <span className="font-medium text-slate-900">{booking.vehicleTypeId?.name || "Not specified"}</span></div>
          </div>
          <NoteField sectionKey="basics" label="Trip Basics" />
        </section>

        {/* Logistics */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">Arrival & Departure Logistics</h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="text-slate-500">Pickup Address:</span> <span className="font-medium text-slate-900">{booking.pickupAddress || 'N/A'}</span></div>
            <div><span className="text-slate-500">Pickup Time:</span> <span className="font-medium text-slate-900">{booking.arrivalTime || 'N/A'}</span></div>
            <div><span className="text-slate-500">Dropoff Address:</span> <span className="font-medium text-slate-900">{booking.destinationAddress || 'N/A'}</span></div>
            <div><span className="text-slate-500">Dropoff Time:</span> <span className="font-medium text-slate-900">{booking.customTripDetails?.dropoffTime || 'N/A'}</span></div>
          </div>
          <NoteField sectionKey="logistics" label="Logistics" />
        </section>

        {/* Itinerary */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">Itinerary</h2>
          <div className="space-y-6">
            {booking.customTripDetails?.itinerary?.map((day: any, index: number) => (
              <div key={index} className="border border-slate-100 rounded-lg p-4 bg-slate-50">
                <h3 className="font-bold text-slate-800 mb-2" suppressHydrationWarning>Day {day.dayNumber} - {formatSriLankanDate(day.date)}</h3>
                <div className="text-sm space-y-2 mb-4">
                  <p><span className="text-slate-500">Start:</span> {day.startingLocation?.address || 'N/A'}</p>
                  <p><span className="text-slate-500">Places to Visit:</span> {day.placesToVisit?.length > 0 ? day.placesToVisit.map((p: any) => p.name).join(", ") : 'None specified'}</p>
                  <p><span className="text-slate-500">Overnight:</span> {day.overnightLocation?.hotel || day.overnightLocation?.city || 'N/A'}</p>
                  {(day.distanceKm > 0 || day.drivingTimeMins > 0) && (
                    <p>
                      <span className="text-slate-500">Driving:</span> {day.distanceKm?.toFixed(1) || 0} km • {Math.round(day.drivingTimeMins || 0)} mins
                    </p>
                  )}
                  {day.notes && (
                    <p className="bg-amber-50 p-2 rounded border border-amber-100 text-amber-800"><span className="font-bold">Notes:</span> {day.notes}</p>
                  )}
                </div>
                <NoteField sectionKey={`day_${day.dayNumber}`} label={`Day ${day.dayNumber}`} />
              </div>
            ))}
            {(!booking.customTripDetails?.itinerary || booking.customTripDetails.itinerary.length === 0) && (
              <div className="text-slate-500 text-sm">No itinerary days specified.</div>
            )}
          </div>
        </section>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">Confirm Trip Price</h2>
          
          <div className="space-y-4 mb-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-sm font-semibold text-slate-700 mb-1">Rider's Proposed Budget:</p>
              {booking.customTripDetails?.budget ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-900">
                    {booking.customTripDetails.budgetCurrency || "USD"} {booking.customTripDetails.budget}
                  </span>
                  <span className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-full text-slate-500">
                    {booking.customTripDetails.budgetCovers || "Transport only"}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 italic">No budget proposed</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Pricing Option</label>
                <select 
                  value={priceMode} 
                  onChange={e => setPriceMode(e.target.value as "ACCEPT_BUDGET" | "CUSTOM_PRICE")}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {hasValidTransportBudget && <option value="ACCEPT_BUDGET">Accept rider's budget</option>}
                  <option value="CUSTOM_PRICE">Set a different price</option>
                </select>
              </div>
            </div>

            {priceMode === "CUSTOM_PRICE" && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Currency</label>
                  <select 
                    value={confirmedCurrency} 
                    onChange={e => setConfirmedCurrency(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="LKR">LKR</option>
                  </select>
                </div>
                <div className="flex-[2]">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Confirmed Total Amount</label>
                  <input 
                    type="number" 
                    value={confirmedAmount}
                    onChange={e => setConfirmedAmount(e.target.value)}
                    placeholder="E.g. 450"
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">This amount will be presented to the rider for payment. Payment cannot be changed once approved.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button 
            onClick={approveTrip}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <CheckCircle size={20} /> Request payment of {effectiveAmount || '0'} {effectiveCurrency}
          </button>
          
          <button 
            onClick={submitReview}
            disabled={loading}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Send size={20} /> Request Changes
          </button>

          <button 
            onClick={rejectTrip}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            Reject Trip
          </button>
        </div>
      </div>
    </div>
  );
}
