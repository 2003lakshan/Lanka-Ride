"use client";

import { useState } from "react";
import WhatsAppPreviewModal, { WhatsAppData, WhatsAppIcon } from "./WhatsAppPreviewModal";
import { Loader2, MessageCircle, HelpCircle } from "lucide-react";

interface WhatsAppSupportButtonProps {
  bookingRef?: string;
  bookingId?: string;
  variant?: "floating" | "inline";
  className?: string;
  label?: string;
}

export default function WhatsAppSupportButton({
  bookingRef,
  bookingId,
  variant = "floating",
  className,
  label = "Chat with Support"
}: WhatsAppSupportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [modalData, setModalData] = useState<WhatsAppData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenSupport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CUSTOMER_SUPPORT",
          bookingId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to prepare WhatsApp support chat.");
      } else {
        setModalData(data);
        setModalOpen(true);
      }
    } catch (err: any) {
      alert("A network error occurred while connecting to WhatsApp support.");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "inline") {
    return (
      <>
        <button
          type="button"
          onClick={handleOpenSupport}
          disabled={loading}
          className={
            className ||
            "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          }
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin text-white" />
          ) : (
            <WhatsAppIcon className="w-4 h-4 text-white" />
          )}
          <span>{loading ? "Preparing..." : label}</span>
        </button>

        <WhatsAppPreviewModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          data={modalData}
        />
      </>
    );
  }

  // Floating button in bottom right corner
  return (
    <>
      <aside 
        aria-label="WhatsApp Support Assistant"
        className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 group"
      >
        <button
          type="button"
          onClick={handleOpenSupport}
          disabled={loading}
          aria-label="Chat with At Your Service on WhatsApp"
          className="flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-3 sm:px-4.5 sm:py-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-white/40 focus:outline-none focus:ring-4 focus:ring-emerald-300"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          ) : (
            <WhatsAppIcon className="w-6 h-6 text-white" />
          )}
          <span className="font-extrabold text-xs sm:text-sm tracking-tight hidden sm:inline">
            WhatsApp Support
          </span>
          <span className="w-2.5 h-2.5 bg-emerald-300 rounded-full animate-ping hidden sm:inline-block" />
        </button>
      </aside>

      <WhatsAppPreviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
      />
    </>
  );
}

