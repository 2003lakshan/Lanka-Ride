"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  MessageSquare, 
  Archive, 
  RotateCcw, 
  Trash2, 
  Loader2 
} from "lucide-react";
import AdminPackageDeleteModal from "./AdminPackageDeleteModal";
import WhatsAppActionButton from "@/components/whatsapp/WhatsAppActionButton";

interface AdminPackageActionsProps {
  packageId: string;
  status: string;
  revision?: number;
  packageTitle?: string;
  category?: string;
  coverPhoto?: string;
  driverName?: string;
}

export default function AdminPackageActions({ 
  packageId, 
  status, 
  revision = 1,
  packageTitle = "Tour Package",
  category,
  coverPhoto,
  driverName
}: AdminPackageActionsProps) {
  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState<"CHANGES" | "REJECT" | "ARCHIVE" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const router = useRouter();

  const isArchived = status === "ARCHIVED";

  const STANDARD_SECTIONS = [
    "Basics & Photos",
    "Itinerary & Logistics",
    "Hotel Details & Meals",
    "Vehicle & Pricing",
    "Amenities & Refreshments",
    "Inclusions & Exclusions",
    "Policies & Terms",
    "Driver Profile Info"
  ];

  const toggleSection = (section: string) => {
    setSelectedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const handleAction = async (action: "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "ARCHIVE" | "RESTORE", customText?: string) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const payload: any = {
        action,
        expectedRevision: revision
      };

      if (action === "REQUEST_CHANGES") {
        if (!customText?.trim()) {
          setErrorMsg("Please provide feedback explaining the changes required.");
          setLoading(false);
          return;
        }
        payload.feedback = customText.trim();
        payload.affectedSections = selectedSections;
      } else if (action === "REJECT") {
        if (!customText?.trim()) {
          setErrorMsg("Please provide a reason for rejection.");
          setLoading(false);
          return;
        }
        payload.reason = customText.trim();
      } else if (action === "ARCHIVE") {
        payload.reason = customText?.trim() || "Archived by Administrator";
      }

      // Use the comprehensive admin package endpoint
      const endpoint = (action === "ARCHIVE" || action === "RESTORE")
        ? `/api/admin/packages/${packageId}`
        : `/api/admin/packages/${packageId}/approve`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 409) {
          alert(`Conflict: ${data.error}`);
        } else {
          setErrorMsg(data.error || "Failed to process review action.");
        }
      } else {
        setModalMode(null);
        setFeedbackText("");
        router.refresh();
      }
    } catch (error: any) {
      setErrorMsg("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {/* Approve & Publish (only if not published and not archived) */}
        {!isArchived && status !== "PUBLISHED" && (
          <button
            onClick={() => handleAction("APPROVE")}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle size={16} />
            <span>{loading ? "Processing..." : "Approve & Publish"}</span>
          </button>
        )}

        {status === "PUBLISHED" && (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <CheckCircle size={15} /> Live & Published (v{revision})
          </span>
        )}

        {/* Request Changes (only if not archived) */}
        {!isArchived && (
          <button
            onClick={() => {
              setErrorMsg("");
              setFeedbackText("");
              setModalMode("CHANGES");
            }}
            disabled={loading}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <MessageSquare size={15} />
            <span>Request Changes</span>
          </button>
        )}

        {/* Reject Package (only if not rejected and not archived) */}
        {!isArchived && status !== "REJECTED" && (
          <button
            onClick={() => {
              setErrorMsg("");
              setFeedbackText("");
              setModalMode("REJECT");
            }}
            disabled={loading}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <XCircle size={15} />
            <span>Reject</span>
          </button>
        )}

        {/* Archive or Restore */}
        {isArchived ? (
          <button
            onClick={() => handleAction("RESTORE")}
            disabled={loading}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            <span>Restore Package</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setErrorMsg("");
              setFeedbackText("");
              setModalMode("ARCHIVE");
            }}
            disabled={loading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Archive size={15} />
            <span>Archive</span>
          </button>
        )}

        {/* WhatsApp Driver Notification */}
        <WhatsAppActionButton
          packageId={packageId}
          packageStatus={status}
          buttonLabel="WhatsApp Driver"
        />

        {/* Delete Package (Opens confirmation modal with checks) */}
        <button
          onClick={() => setDeleteModalOpen(true)}
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
      </div>

      {/* Delete/Archive Guard Confirmation Modal */}
      <AdminPackageDeleteModal
        pkg={{
          _id: packageId,
          title: packageTitle,
          category,
          coverPhoto,
          driverName,
          status
        }}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={() => {
          router.push("/admin/packages");
        }}
        onArchived={() => {
          router.refresh();
        }}
      />

      {/* Modal for Requesting Changes, Rejecting, or Archiving */}
      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              {modalMode === "CHANGES" ? (
                <>
                  <MessageSquare className="text-amber-600" />
                  Request Package Changes
                </>
              ) : modalMode === "ARCHIVE" ? (
                <>
                  <Archive className="text-slate-700" />
                  Archive Tour Package
                </>
              ) : (
                <>
                  <AlertCircle className="text-rose-600" />
                  Reject Package
                </>
              )}
            </h3>
            
            <p className="text-sm text-slate-600 mb-4">
              {modalMode === "CHANGES"
                ? "Provide detailed feedback explaining what the driver needs to adjust. The driver can edit and resubmit."
                : modalMode === "ARCHIVE"
                ? "Archiving will hide this package from traveller discovery and prevent new bookings. Existing bookings remain intact."
                : "State the specific reason for rejecting this travel package. This will be sent directly to the driver."}
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-semibold border border-red-200">
                {errorMsg}
              </div>
            )}

            {modalMode === "CHANGES" && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Affected Sections (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  {STANDARD_SECTIONS.map((sec) => {
                    const checked = selectedSections.includes(sec);
                    return (
                      <label
                        key={sec}
                        className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                          checked ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSection(sec)}
                          className="w-3.5 h-3.5 text-amber-600 rounded"
                        />
                        <span className="truncate">{sec}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {modalMode === "CHANGES"
                  ? "Change Request Feedback *"
                  : modalMode === "ARCHIVE"
                  ? "Archive Note / Reason (Optional)"
                  : "Rejection Reason *"}
              </label>
              <textarea
                rows={modalMode === "ARCHIVE" ? 3 : 4}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={
                  modalMode === "CHANGES"
                    ? "e.g., Please clarify whether admission tickets to Sigiriya are included, and specify the day 2 overnight location."
                    : modalMode === "ARCHIVE"
                    ? "e.g., Seasonal tour retired for this year."
                    : "e.g., Package does not meet quality guidelines or pricing is significantly inconsistent with vehicle type."
                }
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(modalMode === "CHANGES" ? "REQUEST_CHANGES" : (modalMode as "REJECT" | "ARCHIVE"), feedbackText)}
                disabled={loading || ((modalMode === "CHANGES" || modalMode === "REJECT") && !feedbackText.trim())}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer ${
                  modalMode === "CHANGES" 
                    ? "bg-amber-600 hover:bg-amber-700" 
                    : modalMode === "ARCHIVE"
                    ? "bg-slate-800 hover:bg-slate-900"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {loading
                  ? "Submitting..."
                  : modalMode === "CHANGES"
                  ? "Send Change Request"
                  : modalMode === "ARCHIVE"
                  ? "Confirm Archive"
                  : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
