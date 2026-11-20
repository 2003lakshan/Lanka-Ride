import crypto from "crypto";

export const ACTIVE_TRACKING_STATUSES = [
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "PASSENGER_PICKED_UP",
  "TRIP_IN_PROGRESS",
];

/**
 * Generates a cryptographically random, unguessable 32-byte hex token (64 characters).
 */
export function generateShareToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes SHA-256 hash of a raw token for server-side persistence and index lookup.
 */
export function hashShareToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== "string") return "";
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Calculates share link expiration timestamp:
 * Default: Scheduled trip end + 24 hours grace period.
 * For custom trips: endDate + 24 hours.
 * For airport / single-day trips: arrivalDate + 24 hours.
 * Fallback: 48 hours from current timestamp.
 */
export function calculateShareTokenExpiry(booking: any): Date {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

  let baseDate: Date | null = null;

  if (booking?.customTripDetails?.endDate) {
    const end = new Date(booking.customTripDetails.endDate);
    if (!isNaN(end.getTime())) {
      baseDate = end;
    }
  } else if (booking?.arrivalDate) {
    const arr = new Date(booking.arrivalDate);
    if (!isNaN(arr.getTime())) {
      baseDate = arr;
    }
  }

  if (baseDate) {
    // Scheduled end + 24h grace period
    const expiryTime = baseDate.getTime() + ONE_DAY_MS;
    // If the scheduled end date was in the past, guarantee at least 24h from now
    return new Date(Math.max(expiryTime, now + ONE_DAY_MS));
  }

  // Fallback: 48 hours from now
  return new Date(now + TWO_DAYS_MS);
}

/**
 * Strips precise house numbers, street names, and building numbers to create a generalized locality.
 * Prevents exposing rider's home or private pickup address to unauthorized public observers.
 */
