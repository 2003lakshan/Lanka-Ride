"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  ShieldCheck, 
  IdCard, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  FileText, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  User as UserIcon, 
  Loader2,
  AlertCircle,
  Eye
} from "lucide-react";

interface AdminIdentityReviewDetailClientProps {
  identity: any;
  rider: any;
  bookings: any[];
}

export default function AdminIdentityReviewDetailClient({
  identity,
  rider,
  bookings,
}: AdminIdentityReviewDetailClientProps) {
  const router = useRouter();

  const [status, setStatus] = useState<string>(identity.status || "PENDING_REVIEW");
  const [version, setVersion] = useState<number>(identity.version || 1);
  const [rejectionReason, setRejectionReason] = useState<string>(identity.rejectionReason || "");
  const [reviewedBy, setReviewedBy] = useState<any>(identity.reviewedBy);
  const [reviewedAt, setReviewedAt] = useState<string | null>(identity.reviewedAt || null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectInput, setRejectInput] = useState("");
  const [rejectError, setRejectError] = useState("");

  const handleReviewAction = async (action: "APPROVE" | "REJECT", reason?: string) => {
    setFeedback(null);
    setRejectError("");

    if (action === "REJECT" && (!reason || !reason.trim())) {
      setRejectError("Please provide a specific reason explaining why the document was rejected.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/identity-documents/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId: identity._id,
          action,
          rejectionReason: reason?.trim(),
          expectedVersion: version,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(data.status);
        if (data.version) setVersion(data.version);
        if (data.reviewedAt) setReviewedAt(data.reviewedAt);

        if (action === "REJECT") {
          setRejectionReason(reason?.trim() || "");
          setShowRejectModal(false);
          setRejectInput("");
          setFeedback({
            type: "success",
            message: "Identity document rejected successfully. The rider has been notified to re-upload.",
          });
        } else {
          setRejectionReason("");
          setFeedback({
            type: "success",
            message: "Identity document approved successfully! The rider's verified status is now active.",
          });
        }
        router.refresh();
      } else if (res.status === 409) {
        alert(
          data.error ||
          "The rider has uploaded or replaced their document while you were reviewing. The page will refresh to display the latest files."
        );
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to update identity review status.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "A network error occurred while submitting your review decision.",
      });
    } finally {
      setLoading(false);
    }
  };

  const isPending = status === "PENDING_REVIEW";
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";

  const files = identity.files || {};
  const isNationalId = identity.documentType === "NATIONAL_ID";

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/identity-reviews"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Back to Custom Trip</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Identity Verification Record
            </span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Version {version}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <IdCard className="text-blue-600" size={26} />
            <span>{rider?.name || "Rider Identity"}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Document Type: <strong className="text-slate-800">{isNationalId ? "National ID Card" : "Passport"}</strong> • 
            Submitted on {new Date(identity.updatedAt || identity.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Current Review Status Badge */}
        <div>
          {isPending && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
              <Clock size={16} className="text-amber-600 animate-pulse" />
              <span>Pending Review</span>
            </span>
          )}
          {isApproved && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Approved</span>
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-red-50 text-red-800 border border-red-200 shadow-xs">
              <XCircle size={16} className="text-red-600" />
              <span>Rejected</span>
            </span>
          )}
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 border ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Grid: Left Rider Profile & Metadata, Right Document Previews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Rider Profile Details */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
              <UserIcon size={16} className="text-blue-600" />
              Rider Profile
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Full Name</span>
                <span className="text-sm font-bold text-slate-900">{rider?.name || "N/A"}</span>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold flex items-center gap-1">
                  <Mail size={12} /> Email Address
                </span>
                <span className="font-medium text-slate-800 break-all">{rider?.email || "N/A"}</span>
                {rider?.isEmailVerified && (
                  <span className="inline-block ml-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                    Verified
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block font-semibold flex items-center gap-1">
                  <Phone size={12} /> Mobile Number
                </span>
                <span className="font-medium text-slate-800">{rider?.phoneNumber || "Not provided"}</span>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold flex items-center gap-1">
                  <MapPin size={12} /> Country of Residence
                </span>
                <span className="font-medium text-slate-800">{rider?.nationality || "Not provided"}</span>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold flex items-center gap-1">
                  <Calendar size={12} /> Registered On
                </span>
                <span className="font-medium text-slate-800">
                  {rider?.createdAt ? new Date(rider.createdAt).toLocaleDateString() : "N/A"}
                </span>
              </div>

              <div className="pt-2">
                <Link
                  href={`/admin/users/${rider?._id || ""}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold hover:underline"
                >
                  <span>Open Full Rider Account</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          </div>

          {/* Audit Trail Card */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs space-y-2.5">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Verification Audit Details
            </h3>
            <div className="space-y-1.5 text-slate-600">
              <div>
                <span className="text-slate-400">Current Version:</span>{" "}
                <strong className="text-slate-800">v{version}</strong>
              </div>
              {identity.reviewedVersion && (
                <div>
                  <span className="text-slate-400">Approved Version:</span>{" "}
                  <strong className="text-slate-800">v{identity.reviewedVersion}</strong>
                </div>
              )}
              {reviewedBy && (
                <div>
                  <span className="text-slate-400">Reviewed By:</span>{" "}
                  <strong className="text-slate-800">{reviewedBy.name || reviewedBy.email || "Admin"}</strong>
                </div>
              )}
              {reviewedAt && (
                <div>
                  <span className="text-slate-400">Reviewed Date:</span>{" "}
                  <strong className="text-slate-800">{new Date(reviewedAt).toLocaleString()}</strong>
                </div>
              )}
              {rejectionReason && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
                  <span className="font-bold block mb-0.5">Rejection Reason:</span>
                  <span>{rejectionReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Linked Custom Trips */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Linked Custom Trips ({bookings?.length || 0})
            </h3>
            {bookings && bookings.length > 0 ? (
              <div className="space-y-2">
                {bookings.map((b: any) => (
                  <div key={b._id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{b.bookingReference}</span>
                      <span className="text-[11px] text-slate-500">{b.status}</span>
                    </div>
                    <Link
                      href={`/admin/custom-trips/${b._id}`}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-1"
                    >
                      <span>Trip Review</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No custom trip submitted yet. Reviewing proactive identity upload before trip submission.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (Span 2): Protected Document Previews & Review Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Files Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b pb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={18} />
                <span>Uploaded Document Files</span>
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {isNationalId ? "National ID Card (Front & Back)" : "Passport (Photo & Details Page)"}
              </span>
            </div>

            {/* Document Files List / Grid */}
            <div className="space-y-4">
              {isNationalId ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* National ID Front */}
                  <div className="p-4 border rounded-xl bg-slate-50/70 border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-slate-500">National ID — Front</span>
                        {files.front && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Available
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-2 truncate">
                        {files.front?.originalName || "No file uploaded"}
                      </p>
                      {files.front?.size && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(files.front.size / (1024 * 1024)).toFixed(2)} MB • {files.front.mimeType}
                        </p>
                      )}
                    </div>

                    {files.front?.viewUrl && (
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <a
                          href={files.front.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 shadow-2xs transition-colors"
                        >
                          <Eye size={14} />
                          <span>View Protected Document</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* National ID Back */}
                  <div className="p-4 border rounded-xl bg-slate-50/70 border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-slate-500">National ID — Back</span>
                        {files.back && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Available
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-2 truncate">
                        {files.back?.originalName || "No file uploaded"}
                      </p>
                      {files.back?.size && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(files.back.size / (1024 * 1024)).toFixed(2)} MB • {files.back.mimeType}
                        </p>
                      )}
                    </div>

                    {files.back?.viewUrl && (
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <a
                          href={files.back.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 shadow-2xs transition-colors"
                        >
                          <Eye size={14} />
                          <span>View Protected Document</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Passport Photo Page */
                <div className="p-4 border rounded-xl bg-slate-50/70 border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase text-slate-500">Passport Photo & Details Page</span>
                      {files.photoPage && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Available
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1 truncate">
                      {files.photoPage?.originalName || "No file uploaded"}
                    </p>
                    {files.photoPage?.size && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(files.photoPage.size / (1024 * 1024)).toFixed(2)} MB • {files.photoPage.mimeType}
                      </p>
                    )}
                  </div>

                  {files.photoPage?.viewUrl && (
                    <a
                      href={files.photoPage.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-2xs transition-colors"
                    >
                      <Eye size={14} />
                      <span>View Protected Document</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Admin Review Action Controls */}
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
                Review Decision Controls
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={loading || isApproved}
                  onClick={() => handleReviewAction("APPROVE")}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>{isApproved ? "Document Approved" : "Approve Identity Document"}</span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setShowRejectModal(!showRejectModal);
                    setRejectError("");
                  }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-extrabold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <XCircle size={16} />
                  <span>Reject with Reason</span>
                </button>
              </div>

              {/* Rejection Form Dropdown / Modal */}
              {showRejectModal && (
                <div className="mt-4 p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold text-red-900">
                      Reason for Rejection * (visible to the rider)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(false)}
                      className="text-xs text-red-500 hover:text-red-700 font-bold"
                    >
                      Cancel
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={rejectInput}
                    onChange={(e) => {
                      setRejectInput(e.target.value);
                      if (rejectError) setRejectError("");
                    }}
                    placeholder="e.g. Back image is blurry, name does not match booking contact, or document is expired..."
                    className="w-full p-2.5 text-xs bg-white border border-red-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                  />

                  {rejectError && (
                    <p className="text-[11px] font-bold text-red-600">{rejectError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleReviewAction("REJECT", rejectInput)}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={14} />}
                      <span>Confirm Rejection</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

