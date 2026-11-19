"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Briefcase,
  Car,
  DollarSign,
  MapPin,
  Plane,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  Save,
  AlertCircle,
  ShieldCheck,
  Mail,
  Phone,
  Globe,
  CheckCircle2,
  Lock,
  RefreshCw,
  Send,
  User,
  UserCheck,
  Sparkles,
  Upload,
  FileText,
  X,
  ExternalLink,
  File,
  ImageIcon,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import PlacesAutocompleteInput, { LocationState } from "@/components/booking/PlacesAutocompleteInput";
import MapLocationPicker from "@/components/booking/MapLocationPicker";
import ItineraryRouteSummary from "@/components/booking/ItineraryRouteSummary";
import CountrySelect from "@/components/booking/CountrySelect";
import PhoneInputWithCountry from "@/components/booking/PhoneInputWithCountry";
import { formatSriLankanDate } from "@/lib/dateTime";

interface VehicleType {
  _id: string;
  name: string;
  maxPassengers: number;
  maxLuggage: number;
}

type TripDay = {
  dayNumber: number;
  date: string;
  startingLocation: LocationState | null;
  departureTime: string;
  placesToVisit: { location: LocationState; activityTime: string }[];
  overnightLocation: LocationState | null;
  notes: string;
};

interface TripBuilderClientProps {
  vehicleTypes: VehicleType[];
  initialData?: any;
  currentUserProfile?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
    nationality?: string;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
    identityStatus?: string;
  } | null;
  existingIdentity?: {
    _id?: string;
    documentType: "NATIONAL_ID" | "PASSPORT";
    status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    acknowledgedPurpose: boolean;
    rejectionReason?: string;
    files?: {
      front?: { fileId: string; originalName: string; mimeType: string; size: number; viewUrl?: string };
      back?: { fileId: string; originalName: string; mimeType: string; size: number; viewUrl?: string };
      photoPage?: { fileId: string; originalName: string; mimeType: string; size: number; viewUrl?: string };
    };
  } | null;
}

function DocumentUploadCard({
  title,
  fileKey,
  fileData,
  uploading,
  disabled,
  onUpload,
  onRemove,
}: {
  title: string;
  fileKey: string;
  fileData?: any;
  uploading: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        fileData?.fileId
          ? "bg-emerald-50/30 border-emerald-200"
          : "bg-slate-50 border-slate-200 hover:border-slate-300"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/jpg,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
            e.target.value = "";
          }
        }}
      />

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</span>
        {fileData?.fileId && (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={12} /> Uploaded
          </span>
        )}
      </div>

      {uploading ? (
        <div className="h-28 flex flex-col items-center justify-center gap-2 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Uploading & validating file...</span>
        </div>
      ) : fileData?.fileId ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
            {fileData.mimeType === "application/pdf" ? (
              <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 border border-red-100">
                PDF
              </div>
            ) : fileData.viewUrl ? (
              <img
                src={fileData.viewUrl}
                alt="preview"
                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{fileData.originalName}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {(fileData.size / (1024 * 1024)).toFixed(2)} MB • {fileData.mimeType === "application/pdf" ? "PDF Document" : "Image"}
              </p>
            </div>
            {fileData.viewUrl && (
              <a
                href={fileData.viewUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition-colors"
                title="View Document in New Tab"
              >
                <ExternalLink size={15} />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} /> Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="py-1.5 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            if (!disabled) fileInputRef.current?.click();
          }}
          className={`h-28 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-center px-4 ${
            disabled
              ? "border-slate-200 bg-slate-100/50 cursor-not-allowed opacity-60"
              : "border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 cursor-pointer"
          }`}
        >
          <Upload size={20} className={disabled ? "text-slate-400" : "text-blue-600"} />
          <span className="text-xs font-bold text-slate-800">
            {disabled ? "Acknowledge purpose above to upload" : "Click to select or drop document"}
          </span>
          <span className="text-[10px] text-slate-400">JPG, PNG, or PDF up to 5 MB</span>
        </div>
      )}
    </div>
  );
}

