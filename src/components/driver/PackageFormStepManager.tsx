"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Package as PackageIcon,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  Info,
  Car,
  Clock,
  ShieldCheck,
  Eye,
  RotateCcw,
  Sparkles,
  HelpCircle,
  X
} from "lucide-react";
import PackageImage from "@/components/packages/PackageImage";

export interface PackageAmenity {
  id?: string;
  name: string;
  category?: "WATER" | "SNACKS" | "BEVERAGES" | "WIFI" | "CUSTOM";
  isIncluded: boolean;
  quantity?: number;
  unit?: string;
  coverage: "PER_PERSON_PER_DAY" | "PER_PERSON_PER_TRIP" | "PER_VEHICLE";
  description?: string;
  price?: number;
  currency?: "LKR" | "USD";
  chargingBasis?: "PER_PERSON" | "PER_VEHICLE" | "PER_ITEM";
}

export interface PackageFormData {
  _id?: string;
  title: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  destinations: string[];
  coverPhoto: string;
  galleryPhotos: string[];
  startingCity: string;
  pickupOptions: string;
  pickupTime: string;
  dropoffLocation: string;
  days: number;
  nights: number;
  vehicleTypeId: string;
  minPassengers: number;
  maxPassengers: number;
  availableDates: string;
  availableDateRanges: Array<{ startDate: string; endDate: string }>;
  advanceNoticeDays: number;
  costs: {
    basePrice: number;
    totalStartingPrice: number;
    priceType: "PER_PERSON" | "PER_VEHICLE" | "ENTIRE_PACKAGE";
    currency: "LKR" | "USD";
    passengerCountCovered: number;
    extraPersonRate: number;
    depositRequired: number;
    inclusions: string[];
    exclusions: string[];
    cancellationTerms: string;
    conditions: string;
  };
  inclusionsList: string[];
  exclusionsList: string[];
  includedServicesDetails: {
    accommodation?: string;
    meals?: string;
    tickets?: string;
    guide?: string;
  };
  amenities: PackageAmenity[];
  languages: string[];
  activityLevel: "Easy" | "Moderate" | "Strenuous";
  accessibility: string;
  childSeatAvailable: boolean;
  thingsToBring: string[];
  cancellationPolicy: string;
  weatherPolicy: string;
  extraChargeConditions: string;
  itinerary: Array<{
    dayNumber: number;
    title?: string;
    destinations?: string[];
    placesToVisit?: string[];
    activities?: string[];
    travelTime?: string;
    stopDuration?: string;
    overnightLocation?: string;
    accommodationDetails?: string;
    notes?: string;
    meals?: {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
    };
  }>;
  status?: string;
  changeRequest?: {
    feedback: string;
    affectedFields?: string[];
    requestedAt?: string;
    requestedByName?: string;
  } | null;
  rejectionReason?: string;
  revision?: number;
}

interface VehicleOption {
  _id: string;
  name: string;
  category: string;
  maxPassengers: number;
  maxLuggage: number;
  hasAC?: boolean;
}

interface PackageFormStepManagerProps {
  initialData?: Partial<PackageFormData>;
  packageId?: string;
  isEdit?: boolean;
}

const CATEGORIES = [
  "Cultural Tour",
  "Wildlife Safari",
  "Beach Tour",
  "Hill Country & Tea",
  "Adventure & Trekking",
  "Culinary & Food",
  "Island Round Tour",
  "Heritage & Ancient Cities"
];

const QUICK_INCLUSIONS = [
  "Private air-conditioned vehicle",
  "English-speaking professional driver/guide",
  "Fuel, highway tolls & parking fees",
  "Complimentary bottled water daily",
  "Hotel pickup and drop-off",
  "Driver accommodation and meals included"
];

const QUICK_EXCLUSIONS = [
  "Monument and national park entrance fees",
  "Personal expenses, drinks and tips",
  "Optional activities and sports fees",
  "Meals not specifically stated"
];

const QUICK_LANGUAGES = [
  "English",
  "Sinhala",
  "Tamil",
  "German",
  "French",
  "Russian",
  "Chinese",
  "Japanese"
];

const STEPS = [
  { id: 1, label: "Basics & Photos", icon: ImageIcon },
  { id: 2, label: "Itinerary & Logistics", icon: Clock },
  { id: 3, label: "Vehicle & Pricing", icon: Car },
  { id: 4, label: "Amenities & Inclusions", icon: Info },
  { id: 5, label: "Availability & Terms", icon: ShieldCheck },
  { id: 6, label: "Review & Submit", icon: CheckCircle }
];

