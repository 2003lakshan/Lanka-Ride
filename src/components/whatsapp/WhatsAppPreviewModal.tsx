"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertTriangle, 
  Edit2, 
  Phone, 
  User, 
  Info,
  ShieldCheck
} from "lucide-react";
import { normalizeWhatsAppPhone, buildWhatsAppLink, NormalizedWhatsAppPhone } from "@/lib/whatsapp";
import PhoneInputWithCountry from "@/components/booking/PhoneInputWithCountry";

export interface WhatsAppData {
  type: string;
  title: string;
  recipientName: string;
  recipientRole: string;
  phone: NormalizedWhatsAppPhone;
  message: string;
  waLink: string;
  bookingRef?: string;
}

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WhatsAppData | null;
}

export function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      aria-hidden="true"
    >
      <path d="M12.031 2C6.496 2 2 6.496 2 12.031c0 1.905.534 3.688 1.458 5.215L2.062 22l4.896-1.375A9.973 9.973 0 0 0 12.031 22C17.566 22 22 17.504 22 12.031 22 6.496 17.566 2 12.031 2zm5.727 14.152c-.244.688-1.22 1.264-1.996 1.43-.526.113-1.214.204-3.528-.756-2.96-1.227-4.864-4.234-5.012-4.432-.144-.199-1.2-1.6-1.2-3.053 0-1.453.762-2.167 1.034-2.464.272-.298.594-.372.793-.372.2 0 .397.002.57.01.185.01.433-.07.678.52.249.596.848 2.067.922 2.217.074.148.124.322.025.52-.099.198-.148.322-.297.495-.148.174-.312.388-.446.521-.148.148-.303.31-.13.608.173.298.77 1.269 1.65 2.054 1.134 1.01 2.09 1.322 2.387 1.47.298.149.471.124.645-.074.173-.199.743-.867.942-1.165.198-.298.396-.248.67-.149.272.099 1.731.817 2.029.966.297.148.495.223.57.347.074.124.074.719-.17 1.407z" />
    </svg>
  );
}

export default function WhatsAppPreviewModal({
  isOpen,
  onClose,
  data
}: WhatsAppPreviewModalProps) {
  const [editedMessage, setEditedMessage] = useState("");
  const [phoneState, setPhoneState] = useState<NormalizedWhatsAppPhone | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  // Sync state whenever data changes or modal opens
  useEffect(() => {
    if (data) {
      setEditedMessage(data.message || "");
      setPhoneState(data.phone);
      setIsEditingPhone(data.phone.requiresCorrection);
      setCopied(false);
      setPopupBlocked(false);
    }
  }, [data, isOpen]);

  // Recalculate official wa.me link dynamically whenever phone or message updates
  useEffect(() => {
    if (phoneState?.digits && editedMessage) {
      setGeneratedLink(buildWhatsAppLink(phoneState.digits, editedMessage));
    } else {
      setGeneratedLink("");
    }
  }, [phoneState, editedMessage]);

  if (!isOpen || !data) return null;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Clipboard copy error:", err);
    }
  };

  const handlePhoneChange = (val: string) => {
    const normalized = normalizeWhatsAppPhone(val);
    setPhoneState(normalized);
  };

  const handleOpenWhatsApp = () => {
    if (!phoneState?.isValid || !phoneState.digits) {
      setIsEditingPhone(true);
      return;
    }

    const url = generatedLink || buildWhatsAppLink(phoneState.digits, editedMessage);

    // Record observed action (does NOT mark message sent/delivered/read)
    fetch("/api/whatsapp/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: data.type,
        recipientName: data.recipientName,
        recipientPhone: phoneState.digits,
        bookingRef: data.bookingRef,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});

    // Open official click-to-chat URL
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      setPopupBlocked(true);
    } else {
      // Keep modal open so user can easily copy message or retry if needed, but provide clear status
      setPopupBlocked(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-700 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <WhatsAppIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                {data.title || "WhatsApp Click-to-Chat"}
              </h3>
              <p className="text-xs text-emerald-100 flex items-center gap-1.5 mt-0.5">
                <span>At Your Service – Powered by Pexora</span>
                {data.bookingRef && (
                  <>
                    <span>&bull;</span>
                    <span className="font-mono font-bold bg-white/20 px-1.5 py-0.2 rounded text-[11px] text-white">
                      {data.bookingRef}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-emerald-200 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Recipient Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold">
                  <User size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900">{data.recipientName}</span>
                  <span className="text-[10px] text-slate-500 font-semibold ml-2 uppercase px-2 py-0.5 bg-slate-200 rounded-md">
                    {data.recipientRole}
                  </span>
                </div>
              </div>

              {!isEditingPhone && (
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 p-1 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit2 size={12} />
                  <span>Edit Number</span>
                </button>
              )}
            </div>

            {/* Phone Display or Input */}
            {!isEditingPhone ? (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-slate-400" />
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {phoneState?.formatted || phoneState?.raw || "No phone number available"}
                  </span>
                  {phoneState?.isValid ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck size={11} /> Valid WhatsApp
                    </span>
                  ) : (
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle size={11} /> Needs Correction
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  wa.me/{phoneState?.digits || "..."}
                </span>
              </div>
            ) : (
              <div className="space-y-2 pt-1 border-t border-slate-200/60">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Recipient WhatsApp Number
                </label>
                <PhoneInputWithCountry
                  value={phoneState?.formatted || phoneState?.raw || ""}
                  onChange={handlePhoneChange}
                  placeholder="Enter phone with country code (e.g. 77 123 4567)"
                />
                {phoneState && !phoneState.isValid && (
                  <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>{phoneState.reason || "Please ensure the phone number includes a valid country code."}</span>
                  </p>
                )}
                {phoneState && phoneState.isValid && (
                  <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
                    <span>✓ Normalized: +{phoneState.digits}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(false)}
                      className="text-blue-600 hover:underline font-bold text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Editable Message Preview Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <span>Message Preview & Editor</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {editedMessage.length} characters
              </span>
            </div>

            <textarea
              rows={8}
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 text-xs sm:text-sm font-sans leading-relaxed text-slate-800 outline-none transition-all resize-y shadow-inner"
              placeholder="Type or adjust your WhatsApp message here..."
            />
            
            <p className="text-[11px] text-slate-500 flex items-center gap-1 leading-normal">
              <Info size={13} className="shrink-0 text-slate-400" />
              <span>You can personalize this message before launching WhatsApp. You will press Send inside WhatsApp.</span>
            </p>
          </div>

          {/* Pop-up Blocker Fallback Banner */}
          {popupBlocked && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-600" />
                <span>Browser Pop-up Blocked</span>
              </div>
              <p className="text-amber-800">
                Your browser blocked the automatic new tab. Tap the link below to open WhatsApp directly:
              </p>
              <a
                href={generatedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 underline mt-1"
              >
                <span>Launch WhatsApp Directly</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {copied ? (
              <>
                <Check size={16} className="text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy Message</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!phoneState?.isValid}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <WhatsAppIcon className="w-5 h-5 text-white" />
              <span>Open WhatsApp</span>
              <ExternalLink size={14} className="opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