export default function TripBuilderClient({
  vehicleTypes,
  initialData,
  currentUserProfile,
  existingIdentity,
}: TripBuilderClientProps) {
  const router = useRouter();

  // Step state: 1: Details, 2: Basics, 3: Logistics, 4: Itinerary, 5: Review
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // STEP 1: Your Details & Verification
  // =========================================================
  const existingContact = initialData?.customTripDetails?.bookingContact;

  const [contactFullName, setContactFullName] = useState<string>(
    existingContact?.fullName || currentUserProfile?.name || ""
  );
  const [contactCountry, setContactCountry] = useState<string>(
    existingContact?.country || currentUserProfile?.nationality || "Sri Lanka"
  );
  const [contactEmail, setContactEmail] = useState<string>(
    existingContact?.email || currentUserProfile?.email || ""
  );
  const [contactPhone, setContactPhone] = useState<string>(
    existingContact?.phone || currentUserProfile?.phoneNumber || ""
  );

  // Exact verified values bound to the user session
  const [verifiedEmailValue, setVerifiedEmailValue] = useState<string | null>(() => {
    if (existingContact?.email) return existingContact.email.toLowerCase().trim();
    if (currentUserProfile?.isEmailVerified && currentUserProfile.email) {
      return currentUserProfile.email.toLowerCase().trim();
    }
    return null;
  });

  const [emailVerificationToken, setEmailVerificationToken] = useState<string | null>(null);

  // Booking for someone else state
  const [isBookingForSomeoneElse, setIsBookingForSomeoneElse] = useState<boolean>(
    Boolean(existingContact?.isBookingForSomeoneElse)
  );
  const [passengerFullName, setPassengerFullName] = useState<string>(
    existingContact?.passenger?.fullName || ""
  );
  const [passengerPhone, setPassengerPhone] = useState<string>(
    existingContact?.passenger?.phone || ""
  );

  // Accuracy confirmation checkbox
  const [confirmedAccuracy, setConfirmedAccuracy] = useState<boolean>(
    Boolean(existingContact?.confirmedAccuracy)
  );

  // Dynamic verification binding check:
  // If the rider edits the verified email, isEmailVerified flips to false immediately!
  const isEmailVerified = useMemo(() => {
    if (!verifiedEmailValue || !contactEmail.trim()) return false;
    return verifiedEmailValue.toLowerCase().trim() === contactEmail.toLowerCase().trim();
  }, [verifiedEmailValue, contactEmail]);

  // Email verification action UI states
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpInput, setEmailOtpInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailError, setEmailError] = useState("");
  const [emailSuccessMsg, setEmailSuccessMsg] = useState("");
  const [emailDevMockCode, setEmailDevMockCode] = useState<string | null>(null);

  // Countdown timer for email resend cooldown
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const t = setInterval(() => setEmailCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [emailCooldown]);

  // Identity Document State
  const initialIdentity = existingIdentity || initialData?.customTripDetails?.identityVerification;
  const [documentType, setDocumentType] = useState<"NATIONAL_ID" | "PASSPORT">(
    initialIdentity?.documentType || "PASSPORT"
  );
  const [acknowledgedPurpose, setAcknowledgedPurpose] = useState<boolean>(
    Boolean(initialIdentity?.acknowledgedPurpose ?? (initialIdentity?.status ? true : false))
  );
  const [identityStatus, setIdentityStatus] = useState<string>(
    initialIdentity?.status || "NOT_SUBMITTED"
  );
  const [identityRejectionReason, setIdentityRejectionReason] = useState<string>(
    initialIdentity?.rejectionReason || ""
  );
  const [identityFiles, setIdentityFiles] = useState<{
    front?: any;
    back?: any;
    photoPage?: any;
  }>(initialIdentity?.files || {});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>("");

  const isIdentityComplete = useMemo(() => {
    if (!acknowledgedPurpose) return false;
    if (documentType === "NATIONAL_ID") {
      return Boolean(identityFiles?.front?.fileId && identityFiles?.back?.fileId);
    }
    return Boolean(identityFiles?.photoPage?.fileId);
  }, [acknowledgedPurpose, documentType, identityFiles]);

  const handleFileUpload = async (fileKey: "front" | "back" | "photoPage", file: File) => {
    setUploadError("");
    if (!acknowledgedPurpose) {
      setUploadError("Please check the acknowledgment box before uploading your document.");
      return;
    }

    if (!file) return;

    // Client-side size check (5 MB)
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`File size exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`);
      return;
    }

    // Client-side format check
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Invalid file type. Only JPG, PNG, and PDF files are accepted.");
      return;
    }

    setUploadingKey(fileKey);
    try {
      const formData = new FormData();
      formData.append("documentType", documentType);
      formData.append("fileKey", fileKey);
      formData.append("acknowledgedPurpose", "true");
      formData.append("file", file);

      const res = await fetch("/api/identity-documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIdentityFiles(data.files || {});
        setIdentityStatus(data.status || "PENDING_REVIEW");
        setIdentityRejectionReason("");
      } else {
        setUploadError(data.error || "Failed to upload document.");
      }
    } catch {
      setUploadError("Network error while uploading document.");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleFileRemove = async (fileKey: "front" | "back" | "photoPage") => {
    setUploadError("");
    setUploadingKey(fileKey);
    try {
      const res = await fetch("/api/identity-documents/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIdentityFiles(data.files || {});
        setIdentityStatus(data.status);
      } else {
        setUploadError(data.error || "Failed to remove document.");
      }
    } catch {
      setUploadError("Network error while removing document.");
    } finally {
      setUploadingKey(null);
    }
  };

  // =========================================================
  // STEP 2: Basics
  // =========================================================
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [luggage, setLuggage] = useState(2);
  const [vehicleTypeId, setVehicleTypeId] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [budgetCovers, setBudgetCovers] = useState("Transport only");
  const [budgetFlexibility, setBudgetFlexibility] = useState("Negotiable");
  const [budgetNotes, setBudgetNotes] = useState("");

  // =========================================================
  // STEP 3: Logistics
  // =========================================================
  const [pickupLocation, setPickupLocation] = useState<LocationState | null>(null);
  const [pickupTime, setPickupTime] = useState("");
  const [pickupFlight, setPickupFlight] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState<LocationState | null>(null);
  const [dropoffTime, setDropoffTime] = useState("");
  const [dropoffFlight, setDropoffFlight] = useState("");

  // =========================================================
  // STEP 4: Itinerary
  // =========================================================
  const [itinerary, setItinerary] = useState<TripDay[]>([]);
  const [routeData, setRouteData] = useState<any>(null);

  // Prefill from initialData
  useEffect(() => {
    if (initialData?.customTripDetails?.itinerary) {
      const mappedItinerary = initialData.customTripDetails.itinerary.map((day: any) => ({
        ...day,
        startingLocation: day.startingLocation
          ? {
              address: day.startingLocation.address || "",
              lat: day.startingLocation.lat || 0,
              lng: day.startingLocation.lng || 0,
              source: "local",
            }
          : null,
        overnightLocation: day.overnightLocation
          ? {
              address: day.overnightLocation.hotel || day.overnightLocation.city || "",
              lat: day.overnightLocation.lat || 0,
              lng: day.overnightLocation.lng || 0,
              source: "local",
            }
          : null,
        placesToVisit: day.placesToVisit
          ? day.placesToVisit.map((p: any) => ({
              location: {
                address: p.name || "",
                lat: p.lat || 0,
                lng: p.lng || 0,
                source: "local",
              },
              activityTime: p.activityTime,
            }))
          : [],
      }));
      setItinerary(mappedItinerary);
    }
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      if (initialData.arrivalDate) {
        setStartDate(new Date(initialData.arrivalDate).toISOString().split("T")[0]);
      }
      if (initialData.customTripDetails?.endDate) {
        setEndDate(new Date(initialData.customTripDetails.endDate).toISOString().split("T")[0]);
      }
      setAdults(initialData.passengerDetails?.adults || 2);
      setChildren(initialData.passengerDetails?.children || 0);
      setLuggage(initialData.passengerDetails?.luggage || 2);
      setVehicleTypeId(initialData.vehicleTypeId || "");
      setBudget(initialData.customTripDetails?.budget?.toString() || "");
      if (initialData.customTripDetails?.budgetCurrency) {
        setBudgetCurrency(initialData.customTripDetails.budgetCurrency);
      }
      if (initialData.customTripDetails?.budgetCovers) {
        setBudgetCovers(initialData.customTripDetails.budgetCovers);
      }
      if (initialData.customTripDetails?.budgetFlexibility) {
        setBudgetFlexibility(initialData.customTripDetails.budgetFlexibility);
      }
      if (initialData.customTripDetails?.budgetNotes) {
        setBudgetNotes(initialData.customTripDetails.budgetNotes);
      }

      if (initialData.pickupAddress) {
        setPickupLocation({
          address: initialData.pickupAddress,
          lat: initialData.pickupLat || 0,
          lng: initialData.pickupLng || 0,
          source: "local",
        });
      }
      setPickupTime(initialData.arrivalTime || "");
      setPickupFlight(initialData.flightNumber || "");

      if (initialData.destinationAddress) {
        setDropoffLocation({
          address: initialData.destinationAddress,
          lat: initialData.destinationLat || 0,
          lng: initialData.destinationLng || 0,
          source: "local",
        });
      }
      setDropoffTime(initialData.customTripDetails?.dropoffTime || "");
      setDropoffFlight(initialData.customTripDetails?.dropoffFlightNumber || "");
    }
  }, [initialData]);

  // Calculate days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays > 0 && diffDays < 30) {
        setItinerary((prev) => {
          const newItin = [];
          for (let i = 1; i <= diffDays; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i - 1);

            const existing = prev.find((p) => p.dayNumber === i);
            newItin.push(
              existing || {
                dayNumber: i,
                date: d.toISOString().split("T")[0],
                startingLocation: null,
                departureTime: "08:30",
                placesToVisit: [],
                overnightLocation: null,
                notes: "",
              }
            );
          }
          return newItin;
        });
      }
    }
  }, [startDate, endDate]);

  // =========================================================
  // Verification Handlers
  // =========================================================

  const handleSendEmailOtp = async () => {
    setEmailError("");
    setEmailSuccessMsg("");
    setEmailDevMockCode(null);

    const cleanEmail = contactEmail.toLowerCase().trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setEmailSending(true);
    try {
      const res = await fetch("/api/verification/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMAIL", target: cleanEmail }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmailOtpSent(true);
        setEmailCooldown(data.cooldownSeconds || 60);
        setEmailSuccessMsg(data.message || "Verification code sent to your email.");
        if (data.isDevMock && data.devCode) {
          setEmailDevMockCode(data.devCode);
        }
      } else {
        setEmailError(data.error || "Failed to dispatch verification email.");
        if (data.cooldownSeconds) {
          setEmailCooldown(data.cooldownSeconds);
        }
      }
    } catch {
      setEmailError("Network error while sending verification email.");
    } finally {
      setEmailSending(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    setEmailError("");
    setEmailSuccessMsg("");

    const cleanEmail = contactEmail.toLowerCase().trim();
    const cleanCode = emailOtpInput.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setEmailError("Please enter the 6-digit code.");
      return;
    }

    setEmailVerifying(true);
    try {
      const res = await fetch("/api/verification/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMAIL", target: cleanEmail, code: cleanCode }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.verified) {
        setVerifiedEmailValue(cleanEmail);
        setEmailVerificationToken(data.verificationToken);
        setEmailOtpSent(false);
        setEmailOtpInput("");
        setEmailSuccessMsg("Email verified successfully!");
        setEmailDevMockCode(null);
      } else {
        setEmailError(data.error || "Invalid verification code.");
      }
    } catch {
      setEmailError("Network error while verifying email code.");
    } finally {
      setEmailVerifying(false);
    }
  };

  // =========================================================
  // Itinerary Handlers
  // =========================================================
  const handleAddPlace = (dayIndex: number) => {
    const newItin = [...itinerary];
    newItin[dayIndex].placesToVisit.push({
      location: { address: "", lat: 0, lng: 0, source: "local" },
      activityTime: "2 hours",
    });
    setItinerary(newItin);
  };

  const handleUpdatePlace = (dayIndex: number, placeIndex: number, location: LocationState | null) => {
    const newItin = [...itinerary];
    if (location) {
      newItin[dayIndex].placesToVisit[placeIndex].location = location;
    }
    setItinerary(newItin);
  };

  const handleUpdatePlaceTime = (dayIndex: number, placeIndex: number, time: string) => {
    const newItin = [...itinerary];
    newItin[dayIndex].placesToVisit[placeIndex].activityTime = time;
    setItinerary(newItin);
  };

  const handleRemovePlace = (dayIndex: number, placeIndex: number) => {
    const newItin = [...itinerary];
    newItin[dayIndex].placesToVisit.splice(placeIndex, 1);
    setItinerary(newItin);
  };

  const handleUpdateDay = (dayIndex: number, field: keyof TripDay, value: any) => {
    const newItin = [...itinerary];
    (newItin[dayIndex] as any)[field] = value;

    if (field === "overnightLocation" && dayIndex < newItin.length - 1) {
      if (!newItin[dayIndex + 1].startingLocation || newItin[dayIndex + 1].startingLocation?.address === "") {
        newItin[dayIndex + 1].startingLocation = value;
      }
    }

    setItinerary(newItin);
  };

  // =========================================================
  // Step Validations
  // =========================================================

  const validateStep1Details = () => {
    if (!contactFullName.trim()) return "Please enter your full name.";
    if (!contactCountry.trim()) return "Please select your country of residence.";
    if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return "Please enter a valid email address.";
    }
    if (!isEmailVerified) {
      return "Please verify your email address to continue.";
    }
    if (!contactPhone.trim() || contactPhone.replace(/\D/g, "").length < 7) {
      return "Please enter a valid mobile number with country code.";
    }
    if (!acknowledgedPurpose) {
      return "Please acknowledge the identity document verification purpose.";
    }
    if (documentType === "NATIONAL_ID") {
      if (!identityFiles?.front?.fileId) return "Please upload the front image of your National ID Card.";
      if (!identityFiles?.back?.fileId) return "Please upload the back image of your National ID Card.";
    } else {
      if (!identityFiles?.photoPage?.fileId) return "Please upload your Passport photo & details page.";
    }
    if (identityStatus === "REJECTED") {
      return `Your identity document was rejected: "${identityRejectionReason}". Please re-upload before continuing.`;
    }
    if (isBookingForSomeoneElse) {
      if (!passengerFullName.trim()) {
        return "Please enter the travelling passenger's full name.";
      }
      if (!passengerPhone.trim() || passengerPhone.replace(/\D/g, "").length < 7) {
        return "Please enter the travelling passenger's mobile number with country code.";
      }
    }
    if (!confirmedAccuracy) {
      return "Please confirm that your contact and trip details are accurate.";
    }
    return null;
  };

  const validateStep2Basics = () => {
    if (!startDate || !endDate) return "Please select start and end dates.";
    if (new Date(startDate) > new Date(endDate)) return "Start date must be before end date.";
    if (!vehicleTypeId) return "Please select a vehicle type.";
    if (!budget) return "Please enter your target budget.";
    if (Number(budget) <= 0) return "Budget must be a positive number.";
    return null;
  };

  const validateStep3Logistics = () => {
    if (!pickupLocation) return "Please select a pickup location.";
    if (!pickupTime) return "Please select a pickup time.";
    if (!dropoffLocation) return "Please select a drop-off location.";
    return null;
  };

  const validateStep4Itinerary = () => {
    for (let i = 0; i < itinerary.length; i++) {
      if (!itinerary[i].startingLocation) return `Please set a starting location for Day ${i + 1}`;
      if (!itinerary[i].overnightLocation) return `Please set an overnight location for Day ${i + 1}`;
      for (let j = 0; j < itinerary[i].placesToVisit.length; j++) {
        if (!itinerary[i].placesToVisit[j].location.address) {
          return `Please complete all places to visit on Day ${i + 1}`;
        }
      }
    }
    return null;
  };

  const handleNext = () => {
    setError("");
    let err = null;
    if (step === 1) err = validateStep1Details();
    if (step === 2) err = validateStep2Basics();
    if (step === 3) err = validateStep3Logistics();
    if (step === 4) err = validateStep4Itinerary();

    if (err) {
      setError(err);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async (isDraft: boolean) => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        bookingId: initialData?._id,
        isDraft,
        contactDetails: {
          fullName: contactFullName.trim(),
          country: contactCountry.trim(),
          email: contactEmail.toLowerCase().trim(),
          phone: contactPhone.trim(),
          isBookingForSomeoneElse,
          passengerDetails: isBookingForSomeoneElse
            ? {
                fullName: passengerFullName.trim(),
                phone: passengerPhone.trim(),
              }
            : undefined,
          confirmedAccuracy,
          emailVerificationToken,
        },
        basics: {
          startDate,
          endDate,
          adults,
          children,
          luggage,
          vehicleTypeId,
          budget,
          budgetCurrency,
          budgetCovers,
          budgetFlexibility,
          budgetNotes,
        },
        logistics: {
          pickupLocation,
          pickupTime,
          pickupFlight,
          dropoffLocation,
          dropoffTime,
          dropoffFlight,
        },
        itinerary: itinerary.map((day) => ({
          ...day,
          distanceKm: routeData?.daySummaries?.[day.dayNumber]?.totalDrivingDistanceKm || 0,
          drivingTimeMins: routeData?.daySummaries?.[day.dayNumber]?.totalDrivingTimeMins || 0,
        })),
        totalDistanceKm: routeData?.totalDistanceKm || 0,
        totalDurationMins: routeData?.totalDurationMins || 0,
      };

      const res = await fetch("/api/bookings/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/my-bookings");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save trip request.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const STEPS_NAV = [
    { num: 1, label: "Your Details" },
    { num: 2, label: "Basics" },
    { num: 3, label: "Logistics" },
    { num: 4, label: "Itinerary" },
    { num: 5, label: "Review" },
  ];

  const isStep1Ready = Boolean(
    contactFullName.trim() &&
    contactCountry.trim() &&
    isEmailVerified &&
    contactPhone.trim() &&
    contactPhone.replace(/\D/g, "").length >= 7 &&
    isIdentityComplete &&
    identityStatus !== "REJECTED" &&
    (!isBookingForSomeoneElse || (passengerFullName.trim() && passengerPhone.trim() && passengerPhone.replace(/\D/g, "").length >= 7)) &&
    confirmedAccuracy
  );

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* 5-Step Progress Bar Header */}
      <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 flex justify-between items-center relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-0"></div>
        <div
          className="absolute top-1/2 left-0 h-0.5 bg-blue-600 transition-all duration-300"
          style={{ width: `${((step - 1) / 4) * 100}%` }}
        ></div>

        {STEPS_NAV.map((s) => (
          <div key={s.num} className="relative z-10 flex flex-col items-center justify-center bg-slate-50 px-1 sm:px-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                step >= s.num ? "bg-blue-600 text-white shadow-md shadow-blue-500/30" : "bg-slate-200 text-slate-500"
              }`}
            >
              {step > s.num ? <Check size={16} /> : s.num}
            </div>
            <span
              className={`text-[10px] font-bold uppercase mt-2 hidden md:block ${
                step >= s.num ? "text-blue-900" : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="p-6 sm:p-10">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* =========================================================
            STEP 1: Your Details & Verification
        ========================================================= */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" size={26} />
                Your Details & Verification
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Please verify your contact details. This ensures timely driver matching updates, quotations, and official trip confirmations.
              </p>
            </div>

            {/* Primary Booking Contact Information */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                  <User size={18} className="text-blue-600" />
                  Booking Contact Person
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
                  Primary Account Holder
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={contactFullName}
                    onChange={(e) => setContactFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-medium text-slate-900 text-sm"
                  />
                </div>

                {/* Country of Residence */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Country of Residence *
                  </label>
                  <CountrySelect
                    value={contactCountry}
                    onChange={(val) => setContactCountry(val)}
                    placeholder="Select Country of Residence"
                  />
                </div>

                {/* Email Address with Verification */}
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Email Address *
                    </label>
                    <div>
                      {isEmailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} />
                          Verified
                        </span>
                      ) : verifiedEmailValue && contactEmail.trim().toLowerCase() !== verifiedEmailValue.toLowerCase() ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertCircle size={13} />
                          Email Changed • Verify New Email
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                          Unverified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                      <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => {
                          setContactEmail(e.target.value);
                          setEmailOtpSent(false);
                          setEmailError("");
                          setEmailSuccessMsg("");
                        }}
                        placeholder="e.g. john@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-medium text-slate-900 text-sm"
                      />
                    </div>

                    {!isEmailVerified && (
                      <button
                        type="button"
                        disabled={emailSending || emailCooldown > 0 || !contactEmail.trim()}
                        onClick={handleSendEmailOtp}
                        className={`px-5 py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          emailCooldown > 0
                            ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95"
                        } disabled:opacity-60 disabled:cursor-not-allowed shrink-0`}
                      >
                        {emailSending ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : emailCooldown > 0 ? (
                          <span>Resend in {emailCooldown}s</span>
                        ) : emailOtpSent ? (
                          <span>Resend Code</span>
                        ) : (
                          <>
                            <Send size={14} />
                            <span>Verify Email</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Dev Mock Banner for Email */}
                  {emailDevMockCode && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-amber-600 shrink-0" />
                        <span>
                          <strong>[DEV MOCK MODE]</strong> Verification Code:{" "}
                          <code className="bg-white px-2 py-0.5 rounded font-mono font-bold text-amber-700 border border-amber-300">
                            {emailDevMockCode}
                          </code>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEmailOtpInput(emailDevMockCode)}
                        className="text-xs text-blue-600 hover:underline font-bold"
                      >
                        Auto-fill
                      </button>
                    </div>
                  )}

                  {/* Email Feedback Messages */}
                  {emailError && <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><AlertCircle size={13} /> {emailError}</p>}
                  {emailSuccessMsg && <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={13} /> {emailSuccessMsg}</p>}

                  {/* Email OTP Code Input Box */}
                  {emailOtpSent && !isEmailVerified && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
                      <p className="text-xs font-medium text-slate-700">
                        Enter the 6-digit code sent to <strong>{contactEmail}</strong>:
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          maxLength={6}
                          value={emailOtpInput}
                          onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, ""))}
                          placeholder="123456"
                          className="w-40 tracking-widest text-center text-lg font-mono font-bold py-2 px-3 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                        />
                        <button
                          type="button"
                          disabled={emailVerifying || emailOtpInput.length !== 6}
                          onClick={handleVerifyEmailOtp}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          {emailVerifying ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                          <span>Verify</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Number with Country Code */}
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mobile Number *
                  </label>
                  <p className="text-xs text-slate-500">
                    Used for driver communications and pickup coordination during your stay.
                  </p>
                  <PhoneInputWithCountry
                    value={contactPhone}
                    onChange={(val) => setContactPhone(val)}
                    placeholder="77 123 4567"
                  />
                </div>
              </div>
            </div>

            {/* Identity Document Verification */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Identity Document Verification
                  </h3>
                </div>
                <div>
                  {identityStatus === "APPROVED" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={13} />
                      Verified • Approved
                    </span>
                  ) : identityStatus === "REJECTED" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-700 border border-red-200">
                      <XCircle size={13} />
                      Document Rejected • Re-upload Required
                    </span>
                  ) : identityStatus === "PENDING_REVIEW" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock size={13} />
                      Pending Review
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                      Document Required
                    </span>
                  )}
                </div>
              </div>

              {/* Explanatory Notice */}
              <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2 text-xs text-slate-700 leading-relaxed">
                <p className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-blue-600 shrink-0" />
                  Booking Contact & Identity Verification
                </p>
                <p>
                  We collect your identity document to verify the booking contact and support passenger safety.
                </p>
                <p className="text-[11px] text-slate-500">
                  🔒 <strong>Private & Protected:</strong> Your documents are stored in encrypted private storage, strictly restricted to you and authorized compliance personnel.
                </p>
              </div>

              {/* Status Alert Banner */}
              {identityStatus === "PENDING_REVIEW" && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Identity Review Status: Pending Review</p>
                    <p className="mt-0.5 text-amber-800">
                      Your identity documents have been submitted and are queued for compliance review during trip approval. You can continue building and submitting your trip now!
                    </p>
                  </div>
                </div>
              )}

              {identityStatus === "REJECTED" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
                  <XCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Identity Document Rejected</p>
                    <p className="mt-0.5 text-red-800">
                      <strong>Reason:</strong> {identityRejectionReason || "Uploaded documents were unclear or could not be verified."}
                    </p>
                    <p className="mt-1 font-semibold text-red-900">
                      Please upload a clear, legible replacement below to proceed.
                    </p>
                  </div>
                </div>
              )}

              {identityStatus === "APPROVED" && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Identity Verified & Approved</p>
                    <p className="mt-0.5 text-emerald-800">
                      Your government identity document has been approved by compliance. You are ready to book custom tours.
                    </p>
                  </div>
                </div>
              )}

              {/* Purpose Acknowledgment Checkbox */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledgedPurpose}
                    onChange={(e) => {
                      setAcknowledgedPurpose(e.target.checked);
                      setUploadError("");
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-0.5 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800 leading-normal">
                    I acknowledge that this document is collected to verify the booking contact and support passenger safety, and confirm that the uploaded document is authentic and belongs to me. *
                  </span>
                </label>
              </div>

              {/* Document Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Document Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentType("NATIONAL_ID");
                      setUploadError("");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      documentType === "NATIONAL_ID"
                        ? "border-blue-600 bg-blue-50/50 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">National ID Card</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Requires front and back images / PDF</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        documentType === "NATIONAL_ID" ? "border-blue-600 bg-blue-600" : "border-slate-300"
                      }`}
                    >
                      {documentType === "NATIONAL_ID" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDocumentType("PASSPORT");
                      setUploadError("");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      documentType === "PASSPORT"
                        ? "border-blue-600 bg-blue-50/50 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">Passport</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Requires photo & details page</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        documentType === "PASSPORT" ? "border-blue-600 bg-blue-600" : "border-slate-300"
                      }`}
                    >
                      {documentType === "PASSPORT" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Upload Error Display */}
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Dropzones */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Required Files ({documentType === "NATIONAL_ID" ? "Front & Back" : "Photo / Details Page"})
                  </span>
                  <span className="font-medium text-slate-400">Accepted: JPG, PNG, PDF • Max 5 MB each</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {documentType === "NATIONAL_ID" ? (
                    <>
                      <DocumentUploadCard
                        title="Front of National ID"
                        fileKey="front"
                        fileData={identityFiles.front}
                        uploading={uploadingKey === "front"}
                        disabled={!acknowledgedPurpose}
                        onUpload={(f) => handleFileUpload("front", f)}
                        onRemove={() => handleFileRemove("front")}
                      />
                      <DocumentUploadCard
                        title="Back of National ID"
                        fileKey="back"
                        fileData={identityFiles.back}
                        uploading={uploadingKey === "back"}
                        disabled={!acknowledgedPurpose}
                        onUpload={(f) => handleFileUpload("back", f)}
                        onRemove={() => handleFileRemove("back")}
                      />
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <DocumentUploadCard
                        title="Passport Photo & Details Page"
                        fileKey="photoPage"
                        fileData={identityFiles.photoPage}
                        uploading={uploadingKey === "photoPage"}
                        disabled={!acknowledgedPurpose}
                        onUpload={(f) => handleFileUpload("photoPage", f)}
                        onRemove={() => handleFileRemove("photoPage")}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* "I'm booking for someone else" Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBookingForSomeoneElse}
                  onChange={(e) => setIsBookingForSomeoneElse(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    I'm booking this trip for someone else
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select this if you are arranging and paying for this trip, but another person will be the primary passenger traveling in Sri Lanka.
                  </p>
                </div>
              </label>

              {isBookingForSomeoneElse && (
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
                  <div className="md:col-span-2">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <UserCheck size={16} className="text-blue-600" />
                      Main Travelling Passenger
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      The assigned driver will be provided these passenger details for pickup coordination and on-the-ground communication.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Passenger Full Name *
                    </label>
                    <input
                      type="text"
                      value={passengerFullName}
                      onChange={(e) => setPassengerFullName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-900 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Passenger Mobile Number *
                    </label>
                    <PhoneInputWithCountry
                      value={passengerPhone}
                      onChange={(val) => setPassengerPhone(val)}
                      placeholder="77 987 6543"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Accuracy Confirmation Checkbox */}
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedAccuracy}
                  onChange={(e) => setConfirmedAccuracy(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 mt-0.5 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700 leading-relaxed">
                  I confirm that my contact and trip details are accurate. I acknowledge that notifications regarding driver matching, trip quotations, and confirmations will be sent to the verified contacts.
                </span>
              </label>
            </div>

            {/* Continue to Trip Basics Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleNext}
                disabled={!isStep1Ready}
                className={`px-8 py-3.5 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  isStep1Ready
                    ? "bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <span>Continue to Trip Basics</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            STEP 2: Trip Basics
        ========================================================= */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold text-slate-900">Trip Basics</h2>

            {initialData?.adminNotes?.basics && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
                <p className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <AlertCircle size={16} /> Admin Feedback - Trip Basics
                </p>
                <p className="text-sm text-amber-800 mt-1">{initialData.adminNotes.basics}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Date *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="text-slate-400" size={18} />
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">End Date *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="text-slate-400" size={18} />
                  </div>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Passenger & Luggage Counts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Adults (12+ yrs)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                  >
                    -
                  </button>
                  <span className="text-lg font-bold text-slate-800 w-8 text-center">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Children (under 12)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                  >
                    -
                  </button>
                  <span className="text-lg font-bold text-slate-800 w-8 text-center">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Large Luggage</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLuggage(Math.max(0, luggage - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                  >
                    -
                  </button>
                  <span className="text-lg font-bold text-slate-800 w-8 text-center">{luggage}</span>
                  <button
                    type="button"
                    onClick={() => setLuggage(luggage + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-slate-700"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Vehicle Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">Vehicle Preference *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {vehicleTypes.map((v) => (
                  <div
                    key={v._id}
                    onClick={() => setVehicleTypeId(v._id)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                      vehicleTypeId === v._id
                        ? "border-blue-600 bg-blue-50/20 shadow-md"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-800 text-base">{v.name}</span>
                      <Car size={20} className={vehicleTypeId === v._id ? "text-blue-600" : "text-slate-400"} />
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <p className="flex items-center gap-1.5"><Users size={12} /> Up to {v.maxPassengers} passengers</p>
                      <p className="flex items-center gap-1.5"><Briefcase size={12} /> Up to {v.maxLuggage} bags</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Budget */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <DollarSign size={18} className="text-blue-600" />
                Target Budget
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Proposed Budget Amount *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={budgetCurrency}
                      onChange={(e) => setBudgetCurrency(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-sm text-slate-800"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="LKR">LKR (Rs)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="e.g. 500"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Budget Flexibility
                  </label>
                  <select
                    value={budgetFlexibility}
                    onChange={(e) => setBudgetFlexibility(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium"
                  >
                    <option value="Negotiable">Negotiable (Open to counter-offers)</option>
                    <option value="Fixed maximum">Fixed Maximum</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Budget Notes (Optional)
                </label>
                <textarea
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                  placeholder="Any special inclusions or budget notes..."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <ChevronLeft size={16} /> Back to Details
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Continue to Logistics <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            STEP 3: Logistics
        ========================================================= */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold text-slate-900">Arrival & Departure Logistics</h2>

            {/* Initial Pickup */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <MapPin size={18} className="text-blue-600" />
                Initial Trip Pickup *
              </h3>
              <PlacesAutocompleteInput
                label="Pickup Location"
                value={pickupLocation}
                onChange={setPickupLocation}
                placeholder="Enter Airport, Hotel, or Address"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Pickup Time *
                  </label>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Flight Number (Optional)
                  </label>
                  <div className="relative">
                    <Plane size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={pickupFlight}
                      onChange={(e) => setPickupFlight(e.target.value)}
                      placeholder="e.g. UL 504"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Final Drop-off */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <MapPin size={18} className="text-rose-600" />
                Final Trip Drop-off *
              </h3>
              <PlacesAutocompleteInput
                label="Drop-off Location"
                value={dropoffLocation}
                onChange={setDropoffLocation}
                placeholder="Enter Airport, Hotel, or Address"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Drop-off Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={dropoffTime}
                    onChange={(e) => setDropoffTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Departure Flight (Optional)
                  </label>
                  <div className="relative">
                    <Plane size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={dropoffFlight}
                      onChange={(e) => setDropoffFlight(e.target.value)}
                      placeholder="e.g. UL 505"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <ChevronLeft size={16} /> Back to Basics
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Continue to Itinerary <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            STEP 4: Itinerary
        ========================================================= */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Day-by-Day Itinerary</h2>
                <p className="text-slate-500 text-sm">Specify starting locations, places to visit, and overnight stays for each day.</p>
              </div>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs self-start sm:self-auto cursor-pointer"
              >
                <Save size={14} /> Save Draft
              </button>
            </div>

            <div className="space-y-6">
              {itinerary.map((day, dayIndex) => (
                <div key={day.dayNumber} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="font-bold text-slate-800 text-base">
                      Day {day.dayNumber} • {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                      Departure: {day.departureTime}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PlacesAutocompleteInput
                      label="Day Starting Location *"
                      value={day.startingLocation}
                      onChange={(loc) => handleUpdateDay(dayIndex, "startingLocation", loc)}
                      placeholder="Where does this day start?"
                    />

                    <PlacesAutocompleteInput
                      label="Overnight Location (Hotel/City) *"
                      value={day.overnightLocation}
                      onChange={(loc) => handleUpdateDay(dayIndex, "overnightLocation", loc)}
                      placeholder="Where will you sleep tonight?"
                    />
                  </div>

                  {/* Places to Visit */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Attractions / Places to Visit on Day {day.dayNumber}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAddPlace(dayIndex)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} /> Add Attraction
                      </button>
                    </div>

                    {day.placesToVisit.map((place, placeIndex) => (
                      <div key={placeIndex} className="flex items-center gap-2">
                        <div className="flex-1">
                          <PlacesAutocompleteInput
                            label=""
                            value={place.location}
                            onChange={(loc) => handleUpdatePlace(dayIndex, placeIndex, loc)}
                            placeholder="e.g. Sigiriya Rock Fortress, Temple of the Tooth"
                          />
                        </div>
                        <input
                          type="text"
                          value={place.activityTime}
                          onChange={(e) => handleUpdatePlaceTime(dayIndex, placeIndex, e.target.value)}
                          placeholder="e.g. 2 hours"
                          className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePlace(dayIndex, placeIndex)}
                          className="p-3 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Route Summary */}
            {itinerary.length > 0 && (
              <ItineraryRouteSummary
                itinerary={itinerary}
                onRouteCalculated={(data) => setRouteData(data)}
              />
            )}

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <ChevronLeft size={16} /> Back to Logistics
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Review Request <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            STEP 5: Review & Submit
        ========================================================= */}
        {step === 5 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold text-slate-900">Review Trip Request</h2>

            {/* 1. Contact & Passenger Details Card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-600" />
                  Booking Contact & Passengers
                </h3>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Booking Contact</p>
                  <p className="font-medium text-slate-900">{contactFullName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{contactCountry}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Verified Email</p>
                  <p className="font-medium text-slate-900 flex items-center gap-1.5 truncate">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{contactEmail}</span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Mobile</p>
                  <p className="font-medium text-slate-900 flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <span>{contactPhone}</span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Identity Document</p>
                  <div className="flex items-center gap-1.5 font-medium text-slate-900 text-sm">
                    <ShieldCheck size={14} className="text-blue-600 shrink-0" />
                    <span>{documentType === "NATIONAL_ID" ? "National ID Card" : "Passport"}</span>
                  </div>
                  <span className={`inline-block mt-1 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded border ${
                    identityStatus === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    {identityStatus === "APPROVED" ? "Approved" : "Pending Review"}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Travelling Passenger</p>
                  {isBookingForSomeoneElse ? (
                    <div>
                      <p className="font-bold text-slate-900">{passengerFullName}</p>
                      <p className="text-xs text-slate-500">{passengerPhone}</p>
                      <span className="inline-block mt-1 text-[10px] uppercase font-extrabold px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                        Booked For Someone Else
                      </span>
                    </div>
                  ) : (
                    <p className="font-medium text-slate-700">Account Holder (Traveling)</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Trip Overview (Basics) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" /> Trip Overview
                </h3>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dates</p>
                  <p className="font-medium text-slate-900" suppressHydrationWarning>
                    {formatSriLankanDate(startDate)} - {formatSriLankanDate(endDate)}
                  </p>
                  <p className="text-sm text-slate-500">{itinerary.length} Days, {itinerary.length - 1} Nights</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Passengers</p>
                  <p className="font-medium text-slate-900">{adults} Adults, {children} Children</p>
                  <p className="text-sm text-slate-500">{luggage} Large Bags</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Vehicle Preference</p>
                  <p className="font-medium text-slate-900">{vehicleTypes.find((v) => v._id === vehicleTypeId)?.name || "Not selected"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Rider's Target Budget</p>
                  <p className="font-medium text-slate-900">{budget ? `${budgetCurrency} ${budget}` : "Flexible"}</p>
                  {budget && (
                    <p className="text-xs text-slate-500 mt-1">
                      {budgetCovers} • {budgetFlexibility}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Arrival & Departure (Logistics) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <MapPin size={18} className="text-blue-600" /> Arrival & Departure
                </h3>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Initial Pickup</p>
                  <p className="font-medium text-slate-900 mt-1">{pickupLocation?.address || "Not set"}</p>
                  <p className="text-sm text-slate-500">Time: {pickupTime || "Not set"}</p>
                  {pickupFlight && <p className="text-sm text-slate-500">Flight: {pickupFlight}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Final Drop-off</p>
                  <p className="font-medium text-slate-900 mt-1">{dropoffLocation?.address || "Not set"}</p>
                  <p className="text-sm text-slate-500">Time: {dropoffTime || "Not set"}</p>
                  {dropoffFlight && <p className="text-sm text-slate-500">Flight: {dropoffFlight}</p>}
                </div>
              </div>
            </div>

            {/* 4. Complete Itinerary */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Car size={18} className="text-blue-600" /> Complete Itinerary
                </h3>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {itinerary.map((day) => (
                  <div key={day.dayNumber} className="p-5">
                    <p className="font-bold text-slate-900">
                      Day {day.dayNumber} • {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {day.startingLocation?.address?.split(",")[0]} → {day.overnightLocation?.address?.split(",")[0]}
                    </p>
                    {day.placesToVisit.length > 0 && (
                      <p className="text-xs text-slate-600 mt-1">
                        Attractions: {day.placesToVisit.map((p) => p.location.address.split(",")[0]).join(" • ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submission Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
              >
                <ChevronLeft size={16} /> Back to Itinerary
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all flex-1 sm:flex-none cursor-pointer"
                >
                  <Save size={16} /> Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 flex-1 sm:flex-none cursor-pointer"
                >
                  {loading ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <span>Submit Trip Request</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
