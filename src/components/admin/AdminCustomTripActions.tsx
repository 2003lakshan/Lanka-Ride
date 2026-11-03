"use client";

import { useState } from "react";
import { CheckCircle, Edit, RefreshCw, Eye } from "lucide-react";
import Link from "next/link";

interface AdminCustomTripActionsProps {
  bookingId: string;
  status: string;
  paymentStatus?: string;
}

export default function AdminCustomTripActions({ bookingId, status, paymentStatus }: AdminCustomTripActionsProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: "APPROVE" | "REQUEST_CHANGES" | "CONFIRM_PAYMENT") => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to perform action");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (status === "AWAITING_PAYMENT") {
    return (
      <div className="flex flex-col gap-2 mt-3 border-t border-slate-100 pt-3">
        {paymentStatus === "VERIFYING_PAYMENT" && (
          <div className="text-xs text-blue-600 font-bold mb-1">Rider confirmed transfer!</div>
        )}
        <button 
          onClick={() => handleAction("CONFIRM_PAYMENT")}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center justify-center gap-1 transition-colors"
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          Verify Payment & Activate
        </button>
      </div>
    );
  }

  if (status !== "PENDING_APPROVAL") return null;

  return (
    <div className="flex flex-col gap-2 mt-3 border-t border-slate-100 pt-3">
      <button 
        onClick={() => handleAction("APPROVE")}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center justify-center gap-1 transition-colors"
      >
        {loading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        Approve Trip
      </button>
      <Link 
        href={`/admin/custom-trips/${bookingId}`}
        className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold py-2 px-3 rounded flex items-center justify-center gap-1 transition-colors"
      >
        <Eye size={12} />
        Review Full Plan
      </Link>
    </div>
  );
}
