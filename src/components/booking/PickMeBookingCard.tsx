"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  MapPin,
  Navigation,
  Bike,
  Car,
  Truck,
  Clock,
  Calendar,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Package,
  Sparkles,
  Info,
  X,
  CreditCard,
  Banknote,
  ArrowRight,
  ShieldCheck,
  LocateFixed,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

// Dynamically import Leaflet components to avoid SSR/hydration errors
const DraggablePinMapModal = dynamic(
  () => import("./DraggablePinMapModal"),
  { ssr: false }
);

const PickMeRoutePreviewMap = dynamic(
  () => import("./PickMeRoutePreviewMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-48 bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400 animate-pulse border border-slate-200">
        Loading road route map...
      </div>
    ),
  }
);

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export interface IntermediateStopPoint extends LocationPoint {
  id: string;
  notes?: string;
}

export interface CategoryFareEstimate {
  category: string;
  displayName: string;
  description: string;
  maxPassengers: number;
  maxLuggage: number;
  loadCapacityKg?: number;
  isGoodsTransport: boolean;
  baseFare: number;
  ratePerKm: number;
  minimumFare: number;
  estimatedFare: number;
  isAvailable: boolean;
  unavailableReason?: string;
  sortOrder: number;
}

export interface RouteStats {
  distanceKm: number;
  durationMins: number;
  coordinates: [number, number][];
}

const DRAFT_STORAGE_KEY = "lar_pickme_booking_draft";

