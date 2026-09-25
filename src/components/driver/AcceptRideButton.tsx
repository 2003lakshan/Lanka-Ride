"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptRideButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: "POST",
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

  return (
    <button 
      onClick={handleAccept}
      disabled={loading}
      className="text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? "Accepting..." : "Accept Ride"}
    </button>
  );
}