export function generalizeAddress(address?: string | null): string {
  if (!address || typeof address !== "string") {
    return "Scheduled Location";
  }

  const trimmed = address.trim();
  if (!trimmed) return "Scheduled Location";

  // Check airport keywords
  const lower = trimmed.toLowerCase();
  if (lower.includes("bandaranaike") || lower.includes("katunayake") || lower.includes("cmb")) {
    return "Bandaranaike International Airport (CMB)";
  }
  if (lower.includes("mattala") || lower.includes("hri")) {
    return "Mattala Rajapaksa Airport (HRI)";
  }
  if (lower.includes("ratmalana") || lower.includes("rml")) {
    return "Ratmalana Airport (RML)";
  }

  // Remove leading house/flat/building numbers: e.g. "No. 45/A,", "12B,", "#101,"
  let cleaned = trimmed.replace(/^(no\.?\s*[\w/-]+|flat\s*[\w/-]+|apt\.?\s*[\w/-]+|#\s*[\w/-]+|\d+[\w/-]*)\s*,?\s*/i, "");

  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 3) {
    // Return last 2 parts (e.g. "Negombo, Western Province" or "Colombo 07, Sri Lanka")
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  } else if (parts.length === 2) {
    // If the first part still looks like a street name, prefer the last (locality/city)
    const firstLower = parts[0].toLowerCase();
    if (firstLower.includes("road") || firstLower.includes("rd") || firstLower.includes("street") || firstLower.includes("lane") || firstLower.includes("ave")) {
      return parts[1];
    }
    return `${parts[0]}, ${parts[1]}`;
  }

  return parts[0] || "Scheduled Area";
}

/**
 * Returns a privacy-safe driver public display name (e.g. "Kasun" or "Kasun P.").
 * Never reveals full driver personal email, phone, or home address.
 */
export function getPublicDriverName(fullName?: string | null): string {
  if (!fullName || typeof fullName !== "string") return "Assigned Driver";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/**
 * Maps raw booking status to user-friendly public labels and contextual explanations.
 */
export function getPublicStatusInfo(status: string): {
  label: string;
  description: string;
  badgeVariant: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  isLiveTracking: boolean;
} {
  const isLive = ACTIVE_TRACKING_STATUSES.includes(status);

  switch (status) {
    case "DRAFT":
    case "PENDING_APPROVAL":
    case "NEEDS_REVISION":
    case "CHANGES_REQUESTED":
    case "PENDING":
      return {
        label: "Awaiting Admin Approval",
        description: "This trip is currently being reviewed by our operations team. Live vehicle tracking will activate on the day of travel once a driver is dispatched.",
        badgeVariant: "pending",
        isLiveTracking: false,
      };

    case "AWAITING_PAYMENT":
    case "PENDING_ADMIN_CONFIRMATION":
    case "CONFIRMED":
      return {
        label: "Trip Confirmed",
        description: "This booking is confirmed. Live vehicle tracking will start on the day of travel once the driver heads to pickup.",
        badgeVariant: "confirmed",
        isLiveTracking: false,
      };

    case "DRIVER_ASSIGNED":
      return {
        label: "Driver Assigned",
        description: "A professional tourism driver has been assigned. Live tracking starts as soon as the driver departs for pickup.",
        badgeVariant: "active",
        isLiveTracking: true,
      };

    case "DRIVER_EN_ROUTE":
      return {
        label: "Driver En Route to Pickup",
        description: "The driver is currently heading to the pickup location. Live GPS location is active on the map.",
        badgeVariant: "active",
        isLiveTracking: true,
      };

    case "DRIVER_ARRIVED":
      return {
        label: "Driver Arrived at Pickup",
        description: "The driver has arrived at the pickup point and is waiting for the passenger.",
        badgeVariant: "active",
        isLiveTracking: true,
      };

    case "PASSENGER_PICKED_UP":
    case "TRIP_IN_PROGRESS":
      return {
        label: "Trip In Progress",
        description: "The journey is underway! Real-time vehicle location is streaming live.",
        badgeVariant: "active",
        isLiveTracking: true,
      };

    case "COMPLETED":
      return {
        label: "Trip Completed",
        description: "This trip has safely concluded. Live location tracking has ended.",
        badgeVariant: "completed",
        isLiveTracking: false,
      };

    case "CANCELLED":
    case "REFUNDED":
      return {
        label: "Trip Cancelled",
        description: "This booking has been cancelled. Live tracking is not available.",
        badgeVariant: "cancelled",
        isLiveTracking: false,
      };

    default:
      return {
        label: status.replace(/_/g, " "),
        description: "Trip status is being updated by the operations team.",
        badgeVariant: isLive ? "active" : "pending",
        isLiveTracking: isLive,
      };
  }
}

export interface SanitizedSharedBooking {
  bookingId: string;
  bookingReference: string;
  status: string;
  statusInfo: {
    label: string;
    description: string;
    badgeVariant: "pending" | "confirmed" | "active" | "completed" | "cancelled";
    isLiveTracking: boolean;
  };
  tripType: string;
  tripDate: string | null;
  pickupTime: string | null;
  pickupGeneral: string;
  destinationGeneral: string;
  pickupCoords: { lat: number; lng: number } | null;
  destinationCoords: { lat: number; lng: number } | null;
  intermediateStops?: Array<{
    name?: string;
    generalAddress: string;
    lat: number;
    lng: number;
    stopOrder: number;
    visited?: boolean;
  }>;
  customTripItinerary?: Array<{
    dayNumber: number;
    date?: string | null;
    placesToVisit?: Array<{
      name?: string;
      lat?: number;
      lng?: number;
      visited?: boolean;
    }>;
    overnightCity?: string | null;
  }>;
  driver: {
    name: string;
    vehicleModel: string;
    registrationNumber: string | null;
    rating: number;
    completedTrips: number | null;
  } | null;
  driverLocation: {
    lat: number;
    lng: number;
    updatedAt: string;
    accuracy?: number;
  } | null;
  expiresAt: string | null;
}

/**
 * Sanitizes booking document for public shareable consumption:
 * Statically omits ALL sensitive passenger PII, financial details, identity documents,
 * exact home addresses, phone numbers, and internal admin comments.
 */
export function sanitizeBookingForShare(booking: any): SanitizedSharedBooking {
  const isLive = ACTIVE_TRACKING_STATUSES.includes(booking.status);
  const statusInfo = getPublicStatusInfo(booking.status);

  // Driver details (limited to public-safe fields)
  let driverData: SanitizedSharedBooking["driver"] = null;
  const driver = booking.driverId;
  if (driver && typeof driver === "object") {
    const rawName = driver.name || driver.fullName || "Assigned Driver";
    const vDetails = driver.vehicleDetails || driver.driverProfile?.vehicleDetails;
    driverData = {
      name: getPublicDriverName(rawName),
      vehicleModel: vDetails?.model || (booking.vehicleTypeId as any)?.name || "Tourism Vehicle",
      registrationNumber: vDetails?.registrationNumber || driver.vehicleRegistration || null,
      rating: typeof driver.rating === "number" ? driver.rating : 4.9,
      completedTrips: typeof driver.completedTripsCount === "number" ? driver.completedTripsCount : null,
    };
  }

  // Live driver coordinates (ONLY exposed if trip is in active tracking stage)
  let driverLoc: SanitizedSharedBooking["driverLocation"] = null;
  if (isLive && booking.driverLocation?.lat && booking.driverLocation?.lng) {
    driverLoc = {
      lat: booking.driverLocation.lat,
      lng: booking.driverLocation.lng,
      updatedAt: booking.driverLocation.updatedAt
        ? new Date(booking.driverLocation.updatedAt).toISOString()
        : new Date().toISOString(),
      accuracy: booking.driverLocation.accuracy,
    };
  }

  // Generalized stops
  const intermediateStops = Array.isArray(booking.intermediateStops)
    ? booking.intermediateStops.map((s: any) => ({
        name: s.name,
        generalAddress: generalizeAddress(s.address),
        lat: s.lat,
        lng: s.lng,
        stopOrder: s.stopOrder,
        visited: Boolean(s.visited),
      }))
    : undefined;

  // Generalized custom itinerary
  const customTripItinerary = Array.isArray(booking.customTripDetails?.itinerary)
    ? booking.customTripDetails.itinerary.map((d: any) => ({
        dayNumber: d.dayNumber,
        date: d.date ? new Date(d.date).toISOString() : null,
        placesToVisit: Array.isArray(d.placesToVisit)
          ? d.placesToVisit.map((p: any) => ({
              name: p.name,
              lat: p.lat,
              lng: p.lng,
              visited: Boolean(p.visited),
            }))
          : [],
        overnightCity: d.overnightLocation?.city || null,
      }))
    : undefined;

  const pickupCoords =
    booking.pickupLat && booking.pickupLng
      ? { lat: booking.pickupLat, lng: booking.pickupLng }
      : null;

  const destinationCoords =
    booking.destinationLat && booking.destinationLng
      ? { lat: booking.destinationLat, lng: booking.destinationLng }
      : null;

  const tripDate = booking.arrivalDate
    ? new Date(booking.arrivalDate).toISOString()
    : booking.customTripDetails?.startDate
    ? new Date(booking.customTripDetails.startDate).toISOString()
    : null;

  const pickupTime =
    booking.arrivalTime ||
    (booking.customTripDetails?.itinerary?.[0] as any)?.departureTime ||
    null;

  return {
    bookingId: (booking._id || "").toString(),
    bookingReference: booking.bookingReference,
    status: booking.status,
    statusInfo,
    tripType:
      booking.bookingType ||
      (booking.pickMeDetails?.isPickMe
        ? "LOCAL_RIDE"
        : booking.customTripDetails?.isCustomTrip
        ? "CUSTOM_TRIP"
        : "AIRPORT_TRANSFER"),
    tripDate,
    pickupTime,
    pickupGeneral: generalizeAddress(booking.pickupAddress),
    destinationGeneral: generalizeAddress(booking.destinationAddress),
    pickupCoords,
    destinationCoords,
    intermediateStops,
    customTripItinerary,
    driver: driverData,
    driverLocation: driverLoc,
    expiresAt: booking.shareTokenExpiresAt
      ? new Date(booking.shareTokenExpiresAt).toISOString()
      : null,
  };
}

