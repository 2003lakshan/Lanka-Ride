"use client";

import { useState } from "react";
import { CreditCard, CheckCircle, RefreshCw, Landmark } from "lucide-react";

interface PaymentActionClientProps {
  bookingId: string;
  paymentStatus: string;
}

export default function PaymentActionClient({ bookingId, paymentStatus }: PaymentActionClientProps) {
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const confirmPayment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payment`, {
        method: "POST"
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to submit payment confirmation");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (paymentStatus === "PAID" || paymentStatus === "VERIFYING_PAYMENT") {
    return (
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
            <RefreshCw size={16} className="animate-spin" /> Payment Verifying
          </h4>
          <p className="text-xs text-blue-800">
            Payment received — waiting for admin confirmation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex flex-col gap-3">
      <div>
        <h4 className="text-sm font-bold text-emerald-900 mb-1 flex items-center gap-2">
          <CreditCard size={16} /> Payment Required
        </h4>
        <p className="text-xs text-emerald-800 mb-3">
          Your custom trip has been approved! Please complete the bank transfer to proceed.
        </p>
      </div>

      {!showDetails ? (
        <button 
          onClick={() => setShowDetails(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-center text-sm font-bold py-2.5 rounded-lg transition-colors w-full shadow-md shadow-emerald-500/20"
        >
          View Bank Details
        </button>
      ) : (
        <div className="bg-white border border-emerald-200 p-4 rounded-lg text-sm shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <Landmark className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1 text-slate-700">
              <p><span className="font-bold text-slate-900">Bank of Ceylon</span></p>
              <p>Badulla City Branch (729)</p>
              <p>Account Number: <span className="font-mono font-bold text-slate-900">0091000137</span></p>
              <p>Account Holder: MR R M N L RATHNAYAKA</p>
            </div>
          </div>
          
          <div className="pt-3 border-t border-emerald-100">
            <button 
              onClick={confirmPayment}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-center text-sm font-bold py-2.5 rounded-lg transition-colors w-full shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              I Have Made the Transfer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
