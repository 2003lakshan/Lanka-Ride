"use client";

import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  Trash2, 
  Archive, 
  X, 
  Loader2, 
  ShieldAlert, 
  CheckCircle,
  FileText
} from "lucide-react";
import PackageImage from "@/components/packages/PackageImage";

interface PackageSummary {
  _id: string;
  title: string;
  category?: string;
  coverPhoto?: string;
  driverName?: string;
  status?: string;
}

interface AdminPackageDeleteModalProps {
  pkg: PackageSummary;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: (packageId: string) => void;
  onArchived?: (packageId: string) => void;
}

export default function AdminPackageDeleteModal({
  pkg,
  isOpen,
  onClose,
  onDeleted,
  onArchived
}: AdminPackageDeleteModalProps) {
  const [checking, setChecking] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [linkedBookings, setLinkedBookings] = useState<number | null>(null);
  const [linkedEnquiries, setLinkedEnquiries] = useState<number | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);

  useEffect(() => {
    if (!isOpen || !pkg?._id) return;

    let isMounted = true;
    setChecking(true);
    setErrorMsg("");
    setShowReasonInput(false);
    setArchiveReason("");

    fetch(`/api/admin/packages/${pkg._id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.error) {
          setErrorMsg(data.error);
        } else {
          setLinkedBookings(data.linkedBookings ?? 0);
          setLinkedEnquiries(data.linkedEnquiries ?? 0);
          setCanDelete(Boolean(data.canDelete));
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg("Failed to verify package eligibility.");
      })
      .finally(() => {
        if (isMounted) setChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, pkg?._id]);

  if (!isOpen || !pkg) return null;

  const handleDelete = async () => {
    if (!canDelete) return;

    setActionLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/admin/packages/${pkg._id}`, {
        method: "DELETE"
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to permanently delete package.");
      } else {
        if (onDeleted) onDeleted(pkg._id);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg("A network error occurred while deleting the package.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    setActionLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/admin/packages/${pkg._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ARCHIVE",
          reason: archiveReason || "Archived by Administrator"
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to archive package.");
      } else {
        if (onArchived) onArchived(pkg._id);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg("A network error occurred while archiving the package.");
    } finally {
      setActionLoading(false);
    }
  };

  const hasLinkedHistory = (linkedBookings ?? 0) > 0 || (linkedEnquiries ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${hasLinkedHistory ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600"}`}>
              {hasLinkedHistory ? <Archive size={20} /> : <Trash2 size={20} />}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                {hasLinkedHistory ? "Package Deletion Restricted" : "Delete Tour Package"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Package Reference: {pkg._id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={actionLoading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Package Preview Card */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-200 border border-slate-200">
              <PackageImage
                src={pkg.coverPhoto}
                alt={pkg.title}
                category={pkg.category}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 text-sm truncate">{pkg.title}</h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] uppercase">
                  {pkg.category || "Tour"}
                </span>
                {pkg.driverName && <span className="truncate">By {pkg.driverName}</span>}
              </div>
            </div>
          </div>

          {/* Linked Record Verification Box */}
          {checking ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <span>Verifying linked bookings and enquiries...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3.5 rounded-2xl border ${linkedBookings ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-slate-50 border-slate-200 text-slate-800"}`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Linked Bookings</div>
                  <div className="text-xl font-black mt-0.5 flex items-center gap-1.5">
                    {linkedBookings ?? 0}
                    {linkedBookings && linkedBookings > 0 ? (
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">Protected</span>
                    ) : (
                      <CheckCircle size={14} className="text-emerald-500" />
                    )}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${linkedEnquiries ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-slate-50 border-slate-200 text-slate-800"}`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Linked Enquiries</div>
                  <div className="text-xl font-black mt-0.5 flex items-center gap-1.5">
                    {linkedEnquiries ?? 0}
                    {linkedEnquiries && linkedEnquiries > 0 ? (
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <CheckCircle size={14} className="text-emerald-500" />
                    )}
                  </div>
                </div>
              </div>

              {hasLinkedHistory ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-start gap-2.5 text-amber-900 font-bold text-xs sm:text-sm">
                    <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>Deletion blocked: Booking history exists</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed pl-7">
                    This package has recorded bookings or traveller enquiries. Permanent deletion is disabled to preserve traveller contracts, pricing snapshots, and audit trail integrity.
                  </p>
                  <p className="text-xs font-semibold text-amber-900 pl-7">
                    You can safely <strong>Archive</strong> this package. Archiving immediately removes it from public listings and prevents new bookings while preserving existing booking records.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                  <div className="flex items-start gap-2 text-rose-900 font-bold text-xs sm:text-sm">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    <span>Permanent Deletion Warning</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed pl-6">
                    This package has no linked bookings or enquiries and is eligible for permanent removal.
                  </p>
                  <ul className="text-xs text-rose-800 list-disc list-inside space-y-1 pl-6">
                    <li>The package document will be permanently deleted from the database.</li>
                    <li>Package-owned photos will be deleted from the server unless shared by another package or vehicle.</li>
                    <li>This action cannot be undone.</li>
                  </ul>
                </div>
              )}

              {/* Optional Archive Reason */}
              {(hasLinkedHistory || showReasonInput) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Archive Note / Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    placeholder="e.g., Seasonal tour retired for 2026"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>

          {hasLinkedHistory ? (
            <button
              type="button"
              onClick={handleArchive}
              disabled={actionLoading || checking}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Archiving...</span>
                </>
              ) : (
                <>
                  <Archive size={16} />
                  <span>Archive Package Instead</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              {!showReasonInput && (
                <button
                  type="button"
                  onClick={() => setShowReasonInput(true)}
                  disabled={actionLoading || checking}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Archive size={14} />
                  <span>Archive Instead</span>
                </button>
              )}

              {showReasonInput && (
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={actionLoading || checking}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                  <span>Confirm Archive</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading || checking || !canDelete}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

