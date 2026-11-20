"use client";

import { useState, useEffect } from "react";
import { 
  Share2, 
  Copy, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  Clock, 
  ExternalLink, 
  X,
  MessageCircle
} from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";

interface ShareTrackingModalProps {
  bookingId: string;
  bookingRef: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareTrackingModal({
  bookingId,
  bookingRef,
  isOpen,
  onClose,
}: ShareTrackingModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareData, setShareData] = useState<{
    hasActiveLink: boolean;
    hasEverGenerated: boolean;
    isRevoked: boolean;
    isExpired: boolean;
    expiresAt: string | null;
    shareUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !bookingId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/bookings/${bookingId}/share`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success) {
          setShareData(data);
        } else {
          setError(data.error || "Failed to load sharing details");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load sharing details");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  const handleCreateOrRegenerate = async (isRegenerating = false) => {
    if (isRegenerating && !window.confirm("Generating a new link will immediately invalidate any previously shared link. Do you want to proceed?")) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isRegenerating ? "REGENERATE" : "CREATE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate link");
      }
      setShareData({
        hasActiveLink: true,
        hasEverGenerated: true,
        isRevoked: false,
        isExpired: false,
        expiresAt: data.expiresAt,
        shareUrl: data.shareUrl,
      });
    } catch (err: any) {
      setError(err.message || "Failed to generate link");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm("Are you sure you want to revoke this sharing link? Anyone with the link will immediately lose access to trip tracking.")) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVOKE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke link");
      }
      setShareData((prev) =>
        prev
          ? {
              ...prev,
              hasActiveLink: false,
              isRevoked: true,
              shareUrl: undefined,
            }
          : null
      );
    } catch (err: any) {
      setError(err.message || "Failed to revoke link");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareData?.shareUrl) return;
    navigator.clipboard.writeText(shareData.shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleShareWhatsApp = () => {
    if (!shareData?.shareUrl) return;
    const msg = `Hi! You can track my trip (${bookingRef}) live on the map without logging in:\n${shareData.shareUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-tracking-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="share-tracking-modal-title" className="text-base font-bold text-slate-900">
                Share Live Trip Tracking
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Booking Reference: <span className="font-semibold text-slate-700">{bookingRef}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Privacy Protection Notice */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100/80 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed text-emerald-950">
              <p className="font-bold text-emerald-900">Privacy & Safety Guaranteed</p>
              <p className="text-emerald-800">
                Anyone with this link can view real-time trip status and live vehicle coordinates without logging in. Passenger personal phone numbers, payment details, documents, and exact residential addresses are strictly protected and hidden.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Checking link status...</p>
            </div>
          ) : shareData?.hasActiveLink && shareData.shareUrl ? (
            <div className="space-y-4">
              {/* Active Link Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Public Tracking Link
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-2xl border border-slate-200 bg-slate-50">
                  <input
                    type="text"
                    readOnly
                    value={shareData.shareUrl}
                    className="flex-1 bg-transparent border-none text-xs font-mono text-slate-700 outline-none truncate select-all px-2"
                  />
                  <button
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      copied
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Expiry info */}
              {shareData.expiresAt && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Valid until{" "}
                    <strong className="text-slate-700">
                      {new Date(shareData.expiresAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </strong>{" "}
                    (Scheduled trip end + 24h grace)
                  </span>
                </div>
              )}

              {/* Fast WhatsApp share & test button */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" /> Share via WhatsApp
                </button>
                <a
                  href={shareData.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  <ExternalLink className="w-4 h-4" /> Open Public Page
                </a>
              </div>

              {/* Advanced Actions: Regenerate & Revoke */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleCreateOrRegenerate(true)}
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-semibold transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
                  Regenerate Link
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleRevoke}
                  className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke Public Access
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-2">
                {shareData?.isRevoked ? (
                  <p className="text-amber-800 font-medium">
                    ⚠️ The previous tracking link for this booking was revoked. You can generate a brand new link anytime.
                  </p>
                ) : shareData?.isExpired ? (
                  <p className="text-amber-800 font-medium">
                    ⌛ The previous tracking link has expired. Generate a new link to re-enable sharing.
                  </p>
                ) : (
                  <p>
                    No public share link has been created yet. Generate an unguessable link to safely share live vehicle tracking with family, friends, or hotel staff.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleCreateOrRegenerate(false)}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-60"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                Generate Shareable Tracking Link
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>At Your Service – Powered by Pexora</span>
          <button
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

