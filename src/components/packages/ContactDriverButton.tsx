"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ContactDriverButton({ packageId }: { packageId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleContact = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/my-bookings/enquiries/${data.enquiryId}`);
      } else {
        alert(data.error || "Failed to create enquiry.");
      }
    } catch (error) {
      console.error("Error creating enquiry:", error);
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleContact}
      disabled={loading}
      className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2 disabled:bg-slate-500 disabled:cursor-not-allowed"
    >
      <MessageCircle size={20} />
      {loading ? "Sending Enquiry..." : "Contact Driver"}
    </button>
  );
}
