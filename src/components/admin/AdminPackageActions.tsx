"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, MessageSquare } from "lucide-react";

interface AdminPackageActionsProps {
  packageId: string;
  status: string;
  revision?: number;
}

export default function AdminPackageActions({ packageId, status, revision = 1 }: AdminPackageActionsProps) {
  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState<"CHANGES" | "REJECT" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

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

  const handleAction = async (action: "APPROVE" | "REQUEST_CHANGES" | "REJECT", customText?: string) => {
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
      }

      const res = await fetch(`/api/admin/packages/${packageId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 409) {
          alert(`Conflict: ${data.error}`);
        } else {
          setErrorMsg(data.error || "Failed to process review.");
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
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {status !== "PUBLISHED" && (
          <button
            onClick={() => handleAction("APPROVE")}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle size={18} />
            <span>{loading ? "Processing..." : "Approve & Publish"}</span>
          </button>
        )}

        {status === "PUBLISHED" && (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <CheckCircle size={16} /> Live & Published (v{revision})
          </span>
        )}

        <button
          onClick={() => {
            setErrorMsg("");
            setFeedbackText("");
            setModalMode("CHANGES");
          }}
          disabled={loading}
          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3.5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <MessageSquare size={16} />
          <span>Request Changes</span>
        </button>

        {status !== "REJECTED" && (
          <button
            onClick={() => {
              setErrorMsg("");
              setFeedbackText("");
              setModalMode("REJECT");
            }}
            disabled={loading}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <XCircle size={16} />
            <span>Reject Package</span>
          </button>
        )}
      </div>

      {/* Modal for Requesting Changes or Rejecting */}
      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              {modalMode === "CHANGES" ? (
                <>
                  <MessageSquare className="text-amber-600" />
                  Request Package Changes
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
                ? "Provide detailed feedback explaining what the driver needs to adjust (e.g. pricing basis, vehicle capacity, or itinerary details). The driver can edit and resubmit."
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
                {modalMode === "CHANGES" ? "Change Request Feedback *" : "Rejection Reason *"}
              </label>
              <textarea
                rows={4}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={
                  modalMode === "CHANGES"
                    ? "e.g., Please clarify whether admission tickets to Sigiriya are included, and specify the day 2 overnight location."
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
                onClick={() => handleAction(modalMode === "CHANGES" ? "REQUEST_CHANGES" : "REJECT", feedbackText)}
                disabled={loading || !feedbackText.trim()}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer ${
                  modalMode === "CHANGES" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {loading ? "Submitting..." : modalMode === "CHANGES" ? "Send Change Request" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
