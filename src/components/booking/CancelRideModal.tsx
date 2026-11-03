"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Check, Loader2, X } from "lucide-react";
import { CANCELLATION_REASONS, CancellationReasonOption } from "@/lib/cancellation";

interface CancelRideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, comments?: string) => Promise<boolean | void>;
  bookingReference?: string;
  isSubmitting?: boolean;
}

export default function CancelRideModal({
  isOpen,
  onClose,
  onConfirm,
  bookingReference,
  isSubmitting: externalSubmitting = false,
}: CancelRideModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [comments, setComments] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [internalSubmitting, setInternalSubmitting] = useState(false);

  const isSubmitting = externalSubmitting || internalSubmitting;

  useEffect(() => {
    if (isOpen) {
      setSelectedReason("");
      setComments("");
      setErrorMsg(null);
      setInternalSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOption = CANCELLATION_REASONS.find(
    (r) => r.code === selectedReason
  );
  const isOther = selectedReason === "OTHER";

  const handleConfirm = async () => {
    setErrorMsg(null);

    if (!selectedReason) {
      setErrorMsg("Please select a reason for cancelling your ride.");
      return;
    }

    if (isOther && (!comments || comments.trim().length < 3)) {
      setErrorMsg("Please provide a short explanation for 'Other' (at least 3 characters).");
      return;
    }

    setInternalSubmitting(true);
    try {
      const res = await onConfirm(selectedReason, comments.trim() || undefined);
      // If onConfirm returns false or throws, keep modal open with error
      if (res === false) {
        setInternalSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to cancel ride. Please try again.");
      setInternalSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="cancel-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Cancel Ride
              </h3>
              {bookingReference && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ride Reference: <span className="font-semibold text-slate-700 dark:text-slate-300">{bookingReference}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Please tell us why you want to cancel. If a driver is assigned or currently en route, they will be notified immediately.
          </p>

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-2 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cancellation Reasons List */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Reason <span className="text-red-500">*</span>
            </legend>
            {CANCELLATION_REASONS.map((reason) => {
              const isSelected = selectedReason === reason.code;
              return (
                <label
                  key={reason.code}
                  htmlFor={`reason-${reason.code}`}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                    isSelected
                      ? "border-red-500 bg-red-50/60 dark:bg-red-950/30 text-red-900 dark:text-red-200 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id={`reason-${reason.code}`}
                      name="cancellation_reason"
                      value={reason.code}
                      checked={isSelected}
                      onChange={() => {
                        setSelectedReason(reason.code);
                        setErrorMsg(null);
                      }}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300 dark:border-slate-700"
                    />
                    <span>{reason.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                </label>
              );
            })}
          </fieldset>

          {/* Explanation / Comments Box */}
          <div className="pt-2">
            <label
              htmlFor="cancellation-comments"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
            >
              {isOther ? (
                <>
                  Explanation <span className="text-red-500">* (Required for &apos;Other&apos;)</span>
                </>
              ) : (
                <>Additional Comments <span className="text-slate-400 font-normal lowercase">(optional)</span></>
              )}
            </label>
            <textarea
              id="cancellation-comments"
              rows={3}
              value={comments}
              onChange={(e) => {
                setComments(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              disabled={isSubmitting}
              placeholder={
                isOther
                  ? "Please tell us briefly why you are cancelling..."
                  : "Any extra feedback or details (optional)..."
              }
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all resize-none ${
                isOther && errorMsg && (!comments || comments.trim().length < 3)
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-slate-200 dark:border-slate-700 focus:border-red-500 focus:ring-red-500/20"
              }`}
            />
            {isOther && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Please provide at least 3 characters explaining the reason.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Keep Ride
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              !selectedReason ||
              (isOther && (!comments || comments.trim().length < 3))
            }
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-semibold shadow-md shadow-red-500/20 flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cancelling...</span>
              </>
            ) : (
              <span>Confirm Cancellation</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