export default function PickMeBookingCard() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // Booking mode selector: Local Ride vs Airport Transfer
  const [bookingMode, setBookingMode] = useState<"LOCAL" | "AIRPORT">("LOCAL");

  // Step state: 1 (Pickup) -> 2 (Stops & Destination) -> 3 (Vehicle & Fare) -> 4 (Review)
  // Always starts on Step 1 for fresh bookings and post-authentication return
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Pickup Location & Instructions
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [pickupSearchText, setPickupSearchText] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationPoint[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Step 2: Destination & Intermediate Stops
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [destinationSearchText, setDestinationSearchText] = useState("");
  const [destinationSuggestions, setDestinationSuggestions] = useState<LocationPoint[]>([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);

  // Intermediate stops (Max 5)
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStopPoint[]>([]);
  const [activeStopInputIndex, setActiveStopInputIndex] = useState<number | null>(null);

  // Road Routing & Anti-stale Ref
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const routingRequestIdRef = useRef(0);

  // Step 3: Vehicle & Fare
  const [categories, setCategories] = useState<CategoryFareEstimate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Car");
  const [goodsDescription, setGoodsDescription] = useState("");
  const [rideNow, setRideNow] = useState(true);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Step 4: Passenger Details & Payment
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    phoneNumber?: string;
  } | null>(null);
  const [hasWhatsAppConfirmed, setHasWhatsAppConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");

  // Map Modal State for "Choose on Map"
  const [mapModalConfig, setMapModalConfig] = useState<{
    isOpen: boolean;
    targetType: "pickup" | "destination" | "stop";
    stopIndex?: number;
    title: string;
    confirmLabel: string;
    initialCoords?: { lat: number; lng: number } | null;
    initialAddress?: string;
  }>({
    isOpen: false,
    targetType: "pickup",
    title: "Choose Location on Map",
    confirmLabel: "Confirm Location",
  });

  // Draft state
  const [draftRestored, setDraftRestored] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // User Role Check
  const userRole = (session?.user as any)?.role;
  const isDriverOrAdmin = userRole === "DRIVER" || userRole === "ADMIN";
  const isAuthenticated = sessionStatus === "authenticated" && Boolean(session?.user);

  // Fetch verified profile details from database when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetch("/api/user/profile")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            setUserProfile({
              name: data.user.name || session?.user?.name || "Rider",
              email: data.user.email || session?.user?.email || "",
              phoneNumber: data.user.phoneNumber || (session?.user as any)?.phoneNumber || "",
            });
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, session]);

  // Restore draft from sessionStorage on mount (preserving entered locations, starting at Step 1)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedDraft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.pickup) {
            setPickup(parsed.pickup);
            setPickupSearchText(parsed.pickup.address);
          }
          if (parsed.pickupInstructions) {
            setPickupInstructions(parsed.pickupInstructions);
          }
          if (Array.isArray(parsed.intermediateStops)) {
            setIntermediateStops(parsed.intermediateStops);
          }
          if (parsed.destination) {
            setDestination(parsed.destination);
            setDestinationSearchText(parsed.destination.address);
          }
          if (parsed.selectedCategory) {
            setSelectedCategory(parsed.selectedCategory);
          }
          if (parsed.goodsDescription) {
            setGoodsDescription(parsed.goodsDescription);
          }
          if (parsed.paymentMethod) {
            setPaymentMethod(parsed.paymentMethod);
          }
          if (parsed.hasWhatsAppConfirmed !== undefined) {
            setHasWhatsAppConfirmed(parsed.hasWhatsAppConfirmed);
          }
          if (parsed.currentStep && parsed.currentStep > 1) {
            setCurrentStep(parsed.currentStep);
          }
        }
      } catch {
        // Ignore JSON error
      } finally {
        setDraftRestored(true);
      }
    }
  }, []);

  // Save draft whenever key inputs change (only after draft has been loaded)
  useEffect(() => {
    if (!draftRestored) return;
    if (typeof window !== "undefined") {
      try {
        const draft = {
          currentStep,
          pickup,
          pickupInstructions,
          intermediateStops,
          destination,
          selectedCategory,
          goodsDescription,
          paymentMethod,
          rideNow,
          scheduledDate,
          scheduledTime,
          hasWhatsAppConfirmed,
        };
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // Ignore storage errors
      }
    }
  }, [pickup, pickupInstructions, intermediateStops, destination, selectedCategory, goodsDescription]);

  // Fetch initial active categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/pickme/categories");
        if (res.ok) {
          const data = await res.json();
          if (data.categories && Array.isArray(data.categories)) {
            const mapped = data.categories.map((c: any) => ({
              category: c.category,
              displayName: c.displayName,
              description: c.description,
              maxPassengers: c.passengerCapacity,
              maxLuggage: c.luggageCapacity,
              loadCapacityKg: c.loadCapacityKg,
              isGoodsTransport: Boolean(c.isGoodsTransport),
              baseFare: c.baseFare,
              ratePerKm: c.ratePerKm,
              minimumFare: c.minimumFare,
              estimatedFare: c.minimumFare || 0,
              isAvailable: Boolean(c.isActive),
              sortOrder: c.sortOrder || 0,
            }));
            setCategories(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load vehicle categories:", err);
      }
    }
    fetchCategories();
  }, []);

  // Debounced search for Pickup
  useEffect(() => {
    if (!pickupSearchText || (pickup && pickup.address === pickupSearchText)) {
      setPickupSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setPickupLoading(true);
      try {
        const res = await fetch(`/api/pickme/geocode?q=${encodeURIComponent(pickupSearchText)}`);
        if (res.ok) {
          const data = await res.json();
          setPickupSuggestions(data.results || []);
          setShowPickupDropdown(true);
        }
      } catch {
        // Ignore
      } finally {
        setPickupLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [pickupSearchText, pickup]);

  // Debounced search for Destination
  useEffect(() => {
    if (!destinationSearchText || (destination && destination.address === destinationSearchText)) {
      setDestinationSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setDestinationLoading(true);
      try {
        const res = await fetch(`/api/pickme/geocode?q=${encodeURIComponent(destinationSearchText)}`);
        if (res.ok) {
          const data = await res.json();
          setDestinationSuggestions(data.results || []);
          setShowDestinationDropdown(true);
        }
      } catch {
        // Ignore
      } finally {
        setDestinationLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [destinationSearchText, destination]);

  // Road Route & Fare Calculation with Anti-Stale Protection
  const calculateRouteAndFares = useCallback(
    async (
      origin: LocationPoint,
      dest: LocationPoint,
      stops: IntermediateStopPoint[]
    ) => {
      const thisRequestId = ++routingRequestIdRef.current;
      setRoutingLoading(true);
      setRoutingError(null);

      try {
        const res = await fetch("/api/pickme/fares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup: origin,
            destination: dest,
            intermediateStops: stops.map((s, idx) => ({
              address: s.address,
              lat: s.lat,
              lng: s.lng,
              stopOrder: idx + 1,
              notes: s.notes,
            })),
          }),
        });

        // Discard response if a newer calculation was started
        if (thisRequestId !== routingRequestIdRef.current) return;

        const data = await res.json();

        if (!res.ok || data.status !== "ok") {
          throw new Error(data.error || "Road routing is temporarily unavailable. Please retry.");
        }

        setRouteStats({
          distanceKm: data.distanceKm,
          durationMins: data.durationMins,
          coordinates: data.coordinates || [],
        });

        if (Array.isArray(data.estimates) && data.estimates.length > 0) {
          setCategories(data.estimates);
          // If current selected category is not available, pick first available
          const current = data.estimates.find((c: any) => c.category === selectedCategory);
          if (!current || !current.isAvailable) {
            const firstAvail = data.estimates.find((c: any) => c.isAvailable);
            if (firstAvail) setSelectedCategory(firstAvail.category);
          }
        }
      } catch (err: any) {
        if (thisRequestId !== routingRequestIdRef.current) return;
        setRoutingError(err.message || "Could not calculate driving route. Please check addresses or retry.");
        setRouteStats(null);
      } finally {
        if (thisRequestId === routingRequestIdRef.current) {
          setRoutingLoading(false);
        }
      }
    },
    [selectedCategory]
  );

  // Recalculate route whenever locations change and both pickup and destination exist
  useEffect(() => {
    if (pickup && destination) {
      calculateRouteAndFares(pickup, destination, intermediateStops);
    } else {
      setRouteStats(null);
      setRoutingError(null);
    }
  }, [pickup, destination, intermediateStops, calculateRouteAndFares]);

  // Geolocation Handler for "Use Current Location"
  const handleUseCurrentLocation = () => {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser. Please search or pick on map.");
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = `My Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

        try {
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
            { headers: { "User-Agent": "LankaAirportRide-PickMe/1.0" } }
          );
          if (revRes.ok) {
            const revData = await revRes.json();
            if (revData.display_name) {
              address = revData.display_name.split(",").slice(0, 3).join(",");
            }
          }
        } catch {
          // Fall back to coordinate label
        }

        const point: LocationPoint = { address, lat, lng };
        setPickup(point);
        setPickupSearchText(address);
        setShowPickupDropdown(false);
      },
      (err) => {
        setGeoLoading(false);
        let msg = "Unable to retrieve your location. Please check browser permissions.";
        if (err.code === 1) {
          msg = "Location permission denied. Please allow location access in your browser or type your address.";
        } else if (err.code === 2) {
          msg = "Position unavailable. Please search your address manually or choose on the map.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please retry or choose on the map.";
        }
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Intermediate Stop Management
  const handleAddStop = () => {
    if (intermediateStops.length >= 5) return;
    const newStop: IntermediateStopPoint = {
      id: `stop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      address: "",
      lat: 0,
      lng: 0,
    };
    setIntermediateStops([...intermediateStops, newStop]);
    setActiveStopInputIndex(intermediateStops.length);
  };

  const handleRemoveStop = (index: number) => {
    const updated = intermediateStops.filter((_, i) => i !== index);
    setIntermediateStops(updated);
    if (activeStopInputIndex === index) {
      setActiveStopInputIndex(null);
    } else if (activeStopInputIndex !== null && activeStopInputIndex > index) {
      setActiveStopInputIndex(activeStopInputIndex - 1);
    }
  };

  const handleMoveStopUp = (index: number) => {
    if (index === 0) return;
    const updated = [...intermediateStops];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setIntermediateStops(updated);
  };

  const handleMoveStopDown = (index: number) => {
    if (index === intermediateStops.length - 1) return;
    const updated = [...intermediateStops];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setIntermediateStops(updated);
  };

  // Open "Choose on Map" Modal
  const openMapModal = (
    targetType: "pickup" | "destination" | "stop",
    stopIndex?: number
  ) => {
    let title = "Choose Location on Map";
    let confirmLabel = "Confirm Location";
    let initialCoords: { lat: number; lng: number } | null = null;
    let initialAddress: string | undefined;

    if (targetType === "pickup") {
      title = "Set Pickup Location";
      confirmLabel = "Confirm Pickup";
      if (pickup && pickup.lat && pickup.lng) {
        initialCoords = { lat: pickup.lat, lng: pickup.lng };
        initialAddress = pickup.address;
      }
    } else if (targetType === "destination") {
      title = "Set Final Drop-off";
      confirmLabel = "Confirm Final Drop-off";
      if (destination && destination.lat && destination.lng) {
        initialCoords = { lat: destination.lat, lng: destination.lng };
        initialAddress = destination.address;
      }
    } else if (targetType === "stop" && typeof stopIndex === "number") {
      const stopNum = stopIndex + 1;
      title = `Set Stop ${stopNum} on Map`;
      confirmLabel = `Confirm Stop ${stopNum}`;
      const st = intermediateStops[stopIndex];
      if (st && st.lat && st.lng) {
        initialCoords = { lat: st.lat, lng: st.lng };
        initialAddress = st.address;
      }
    }

    setMapModalConfig({
      isOpen: true,
      targetType,
      stopIndex,
      title,
      confirmLabel,
      initialCoords,
      initialAddress,
    });
  };

  // Handle Confirmed Selection from Map Modal
  const handleMapConfirm = (point: { lat: number; lng: number; address: string; landmark?: string }) => {
    const combinedAddress = point.landmark
      ? `${point.landmark} - ${point.address}`
      : point.address;

    if (mapModalConfig.targetType === "pickup") {
      setPickup({ address: combinedAddress, lat: point.lat, lng: point.lng });
      setPickupSearchText(combinedAddress);
      setShowPickupDropdown(false);
    } else if (mapModalConfig.targetType === "destination") {
      setDestination({ address: combinedAddress, lat: point.lat, lng: point.lng });
      setDestinationSearchText(combinedAddress);
      setShowDestinationDropdown(false);
    } else if (mapModalConfig.targetType === "stop" && typeof mapModalConfig.stopIndex === "number") {
      const idx = mapModalConfig.stopIndex;
      const updated = [...intermediateStops];
      if (updated[idx]) {
        updated[idx] = {
          ...updated[idx],
          address: combinedAddress,
          lat: point.lat,
          lng: point.lng,
          notes: point.landmark || updated[idx].notes,
        };
        setIntermediateStops(updated);
      }
    }

    setMapModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Render Vehicle Category Icon
  const renderCategoryIcon = (catName: string, className = "w-5 h-5") => {
    switch (catName) {
      case "Bike":
        return <Bike className={className} />;
      case "Three-wheeler":
      case "Car":
        return <Car className={className} />;
      case "Mini Van":
      case "Van":
        return <Truck className={className} />;
      case "Lorry":
        return <Truck className={className} />;
      default:
        return <Car className={className} />;
    }
  };

  // Safe internal return URL when redirecting to auth
  const handleAuthRedirect = () => {
    const returnUrl = "/?mode=pickme";
    router.push(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
  };

  // Submit Booking to Server
  const handleConfirmAndFindDriver = async () => {
    if (!pickup || !destination || !routeStats) return;

    if (!isAuthenticated) {
      handleAuthRedirect();
      return;
    }

    if (isDriverOrAdmin) {
      setSubmitError(
        `Logged in as ${userRole}. Driver and Admin accounts cannot create rider bookings. Please log in with a rider account.`
      );
      return;
    }

    const currentCat = categories.find((c) => c.category === selectedCategory);
    if (!currentCat || !currentCat.isAvailable) {
      setSubmitError("The selected vehicle category is not available. Please choose another vehicle.");
      return;
    }

    if (selectedCategory === "Lorry" && (!goodsDescription || !goodsDescription.trim())) {
      setSubmitError("A brief description of goods is required for Lorry bookings.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/bookings/pickme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLocation: pickup,
          pickupInstructions: pickupInstructions.trim() || undefined,
          destinationLocation: destination,
          intermediateStops: intermediateStops.map((s, idx) => ({
            address: s.address,
            lat: s.lat,
            lng: s.lng,
            stopOrder: idx + 1,
            notes: s.notes?.trim() || undefined,
          })),
          vehicleCategory: selectedCategory,
          goodsDescription: selectedCategory === "Lorry" ? goodsDescription.trim() : undefined,
          hasWhatsAppConfirmed,
          paymentMethod,
          rideNow,
          scheduledDate: !rideNow ? scheduledDate : undefined,
          scheduledTime: !rideNow ? scheduledTime : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm booking.");
      }

      // Clear draft on successful booking
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }

      // Redirect to live rider tracking page
      router.push(`/track?ref=${data.bookingReference}`);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit booking. Please try again.");
      setIsSubmitting(false);
    }
  };

  const selectedCatObj = categories.find((c) => c.category === selectedCategory);

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-7 border border-slate-100 max-w-lg mx-auto lg:max-w-none relative">
      {/* Booking Mode Selector (Local Ride vs Airport Transfer) */}
      <div className="flex items-center gap-2 mb-5 bg-slate-100 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setBookingMode("LOCAL")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            bookingMode === "LOCAL"
              ? "bg-amber-400 text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles size={14} className="text-slate-900" />
          <span>Local Ride (PickMe)</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/booking")}
          className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Airport Transfer</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ============================================================== */}
      {/* STATE A: SESSION LOADING (Zero-flash skeleton placeholder)      */}
      {/* ============================================================== */}
      {sessionStatus === "loading" && (
        <div className="py-10 px-4 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse">
            <Sparkles size={24} />
          </div>
          <div className="space-y-2 w-full max-w-xs mx-auto">
            <div className="h-4 bg-slate-200 rounded-full w-36 mx-auto animate-pulse"></div>
            <div className="h-3 bg-slate-100 rounded-full w-52 mx-auto animate-pulse"></div>
          </div>
          <div className="h-12 bg-slate-100 rounded-2xl w-full animate-pulse mt-3"></div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE B: LOGGED-OUT VISITOR (Simple entry card + button)        */}
      {/* ============================================================== */}
      {sessionStatus !== "loading" && !isAuthenticated && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="text-amber-500" size={24} />
              Where to?
            </h2>
            <span className="text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full">
              Instant Local Dispatch
            </span>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            Book on-demand local rides, multi-stop errands, and goods transport across Sri Lanka with upfront rates and live driver GPS tracking.
          </p>

          {/* Value Highlights */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-800 block">6 Fleets</span>
              <span className="text-[11px] text-slate-500">Bike to Lorry</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-800 block">Multi-Stop</span>
              <span className="text-[11px] text-slate-500">Up to 5 stops</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-800 block">Live GPS</span>
              <span className="text-[11px] text-slate-500">Realtime driver</span>
            </div>
          </div>

          {/* Single, Simple "Book a Local Ride" Entry Action */}
          <div>
            <button
              type="button"
              id="book-local-ride-button"
              onClick={handleAuthRedirect}
              className="w-full py-4 px-6 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-900 font-black text-base rounded-2xl transition-all shadow-lg shadow-amber-400/30 flex items-center justify-center gap-2 cursor-pointer touch-manipulation min-h-[48px]"
            >
              <Sparkles size={18} />
              <span>Book a Local Ride</span>
              <ArrowRight size={18} className="ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE C: DRIVER / ADMIN ROLE RESTRICTION                       */}
      {/* ============================================================== */}
      {sessionStatus !== "loading" && isAuthenticated && isDriverOrAdmin && (
        <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-3xl space-y-3 text-center animate-in fade-in duration-200">
          <AlertTriangle size={32} className="text-amber-600 mx-auto" />
          <h3 className="text-base font-bold text-amber-950">
            {userRole === "DRIVER" ? "Driver Account Active" : "Admin Account Active"}
          </h3>
          <p className="text-xs text-amber-800 max-w-sm mx-auto leading-relaxed">
            {userRole === "DRIVER"
              ? "You are logged in with a driver account. Driver accounts cannot create rider bookings."
              : "You are logged in with an administrator account."}
            Please log in with a rider account to book a local ride.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => router.push(userRole === "DRIVER" ? "/driver" : "/admin")}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              Go to {userRole === "DRIVER" ? "Driver Dashboard" : "Admin Panel"}
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-50 cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STATE D: AUTHENTICATED RIDER BOOKING WIZARD                    */}
      {/* ============================================================== */}
      {sessionStatus !== "loading" && isAuthenticated && !isDriverOrAdmin && (
        <div className="animate-in fade-in duration-200">
          {/* Step Header & Progress Indicator */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <MapPin className="text-amber-500" size={22} />
                {currentStep === 1 && "Pickup Location"}
                {currentStep === 2 && "Destination & Stops"}
                {currentStep === 3 && "Select Vehicle & Fare"}
                {currentStep === 4 && "Review & Request"}
              </h2>
              <span className="text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full">
                Step {currentStep} of 4
              </span>
            </div>

            {/* Clickable Progress Tracker */}
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {[
                { stepNum: 1, label: "Pickup" },
                { stepNum: 2, label: "Stops" },
                { stepNum: 3, label: "Vehicle" },
                { stepNum: 4, label: "Review" },
              ].map((item) => {
                const isCompleted = item.stepNum < currentStep;
                const isCurrent = item.stepNum === currentStep;
                const canJump =
                  item.stepNum < currentStep ||
                  (item.stepNum === 2 && pickup) ||
                  (item.stepNum === 3 && destination && routeStats);

                return (
                  <button
                    key={item.stepNum}
                    type="button"
                    disabled={!canJump}
                    onClick={() => setCurrentStep(item.stepNum as any)}
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all text-center truncate ${
                      isCurrent
                        ? "bg-slate-900 text-white shadow-xs"
                        : isCompleted
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {isCompleted && "✓ "}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 1: PICKUP LOCATION ONLY */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Where should the driver pick you up?
                </label>

                {/* Address Search Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <MapPin size={18} />
                  </div>
                  <input
                    type="text"
                    value={pickupSearchText}
                    onChange={(e) => {
                      setPickupSearchText(e.target.value);
                      if (pickup && pickup.address !== e.target.value) {
                        setPickup(null);
                      }
                    }}
                    onFocus={() => {
                      if (pickupSuggestions.length > 0) setShowPickupDropdown(true);
                    }}
                    placeholder="Search pickup address, street, hotel, city..."
                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-xs"
                  />
                  {pickupSearchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickupSearchText("");
                        setPickup(null);
                        setPickupSuggestions([]);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Pickup Suggestions Dropdown */}
                {showPickupDropdown && pickupSuggestions.length > 0 && (
                  <div className="mt-2 bg-white rounded-xl shadow-lg border border-slate-100 max-h-56 overflow-y-auto divide-y divide-slate-100 z-20 relative">
                    {pickupSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPickup(item);
                          setPickupSearchText(item.address);
                          setShowPickupDropdown(false);
                          setGeoError(null);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-950 flex items-start gap-2 transition-colors cursor-pointer"
                      >
                        <MapPin size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item.address}</span>
                      </button>
                    ))}
                  </div>
                )}

                {pickupLoading && (
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                    <RefreshCw size={11} className="animate-spin text-amber-500" />
                    Searching Sri Lanka addresses...
                  </p>
                )}

                {/* Quick Actions: Use Current Location & Choose on Map */}
                <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={geoLoading}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    {geoLoading ? (
                      <RefreshCw size={14} className="animate-spin text-blue-600" />
                    ) : (
                      <LocateFixed size={14} className="text-blue-600" />
                    )}
                    <span>Use Current Location</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openMapModal("pickup")}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    <Navigation size={14} className="text-emerald-600" />
                    <span>Choose on Map</span>
                  </button>
                </div>

                {/* Geolocation Error Alert */}
                {geoError && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{geoError}</span>
                  </div>
                )}

                {/* Confirmed Pickup Badge */}
                {pickup && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <span className="font-bold block">Selected Pickup Point</span>
                      <span className="text-emerald-800">{pickup.address}</span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">
                        Coords: {pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Pickup Instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pickup Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={pickupInstructions}
                  onChange={(e) => setPickupInstructions(e.target.value)}
                  placeholder="e.g. Near main security gate, Building B entrance, call on arrival"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
              </div>

              {/* Next Button */}
              <button
                type="button"
                disabled={!pickup || !pickup.lat || !pickup.lng}
                onClick={() => setCurrentStep(2)}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
              >
                <span>Continue to Destination & Stops</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: DESTINATION AND INTERMEDIATE STOPS */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Journey Flow Display */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Trip Waypoints
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Edit2 size={11} />
                    Edit Pickup
                  </button>
                </div>

                {/* 1. Pickup Summary */}
                <div className="flex items-start gap-2.5 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    P
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-800 block">Pickup</span>
                    <p className="text-slate-600 truncate">{pickup?.address || "No pickup selected"}</p>
                    {pickupInstructions && (
                      <p className="text-[10px] text-emerald-700 italic mt-0.5">Note: {pickupInstructions}</p>
                    )}
                  </div>
                </div>

                {/* 2. Intermediate Stops List */}
                {intermediateStops.map((stop, index) => (
                  <div
                    key={stop.id || index}
                    className="flex items-start gap-2.5 text-xs bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80"
                  >
                    <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950">Stop {index + 1}</span>
                        <div className="flex items-center gap-1">
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveStopUp(index)}
                              title="Move Up"
                              className="p-1 hover:bg-amber-100 rounded text-slate-600 cursor-pointer"
                            >
                              <ArrowUp size={12} />
                            </button>
                          )}
                          {index < intermediateStops.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMoveStopDown(index)}
                              title="Move Down"
                              className="p-1 hover:bg-amber-100 rounded text-slate-600 cursor-pointer"
                            >
                              <ArrowDown size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openMapModal("stop", index)}
                            title="Choose on map"
                            className="p-1 hover:bg-amber-100 rounded text-slate-600 cursor-pointer"
                          >
                            <MapPin size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStop(index)}
                            title="Remove Stop"
                            className="p-1 hover:bg-rose-100 rounded text-rose-600 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Stop Search / Display */}
                      <input
                        type="text"
                        value={stop.address}
                        onChange={(e) => {
                          const updated = [...intermediateStops];
                          updated[index].address = e.target.value;
                          setIntermediateStops(updated);
                        }}
                        placeholder={`Enter location for Stop ${index + 1} (ATM, grocery, etc.)...`}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      {stop.notes && (
                        <p className="text-[10px] text-amber-700 italic mt-0.5">Note: {stop.notes}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* "+ Add Stop" Action */}
                {intermediateStops.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="w-full py-2 px-3 border border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>+ Add Intermediate Stop (ATM, shop, etc.)</span>
                  </button>
                )}

                {/* 3. Final Destination Input */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Final Drop-off Destination
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-600">
                      <MapPin size={18} />
                    </div>
                    <input
                      type="text"
                      value={destinationSearchText}
                      onChange={(e) => {
                        setDestinationSearchText(e.target.value);
                        if (destination && destination.address !== e.target.value) {
                          setDestination(null);
                        }
                      }}
                      onFocus={() => {
                        if (destinationSuggestions.length > 0) setShowDestinationDropdown(true);
                      }}
                      placeholder="Search final destination address or city..."
                      className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all shadow-xs"
                    />
                    {destinationSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setDestinationSearchText("");
                          setDestination(null);
                          setDestinationSuggestions([]);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Destination Suggestions */}
                  {showDestinationDropdown && destinationSuggestions.length > 0 && (
                    <div className="mt-1 bg-white rounded-xl shadow-lg border border-slate-100 max-h-52 overflow-y-auto divide-y divide-slate-100 z-20 relative">
                      {destinationSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setDestination(item);
                            setDestinationSearchText(item.address);
                            setShowDestinationDropdown(false);
                          }}
                          className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-950 flex items-start gap-2 transition-colors cursor-pointer"
                        >
                          <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                          <span>{item.address}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Choose on Map for Destination */}
                  <div className="pt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => openMapModal("destination")}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Navigation size={13} className="text-rose-600" />
                      <span>Choose Drop-off on Map</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Route Map Preview with Road Polyline */}
              {pickup && destination && (
                <div className="space-y-2">
                  <PickMeRoutePreviewMap
                    pickup={pickup}
                    destination={destination}
                    intermediateStops={intermediateStops}
                    routeGeometry={routeStats?.coordinates}
                    height="220px"
                  />

                  {/* Route Statistics Bar */}
                  {routingLoading && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-600">
                      <RefreshCw size={14} className="animate-spin text-blue-600" />
                      <span>Calculating road distance & driving duration across all stops...</span>
                    </div>
                  )}

                  {routeStats && !routingLoading && (
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between text-blue-950 font-bold">
                        <span>Driving Distance: {routeStats.distanceKm} km</span>
                        <span>Est. Driving Time: ~{routeStats.durationMins} mins</span>
                      </div>
                      <p className="text-[11px] text-blue-800">
                        * Driving time is estimated based on current road conditions and excludes time spent at intermediate stops.
                      </p>
                    </div>
                  )}

                  {/* Routing Error State */}
                  {routingError && !routingLoading && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2">
                      <div className="flex items-start gap-2 text-rose-800 font-semibold">
                        <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                        <span>{routingError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (pickup && destination) {
                            calculateRouteAndFares(pickup, destination, intermediateStops);
                          }
                        }}
                        className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw size={13} />
                        <span>Retry Road Routing</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={!destination || !destination.lat || !routeStats || routingLoading}
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <span>Continue to Vehicle & Fare</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: VEHICLE AND FARE */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Choose Vehicle Category
                  </label>
                  {routeStats && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      {routeStats.distanceKm} km total road trip
                    </span>
                  )}
                </div>

                {/* 6 Vehicle Categories Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.category;
                    const isAvail = cat.isAvailable;

                    return (
                      <button
                        key={cat.category}
                        type="button"
                        disabled={!isAvail}
                        onClick={() => {
                          if (isAvail) setSelectedCategory(cat.category);
                        }}
                        className={`relative p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected && isAvail
                            ? "border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-400"
                            : isAvail
                            ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                            : "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                isSelected ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {renderCategoryIcon(cat.category, "w-4 h-4")}
                            </div>
                            {cat.isGoodsTransport && (
                              <span className="text-[9px] font-bold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded uppercase">
                                Goods
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-slate-900 text-xs">{cat.displayName || cat.category}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {cat.maxPassengers > 0 && `${cat.maxPassengers} Pass.`}
                            {cat.loadCapacityKg ? ` • ${cat.loadCapacityKg} kg` : ""}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100">
                          {isAvail ? (
                            <div className="font-black text-xs text-slate-900">
                              LKR {cat.estimatedFare ? cat.estimatedFare.toLocaleString() : "---"}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-500">Unavailable</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lorry Goods Description Requirement */}
              {selectedCategory === "Lorry" && (
                <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-orange-900 font-bold">
                    <Package size={16} className="text-orange-600" />
                    <span>Goods Description Required for Lorry</span>
                  </div>
                  <textarea
                    value={goodsDescription}
                    onChange={(e) => setGoodsDescription(e.target.value)}
                    required
                    rows={2}
                    placeholder="Describe items to transport, approximate weight, fragile goods..."
                    className="w-full p-2.5 bg-white border border-orange-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* Scheduling: Ride Now vs Schedule */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRideNow(true)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      rideNow ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    ⚡ Ride Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setRideNow(false)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      !rideNow ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    📅 Schedule Ride
                  </button>
                </div>

                {!rideNow && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={
                    !selectedCatObj ||
                    !selectedCatObj.isAvailable ||
                    (selectedCategory === "Lorry" && !goodsDescription.trim())
                  }
                  onClick={() => setCurrentStep(4)}
                  className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <span>Review Booking Details</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW AND REQUEST */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* Map Preview in Review */}
              {pickup && destination && (
                <PickMeRoutePreviewMap
                  pickup={pickup}
                  destination={destination}
                  intermediateStops={intermediateStops}
                  routeGeometry={routeStats?.coordinates}
                  height="180px"
                  interactive={false}
                />
              )}

              {/* Itinerary Review Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                {/* Pickup */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      P
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Pickup Location</span>
                      <span className="text-slate-700">{pickup?.address}</span>
                      {pickupInstructions && (
                        <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-normal block mt-1">
                          Instructions: {pickupInstructions}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-blue-600 hover:underline font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                {/* Intermediate Stops */}
                {intermediateStops.map((st, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 pl-2">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <span className="font-bold text-amber-950 block">Stop {idx + 1}</span>
                        <span className="text-slate-700">{st.address}</span>
                        {st.notes && (
                          <span className="text-[10px] text-slate-400 italic block">Note: {st.notes}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-blue-600 hover:underline font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                ))}

                {/* Drop-off */}
                <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-200">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      D
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Final Destination</span>
                      <span className="text-slate-700">{destination?.address}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-blue-600 hover:underline font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                {/* Distance & Duration */}
                {routeStats && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                    <span>Total Road Distance: <strong>{routeStats.distanceKm} km</strong></span>
                    <span>Est. Driving Duration: <strong>~{routeStats.durationMins} mins</strong></span>
                  </div>
                )}
              </div>

              {/* Vehicle & Fare Review */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center">
                      {renderCategoryIcon(selectedCategory, "w-4 h-4")}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {selectedCatObj?.displayName || selectedCategory}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {selectedCatObj?.description || "Local Ride"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-blue-600 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                {selectedCategory === "Lorry" && goodsDescription && (
                  <div className="bg-white/80 p-2 rounded-xl text-[11px] text-slate-700 border border-amber-200/60">
                    <span className="font-bold text-slate-900">Goods: </span>
                    <span>{goodsDescription}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                  <span className="font-bold text-slate-700">Estimated Fare</span>
                  <span className="text-base font-black text-slate-900">
                    LKR {selectedCatObj?.estimatedFare ? selectedCatObj.estimatedFare.toLocaleString() : "---"}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider block">Payment Method</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                      paymentMethod === "CASH"
                        ? "bg-white border-amber-500 text-slate-900 shadow-xs ring-1 ring-amber-400"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/60"
                    }`}
                  >
                    <Banknote size={15} className="text-emerald-600" />
                    <span>Cash to Driver</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                      paymentMethod === "CARD"
                        ? "bg-white border-amber-500 text-slate-900 shadow-xs ring-1 ring-amber-400"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/60"
                    }`}
                  >
                    <CreditCard size={15} className="text-blue-600" />
                    <span>Credit / Debit Card</span>
                  </button>
                </div>
              </div>

              {/* Submit Error Banner */}
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Action Buttons: Back and Confirm & Find Driver */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setCurrentStep(3)}
                  className="py-3.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || isDriverOrAdmin}
                  onClick={handleConfirmAndFindDriver}
                  className="flex-1 py-4 px-4 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-900 font-black text-sm rounded-2xl transition-all shadow-lg shadow-amber-400/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Confirming & Finding Driver...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Confirm & Find Driver</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draggable Map Modal for Map Selection */}
      {mapModalConfig.isOpen && (
        <DraggablePinMapModal
          isOpen={mapModalConfig.isOpen}
          title={mapModalConfig.title}
          confirmLabel={mapModalConfig.confirmLabel}
          initialCoords={mapModalConfig.initialCoords || null}
          initialAddress={mapModalConfig.initialAddress}
          onClose={() => setMapModalConfig((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={handleMapConfirm}
        />
      )}
    </div>
  );
}