export default function PackageFormStepManager({ initialData, packageId, isEdit = false }: PackageFormStepManagerProps) {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [primaryVehicleInfo, setPrimaryVehicleInfo] = useState<any>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<PackageFormData>(() => ({
    title: initialData?.title || "",
    category: initialData?.category || "Cultural Tour",
    shortDescription: initialData?.shortDescription || "",
    fullDescription: initialData?.fullDescription || "",
    destinations: initialData?.destinations || [],
    coverPhoto: initialData?.coverPhoto || "",
    galleryPhotos: initialData?.galleryPhotos || [],
    startingCity: initialData?.startingCity || "",
    pickupOptions: initialData?.pickupOptions || "Any hotel in starting city or airport",
    pickupTime: initialData?.pickupTime || "08:00 AM",
    dropoffLocation: initialData?.dropoffLocation || "Starting city hotel or airport",
    days: initialData?.days || 1,
    nights: initialData?.nights ?? (initialData?.days ? Math.max(0, initialData.days - 1) : 0),
    vehicleTypeId: initialData?.vehicleTypeId || "",
    minPassengers: initialData?.minPassengers || 1,
    maxPassengers: initialData?.maxPassengers || 4,
    availableDates: initialData?.availableDates || "Available year-round on request",
    availableDateRanges: initialData?.availableDateRanges || [],
    advanceNoticeDays: initialData?.advanceNoticeDays ?? 2,
    costs: {
      basePrice: initialData?.costs?.basePrice || 15000,
      totalStartingPrice: initialData?.costs?.totalStartingPrice || 15000,
      priceType: (initialData?.costs?.priceType as any) || "PER_VEHICLE",
      currency: initialData?.costs?.currency || "LKR",
      passengerCountCovered: initialData?.costs?.passengerCountCovered || 4,
      extraPersonRate: initialData?.costs?.extraPersonRate || 0,
      depositRequired: initialData?.costs?.depositRequired || 0,
      inclusions: initialData?.costs?.inclusions || [],
      exclusions: initialData?.costs?.exclusions || [],
      cancellationTerms: initialData?.costs?.cancellationTerms || "Free cancellation up to 48 hours before pickup.",
      conditions: initialData?.costs?.conditions || "Standard travel terms apply."
    },
    inclusionsList: initialData?.inclusionsList || [
      "Private air-conditioned vehicle",
      "English-speaking professional driver/guide",
      "Fuel, highway tolls & parking fees",
      "Complimentary bottled water daily"
    ],
    exclusionsList: initialData?.exclusionsList || [
      "Monument and national park entrance fees",
      "Personal expenses, drinks and tips"
    ],
    includedServicesDetails: initialData?.includedServicesDetails || {
      accommodation: "Clean, comfortable air-conditioned 3-star hotels or guesthouses with breakfast.",
      meals: "Daily breakfast included at hotels. Lunch and dinner at recommended local restaurants.",
      tickets: "Driver will assist with ticket purchases at counter rates.",
      guide: "Experienced English-speaking tourist driver guide throughout the trip."
    },
    amenities: initialData?.amenities && initialData.amenities.length > 0
      ? initialData.amenities
      : [
          {
            id: "amenity-water",
            name: "Drinking Water (Chilled Mineral Water)",
            category: "WATER",
            isIncluded: true,
            quantity: 2,
            unit: "500 ml bottles",
            coverage: "PER_PERSON_PER_DAY",
            description: "Two 500 ml mineral water bottles per person per day included."
          },
          {
            id: "amenity-snacks",
            name: "Tropical Snack Pack",
            category: "SNACKS",
            isIncluded: true,
            quantity: 1,
            unit: "snack pack",
            coverage: "PER_PERSON_PER_TRIP",
            description: "One snack pack per person per trip included with fresh fruits & local treats."
          },
          {
            id: "amenity-wifi",
            name: "Onboard 4G Wi-Fi",
            category: "WIFI",
            isIncluded: true,
            quantity: 1,
            unit: "hotspot",
            coverage: "PER_VEHICLE",
            description: "Complimentary wireless internet available in vehicle."
          }
        ],
    languages: initialData?.languages || ["English", "Sinhala"],
    activityLevel: initialData?.activityLevel || "Easy",
    accessibility: initialData?.accessibility || "Wheelchair accessible on request",
    childSeatAvailable: initialData?.childSeatAvailable ?? true,
    thingsToBring: initialData?.thingsToBring || ["Comfortable walking shoes", "Sunscreen & sunglasses", "Modest clothing for temples"],
    cancellationPolicy: initialData?.cancellationPolicy || "Full refund if cancelled at least 48 hours before scheduled start date. 50% refund within 24-48 hours.",
    weatherPolicy: initialData?.weatherPolicy || "Tours run rain or shine. In case of extreme weather, alternative scenic routes will be arranged with your agreement.",
    extraChargeConditions: initialData?.extraChargeConditions || "Rates cover up to 150 km per day. Additional mileage charged at standard vehicle rates.",
    itinerary: initialData?.itinerary && initialData.itinerary.length > 0
      ? initialData.itinerary
      : [
          {
            dayNumber: 1,
            title: "Day 1: Arrival & Exploration",
            destinations: [],
            placesToVisit: ["Initial landmark", "Scenic viewpoint"],
            activities: ["Sightseeing", "Cultural walk"],
            travelTime: "Estimated driving time: ~2.5 hrs",
            stopDuration: "1-2 hours per stop",
            overnightLocation: "Hotel in destination city",
            accommodationDetails: "Standard AC hotel room",
            notes: "Comfortable shoes recommended for walking.",
            meals: { breakfast: "Included", lunch: "Optional stop", dinner: "Local restaurant" }
          }
        ],
    status: initialData?.status || "DRAFT",
    changeRequest: initialData?.changeRequest || null,
    rejectionReason: initialData?.rejectionReason || "",
    revision: initialData?.revision || 1
  }));

  // Helper inputs for tags/chips
  const [destinationInput, setDestinationInput] = useState("");
  const [thingInput, setThingInput] = useState("");

  // Amenities editor state
  const [amenityModalOpen, setAmenityModalOpen] = useState(false);
  const [editingAmenityIndex, setEditingAmenityIndex] = useState<number | null>(null);
  const [amenityForm, setAmenityForm] = useState<PackageAmenity>({
    name: "",
    category: "WATER",
    isIncluded: true,
    quantity: 1,
    unit: "bottle",
    coverage: "PER_PERSON_PER_DAY",
    description: "",
    price: 0,
    currency: "LKR",
    chargingBasis: "PER_PERSON"
  });

  const handleOpenAddAmenity = (preset?: Partial<PackageAmenity>) => {
    setEditingAmenityIndex(null);
    setAmenityForm({
      id: "amenity-" + Date.now(),
      name: preset?.name || "",
      category: preset?.category || "WATER",
      isIncluded: preset?.isIncluded ?? true,
      quantity: preset?.quantity ?? 1,
      unit: preset?.unit || "units",
      coverage: preset?.coverage || "PER_PERSON_PER_DAY",
      description: preset?.description || "",
      price: preset?.price || 0,
      currency: preset?.currency || (formData.costs.currency || "LKR"),
      chargingBasis: preset?.chargingBasis || "PER_PERSON"
    });
    setAmenityModalOpen(true);
  };

  const handleOpenEditAmenity = (index: number) => {
    setEditingAmenityIndex(index);
    const item = formData.amenities[index];
    setAmenityForm({ ...item });
    setAmenityModalOpen(true);
  };

  const handleSaveAmenity = () => {
    if (!amenityForm.name.trim()) return;
    setFormData(prev => {
      const list = [...(prev.amenities || [])];
      if (editingAmenityIndex !== null && editingAmenityIndex >= 0) {
        list[editingAmenityIndex] = { ...amenityForm };
      } else {
        list.push({ ...amenityForm, id: amenityForm.id || "amenity-" + Date.now() });
      }
      return { ...prev, amenities: list };
    });
    setAmenityModalOpen(false);
  };

  const handleDeleteAmenity = (index: number) => {
    setFormData(prev => ({
      ...prev,
      amenities: (prev.amenities || []).filter((_, i) => i !== index)
    }));
  };

  // Fetch driver registered vehicle options and vehicle types
  useEffect(() => {
    async function loadVehicleOptions() {
      try {
        const res = await fetch("/api/driver/vehicle-options");
        if (res.ok) {
          const json = await res.json();
          if (json.vehicleTypes) {
            setVehicleOptions(json.vehicleTypes);
            if (!formData.vehicleTypeId && json.primaryVehicle?.vehicleTypeId) {
              setFormData(prev => ({
                ...prev,
                vehicleTypeId: json.primaryVehicle.vehicleTypeId,
                maxPassengers: Math.min(prev.maxPassengers, json.primaryVehicle.maxPassengers || 4)
              }));
            } else if (!formData.vehicleTypeId && json.vehicleTypes.length > 0) {
              setFormData(prev => ({
                ...prev,
                vehicleTypeId: json.vehicleTypes[0]._id
              }));
            }
          }
          if (json.primaryVehicle) {
            setPrimaryVehicleInfo(json.primaryVehicle);
          }
        }
      } catch (e) {
        console.error("Failed to load vehicle options", e);
      }
    }
    loadVehicleOptions();
  }, []);

  // Sync itinerary days with `days` count
  const handleDaysChange = (newDays: number) => {
    const validDays = Math.max(1, newDays);
    const suggestedNights = Math.max(0, validDays - 1);

    setFormData(prev => {
      let currentItin = [...prev.itinerary];
      if (currentItin.length < validDays) {
        for (let i = currentItin.length + 1; i <= validDays; i++) {
          currentItin.push({
            dayNumber: i,
            title: `Day ${i}: Highlights & Exploration`,
            destinations: [],
            placesToVisit: [],
            activities: [],
            travelTime: "Estimated driving time: ~2-3 hrs",
            stopDuration: "1-2 hours per stop",
            overnightLocation: "",
            accommodationDetails: "",
            notes: "",
            meals: { breakfast: "Included", lunch: "Local stop", dinner: "Hotel/local eatery" }
          });
        }
      } else if (currentItin.length > validDays) {
        currentItin = currentItin.slice(0, validDays);
      }

      return {
        ...prev,
        days: validDays,
        nights: suggestedNights,
        itinerary: currentItin
      };
    });
  };

  // Selected vehicle object
  const selectedVehicle = vehicleOptions.find(v => v._id === formData.vehicleTypeId) || primaryVehicleInfo;

  // Capacity validation warning
  const capacityExceeded = selectedVehicle && formData.maxPassengers > selectedVehicle.maxPassengers;

  // Handle Cover Photo Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/driver/packages/upload", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload photo");
      setFormData(prev => ({ ...prev, coverPhoto: data.url }));
      setSuccessMsg("Cover photo uploaded successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  // Handle Gallery Photo Upload
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        const res = await fetch("/api/driver/packages/upload", {
          method: "POST",
          body: fd
        });
        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }
      setFormData(prev => ({
        ...prev,
        galleryPhotos: [...prev.galleryPhotos, ...uploadedUrls]
      }));
      setSuccessMsg(`${uploadedUrls.length} photo(s) added to gallery!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to upload gallery images.");
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  // Add / Remove Gallery URL manually
  const removeGalleryPhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      galleryPhotos: prev.galleryPhotos.filter((_, i) => i !== index)
    }));
  };

  // Add Destination tag
  const addDestination = () => {
    if (!destinationInput.trim()) return;
    if (!formData.destinations.includes(destinationInput.trim())) {
      setFormData(prev => ({
        ...prev,
        destinations: [...prev.destinations, destinationInput.trim()]
      }));
    }
    setDestinationInput("");
  };

  const removeDestination = (dest: string) => {
    setFormData(prev => ({
      ...prev,
      destinations: prev.destinations.filter(d => d !== dest)
    }));
  };

  // Add Things to Bring tag
  const addThing = () => {
    if (!thingInput.trim()) return;
    if (!formData.thingsToBring.includes(thingInput.trim())) {
      setFormData(prev => ({
        ...prev,
        thingsToBring: [...prev.thingsToBring, thingInput.trim()]
      }));
    }
    setThingInput("");
  };

  const removeThing = (thing: string) => {
    setFormData(prev => ({
      ...prev,
      thingsToBring: prev.thingsToBring.filter(t => t !== thing)
    }));
  };

  // Quick toggle for inclusions/exclusions
  const toggleInclusion = (item: string) => {
    setFormData(prev => {
      const exists = prev.inclusionsList.includes(item);
      return {
        ...prev,
        inclusionsList: exists
          ? prev.inclusionsList.filter(i => i !== item)
          : [...prev.inclusionsList, item]
      };
    });
  };

  const toggleExclusion = (item: string) => {
    setFormData(prev => {
      const exists = prev.exclusionsList.includes(item);
      return {
        ...prev,
        exclusionsList: exists
          ? prev.exclusionsList.filter(i => i !== item)
          : [...prev.exclusionsList, item]
      };
    });
  };

  const toggleLanguage = (lang: string) => {
    setFormData(prev => {
      const exists = prev.languages.includes(lang);
      return {
        ...prev,
        languages: exists
          ? prev.languages.filter(l => l !== lang)
          : [...prev.languages, lang]
      };
    });
  };

  // Step 2 Itinerary day updater
  const updateItineraryDay = (index: number, updates: Partial<PackageFormData["itinerary"][0]>) => {
    setFormData(prev => {
      const nextItin = [...prev.itinerary];
      nextItin[index] = { ...nextItin[index], ...updates };
      return { ...prev, itinerary: nextItin };
    });
  };

  // Save handler (Draft vs Review)
  const handleSave = async (submitForReview: boolean = false) => {
    setError(null);
    setSuccessMsg(null);

    // Validation when submitting for review
    if (submitForReview) {
      if (!formData.title.trim()) {
        setError("Package title is required before submitting for review.");
        setCurrentStep(1);
        return;
      }
      if (!formData.coverPhoto.trim()) {
        setError("A cover photo is required before submitting for review.");
        setCurrentStep(1);
        return;
      }
      if (!formData.startingCity.trim()) {
        setError("Starting city is required.");
        setCurrentStep(2);
        return;
      }
      if (formData.days < 1) {
        setError("Duration must be at least 1 day.");
        setCurrentStep(2);
        return;
      }
      if (capacityExceeded) {
        setError(`Maximum passengers (${formData.maxPassengers}) exceeds selected vehicle limit (${selectedVehicle?.maxPassengers}).`);
        setCurrentStep(3);
        return;
      }
      if (!formData.costs.basePrice || formData.costs.basePrice <= 0) {
        setError("Please specify a valid base price.");
        setCurrentStep(3);
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? `/api/driver/packages/${packageId}` : "/api/driver/packages";
      const method = isEdit ? "PUT" : "POST";

      const targetStatus = submitForReview ? "PENDING_REVIEW" : (isEdit ? formData.status || "DRAFT" : "DRAFT");

      const payload = {
        ...formData,
        status: targetStatus,
        costs: {
          ...formData.costs,
          totalStartingPrice: formData.costs.basePrice,
          inclusions: formData.inclusionsList,
          exclusions: formData.exclusionsList
        }
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save package");

      setSuccessMsg(submitForReview ? "Package submitted for admin review successfully!" : "Package saved as draft!");
      setTimeout(() => {
        router.push("/driver/packages");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Admin Change Request / Rejection Banner */}
      {formData.changeRequest && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-800">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 uppercase">
                  Changes Requested by Admin
                </span>
                {formData.changeRequest.requestedByName && (
                  <span className="text-xs text-amber-800">by {formData.changeRequest.requestedByName}</span>
                )}
              </div>
              <h3 className="text-lg font-bold text-amber-950 mt-1">Review Administrator Feedback</h3>
              <p className="text-amber-900 mt-2 bg-white/70 p-4 rounded-xl border border-amber-200 text-sm whitespace-pre-wrap font-medium">
                "{formData.changeRequest.feedback}"
              </p>
              {formData.changeRequest.affectedFields && formData.changeRequest.affectedFields.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-800 font-semibold flex-wrap">
                  <span>Sections needing attention:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.changeRequest.affectedFields.map(f => {
                      const stepMap: Record<string, number> = {
                        "Basics & Photos": 1,
                        "Itinerary & Logistics": 2,
                        "Hotel Details & Meals": 2,
                        "Vehicle & Pricing": 3,
                        "Amenities & Refreshments": 4,
                        "Inclusions & Exclusions": 4,
                        "Policies & Terms": 5,
                        "Driver Profile Info": -1
                      };
                      const targetStep = stepMap[f];
                      if (targetStep === -1) {
                        return (
                          <a
                            key={f}
                            href="/profile"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                          >
                            {f} &rarr;
                          </a>
                        );
                      }
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => { if (targetStep) setCurrentStep(targetStep); }}
                          className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                          {f} {targetStep ? `(Step ${targetStep})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-amber-700 mt-2">
                Please make the required changes below and click "Submit for Review" when ready.
              </p>
            </div>
          </div>
        </div>
      )}

      {formData.status === "REJECTED" && formData.rejectionReason && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-100 rounded-xl text-rose-800">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-200 text-rose-900 uppercase">
                Package Rejected
              </span>
              <h3 className="text-lg font-bold text-rose-950 mt-1">Rejection Reason</h3>
              <p className="text-rose-900 mt-2 bg-white/70 p-4 rounded-xl border border-rose-200 text-sm font-medium">
                "{formData.rejectionReason}"
              </p>
              <p className="text-xs text-rose-700 mt-2">
                You can revise your package details and resubmit for administrator approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Published State Notice */}
      {formData.status === "PUBLISHED" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-emerald-600" size={20} />
            <div>
              <p className="text-sm font-bold text-emerald-900">This package is currently Live & Published</p>
              <p className="text-xs text-emerald-700">Travellers can discover and book this package. Submitting updates will require admin re-approval.</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-200 text-emerald-900 rounded-full uppercase">
            Live
          </span>
        </div>
      )}

      {/* Top Step Navigation Bar (Responsive Pill Steps) */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[620px] gap-2">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-blue-600 text-white font-bold shadow-xs"
                    : isCompleted
                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                    isActive
                      ? "bg-white/20 text-white"
                      : isCompleted
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isCompleted ? <CheckCircle size={14} /> : step.id}
                </div>
                <div className="truncate">
                  <div className="text-[11px] uppercase tracking-wider opacity-80 leading-none">Step {step.id}</div>
                  <div className="text-xs font-bold truncate mt-0.5">{step.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-200 font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X size={18} />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 text-green-700 p-4 rounded-2xl border border-green-200 font-medium flex items-center gap-2">
          <CheckCircle size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Step Container */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        
        {/* ==================== STEP 1: BASICS & PHOTOS ==================== */}
        {currentStep === 1 && (
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="text-blue-600" size={24} />
                Step 1: Basics & Photos
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Provide essential information and upload photos to showcase your tour experience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Package Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. 5-Day Scenic Hill Country & Wildlife Adventure"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tour Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-medium bg-white"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Key Destinations / Stops
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={destinationInput}
                    onChange={e => setDestinationInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDestination(); } }}
                    placeholder="e.g. Kandy, Ella, Yala"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-medium"
                  />
                  <button
                    type="button"
                    onClick={addDestination}
                    className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-colors"
                  >
                    Add
                  </button>
                </div>
                {formData.destinations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.destinations.map(d => (
                      <span key={d} className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold">
                        <MapPin size={12} className="text-blue-500" />
                        {d}
                        <button type="button" onClick={() => removeDestination(d)} className="text-slate-400 hover:text-red-600 ml-0.5">
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Short Summary (Shown on search cards) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.shortDescription}
                  onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Give travellers a crisp 2-sentence hook highlighting the journey..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Full Description & Story
                </label>
                <textarea
                  rows={4}
                  value={formData.fullDescription}
                  onChange={e => setFormData({ ...formData, fullDescription: e.target.value })}
                  placeholder="Describe the entire experience, secret spots, viewpoints, culture, and hospitality..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-medium"
                />
              </div>

              {/* Cover Photo Section */}
              <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ImageIcon size={16} className="text-blue-600" /> Cover Photo
                    </h3>
                    <p className="text-xs text-slate-500">Upload a high-quality JPG, PNG, or WebP image (max 5MB).</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleCoverUpload}
                    />
                    <button
                      type="button"
                      disabled={uploadingCover}
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <Upload size={14} />
                      {uploadingCover ? "Uploading..." : formData.coverPhoto ? "Replace Photo" : "Upload Photo"}
                    </button>
                    {formData.coverPhoto && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, coverPhoto: "" })}
                        className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div className="sm:col-span-1 h-36 rounded-xl overflow-hidden border border-slate-200 shadow-xs relative bg-white">
                    <PackageImage
                      src={formData.coverPhoto}
                      alt={formData.title || "Cover Preview"}
                      category={formData.category}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-600">Or Paste Image URL directly:</label>
                    <input
                      type="url"
                      value={formData.coverPhoto}
                      onChange={e => setFormData({ ...formData, coverPhoto: e.target.value })}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono outline-none focus:border-blue-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      If the URL breaks or cannot be loaded, our automatic Sri Lanka travel fallback badge will display gracefully.
                    </p>
                  </div>
                </div>
              </div>

              {/* Gallery Photos Section */}
              <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles size={16} className="text-amber-500" /> Additional Gallery Photos
                    </h3>
                    <p className="text-xs text-slate-500">Showcase vehicle comfort, destinations, and scenic attractions.</p>
                  </div>
                  <div>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleGalleryUpload}
                    />
                    <button
                      type="button"
                      disabled={uploadingGallery}
                      onClick={() => galleryInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <Upload size={14} />
                      {uploadingGallery ? "Uploading..." : "Add Gallery Images"}
                    </button>
                  </div>
                </div>

                {formData.galleryPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {formData.galleryPhotos.map((imgUrl, idx) => (
                      <div key={idx} className="relative h-24 rounded-xl overflow-hidden border border-slate-200 group bg-white shadow-xs">
                        <img src={imgUrl} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeGalleryPhoto(idx)}
                          className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No gallery photos uploaded yet. (Optional)</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 2: ITINERARY & LOGISTICS ==================== */}
        {currentStep === 2 && (
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="text-blue-600" size={24} />
                Step 2: Itinerary & Logistics
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Configure tour duration, starting logistics, and day-by-day travel details with estimated route timings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duration (Days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.days}
                  onChange={e => handleDaysChange(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duration (Nights)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={formData.nights}
                  onChange={e => setFormData({ ...formData, nights: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Starting City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.startingCity}
                  onChange={e => setFormData({ ...formData, startingCity: e.target.value })}
                  placeholder="e.g. Colombo / Negombo"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pickup Time
                </label>
                <input
                  type="text"
                  value={formData.pickupTime}
                  onChange={e => setFormData({ ...formData, pickupTime: e.target.value })}
                  placeholder="e.g. 08:00 AM or Flexible"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pickup Location / Service Area
                </label>
                <input
                  type="text"
                  value={formData.pickupOptions}
                  onChange={e => setFormData({ ...formData, pickupOptions: e.target.value })}
                  placeholder="e.g. BIA Airport or any hotel within Colombo/Negombo"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-800 text-sm bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Final Drop-off Location
                </label>
                <input
                  type="text"
                  value={formData.dropoffLocation}
                  onChange={e => setFormData({ ...formData, dropoffLocation: e.target.value })}
                  placeholder="e.g. Colombo hotel or BIA Airport departure terminal"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-800 text-sm bg-white"
                />
              </div>
            </div>

            {/* Day by Day Builder */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Day-by-Day Itinerary Builder</h3>
                  <p className="text-xs text-slate-500">Provide driving estimates, attractions, stop durations, and overnight stays for each day.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDaysChange(formData.days + 1)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors"
                >
                  <Plus size={14} /> Add Day
                </button>
              </div>

              <div className="space-y-4">
                {formData.itinerary.map((day, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs">
                          {day.dayNumber}
                        </span>
                        <input
                          type="text"
                          value={day.title || `Day ${day.dayNumber}`}
                          onChange={e => updateItineraryDay(idx, { title: e.target.value })}
                          placeholder={`Day ${day.dayNumber} Title / Highlights`}
                          className="font-bold text-slate-900 bg-transparent outline-none focus:bg-white px-2 py-1 rounded-md text-sm border border-transparent focus:border-slate-300"
                        />
                      </div>
                      {formData.itinerary.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDaysChange(formData.days - 1)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remove this day"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Places to Visit / Key Attractions
                        </label>
                        <input
                          type="text"
                          value={(day.placesToVisit || []).join(", ")}
                          onChange={e =>
                            updateItineraryDay(idx, {
                              placesToVisit: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                            })
                          }
                          placeholder="e.g. Pinnawala Elephant Sanctuary, Spice Garden"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Activities Planned
                        </label>
                        <input
                          type="text"
                          value={(day.activities || []).join(", ")}
                          onChange={e =>
                            updateItineraryDay(idx, {
                              activities: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                            })
                          }
                          placeholder="e.g. Scenic drive, Photography, Cultural dance show"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Estimated Driving Time <span className="text-blue-600">(Clearly labeled)</span>
                        </label>
                        <input
                          type="text"
                          value={day.travelTime || ""}
                          onChange={e => updateItineraryDay(idx, { travelTime: e.target.value })}
                          placeholder="e.g. Estimated driving time: ~3.5 hours"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Stop Durations
                        </label>
                        <input
                          type="text"
                          value={day.stopDuration || ""}
                          onChange={e => updateItineraryDay(idx, { stopDuration: e.target.value })}
                          placeholder="e.g. 1.5 - 2 hours at main viewpoints"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Overnight Location & Hotel
                        </label>
                        <input
                          type="text"
                          value={day.overnightLocation || ""}
                          onChange={e => updateItineraryDay(idx, { overnightLocation: e.target.value })}
                          placeholder="e.g. Kandy (Standard AC Hotel)"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Accommodation Details
                        </label>
                        <input
                          type="text"
                          value={day.accommodationDetails || ""}
                          onChange={e => updateItineraryDay(idx, { accommodationDetails: e.target.value })}
                          placeholder="e.g. Air-conditioned twin room with breakfast"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">
                          Day Notes / Recommendations
                        </label>
                        <input
                          type="text"
                          value={day.notes || ""}
                          onChange={e => updateItineraryDay(idx, { notes: e.target.value })}
                          placeholder="e.g. Early start recommended to avoid temple crowds; bring walking socks"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: VEHICLE & PRICING ==================== */}
        {currentStep === 3 && (
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Car className="text-blue-600" size={24} />
                Step 3: Vehicle & Pricing
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Select your approved vehicle type, verify passenger limits, and configure explicit pricing terms.
              </p>
            </div>

            {/* Vehicle Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-800">
                Select Vehicle Type <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {vehicleOptions.map(veh => {
                  const isSelected = formData.vehicleTypeId === veh._id;
                  return (
                    <div
                      key={veh._id}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          vehicleTypeId: veh._id,
                          maxPassengers: Math.min(prev.maxPassengers, veh.maxPassengers)
                        }));
                      }}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/50 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900 text-sm">{veh.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {veh.category}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-blue-600" />
                          <span>Max {veh.maxPassengers} Passengers</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Car size={14} className="text-emerald-600" />
                          <span>Max {veh.maxLuggage} Luggage</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                          <CheckCircle size={14} />
                          <span>Air Conditioned</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {primaryVehicleInfo && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3 text-xs text-slate-700">
                  <ShieldCheck className="text-blue-600 shrink-0" size={18} />
                  <span>
                    <strong>Registered Primary Vehicle:</strong> {primaryVehicleInfo.vehicleModel} ({primaryVehicleInfo.plateNumber}) • {primaryVehicleInfo.vehicleCategory}
                  </span>
                </div>
              )}
            </div>

            {/* Capacity Controls & Validation */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Passenger & Capacity Rules</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Group Size
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={formData.maxPassengers}
                    value={formData.minPassengers}
                    onChange={e => setFormData({ ...formData, minPassengers: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900 font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Maximum Passengers
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedVehicle?.maxPassengers || 10}
                    value={formData.maxPassengers}
                    onChange={e => setFormData({ ...formData, maxPassengers: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900 font-bold bg-white"
                  />
                </div>
              </div>

              {capacityExceeded && (
                <div className="bg-rose-50 text-rose-800 p-3 rounded-xl border border-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>
                    Warning: Maximum passengers ({formData.maxPassengers}) exceeds the selected vehicle capacity ({selectedVehicle?.maxPassengers}). Please adjust group size or choose a larger vehicle.
                  </span>
                </div>
              )}
            </div>

            {/* Pricing Details */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Pricing Basis & Structure</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.costs.currency}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        costs: { ...formData.costs, currency: e.target.value as any }
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                  >
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pricing Basis <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.costs.priceType}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        costs: { ...formData.costs, priceType: e.target.value as any }
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                  >
                    <option value="PER_VEHICLE">Per Vehicle (Entire Group)</option>
                    <option value="PER_PERSON">Per Person Rate</option>
                    <option value="ENTIRE_PACKAGE">Entire All-Inclusive Package</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Starting / Base Price ({formData.costs.currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.costs.basePrice}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        costs: {
                          ...formData.costs,
                          basePrice: Number(e.target.value),
                          totalStartingPrice: Number(e.target.value)
                        }
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Passengers Covered in Base Price
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.costs.passengerCountCovered}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        costs: { ...formData.costs, passengerCountCovered: Number(e.target.value) }
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Extra Person Rate ({formData.costs.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.costs.extraPersonRate}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        costs: { ...formData.costs, extraPersonRate: Number(e.target.value) }
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Advance Deposit ({formData.costs.currency} or %0)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.costs.depositRequired}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        costs: { ...formData.costs, depositRequired: Number(e.target.value) }
                      })
                    }
                    placeholder="0 for full payment on completion"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 4: AMENITIES, INCLUSIONS & TRAVELLER INFO ==================== */}
        {currentStep === 4 && (
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="text-blue-600" size={24} />
                Step 4: Amenities, Inclusions & Traveller Information
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Configure refreshments and amenities (drinking water, snacks, tea/coffee, Wi-Fi), service specifics, and travel requirements.
              </p>
            </div>

            {/* Amenities & Refreshments Builder */}
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="text-blue-600" size={18} />
                    Amenities & Refreshments
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure complimentary refreshments or optional paid upgrades with specific quantities and coverage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAddAmenity()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  <Plus size={15} /> Add Custom Item
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Quick Add Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddAmenity({
                      name: "Drinking Water",
                      category: "WATER",
                      isIncluded: true,
                      quantity: 2,
                      unit: "500 ml bottles",
                      coverage: "PER_PERSON_PER_DAY",
                      description: "Two 500 ml mineral water bottles per person per day included."
                    })}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <span>💧</span> Drinking Water (2 x 500ml/day)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddAmenity({
                      name: "Snack Pack",
                      category: "SNACKS",
                      isIncluded: true,
                      quantity: 1,
                      unit: "pack",
                      coverage: "PER_PERSON_PER_TRIP",
                      description: "One snack pack per person per trip included."
                    })}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <span>🍪</span> Snack Pack (1/trip)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddAmenity({
                      name: "Ceylon Tea / Fresh Coffee",
                      category: "BEVERAGES",
                      isIncluded: true,
                      quantity: 1,
                      unit: "cup stop",
                      coverage: "PER_PERSON_PER_DAY",
                      description: "Daily fresh tea or coffee tasting stop included."
                    })}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <span>☕</span> Ceylon Tea & Coffee
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddAmenity({
                      name: "Welcome King Coconut",
                      category: "BEVERAGES",
                      isIncluded: true,
                      quantity: 1,
                      unit: "fresh coconut",
                      coverage: "PER_PERSON_PER_TRIP",
                      description: "Chilled fresh king coconut welcome drink on arrival."
                    })}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <span>🥥</span> King Coconut Welcome
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddAmenity({
                      name: "Onboard 4G Wi-Fi",
                      category: "WIFI",
                      isIncluded: true,
                      quantity: 1,
                      unit: "hotspot",
                      coverage: "PER_VEHICLE",
                      description: "High-speed 4G Wi-Fi throughout the tour for all passengers."
                    })}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <span>📶</span> 4G Wi-Fi (Per vehicle)
                  </button>
                </div>
              </div>

              {/* Configured Amenities List */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Configured Amenities ({formData.amenities.length}):
                </span>

                {formData.amenities.length === 0 ? (
                  <div className="p-4 bg-white rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    No amenities configured yet. Click a preset above or add a custom item.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {formData.amenities.map((item, idx) => {
                      const coverageLabel = item.coverage === "PER_PERSON_PER_DAY"
                        ? "per person per day"
                        : item.coverage === "PER_PERSON_PER_TRIP"
                        ? "per person per trip"
                        : "per vehicle";

                      return (
                        <div
                          key={item.id || idx}
                          className={`p-4 rounded-2xl border ${
                            item.isIncluded
                              ? "bg-white border-emerald-200 shadow-2xs"
                              : "bg-white border-amber-200 shadow-2xs"
                          } flex flex-col justify-between gap-3`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  item.isIncluded
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {item.isIncluded ? "Included" : "Extra Charge"}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 font-medium">
                              {item.quantity ? `${item.quantity} ${item.unit || "units"} ` : ""}
                              {coverageLabel} {item.isIncluded ? "included" : "available"}
                            </p>

                            {item.description && (
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}

                            {!item.isIncluded && (
                              <p className="text-xs font-bold text-amber-700 mt-2">
                                Rate: {item.currency || formData.costs.currency || "LKR"} {item.price?.toLocaleString()} ({item.chargingBasis?.replace(/_/g, " ").toLowerCase() || "per person"})
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAmenity(idx)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAmenity(idx)}
                              className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Inclusions */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-800">
                Included Services
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_INCLUSIONS.map(item => {
                  const active = formData.inclusionsList.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInclusion(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        active
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {active ? "✓ " : "+ "} {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Exclusions */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-800">
                Excluded Services (Traveller Responsibility)
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_EXCLUSIONS.map(item => {
                  const active = formData.exclusionsList.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleExclusion(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        active
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {active ? "✓ " : "+ "} {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Specific Service Details */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Specific Service Breakdown</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Accommodation Details
                  </label>
                  <textarea
                    rows={2}
                    value={formData.includedServicesDetails.accommodation || ""}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        includedServicesDetails: {
                          ...formData.includedServicesDetails,
                          accommodation: e.target.value
                        }
                      })
                    }
                    placeholder="e.g. 3-star AC hotels with ensuite bathroom and breakfast."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Meals Details
                  </label>
                  <textarea
                    rows={2}
                    value={formData.includedServicesDetails.meals || ""}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        includedServicesDetails: {
                          ...formData.includedServicesDetails,
                          meals: e.target.value
                        }
                      })
                    }
                    placeholder="e.g. Breakfast daily included at hotel. Lunch & dinner stops at authentic eateries."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tickets & National Park Fees
                  </label>
                  <textarea
                    rows={2}
                    value={formData.includedServicesDetails.tickets || ""}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        includedServicesDetails: {
                          ...formData.includedServicesDetails,
                          tickets: e.target.value
                        }
                      })
                    }
                    placeholder="e.g. Tickets not included. Driver will arrange queue skips and ticket desk purchases."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Driver / Guide Qualifications
                  </label>
                  <textarea
                    rows={2}
                    value={formData.includedServicesDetails.guide || ""}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        includedServicesDetails: {
                          ...formData.includedServicesDetails,
                          guide: e.target.value
                        }
                      })
                    }
                    placeholder="e.g. SLTDA registered chauffeur guide with 8+ years island experience."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Traveller Requirements & Accessibility */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Languages & Travel Profile</h3>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Tour Languages Spoken</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_LANGUAGES.map(lang => {
                    const active = formData.languages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {active ? "✓ " : ""} {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Activity Level
                  </label>
                  <select
                    value={formData.activityLevel}
                    onChange={e => setFormData({ ...formData, activityLevel: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-900 bg-white text-xs"
                  >
                    <option value="Easy">Easy (Relaxed, minimal walking)</option>
                    <option value="Moderate">Moderate (Some steps & walks)</option>
                    <option value="Strenuous">Strenuous (Hikes, climbs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Accessibility
                  </label>
                  <input
                    type="text"
                    value={formData.accessibility}
                    onChange={e => setFormData({ ...formData, accessibility: e.target.value })}
                    placeholder="e.g. Wheelchair accessible with prior notice"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="childSeat"
                    checked={formData.childSeatAvailable}
                    onChange={e => setFormData({ ...formData, childSeatAvailable: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                  <label htmlFor="childSeat" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Child safety seat available on request
                  </label>
                </div>
              </div>

              {/* Recommended things to bring */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recommended Things to Bring
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={thingInput}
                    onChange={e => setThingInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addThing(); } }}
                    placeholder="e.g. Insect repellent, temple dress"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={addThing}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Add
                  </button>
                </div>
                {formData.thingsToBring.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.thingsToBring.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-800 rounded-full text-[11px] font-semibold">
                        {t}
                        <button type="button" onClick={() => removeThing(t)} className="text-slate-500 hover:text-red-600">
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 5: AVAILABILITY & TERMS ==================== */}
        {currentStep === 5 && (
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" size={24} />
                Step 5: Availability, Cancellation & Policies
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Define operational schedules, advance notice required, refund policies, and weather conditions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Availability / Operational Days
                </label>
                <input
                  type="text"
                  value={formData.availableDates}
                  onChange={e => setFormData({ ...formData, availableDates: e.target.value })}
                  placeholder="e.g. Daily year-round (Best Nov - April)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Advance Booking Notice (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={formData.advanceNoticeDays}
                  onChange={e => setFormData({ ...formData, advanceNoticeDays: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900 font-bold"
                />
                <p className="text-[11px] text-slate-400 mt-1">Travellers must book at least this many days in advance.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Cancellation & Refund Terms <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.cancellationPolicy}
                  onChange={e => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                  placeholder="e.g. Free cancellation up to 48 hours before pickup. 50% refund within 24 hours."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900 font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Weather or Route-Change Policy
                </label>
                <textarea
                  rows={2}
                  value={formData.weatherPolicy}
                  onChange={e => setFormData({ ...formData, weatherPolicy: e.target.value })}
                  placeholder="e.g. In case of heavy monsoon rains or landslides, alternative scenic viewpoints will be arranged with your agreement."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900 font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Extra-Charge Conditions & Mileage Limits
                </label>
                <textarea
                  rows={2}
                  value={formData.extraChargeConditions}
                  onChange={e => setFormData({ ...formData, extraChargeConditions: e.target.value })}
                  placeholder="e.g. Standard packages include 150 km per day. Excess distance charged at 120 LKR per km."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-slate-900 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 6: REVIEW & LIVE PREVIEW ==================== */}
        {currentStep === 6 && (
          <div className="p-6 md:p-8 space-y-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="text-blue-600" size={24} />
                Step 6: Review & Final Submission
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Inspect how your tour package looks to travellers and administrators before saving or submitting.
              </p>
            </div>

            {/* Live Card Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Card Preview (Listing Page)</h3>
                <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
                  <div className="h-48 relative overflow-hidden bg-slate-100">
                    <PackageImage
                      src={formData.coverPhoto}
                      alt={formData.title || "Cover Preview"}
                      category={formData.category}
                    />
                    <div className="absolute top-4 left-4 bg-blue-600/90 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
                      {formData.category}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h4 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{formData.title || "Untitled Package"}</h4>
                    <p className="text-slate-500 text-xs mb-4 line-clamp-2">{formData.shortDescription || "No description provided."}</p>
                    
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-4 mt-auto">
                      <span className="flex items-center gap-1"><Calendar size={14} className="text-slate-400"/> {formData.days} Days / {formData.nights} Nights</span>
                      <span className="flex items-center gap-1"><MapPin size={14} className="text-slate-400"/> {formData.startingCity || "Sri Lanka"}</span>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">From</p>
                        <p className="font-extrabold text-slate-900 text-base">
                          {formData.costs.currency} {formData.costs.basePrice.toLocaleString()}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
                        {formData.costs.priceType.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comprehensive Summary Details */}
              <div className="lg:col-span-2 space-y-4 text-sm">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="font-bold text-slate-900 text-base">Logistics & Vehicle Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Vehicle Type</span>
                      <span className="font-bold text-slate-800">{selectedVehicle?.name || "Standard Car"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Passenger Limit</span>
                      <span className="font-bold text-slate-800">{formData.minPassengers} - {formData.maxPassengers} Pax</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Pickup Location</span>
                      <span className="font-bold text-slate-800">{formData.pickupOptions}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Drop-off Location</span>
                      <span className="font-bold text-slate-800">{formData.dropoffLocation}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Advance Notice</span>
                      <span className="font-bold text-slate-800">{formData.advanceNoticeDays} days</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Languages</span>
                      <span className="font-bold text-slate-800">{formData.languages.join(", ")}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="font-bold text-slate-900 text-base">Itinerary Overview ({formData.itinerary.length} Days)</h3>
                  <div className="space-y-2 text-xs">
                    {formData.itinerary.map(day => (
                      <div key={day.dayNumber} className="bg-white p-3 rounded-xl border border-slate-200">
                        <div className="font-bold text-slate-900 flex justify-between">
                          <span>Day {day.dayNumber}: {day.title}</span>
                          <span className="text-blue-600 font-semibold">{day.travelTime}</span>
                        </div>
                        {day.placesToVisit && day.placesToVisit.length > 0 && (
                          <div className="text-slate-600 mt-1">
                            <strong>Attractions:</strong> {day.placesToVisit.join(", ")}
                          </div>
                        )}
                        {day.overnightLocation && (
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            <strong>Stay:</strong> {day.overnightLocation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 6 Amenities Preview */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-base">Amenities & Refreshments ({formData.amenities.length})</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Edit Step 4 &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {formData.amenities.map((item, idx) => (
                      <div key={item.id || idx} className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{item.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.isIncluded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {item.isIncluded ? 'Included' : `+ ${item.currency || formData.costs.currency || "LKR"} ${item.price?.toLocaleString()}`}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {item.quantity ? `${item.quantity} ${item.unit || ""} ` : ""}
                          ({item.coverage.replace(/_/g, " ").toLowerCase()})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== BOTTOM STEP ACTIONS ==================== */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Save as Draft */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSave(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Draft"}
            </button>

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-xs"
              >
                Next Step <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || capacityExceeded}
                onClick={() => handleSave(true)}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-all shadow-md disabled:opacity-50"
              >
                <CheckCircle size={18} />
                {loading ? "Submitting..." : isEdit && formData.changeRequest ? "Resubmit for Review" : "Submit for Review"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Amenity Modal */}
      {amenityModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="text-blue-600" size={18} />
                {editingAmenityIndex !== null ? "Edit Amenity" : "Add Amenity / Refreshment"}
              </h3>
              <button
                type="button"
                onClick={() => setAmenityModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={amenityForm.name}
                  onChange={e => setAmenityForm({ ...amenityForm, name: e.target.value })}
                  placeholder="e.g. Drinking Water, Snack Pack, Ceylon Tea, Wi-Fi"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={amenityForm.category || "WATER"}
                    onChange={e => setAmenityForm({ ...amenityForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-900 font-semibold"
                  >
                    <option value="WATER">Drinking Water</option>
                    <option value="SNACKS">Snacks & Refreshments</option>
                    <option value="BEVERAGES">Beverages (Tea/Coffee/Drinks)</option>
                    <option value="WIFI">Wi-Fi & Connectivity</option>
                    <option value="CUSTOM">Custom Item</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Coverage Scope</label>
                  <select
                    value={amenityForm.coverage}
                    onChange={e => setAmenityForm({ ...amenityForm, coverage: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-900 font-semibold"
                  >
                    <option value="PER_PERSON_PER_DAY">Per Person / Day</option>
                    <option value="PER_PERSON_PER_TRIP">Per Person / Trip</option>
                    <option value="PER_VEHICLE">Per Vehicle</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={amenityForm.quantity || 1}
                    onChange={e => setAmenityForm({ ...amenityForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={amenityForm.unit || ""}
                    onChange={e => setAmenityForm({ ...amenityForm, unit: e.target.value })}
                    placeholder="e.g. 500 ml bottles, pack, cup, hotspot"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-900 font-semibold"
                  />
                </div>
              </div>

              {/* Inclusion vs Extra Charge Toggle */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Pricing Terms</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmenityForm({ ...amenityForm, isIncluded: true })}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      amenityForm.isIncluded
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    ✓ Included in Price (Free)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmenityForm({ ...amenityForm, isIncluded: false })}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      !amenityForm.isIncluded
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    + Available at Extra Charge
                  </button>
                </div>
              </div>

              {/* Extra charge specifics */}
              {!amenityForm.isIncluded && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-amber-900 mb-1 text-[11px]">Extra Price</label>
                    <input
                      type="number"
                      min={0}
                      value={amenityForm.price || 0}
                      onChange={e => setAmenityForm({ ...amenityForm, price: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-amber-900 mb-1 text-[11px]">Currency</label>
                    <select
                      value={amenityForm.currency || "LKR"}
                      onChange={e => setAmenityForm({ ...amenityForm, currency: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-900"
                    >
                      <option value="LKR">LKR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-amber-900 mb-1 text-[11px]">Charging Basis</label>
                    <select
                      value={amenityForm.chargingBasis || "PER_PERSON"}
                      onChange={e => setAmenityForm({ ...amenityForm, chargingBasis: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-900"
                    >
                      <option value="PER_PERSON">Per Person</option>
                      <option value="PER_VEHICLE">Per Vehicle</option>
                      <option value="PER_ITEM">Per Item</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Optional Description</label>
                <textarea
                  rows={2}
                  value={amenityForm.description || ""}
                  onChange={e => setAmenityForm({ ...amenityForm, description: e.target.value })}
                  placeholder="e.g. Bottled mineral water refreshed daily for each traveller."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAmenityModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!amenityForm.name.trim()}
                onClick={handleSaveAmenity}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                Save Amenity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

