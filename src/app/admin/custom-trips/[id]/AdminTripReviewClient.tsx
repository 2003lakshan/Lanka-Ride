"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle, 
  Send, 
  ArrowLeft, 
  FileText, 
  ExternalLink, 
  ShieldCheck, 
  AlertCircle, 
  XCircle, 
  CheckCircle2, 
  Loader2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Luggage,
  Car,
  History,
  MessageSquareQuote
} from "lucide-react";
import Link from "next/link";
import { formatSriLankanDate } from "@/lib/dateTime";

export default function AdminTripReviewClient({ booking }: { booking: any }) {
  const router = useRouter();
  const currentRevision = Number(booking.customTripDetails?.revision) || 1;
  const [tripStatus, setTripStatus] = useState<string>(booking.status || "PENDING_APPROVAL");
  const [reviewHistory, setReviewHistory] = useState<any[]>(
    booking.customTripDetails?.reviewHistory || []
  );

  const [loading, setLoading] = useState(false);
  const proposedBudget = booking.customTripDetails?.budget;
  const proposedCurrency = booking.customTripDetails?.budgetCurrency || "USD";
  const hasValidTransportBudget =
    proposedBudget &&
    Number(proposedBudget) > 0 &&
    booking.customTripDetails?.budgetCovers === "Transport only";

  const [priceMode, setPriceMode] = useState<"ACCEPT_BUDGET" | "CUSTOM_PRICE">(
    hasValidTransportBudget ? "ACCEPT_BUDGET" : "CUSTOM_PRICE"
  );
  const [confirmedAmount, setConfirmedAmount] = useState<string>(
    booking.customTripDetails?.confirmedAmount?.toString() || ""
  );
  const [confirmedCurrency, setConfirmedCurrency] = useState<string>(
    booking.customTripDetails?.confirmedCurrency || "USD"
  );

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

  // Request Changes Modal state
  const [showChangesModal, setShowChangesModal] = useState<boolean>(false);
  const [changesFeedback, setChangesFeedback] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [submittingChanges, setSubmittingChanges] = useState<boolean>(false);
  const [changesError, setChangesError] = useState<string>("");

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
          useRiderBudget: priceMode === "ACCEPT_BUDGET",
          expectedRevision: currentRevision,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTripStatus(data.status || "PENDING");
        alert("Trip approved and published to eligible drivers successfully!");
        router.push("/admin/custom-trips");
      } else if (res.status === 409) {
        alert(
          data.error ||
            "The rider updated or resubmitted their trip request while you were reviewing. Refreshing to inspect the latest revision."
        );
        router.refresh();
      } else {
        alert(data.error || "Failed to approve trip.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error occurred while approving trip.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleToggleDay = (dayNum: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  };

  const submitRequestChanges = async () => {
    if (!changesFeedback.trim()) {
      setChangesError("Please provide a clear explanation of the changes needed.");
      return;
    }

    setSubmittingChanges(true);
    setChangesError("");

    try {
      const res = await fetch("/api/admin/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking._id,
          action: "REQUEST_CHANGES",
          feedback: changesFeedback.trim(),
          affectedFields: selectedFields,
          affectedDays: selectedDays,
          expectedRevision: currentRevision,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTripStatus("CHANGES_REQUESTED");
        setShowChangesModal(false);
        alert("Changes requested successfully! The rider has been notified.");
        router.push("/admin/custom-trips");
      } else if (res.status === 409) {
        alert(
          data.error ||
            "The rider updated or resubmitted their trip request while you were reviewing. Refreshing to inspect the latest revision."
        );
        router.refresh();
      } else {
        setChangesError(data.error || "Failed to request changes.");
      }
    } catch {
      setChangesError("Network error occurred while requesting changes.");
    } finally {
      setSubmittingChanges(false);
    }
  };

  const itineraryDays = booking.customTripDetails?.itinerary || [];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      {/* Top Navigation & Status Bar */}
      <div className="mb-6">
        <Link
          href="/admin/custom-trips"
          className="text-blue-600 hover:underline inline-flex items-center gap-1.5 text-xs font-bold mb-3"
        >
          <ArrowLeft size={16} /> Back to Custom Trips Management
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {booking.bookingReference}
              </h1>
              <span className="text-xs font-extrabold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md">
                Revision {currentRevision}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Submitted on {formatSriLankanDate(booking.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tripStatus === "PENDING_APPROVAL" ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold bg-amber-500 text-white shadow-xs">
                <Clock size={13} />
                Trip: Awaiting Admin Review
              </span>
            ) : tripStatus === "CHANGES_REQUESTED" ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold bg-orange-600 text-white shadow-xs">
                <AlertCircle size={13} />
                Trip: Changes Requested
              </span>
            ) : tripStatus === "DRIVER_ASSIGNED" ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-xs">
                <Car size={13} />
                Trip: Driver Assigned
              </span>
            ) : tripStatus === "PENDING" && booking.approvedAt ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                <CheckCircle2 size={13} />
                Trip: Approved &bull; Available to Drivers
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                Trip: {tripStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Active Change Request Notice */}
      {tripStatus === "CHANGES_REQUESTED" && booking.customTripDetails?.changeRequest && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
          <div className="flex items-center gap-2 text-orange-900 font-bold text-sm">
            <AlertCircle size={18} className="text-orange-600" />
            <span>Changes Currently Requested from Rider</span>
          </div>
          <p className="text-xs font-semibold text-orange-950 bg-white p-3 rounded-xl border border-orange-200 mt-2">
            &ldquo;{booking.customTripDetails.changeRequest.feedback}&rdquo;
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {booking.customTripDetails.changeRequest.affectedFields?.map((f: string) => (
              <span key={f} className="text-[10px] font-bold px-2 py-0.5 bg-orange-200 text-orange-900 rounded-md">
                Area: {f}
              </span>
            ))}
            {booking.customTripDetails.changeRequest.affectedDays?.map((d: number) => (
              <span key={d} className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-950 rounded-md">
                Day {d}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* =========================================================
            SECTION 1: Booking Contact & Passenger Details
        ========================================================= */}
        <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2 flex items-center justify-between">
            <span>Booking Contact &amp; Passenger</span>
            {booking.customTripDetails?.bookingContact?.isBookingForSomeoneElse && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                Booked For Someone Else
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Booking Contact (Account Holder)
              </p>
              <div>
                <span className="text-slate-500 text-xs">Name:</span>{" "}
                <span className="font-bold text-slate-900">
                  {booking.customTripDetails?.bookingContact?.fullName ||
                    booking.passengerDetails?.fullName ||
                    "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Country:</span>{" "}
                <span className="font-medium text-slate-900">
                  {booking.customTripDetails?.bookingContact?.country ||
                    booking.passengerDetails?.country ||
                    "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Verified Email:</span>{" "}
                <span className="font-medium text-slate-900">
                  {booking.customTripDetails?.bookingContact?.email ||
                    booking.passengerDetails?.email ||
                    "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Contact Phone:</span>{" "}
                <span className="font-medium text-slate-900">
                  {booking.customTripDetails?.bookingContact?.phone ||
                    booking.passengerDetails?.whatsappNumber ||
                    "N/A"}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Travelling Passenger
              </p>
              {booking.customTripDetails?.bookingContact?.isBookingForSomeoneElse ? (
                <>
                  <div>
                    <span className="text-slate-500 text-xs">Passenger Name:</span>{" "}
                    <span className="font-bold text-slate-900">
                      {booking.customTripDetails.bookingContact.passenger?.fullName || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Passenger Mobile:</span>{" "}
                    <span className="font-bold text-slate-900">
                      {booking.customTripDetails.bookingContact.passenger?.phone || "N/A"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Driver will coordinate on-the-ground pickups directly with this passenger.
                  </p>
                </>
              ) : (
                <div className="py-2">
                  <p className="font-medium text-slate-800 text-xs">
                    Primary contact is also the travelling passenger.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 2: Identity Document Verification Review
        ========================================================= */}
        <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={20} />
              <span>Identity Document Verification</span>
            </h2>
            <div className="flex items-center gap-2">
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

              {idVerification?.identityId && (
                <Link
                  href={`/admin/identity-reviews/${idVerification.identityId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
                >
                  <ExternalLink size={12} />
                  <span>Open in ID Dashboard</span>
                </Link>
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
                  <span className="text-[10px] font-bold uppercase text-slate-500">Document Type</span>
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
                      <span className="text-xs font-bold text-slate-500 uppercase">Passport Photo &amp; Details Page</span>
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

              {/* Admin Identity Review Action Buttons */}
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

        {/* =========================================================
            SECTION 3: Trip Basics, Dates, Passengers, Vehicle
        ========================================================= */}
        <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2 flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <span>Trip Basics &amp; Vehicle Preference</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs mb-4">
            <div>
              <span className="text-slate-500 font-semibold block">Start Date:</span>
              <span className="font-bold text-slate-900 text-sm" suppressHydrationWarning>
                {booking.customTripDetails?.startDate
                  ? formatSriLankanDate(booking.customTripDetails.startDate)
                  : booking.arrivalDate
                  ? formatSriLankanDate(booking.arrivalDate)
                  : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">End Date:</span>
              <span className="font-bold text-slate-900 text-sm" suppressHydrationWarning>
                {booking.customTripDetails?.endDate
                  ? formatSriLankanDate(booking.customTripDetails.endDate)
                  : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Vehicle Selected:</span>
              <span className="font-bold text-slate-900 text-sm">
                {booking.vehicleTypeId?.name || "Standard Vehicle"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Adult Passengers:</span>
              <span className="font-bold text-slate-900 text-sm">
                {booking.passengerDetails?.adults ?? 2} Adults
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Children:</span>
              <span className="font-bold text-slate-900 text-sm">
                {booking.passengerDetails?.children ?? 0} Children
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Luggage Bags:</span>
              <span className="font-bold text-slate-900 text-sm">
                {booking.passengerDetails?.luggage ?? 2} Bags
              </span>
            </div>
          </div>

          {/* Budget Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Rider's Proposed Budget:</span>
              <span className="font-extrabold text-slate-900 text-sm">
                {booking.customTripDetails?.budget
                  ? `${booking.customTripDetails.budgetCurrency || "USD"} ${booking.customTripDetails.budget}`
                  : "Flexible"}
              </span>
            </div>
            {booking.customTripDetails?.budget && (
              <p className="text-slate-500">
                Covers: {booking.customTripDetails.budgetCovers || "Transport only"} &bull; Flexibility: {booking.customTripDetails.budgetFlexibility || "Negotiable"}
              </p>
            )}
            {booking.customTripDetails?.budgetNotes && (
              <p className="italic text-amber-800 bg-amber-50 p-2 rounded border border-amber-200/60 mt-2">
                <strong>Rider Note:</strong> &ldquo;{booking.customTripDetails.budgetNotes}&rdquo;
              </p>
            )}
          </div>
        </section>

        {/* =========================================================
            SECTION 4: Logistics & Routes
        ========================================================= */}
        <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2 flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            <span>Pickup &amp; Drop-off Logistics</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Pickup Location
              </span>
              <p className="font-bold text-slate-900 text-sm mb-1">{booking.pickupAddress || "N/A"}</p>
              <p className="text-slate-600">Time: {booking.arrivalTime || "N/A"}</p>
              {booking.flightNumber && <p className="text-slate-600">Flight: {booking.flightNumber}</p>}
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Drop-off Location
              </span>
              <p className="font-bold text-slate-900 text-sm mb-1">{booking.destinationAddress || "N/A"}</p>
              <p className="text-slate-600">Time: {booking.customTripDetails?.dropoffTime || "N/A"}</p>
              {booking.customTripDetails?.dropoffFlightNumber && (
                <p className="text-slate-600">Flight: {booking.customTripDetails.dropoffFlightNumber}</p>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 5: Daily Itinerary
        ========================================================= */}
        <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2 flex items-center justify-between">
            <span>Daily Itinerary ({itineraryDays.length} Days)</span>
            {booking.distanceKm > 0 && (
              <span className="text-xs font-bold text-slate-500">
                Total Route: {booking.distanceKm.toFixed(1)} km &bull; {Math.round(booking.durationMins || 0)} mins
              </span>
            )}
          </h2>
          <div className="space-y-4">
            {itineraryDays.map((day: any, index: number) => (
              <div key={index} className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h3 className="font-bold text-slate-900 text-sm" suppressHydrationWarning>
                    Day {day.dayNumber} - {formatSriLankanDate(day.date)}
                  </h3>
                  {(day.distanceKm > 0 || day.drivingTimeMins > 0) && (
                    <span className="text-[11px] font-bold text-slate-500">
                      {day.distanceKm?.toFixed(1) || 0} km &bull; {Math.round(day.drivingTimeMins || 0)} mins
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-slate-700">
                  <p>
                    <strong className="text-slate-900">Start:</strong> {day.startingLocation?.address || "N/A"}
                  </p>
                  <p>
                    <strong className="text-slate-900">Places to Visit:</strong>{" "}
                    {day.placesToVisit?.length > 0
                      ? day.placesToVisit.map((p: any) => p.name).join(", ")
                      : "None specified"}
                  </p>
                  <p>
                    <strong className="text-slate-900">Overnight:</strong>{" "}
                    {day.overnightLocation?.hotel || day.overnightLocation?.city || "N/A"}
                  </p>
                  {day.notes && (
                    <p className="bg-amber-50 p-2 rounded border border-amber-200/60 text-amber-900 mt-2">
                      <strong>Day Notes:</strong> {day.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {itineraryDays.length === 0 && (
              <p className="text-slate-400 text-xs italic">No itinerary days specified.</p>
            )}
          </div>
        </section>

        {/* =========================================================
            SECTION 6: Review History Timeline
        ========================================================= */}
        {reviewHistory.length > 0 && (
          <section className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4 border-b pb-2 flex items-center gap-2">
              <History size={18} className="text-blue-600" />
              <span>Review History &amp; Revisions</span>
            </h2>
            <div className="space-y-3">
              {reviewHistory.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        item.action === "APPROVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.action === "REQUEST_CHANGES"
                          ? "bg-orange-100 text-orange-900"
                          : "bg-blue-100 text-blue-900"
                      }`}
                    >
                      {item.action === "APPROVE"
                        ? "Trip Approved"
                        : item.action === "REQUEST_CHANGES"
                        ? "Changes Requested"
                        : "Resubmitted by Rider"}
                    </span>
                    <span className="text-slate-400 text-[11px]" suppressHydrationWarning>
                      {formatSriLankanDate(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium">
                    {item.actorName || item.actorRole || "System"}: {item.feedback}
                  </p>
                  {item.revision && (
                    <span className="text-[10px] text-slate-400">
                      Revision: v{item.revision}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =========================================================
            SECTION 7: Pricing Confirmation & Publishing
        ========================================================= */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-3 border-b pb-2">
            Confirm Pricing &amp; Publish to Drivers
          </h2>

          <div className="space-y-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pricing Method
                </label>
                <select
                  value={priceMode}
                  onChange={(e) =>
                    setPriceMode(e.target.value as "ACCEPT_BUDGET" | "CUSTOM_PRICE")
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {hasValidTransportBudget && (
                    <option value="ACCEPT_BUDGET">
                      Accept rider's proposed budget ({proposedCurrency} {proposedBudget})
                    </option>
                  )}
                  <option value="CUSTOM_PRICE">Specify custom confirmed price</option>
                </select>
              </div>
            </div>

            {priceMode === "CUSTOM_PRICE" && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/3">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={confirmedCurrency}
                    onChange={(e) => setConfirmedCurrency(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="LKR">LKR</option>
                  </select>
                </div>
                <div className="w-full sm:w-2/3">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirmed Price Amount *
                  </label>
                  <input
                    type="number"
                    value={confirmedAmount}
                    onChange={(e) => setConfirmedAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 mb-4">
            Approving publishes this custom tour to eligible approved drivers and notifies the rider that their trip is ready for driver acceptance.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={approveTrip}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm cursor-pointer shadow-xs"
            >
              <CheckCircle size={18} />
              <span>
                Approve Trip &amp; Publish for {effectiveCurrency} {effectiveAmount || "0"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowChangesModal(true);
                setChangesError("");
              }}
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm cursor-pointer shadow-xs"
            >
              <Send size={18} />
              <span>Request Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          REQUEST CHANGES MODAL
      ========================================================= */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Send size={18} className="text-amber-500" />
                <span>Request Trip Changes (Revision {currentRevision})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                &times;
              </button>
            </div>

            {changesError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200">
                {changesError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Explanation for Rider (Required) *
              </label>
              <textarea
                rows={3}
                value={changesFeedback}
                onChange={(e) => setChangesFeedback(e.target.value)}
                placeholder="e.g. Please clarify your pickup time for Day 1 and update the hotel destination in Kandy."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Affected Fields (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: "contact", label: "Contact & Passenger" },
                  { id: "basics", label: "Trip Basics & Dates" },
                  { id: "logistics", label: "Pickup / Drop-off" },
                  { id: "itinerary", label: "Itinerary & Places" },
                  { id: "budget", label: "Budget & Pricing" },
                ].map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.id)}
                      onChange={() => handleToggleField(field.id)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-slate-800 font-medium text-[11px]">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {itineraryDays.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Affected Itinerary Days (Optional)
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {itineraryDays.map((d: any) => (
                    <label
                      key={d.dayNumber}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        selectedDays.includes(d.dayNumber)
                          ? "bg-amber-100 border-amber-300 text-amber-900"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedDays.includes(d.dayNumber)}
                        onChange={() => handleToggleDay(d.dayNumber)}
                      />
                      <span>Day {d.dayNumber}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingChanges || !changesFeedback.trim()}
                onClick={submitRequestChanges}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submittingChanges ? <Loader2 size={13} className="animate-spin" /> : <Send size={14} />}
                <span>Send Change Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
