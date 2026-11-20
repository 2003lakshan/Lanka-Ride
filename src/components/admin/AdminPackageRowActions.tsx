"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Archive, RotateCcw, Trash2, Loader2, Check } from "lucide-react";
import AdminPackageDeleteModal from "./AdminPackageDeleteModal";

interface AdminPackageRowActionsProps {
  packageId: string;
  title: string;
  category?: string;
  coverPhoto?: string;
  driverName?: string;
  status: string;
  revision?: number;
}

export default function AdminPackageRowActions({
  packageId,
  title,
  category,
  coverPhoto,
  driverName,
  status,
  revision = 1
}: AdminPackageRowActionsProps) {
  const router = useRouter();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState<string | null>(null);

  const isArchived = status === "ARCHIVED";

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setQuickSuccess(null);

    try {
      const res = await fetch(`/api/admin/packages/${packageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE" })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to restore package.");
      } else {
        setQuickSuccess("Restored");
        setTimeout(() => setQuickSuccess(null), 2500);
        router.refresh();
      }
    } catch (err) {
      alert("A network error occurred while restoring the package.");
    } finally {
      setRestoring(false);
    }
  };

  const handleQuickArchive = async () => {
    if (archiving) return;
    const confirmed = window.confirm(`Archive "${title}"? It will be removed from traveller listings and new bookings.`);
    if (!confirmed) return;

    setArchiving(true);
    setQuickSuccess(null);

    try {
      const res = await fetch(`/api/admin/packages/${packageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ARCHIVE",
          reason: "Archived via tour packages management table"
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to archive package.");
      } else {
        setQuickSuccess("Archived");
        setTimeout(() => setQuickSuccess(null), 2500);
        router.refresh();
      }
    } catch (err) {
      alert("A network error occurred while archiving the package.");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1.5 flex-wrap">
        {quickSuccess && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 animate-in fade-in">
            <Check size={12} /> {quickSuccess}
          </span>
        )}

        {/* Review / View Details */}
        <Link
          href={`/admin/packages/${packageId}`}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors text-xs"
          title="Inspect & Review Package"
        >
          <Eye size={13} />
          <span>Review</span>
        </Link>

        {/* Archive or Restore */}
        {isArchived ? (
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring}
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition-colors text-xs disabled:opacity-50 cursor-pointer"
            title="Restore Package to Active Status"
          >
            {restoring ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            <span>Restore</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuickArchive}
            disabled={archiving}
            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-xl transition-colors text-xs disabled:opacity-50 cursor-pointer"
            title="Archive Package (Hide from Travellers)"
          >
            {archiving ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
            <span>Archive</span>
          </button>
        )}

        {/* Permanent Delete Trigger (Opens Modal) */}
        <button
          type="button"
          onClick={() => setDeleteModalOpen(true)}
          className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-xl transition-colors text-xs cursor-pointer"
          title="Delete Package"
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>

      <AdminPackageDeleteModal
        pkg={{
          _id: packageId,
          title,
          category,
          coverPhoto,
          driverName,
          status
        }}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={() => {
          router.refresh();
        }}
        onArchived={() => {
          router.refresh();
        }}
      />
    </>
  );
}

