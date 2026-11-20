"use client";

import { useState, useRef, useEffect } from "react";
import { 
  ChevronDown, 
  Loader2, 
  MessageSquare, 
  CheckCircle2, 
  Car, 
  Send,
  AlertCircle,
  PackageCheck,
  PackageX
} from "lucide-react";
import WhatsAppPreviewModal, { WhatsAppData, WhatsAppIcon } from "./WhatsAppPreviewModal";

export type WhatsAppActionType =
  | "BOOKING_ACKNOWLEDGEMENT"
  | "BOOKING_CONFIRMATION"
  | "NOTIFY_ASSIGNED_DRIVER"
  | "NOTIFY_TRAVELLER_ASSIGNMENT"
  | "PACKAGE_APPROVAL"
  | "PACKAGE_CHANGES_REQUESTED"
  | "CUSTOMER_SUPPORT";

interface ActionItem {
  type: WhatsAppActionType;
  label: string;
  recipientBadge: "Traveller" | "Driver" | "Support";
  icon?: any;
  disabled?: boolean;
  disabledReason?: string;
}

interface WhatsAppActionButtonProps {
  bookingId?: string;
  packageId?: string;
  hasAssignedDriver?: boolean;
  isConfirmedOrApproved?: boolean;
  packageStatus?: string;
  // If provided, renders as a single button triggering this specific action
  singleActionType?: WhatsAppActionType;
  buttonLabel?: string;
  buttonClassName?: string;
  variant?: "dropdown" | "single" | "icon";
}

export default function WhatsAppActionButton({
  bookingId,
  packageId,
  hasAssignedDriver = false,
  isConfirmedOrApproved = false,
  packageStatus,
  singleActionType,
  buttonLabel,
  buttonClassName,
  variant = "dropdown"
}: WhatsAppActionButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<WhatsAppActionType | null>(null);
  const [modalData, setModalData] = useState<WhatsAppData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleTriggerAction = async (type: WhatsAppActionType) => {
    setDropdownOpen(false);
    setLoadingType(type);

    try {
      const res = await fetch("/api/whatsapp/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          bookingId,
          packageId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to prepare WhatsApp message.");
      } else {
        setModalData(data);
        setModalOpen(true);
      }
    } catch (err: any) {
      alert("A network error occurred while preparing WhatsApp message.");
    } finally {
      setLoadingType(null);
    }
  };

  // Determine available booking actions
  const bookingActions: ActionItem[] = [
    {
      type: "BOOKING_ACKNOWLEDGEMENT",
      label: "Send Booking Acknowledgement",
      recipientBadge: "Traveller",
      icon: MessageSquare
    },
    {
      type: "BOOKING_CONFIRMATION",
      label: "Send Booking Confirmation",
      recipientBadge: "Traveller",
      icon: CheckCircle2,
      disabled: !isConfirmedOrApproved,
      disabledReason: "Available for confirmed bookings"
    },
    {
      type: "NOTIFY_ASSIGNED_DRIVER",
      label: "Notify Assigned Driver",
      recipientBadge: "Driver",
      icon: Car,
      disabled: !hasAssignedDriver,
      disabledReason: "Requires assigned driver"
    },
    {
      type: "NOTIFY_TRAVELLER_ASSIGNMENT",
      label: "Notify Traveller of Driver",
      recipientBadge: "Traveller",
      icon: Send,
      disabled: !hasAssignedDriver,
      disabledReason: "Requires assigned driver"
    }
  ];

  // Determine available package actions
  const packageActions: ActionItem[] = [
    {
      type: "PACKAGE_APPROVAL",
      label: "Notify Driver of Package Approval",
      recipientBadge: "Driver",
      icon: PackageCheck,
      disabled: packageStatus !== "PUBLISHED",
      disabledReason: "Only when package is published"
    },
    {
      type: "PACKAGE_CHANGES_REQUESTED",
      label: "Notify Driver of Changes Requested",
      recipientBadge: "Driver",
      icon: PackageX,
      disabled: packageStatus !== "CHANGES_REQUESTED",
      disabledReason: "Only when changes are requested"
    }
  ];

  const actionsList = packageId ? packageActions : bookingActions;

  // Single Action Button mode
  if (singleActionType || variant === "single") {
    const targetType = singleActionType || "CUSTOMER_SUPPORT";
    const isLoading = loadingType === targetType;

    return (
      <>
        <button
          type="button"
          onClick={() => handleTriggerAction(targetType)}
          disabled={isLoading}
          className={
            buttonClassName ||
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          }
          title={buttonLabel || "Contact via WhatsApp"}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-emerald-700" />
          ) : (
            <WhatsAppIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{isLoading ? "Preparing..." : buttonLabel || "WhatsApp"}</span>
        </button>

        <WhatsAppPreviewModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          data={modalData}
        />
      </>
    );
  }

  // Dropdown Menu mode (e.g. for Trip Drawer or Package Toolbar)
  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={loadingType !== null}
        className={
          buttonClassName ||
          "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
        }
      >
        {loadingType !== null ? (
          <Loader2 size={16} className="animate-spin text-white" />
        ) : (
          <WhatsAppIcon className="w-4 h-4 text-white shrink-0" />
        )}
        <span>{loadingType !== null ? "Preparing..." : buttonLabel || "WhatsApp Actions"}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {dropdownOpen && (
        <div 
          className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right overflow-hidden"
          role="menu"
        >
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Prepared WhatsApp Actions</span>
            <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
          </div>

          <div className="py-1">
            {actionsList.map((item) => {
              const Icon = item.icon || MessageSquare;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => !item.disabled && handleTriggerAction(item.type)}
                  disabled={item.disabled}
                  className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between transition-colors ${
                    item.disabled
                      ? "opacity-40 cursor-not-allowed bg-slate-50/50"
                      : "hover:bg-emerald-50 text-slate-800 cursor-pointer"
                  }`}
                  role="menuitem"
                  title={item.disabled ? item.disabledReason : item.label}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={15} className={item.disabled ? "text-slate-400" : "text-emerald-600"} />
                    <span className="font-semibold truncate">{item.label}</span>
                  </div>
                  <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                    item.recipientBadge === "Traveller" 
                      ? "bg-blue-100 text-blue-800" 
                      : item.recipientBadge === "Driver"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}>
                    {item.recipientBadge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <WhatsAppPreviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
      />
    </div>
  );
}

