"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";

export default function AdminPackageActions({ packageId, status }: { packageId: string, status: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAction = async (action: 'PUBLISHED' | 'REJECTED') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/packages/${packageId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
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

  if (status === 'PUBLISHED') {
    return (
      <div className="flex gap-2">
        <span className="bg-green-100 text-green-800 px-4 py-2 rounded-xl font-bold flex items-center gap-2">
          <CheckCircle size={20} /> Published
        </span>
        <button
          onClick={() => handleAction('REJECTED')}
          disabled={loading}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Revoke & Reject"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <button
        onClick={() => handleAction('REJECTED')}
        disabled={loading}
        className="bg-white border-2 border-red-500 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <XCircle size={20} /> Reject Package
      </button>
      <button
        onClick={() => handleAction('PUBLISHED')}
        disabled={loading}
        className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 shadow-md"
      >
        <CheckCircle size={20} /> Approve & Publish
      </button>
    </div>
  );
}
