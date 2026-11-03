"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminDriverActions({ driverId, isApproved, showViewDetails = true }: { driverId: string, isApproved: boolean, showViewDetails?: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggleApproval = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/approve-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, isApproved: !isApproved }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error);
      } else {
        router.refresh();
      }
    } catch (error) {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${driverId}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to delete user");
      } else {
        router.refresh();
      }
    } catch (error) {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {showViewDetails && (
        <Link
          href={`/admin/users/${driverId}`}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
        >
          View Details
        </Link>
      )}
      <button
        onClick={handleToggleApproval}
        disabled={loading}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          isApproved 
            ? "bg-red-50 text-red-600 hover:bg-red-100" 
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {loading ? "..." : (isApproved ? "Revoke Approval" : "Approve Driver")}
      </button>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {loading ? "..." : "Delete"}
      </button>
    </div>
  );
}
