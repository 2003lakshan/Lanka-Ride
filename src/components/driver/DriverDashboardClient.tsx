"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { 
  Navigation, 
  Car, 
  MapPin, 
  Calendar, 
  Clock, 
  Phone, 
  User as UserIcon, 
  Package as PackageIcon, 
  MessageCircle, 
  ArrowRight, 
  Sparkles,
  CheckCircle2,
  History,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  Volume2,
  VolumeX,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Eye,
  Lock,
  Radio
} from "lucide-react";
import SlideToAccept from "@/components/driver/SlideToAccept";
import { useDriverOffers } from "@/components/providers/DriverOfferProvider";
import { soundManager, SoundState } from "@/lib/sound";
import { useSocket } from "@/components/providers/SocketProvider";
import { useRouter } from "next/navigation";
import { formatSriLankanDate, formatSriLankanLKR, formatSriLankanDateTime } from "@/lib/dateTime";
import { useDriverTracking } from "@/components/providers/DriverTrackingProvider";

interface DriverDashboardClientProps {
  initialBookings: any[];
  initialEnquiries: any[];
  currentUserId: string;
  driverVehicleCategory?: string | null;
}

export default function DriverDashboardClient({
  initialBookings,
  initialEnquiries,
  currentUserId,
  driverVehicleCategory,
}: DriverDashboardClientProps) {
  const { socket, isConnected, registerReconnectHandler } = useSocket();
  const [bookings, setBookings] = useState<any[]>(initialBookings);
  const [enquiries, setEnquiries] = useState<any[]>(initialEnquiries);
  const [newTripAlert, setNewTripAlert] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [soundState, setSoundState] = useState<SoundState>(soundManager.getState());
  const itemsPerPage = 6;
  
  const router = useRouter();
  const processedEventIds = useRef<Set<string>>(new Set());
  const driverOffers = useDriverOffers();

  // Unified global driver status & location methods from DriverOfferProvider
  const isDriverOnline = driverOffers?.isDriverOnline ?? true;
  const hasFreshGps = driverOffers?.hasFreshGps ?? false;
  const isUpdatingLocation = driverOffers?.isUpdatingLocation ?? false;
  const locationError = driverOffers?.locationError ?? null;
  const isInsecureContext = driverOffers?.isInsecureContext ?? false;
  const reportDriverLocation = driverOffers?.reportDriverLocation ?? (async () => {});
  const simulateDriverLocation = driverOffers?.simulateDriverLocation ?? (async () => {});
  const toggleDriverOnline = driverOffers?.toggleDriverOnline ?? (async () => {});

  // Keep Available Trips list in sync with active offers from DriverOfferProvider
  useEffect(() => {
    if (!driverOffers) return;
    const currentActiveOfferIds = new Set(
      (driverOffers.availableOffers || []).map((o) => (o.bookingId || o._id)?.toString()).filter(Boolean)
    );

    setBookings((prev) => {
      let changed = false;
      // Filter out any unassigned local ride offers that are no longer in availableOffers
      let updated = prev.filter((b) => {
        const isSyntheticLocalRide = !b.driverId && (b.bookingType === "LOCAL_RIDE" || b.pickMeDetails?.isPickMe);
        if (isSyntheticLocalRide && !currentActiveOfferIds.has(b._id?.toString())) {
          changed = true;
          return false;
        }
        return true;
      });

      for (const offer of driverOffers.availableOffers || []) {
        const bId = (offer.bookingId || offer._id)?.toString();
        if (!bId) continue;
        if (!updated.some((b) => b._id === bId)) {
          const syntheticBooking: any = {
            _id: bId,
            bookingReference: offer.bookingReference,
            status: "PENDING",
            pickupAddress: offer.pickupLocation?.address || "Pickup Point",
            pickupLat: offer.pickupLocation?.lat,
            pickupLng: offer.pickupLocation?.lng,
            destinationAddress: offer.destinationLocation?.address || "Destination",
            destinationLat: offer.destinationLocation?.lat,
            destinationLng: offer.destinationLocation?.lng,
            distanceKm: offer.passengerJourneyDistanceKm,
            durationMins: offer.passengerJourneyDurationMins,
            bookingType: "LOCAL_RIDE",
            pickMeDetails: {
              isPickMe: true,
              vehicleCategory: offer.vehicleCategory,
              estimatedFare: offer.estimatedFare,
              intermediateStops: offer.intermediateStops,
            },
            vehicleTypeId: {
              name: offer.vehicleCategory,
            },
            paymentMethod: offer.paymentMethod,
            dispatchExpiresAt: new Date(offer.expiresAt),
            createdAt: new Date(offer.serverTime || Date.now()),
          };
          updated.unshift(syntheticBooking);
          changed = true;
        }
      }

      return changed ? updated : prev;
    });
  }, [driverOffers?.availableOffers]);

  // Shared automatic tracking context
  const {
    trackingStatus,
    activeBooking: trackingActiveBooking,
    lastSuccessfulUpload,
    isBackgrounded,
    requestLocationPermission,
    retryTracking,
    setActiveBooking,
  } = useDriverTracking();

  // Find active assigned trip for this driver
  const assignedActiveBooking = useMemo(() => {
    return bookings.find(
      (b) =>
        b.driverId &&
        (b.driverId._id || b.driverId).toString() === currentUserId &&
        ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"].includes(b.status)
    );
  }, [bookings, currentUserId]);

  // Synchronize active trip with shared tracking provider
  useEffect(() => {
    if (assignedActiveBooking) {
      setActiveBooking(assignedActiveBooking);
    }
  }, [assignedActiveBooking, setActiveBooking]);

  // Combined active trip reference for the dashboard banner
  const activeTrip = assignedActiveBooking || trackingActiveBooking;

  // Subscribe to SoundManager state
  useEffect(() => {
    return soundManager.subscribe(setSoundState);
  }, []);

  // Sync when server re-renders
  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  useEffect(() => {
    setEnquiries(initialEnquiries);
  }, [initialEnquiries]);

  // Re-fetch on reconnect
  useEffect(() => {
    let mounted = true;
    const unregister = registerReconnectHandler(() => {
      if (!mounted) return;
      setTimeout(() => {
        if (!mounted) return;
        try {
          router.refresh();
        } catch (e) {
          console.warn("[DriverDashboard] Reconnect refresh skipped:", e);
        }
      }, 50);
    });
    return () => {
      mounted = false;
      unregister();
    };
  }, [registerReconnectHandler, router]);

  // Reset pagination when typing search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Handler when a trip is successfully accepted via SlideToAccept
  const handleTripAccepted = (acceptedBooking: any) => {
    const bookingId = (acceptedBooking._id || acceptedBooking.id).toString();
    soundManager.stopRinging(bookingId);

    const updated = { ...acceptedBooking, status: "DRIVER_ASSIGNED", driverId: currentUserId };

    // Register active booking into shared tracking service immediately
    setActiveBooking(updated);

    // Update local bookings state
    setBookings((prev) => {
      const exists = prev.some((b) => b._id === bookingId);
      if (exists) {
        return prev.map((b) => 
          b._id === bookingId 
            ? updated
            : b
        );
      }
      return [updated, ...prev];
    });

    router.refresh();
  };

  // Realtime listeners for driver channels
  useEffect(() => {
    if (!socket) return;

    // 1. Newly approved trip available for assignment
    const handleBookingAvailable = (data: any) => {
      const newBooking = data.booking;
      if (!newBooking) return;

      // Filter local rides by driver's vehicle category
      if (
        (newBooking.bookingType === "LOCAL_RIDE" || newBooking.pickMeDetails?.isPickMe) &&
        driverVehicleCategory &&
        newBooking.pickMeDetails?.vehicleCategory &&
        newBooking.pickMeDetails.vehicleCategory.trim().toLowerCase() !== driverVehicleCategory.trim().toLowerCase()
      ) {
        return; // Not eligible for this vehicle category
      }

      const eventKey = data.eventId || newBooking._id;
      if (processedEventIds.current.has(eventKey)) return;
      processedEventIds.current.add(eventKey);

      // Add to Available Trips list
      setBookings((prev) => {
        const exists = prev.some((b) => b._id === newBooking._id);
        if (exists) {
          return prev.map((b) => (b._id === newBooking._id ? newBooking : b));
        }
        return [newBooking, ...prev];
      });

      // Play alert sound for eligible online driver
      soundManager.playNotificationSound(newBooking._id);

      setNewTripAlert(`New ride request available: ${newBooking.bookingReference}`);
      setTimeout(() => setNewTripAlert(null), 8000);
    };

    // 2. Booking accepted by another driver or cancelled -> Remove from available list
    const handleBookingRemoved = (data: any) => {
      if (!data.bookingId) return;

      setBookings((prev) =>
        prev.filter((b) => {
          // If this driver is the one who accepted it, keep it
          if (b.driverId && (b.driverId._id || b.driverId).toString() === currentUserId) {
            return true;
          }
          return b._id !== data.bookingId;
        })
      );
    };

    // 3. Driver accepted event (if accepted by this driver, update status; if by someone else, remove)
    const handleDriverAccepted = (data: any) => {
      if (data.booking) {
        const bId = data.booking._id;
        const driverId = data.driver?.id || data.driver?._id;

        setBookings((prev) => {
          if (driverId === currentUserId) {
            const updated = { ...prev.find((b) => b._id === bId), ...data.booking, status: "DRIVER_ASSIGNED", driverId: currentUserId };
            setActiveBooking(updated);
            return prev.map((b) => (b._id === bId ? updated : b));
          } else {
            return prev.filter((b) => b._id !== bId);
          }
        });
      }
    };

    // 4. Status changed
    const handleStatusChanged = (data: any) => {
      if (!data.bookingId) return;
      setBookings((prev) =>
        prev.map((b) => {
          if (b._id === data.bookingId) {
            return {
              ...b,
              status: data.status,
              completedAt: data.completedAt || (data.status === "COMPLETED" ? (b.completedAt || new Date().toISOString()) : b.completedAt),
            };
          }
          return b;
        })
      );
    };

    // 5. Chat messages update enquiry unread flag
    const handleChatMessage = (data: any) => {
      if (data.enquiryId) {
        setEnquiries((prev) =>
          prev.map((e) =>
            e._id === data.enquiryId
              ? { ...e, driverUnread: true, messages: [...(e.messages || []), data.message] }
              : e
          )
        );
      }
    };

    // Handle Local Ride realtime offer
    const handleRideOffer = (offer: any) => {
      if (!offer || !offer.bookingId) return;

      const eventKey = offer.offerId || `offer_${offer.bookingId}`;
      if (processedEventIds.current.has(eventKey)) return;
      processedEventIds.current.add(eventKey);

      // Never display expired offers
      if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= Date.now()) {
        return;
      }

      const bookingId = offer.bookingId.toString();

      // Ensure it is shown in Available Trips list
      setBookings((prev) => {
        const exists = prev.some((b) => b._id === bookingId);
        if (exists) return prev;
        const mappedTrip = {
          _id: bookingId,
          bookingReference: offer.bookingReference,
          bookingType: "LOCAL_RIDE",
          status: "PENDING",
          pickupAddress: offer.pickupLocation?.address || "Pickup Point",
          pickupLat: offer.pickupLocation?.lat,
          pickupLng: offer.pickupLocation?.lng,
          destinationAddress: offer.destinationLocation?.address || "Destination",
          destinationLat: offer.destinationLocation?.lat,
          destinationLng: offer.destinationLocation?.lng,
          intermediateStops: offer.intermediateStops || [],
          distanceKm: offer.passengerJourneyDistanceKm || 0,
          durationMins: offer.passengerJourneyDurationMins || 0,
          paymentMethod: offer.paymentMethod || "CASH",
          dispatchExpiresAt: new Date(offer.expiresAt).toISOString(),
          dispatchStatus: "OFFERED",
          pickMeDetails: {
            isPickMe: true,
            vehicleCategory: offer.vehicleCategory,
            estimatedFare: offer.estimatedFare,
          },
          createdAt: new Date(offer.serverTime || Date.now()).toISOString(),
        };
        return [mappedTrip, ...prev];
      });
    };

    // Handle offer withdrawn (e.g. accepted by another driver)
    const handleRideOfferWithdrawn = (data: any) => {
      if (!data?.bookingId) return;
      const bId = data.bookingId.toString();

      setBookings((prev) =>
        prev.filter((b) => {
          if (b.driverId && (b.driverId._id || b.driverId).toString() === currentUserId) {
            return true;
          }
          return b._id !== bId;
        })
      );

      setNewTripAlert("This ride has already been accepted or cancelled");
      setTimeout(() => setNewTripAlert(null), 5000);
    };

    // Handle offer expired after countdown
    const handleRideOfferExpired = (data: any) => {
      if (!data?.bookingId) return;
      const bId = data.bookingId.toString();

      setBookings((prev) =>
        prev.filter((b) => {
          if (b.driverId && (b.driverId._id || b.driverId).toString() === currentUserId) {
            return true;
          }
          return b._id !== bId;
        })
      );
    };

    socket.on("ride:offer", handleRideOffer);
    socket.on("ride:offer_withdrawn", handleRideOfferWithdrawn);
    socket.on("ride:offer_expired", handleRideOfferExpired);
    socket.on("booking:available", handleBookingAvailable);
    socket.on("booking:removed", handleBookingRemoved);
    socket.on("booking:driver_accepted", handleDriverAccepted);
    socket.on("booking:status_changed", handleStatusChanged);
    socket.on("chat:message", handleChatMessage);

    return () => {
      socket.off("ride:offer", handleRideOffer);
      socket.off("ride:offer_withdrawn", handleRideOfferWithdrawn);
      socket.off("ride:offer_expired", handleRideOfferExpired);
      socket.off("booking:available", handleBookingAvailable);
      socket.off("booking:removed", handleBookingRemoved);
      socket.off("booking:driver_accepted", handleDriverAccepted);
      socket.off("booking:status_changed", handleStatusChanged);
      socket.off("chat:message", handleChatMessage);
    };
  }, [socket, currentUserId, setActiveBooking]);

  // Smart polling fallback: only active when disconnected
  useEffect(() => {
    if (isConnected) return;

    const interval = setInterval(() => {
      try {
        router.refresh();
      } catch (e) {
        console.warn("[DriverDashboard] Polling refresh skipped:", e);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [isConnected, router]);

  // Filter bookings to active trips and valid available ride offers only
  const activeBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === "COMPLETED" || b.status === "CANCELLED" || b.status === "REFUNDED") {
        return false;
      }
      // If unassigned PickMe local ride, check vehicle category matching
      const isAvailablePickMe = !b.driverId && (b.bookingType === "LOCAL_RIDE" || b.pickMeDetails?.isPickMe);
      if (isAvailablePickMe && driverVehicleCategory && b.pickMeDetails?.vehicleCategory) {
        if (b.pickMeDetails.vehicleCategory.trim().toLowerCase() !== driverVehicleCategory.trim().toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, driverVehicleCategory]);

  // Filter active trips and offers list by search query
  const displayedBookings = useMemo(() => {
    if (!searchQuery.trim()) return activeBookings;

    const query = searchQuery.toLowerCase();
    return activeBookings.filter((b) => {
      return (
        b.bookingReference?.toLowerCase().includes(query) ||
        b.passengerDetails?.fullName?.toLowerCase().includes(query) ||
        b.pickupAddress?.toLowerCase().includes(query) ||
        b.destinationAddress?.toLowerCase().includes(query) ||
        b.airportId?.name?.toLowerCase().includes(query)
      );
    });
  }, [activeBookings, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(displayedBookings.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return displayedBookings.slice(start, start + itemsPerPage);
  }, [displayedBookings, currentPage, itemsPerPage]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "CONFIRMED":
        return "bg-blue-100 text-blue-800";
      case "DRIVER_ASSIGNED":
      case "DRIVER_EN_ROUTE":
      case "TRIP_IN_PROGRESS":
        return "bg-indigo-100 text-indigo-800";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div>
      {/* Realtime Alert Banner */}
      {newTripAlert && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 animate-in slide-in-from-top duration-300 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Sparkles className="text-emerald-600 animate-spin" size={18} />
            <span>{newTripAlert}</span>
          </div>
          <button
            onClick={() => setNewTripAlert(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Driver Dashboard</h1>
          <p className="text-slate-600">View upcoming assignments, manage active rides, and accept incoming ride offers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Driver Online Status Switch */}
          <button
            type="button"
            onClick={toggleDriverOnline}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all shadow-xs cursor-pointer ${
              isDriverOnline
                ? "bg-emerald-500 text-slate-950 border-emerald-400 hover:bg-emerald-400"
                : "bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300"
            }`}
            title={isDriverOnline ? "You are online and ready for incoming ride offers" : "You are offline. Tap to go online"}
          >
            <Radio size={14} className={isDriverOnline ? "animate-pulse" : ""} />
            <span>{isDriverOnline ? "Online • Ready" : "Offline"}</span>
          </button>

          {/* Sound Controls Indicator & Ringtone Initializer */}
          {soundState.audioBlocked ? (
            <button
              type="button"
              onClick={() => soundManager.initializeRingtonePlayer()}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-sm animate-bounce cursor-pointer"
              title="Browser blocked audio autoplay. Tap to enable ride ringtone."
            >
              <VolumeX size={15} />
              <span>Enable Ride Sounds</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => soundManager.setSoundEnabled(!soundState.soundEnabled)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors shadow-xs cursor-pointer ${
                soundState.soundEnabled 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100" 
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
              }`}
              title={soundState.soundEnabled ? "Notification sounds enabled" : "Notification sounds muted"}
            >
              {soundState.soundEnabled ? <Volume2 size={15} className="text-emerald-600" /> : <VolumeX size={15} />}
              <span>{soundState.soundEnabled ? "Sounds On" : "Muted"}</span>
            </button>
          )}

          {/* Test Ringtone button for physical phone verification */}
          <button
            type="button"
            onClick={() => soundManager.testRingtone()}
            className="px-2.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-xs cursor-pointer"
            title="Play incoming ride ringtone test on phone"
          >
            <Volume2 size={14} className="text-amber-500" />
            <span>Test Ringtone</span>
          </button>

          <Link
            href="/driver/packages"
            className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm border border-blue-200 flex items-center gap-1.5"
          >
            <PackageIcon size={16} />
            <span>Tour Packages</span>
          </Link>
        </div>
      </div>

      {/* Enable Location to Receive Rides Warning Banner */}
      {isDriverOnline && !hasFreshGps && !activeTrip && (
        <div className="mb-6 p-4 bg-amber-500 text-slate-950 border border-amber-600 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="shrink-0 animate-bounce" />
            <div>
              <span className="font-extrabold text-sm block">
                Enable location to receive rides
              </span>
              <p className="text-xs text-slate-900 font-medium">
                {locationError ? (
                  <span className="font-bold underline">{locationError}</span>
                ) : (
                  "You are online, but your GPS location is missing or stale. Enable GPS sharing so riders within 15 km can match with you."
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={reportDriverLocation}
              disabled={isUpdatingLocation}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isUpdatingLocation ? (
                <>
                  <Loader2 size={13} className="animate-spin text-amber-400" />
                  <span>Updating GPS...</span>
                </>
              ) : (
                <>
                  <Navigation size={13} className="text-amber-400" />
                  <span>Enable Location</span>
                </>
              )}
            </button>
            {isInsecureContext && (
              <button
                type="button"
                onClick={simulateDriverLocation}
                disabled={isUpdatingLocation}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-amber-300 font-extrabold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 border border-slate-700"
                title="Tap to use Colombo GPS coordinates for testing over local network HTTP"
              >
                <span>Test GPS (Dev)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Trip Live GPS Sharing Banner */}
      {activeTrip && (
        <div className="mb-6 overflow-hidden rounded-2xl shadow-sm border transition-all">
          {/* Background Warning Banner */}
          {isBackgrounded && (
            <div className="bg-amber-500 text-white px-4 py-2 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 animate-bounce" />
              <span>Browser is backgrounded. Mobile OS may suspend GPS. Please keep this tab active and visible.</span>
            </div>
          )}

          {/* Insecure Context Banner */}
          {trackingStatus === "INSECURE_CONTEXT" && (
            <div className="bg-rose-600 text-white p-4 text-xs font-medium flex items-center gap-2">
              <Lock size={16} className="shrink-0" />
              <span>GPS sharing requires a secure context (HTTPS or localhost). Geolocation is disabled on unencrypted HTTP.</span>
            </div>
          )}

          {/* Permission Blocked Banner */}
          {trackingStatus === "PERMISSION_BLOCKED" && (
            <div className="bg-rose-600 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span>GPS Permission Blocked for Active Trip {activeTrip.bookingReference}</span>
                </div>
                <p className="text-rose-100">
                  Please allow location in browser site settings (tap 🔒 lock icon in address bar) so the rider and admin can track this trip.
                </p>
              </div>
              <button
                type="button"
                onClick={retryTracking}
                className="bg-white hover:bg-rose-50 text-rose-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 shadow flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Retry Location</span>
              </button>
            </div>
          )}

          {/* Permission Required Banner */}
          {trackingStatus === "PERMISSION_REQUIRED" && (
            <div className="bg-blue-600 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Navigation size={16} className="shrink-0 animate-pulse" />
                  <span>Location Sharing Required for Active Trip {activeTrip.bookingReference}</span>
                </div>
                <p className="text-blue-100">
                  Your live GPS coordinates will be shared with the assigned rider and admin during this active trip to coordinate pickup.
                </p>
              </div>
              <button
                type="button"
                onClick={requestLocationPermission}
                className="bg-white hover:bg-blue-50 text-blue-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Navigation size={14} />
                <span>Enable Location</span>
              </button>
            </div>
          )}

          {/* Starting GPS Banner */}
          {trackingStatus === "STARTING_GPS" && (
            <div className="bg-amber-950 text-amber-200 border border-amber-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <Loader2 size={16} className="shrink-0 animate-spin text-amber-400" />
                <div>
                  <span className="font-bold text-sm text-amber-300 block">
                    Starting GPS for Trip {activeTrip.bookingReference}
                  </span>
                  <p className="text-amber-400/80 mt-0.5">Acquiring high-accuracy satellite fix...</p>
                </div>
              </div>
              <Link
                href={`/driver/booking/${activeTrip._id}`}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow"
              >
                <span>Open Navigation Card</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* Live Location Sharing Banner */}
          {trackingStatus === "LIVE" && (
            <div className="bg-slate-900 text-white border border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-emerald-400">Live Location Sharing Active</span>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Trip {activeTrip.bookingReference}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-0.5">
                    Live GPS uploaded every 3s for rider and admin tracking.
                    {lastSuccessfulUpload && (
                      <span className="text-slate-300">
                        {" "}(±{Math.round(lastSuccessfulUpload.accuracy)}m • Last upload: {new Date(lastSuccessfulUpload.timestamp).toLocaleTimeString()})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Link
                href={`/driver/booking/${activeTrip._id}`}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow"
              >
                <Navigation size={13} />
                <span>Open Navigation Card</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* Location Unavailable Banner */}
          {trackingStatus === "LOCATION_UNAVAILABLE" && (
            <div className="bg-amber-950 text-amber-200 border border-amber-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-sm text-amber-300 block">Device Location Unavailable</span>
                <p className="text-amber-400/80 mt-0.5">Please ensure GPS/location services are turned on on your device.</p>
              </div>
              <button
                type="button"
                onClick={retryTracking}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors shrink-0 shadow flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Retry GPS</span>
              </button>
            </div>
          )}

          {/* Connection Lost Banner */}
          {trackingStatus === "CONNECTION_LOST" && (
            <div className="bg-amber-950 text-amber-200 border border-amber-800 p-4 flex items-center gap-3 text-xs">
              <Radio size={16} className="text-amber-400 animate-pulse shrink-0" />
              <div>
                <span className="font-bold text-sm text-amber-300 block">Connection Lost</span>
                <p className="text-amber-400/80 mt-0.5">Network offline. Upload loop will retry automatically when connection restores.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ride Offers & Assignments Header / Search */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 px-2">
          <Activity size={18} className="text-blue-600" />
          <h2 className="font-extrabold text-slate-900 text-sm">Ride Offers &amp; Active Assignments</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-blue-100 text-blue-800">
            {activeBookings.length}
          </span>
        </div>

        {/* Search Input Filter */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search active rides, ref, passenger..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bookings Grid */}
      {displayedBookings.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Navigation size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            {searchQuery 
              ? "No matching trips found" 
              : "No active or available trips"}
          </h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            {searchQuery
              ? `No active bookings match "${searchQuery}". Try clearing search.`
              : "When new eligible rides or assignments arrive, they will appear here automatically."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
          {paginatedList.map((booking: any) => {
            const isCustom = Boolean(booking.customTripDetails?.isCustomTrip);
            const isPickMe = booking.bookingType === "LOCAL_RIDE" || Boolean(booking.pickMeDetails?.isPickMe);
            const isAvailableForAccept = !booking.driverId && (booking.status === "PENDING" || booking.status === "CONFIRMED");

            const confirmedFare = isCustom
              ? booking.customTripDetails?.confirmedAmount
                ? `${booking.customTripDetails.confirmedCurrency || "USD"} ${booking.customTripDetails.confirmedAmount.toLocaleString()}`
                : null
              : isPickMe
              ? formatSriLankanLKR(booking.pickMeDetails?.estimatedFare || booking.fareBreakdown?.totalEstimatedFare, "N/A")
              : formatSriLankanLKR(booking.fareBreakdown?.totalEstimatedFare, "N/A");

            return (
              <div
                key={booking._id.toString()}
                className={`bg-white rounded-2xl shadow-sm border transition-all flex flex-col justify-between hover:shadow-md min-w-0 overflow-hidden ${
                  isAvailableForAccept
                    ? "border-emerald-300 ring-2 ring-emerald-500/10"
                    : "border-blue-200 ring-1 ring-blue-500/10"
                }`}
              >
                <div className="p-4 sm:p-5 min-w-0">
                  {/* Card Header: Reference & Status */}
                  <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm break-all">
                          {booking.bookingReference}
                        </span>
                        {isCustom && (
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Sparkles size={10} /> Custom
                          </span>
                        )}
                        {isPickMe && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                            <Sparkles size={10} className="text-amber-600" /> {booking.pickMeDetails?.vehicleCategory || "Local Ride"}
                          </span>
                        )}
                        {isAvailableForAccept && (
                          <span className="bg-emerald-500 text-white text-[10px] uppercase px-2 py-0.5 rounded-full font-black animate-pulse">
                            Available Now
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Booked: {booking.createdAt ? formatSriLankanDateTime(booking.createdAt) : "Recently"}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  {/* Rider Details */}
                  <div className="mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <UserIcon size={14} className="text-slate-400" />
                      <span>{booking.passengerDetails?.fullName || booking.touristId?.name || "Rider name unavailable"}</span>
                    </div>
                    {booking.passengerDetails?.whatsappNumber &&
                      booking.passengerDetails.whatsappNumber.replace(/[^0-9]/g, "").length >= 7 &&
                      !["n/a", "no contact provided", "unknown", "none"].includes(booking.passengerDetails.whatsappNumber.trim().toLowerCase()) && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone size={14} className="text-emerald-500" />
                        <span>{booking.passengerDetails.whatsappNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Route Details */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Pickup</span>
                        <span className="text-slate-700 font-medium">
                          {booking.pickupAddress || booking.airportId?.name || (isCustom ? "Custom Tour Pickup" : "Colombo Airport (CMB)")}
                        </span>
                        {(booking.pickupInstructions || booking.pickMeDetails?.pickupInstructions) && (
                          <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-normal block mt-1">
                            Pickup Instructions: {booking.pickupInstructions || booking.pickMeDetails?.pickupInstructions}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Intermediate stops if local ride */}
                    {Array.isArray(booking.intermediateStops) && booking.intermediateStops.length > 0 && (
                      <div className="pl-4 border-l-2 border-amber-300 ml-2 space-y-1.5 py-1">
                        <span className="text-[10px] font-bold text-amber-700 uppercase block">
                          Intermediate Stops ({booking.intermediateStops.length})
                        </span>
                        {booking.intermediateStops.map((stop: any, sIdx: number) => (
                          <div key={sIdx} className="flex items-start gap-1.5 text-xs text-slate-700">
                            <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {stop.stopOrder || sIdx + 1}
                            </span>
                            <div>
                              <span>{stop.address}</span>
                              {stop.notes && <span className="text-slate-400 italic block text-[10px]">Note: {stop.notes}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <MapPin size={15} className="text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Destination</span>
                        <span className="text-slate-700 font-medium">
                          {booking.destinationAddress || (isCustom ? `${booking.customTripDetails?.itinerary?.length || 1}-Day Custom Itinerary` : "Dropoff Location")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isPickMe && booking.pickMeDetails?.goodsDescription && (
                    <div className="mb-3 bg-orange-50 border border-orange-200 p-2 rounded-xl text-xs text-orange-950 flex items-start gap-1.5">
                      <PackageIcon size={14} className="text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Goods Description: </span>
                        <span>{booking.pickMeDetails.goodsDescription}</span>
                      </div>
                    </div>
                  )}

                  {/* Timing & Vehicle Requirements */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      <span className="truncate">
                        {isCustom && booking.customTripDetails?.startDate
                          ? formatSriLankanDate(booking.customTripDetails.startDate)
                          : booking.arrivalDate
                          ? formatSriLankanDate(booking.arrivalDate)
                          : "Flexible"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Car size={14} className="text-slate-400" />
                      <span className="truncate">
                        {booking.vehicleTypeId?.name || "Standard Vehicle"}
                      </span>
                    </div>
                  </div>

                  {/* Fare & Action Section */}
                  <div className="pt-4 border-t border-slate-100 mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                      {isCustom ? (
                        <div className="space-y-0.5">
                          {booking.customTripDetails?.confirmedAmount ? (
                            <>
                              <p className="text-[11px] text-slate-400 font-bold uppercase">Confirmed Fare</p>
                              <p className="font-extrabold text-emerald-700 text-base">
                                {confirmedFare}
                              </p>
                              {booking.customTripDetails?.budget && (
                                <p className="text-[10px] text-slate-400">
                                  Proposed: {booking.customTripDetails.budgetCurrency || "USD"} {booking.customTripDetails.budget}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] text-slate-400 font-bold uppercase">Proposed Budget</p>
                              <p className="font-bold text-slate-800 text-sm">
                                {booking.customTripDetails?.budget
                                  ? `${booking.customTripDetails.budgetCurrency || "USD"} ${booking.customTripDetails.budget}`
                                  : "Flexible"}
                              </p>
                              <p className="text-[10px] text-amber-600 font-medium">Pending Fare Confirmation</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-slate-400 font-bold uppercase">Est. Fare</p>
                          <p className="font-extrabold text-base text-slate-900">
                            {confirmedFare || "N/A"}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-auto min-w-0">
                      {isAvailableForAccept ? (
                        /* Slide to Accept replaces ordinary button */
                        <div className="w-full min-w-0">
                          <SlideToAccept
                            bookingId={booking._id.toString()}
                            bookingReference={booking.bookingReference}
                            variant="single"
                            onSuccess={handleTripAccepted}
                            onReject={() => {
                              driverOffers?.rejectOffer(booking._id.toString());
                              setBookings((prev) => prev.filter((b) => b._id !== booking._id));
                            }}
                          />
                        </div>
                      ) : (
                        <Link
                          href={`/driver/booking/${booking._id}`}
                          className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          <Navigation size={13} />
                          <span>View &amp; Navigate &rarr;</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-600">
            Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-bold text-slate-900">
              {Math.min(currentPage * itemsPerPage, displayedBookings.length)}
            </span>{" "}
            of <span className="font-bold text-slate-900">{displayedBookings.length}</span> trips
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
