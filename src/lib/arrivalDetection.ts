import { isValidCoordinate } from "@/lib/navigation";

/**
 * Arrival Detection Configuration
 * Values can be configured via environment variables or default to standard thresholds.
 */
export const ARRIVAL_CONFIG = {
  // Configurable arrival radius in metres (default: 100 metres)
  RADIUS_METRES: Number(process.env.ARRIVAL_RADIUS_METRES) || 100,

  // Maximum allowed GPS accuracy in metres (default: 50 metres or better)
  MAX_ACCURACY_METRES: Number(process.env.ARRIVAL_MAX_ACCURACY_METRES) || 50,

  // Minimum duration that qualifying GPS samples must span (default: 15 seconds)
  MIN_SUSTAINED_DURATION_MS: Number(process.env.ARRIVAL_MIN_SUSTAINED_DURATION_MS) || 15000,

  // Maximum allowed gap between consecutive GPS samples before candidate expires (default: 45 seconds)
  MAX_UPDATE_GAP_MS: Number(process.env.ARRIVAL_MAX_UPDATE_GAP_MS) || 45000,

  // Maximum age of a GPS sample to be considered fresh (default: 60 seconds)
  MAX_STALE_SAMPLE_AGE_MS: Number(process.env.ARRIVAL_MAX_STALE_SAMPLE_AGE_MS) || 60000,

  // Minimum number of distinct qualifying GPS samples required (default: 2 samples)
  MIN_QUALIFYING_SAMPLES: Number(process.env.ARRIVAL_MIN_QUALIFYING_SAMPLES) || 2,
};

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 * Returns distance in metres rounded to one decimal place.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Resolves the booking's pickup coordinates across standard, custom, and package trips.
 * Returns null if pickup coordinates are missing or invalid, retaining manual arrival.
 */
export async function getBookingPickupCoordinates(
  booking: any
): Promise<{ lat: number; lng: number; source: string } | null> {
  if (!booking) return null;

  // 1. Direct pickup coordinates stored on booking
  if (isValidCoordinate(booking.pickupLat, booking.pickupLng)) {
    return {
      lat: Number(booking.pickupLat),
      lng: Number(booking.pickupLng),
      source: "booking.pickupCoordinates",
    };
  }

  // 2. Custom trip starting location from day 1 itinerary
  const customStarting = booking.customTripDetails?.itinerary?.[0]?.startingLocation;
  if (customStarting && isValidCoordinate(customStarting.lat, customStarting.lng)) {
    return {
      lat: Number(customStarting.lat),
      lng: Number(customStarting.lng),
      source: "customTrip.startingLocation",
    };
  }

  // 3. Populated or referenced airport
  if (booking.airportId) {
    const airportObj = booking.airportId;
    const lat = airportObj.latitude ?? airportObj.lat;
    const lng = airportObj.longitude ?? airportObj.lng;
    if (isValidCoordinate(lat, lng)) {
      return { lat: Number(lat), lng: Number(lng), source: "airport.populated" };
    }

    // If airportId is an ObjectId/string reference that was not populated
    try {
      const AirportModel = (await import("@/models/Airport")).default;
      const airportId = airportObj._id || airportObj;
      const fetchedAirport: any = await AirportModel.findById(airportId).lean();
      if (fetchedAirport) {
        const fetchedLat = fetchedAirport.latitude ?? fetchedAirport.lat;
        const fetchedLng = fetchedAirport.longitude ?? fetchedAirport.lng;
        if (isValidCoordinate(fetchedLat, fetchedLng)) {
          return { lat: Number(fetchedLat), lng: Number(fetchedLng), source: "airport.db" };
        }
      }
    } catch (err) {
      console.warn("[ArrivalDetection] Failed to fetch airport for pickup coordinates:", err);
    }
  }

  return null;
}

export interface ArrivalEvaluationInput {
  booking: any;
  driverLat: number;
  driverLng: number;
  accuracy?: number;
  sampleCapturedAt: Date;
  now?: Date;
  pickupCoords?: { lat: number; lng: number } | null;
}

export type ArrivalEvaluationAction =
  | { action: "SKIP_NOT_ELIGIBLE_STATUS"; status: string }
  | { action: "SKIP_INVALID_PICKUP" }
  | { action: "IGNORE_STALE_SAMPLE"; ageMs: number }
  | { action: "IGNORE_POOR_ACCURACY"; accuracy: number; maxAllowed: number }
  | { action: "RESET_CANDIDATE"; reason: string; distanceMetres: number }
  | { action: "UPDATE_CANDIDATE"; candidate: any; distanceMetres: number; durationMs: number; sampleCount: number }
  | { action: "TRIGGER_ARRIVAL"; distanceMetres: number; durationMs: number; sampleCount: number; candidate: any };

/**
 * Pure evaluation engine for automatic driver arrival.
 * Evaluates candidate state and determines whether to trigger arrival, update candidate,
 * or reset candidate.
 */
export async function evaluateArrivalDetection(
  input: ArrivalEvaluationInput
): Promise<ArrivalEvaluationAction> {
  const { booking, driverLat, driverLng, accuracy, sampleCapturedAt } = input;
  const now = input.now || new Date();

  // 1. Only evaluate accepted trips while status is DRIVER_EN_ROUTE
  if (booking.status !== "DRIVER_EN_ROUTE") {
    return { action: "SKIP_NOT_ELIGIBLE_STATUS", status: booking.status };
  }

  // 2. Resolve pickup coordinates
  const pickup = input.pickupCoords !== undefined
    ? input.pickupCoords
    : await getBookingPickupCoordinates(booking);

  if (!pickup || !isValidCoordinate(pickup.lat, pickup.lng)) {
    return { action: "SKIP_INVALID_PICKUP" };
  }

  // 3. Stale sample check (reject samples older than MAX_STALE_SAMPLE_AGE_MS)
  const sampleAge = now.getTime() - sampleCapturedAt.getTime();
  if (sampleAge > ARRIVAL_CONFIG.MAX_STALE_SAMPLE_AGE_MS) {
    return { action: "IGNORE_STALE_SAMPLE", ageMs: sampleAge };
  }

  // 4. Calculate Haversine distance to pickup
  const distance = calculateHaversineDistance(
    driverLat,
    driverLng,
    pickup.lat,
    pickup.lng
  );

  // 5. Driver outside arrival radius -> reset candidate if one exists
  if (distance > ARRIVAL_CONFIG.RADIUS_METRES) {
    return {
      action: "RESET_CANDIDATE",
      reason: "DRIVER_OUTSIDE_RADIUS",
      distanceMetres: distance,
    };
  }

  // 6. Accuracy check: require reported accuracy of 50m or better
  if (typeof accuracy === "number" && !isNaN(accuracy) && accuracy > ARRIVAL_CONFIG.MAX_ACCURACY_METRES) {
    return {
      action: "IGNORE_POOR_ACCURACY",
      accuracy,
      maxAllowed: ARRIVAL_CONFIG.MAX_ACCURACY_METRES,
    };
  }

  // 7. Driver is inside radius with qualifying accuracy!
  const prevCandidate = booking.arrivalCandidate;

  // Case A: No previous candidate -> start tracking new candidate
  if (!prevCandidate || !prevCandidate.firstDetectedAt) {
    const newCandidate = {
      firstDetectedAt: sampleCapturedAt,
      lastDetectedAt: sampleCapturedAt,
      sampleCount: 1,
      lastDistanceMetres: distance,
      lastAccuracyMetres: accuracy,
    };
    return {
      action: "UPDATE_CANDIDATE",
      candidate: newCandidate,
      distanceMetres: distance,
      durationMs: 0,
      sampleCount: 1,
    };
  }

  // Case B: Previous candidate exists -> check for update gap
  const prevLastDetected = new Date(prevCandidate.lastDetectedAt).getTime();
  const gapMs = sampleCapturedAt.getTime() - prevLastDetected;

  if (gapMs > ARRIVAL_CONFIG.MAX_UPDATE_GAP_MS) {
    // Gap exceeded threshold -> candidate expired! Reset to start from this fresh sample
    const resetCandidate = {
      firstDetectedAt: sampleCapturedAt,
      lastDetectedAt: sampleCapturedAt,
      sampleCount: 1,
      lastDistanceMetres: distance,
      lastAccuracyMetres: accuracy,
    };
    return {
      action: "UPDATE_CANDIDATE",
      candidate: resetCandidate,
      distanceMetres: distance,
      durationMs: 0,
      sampleCount: 1,
    };
  }

  // Case C: Consecutive qualifying sample inside radius within allowable gap
  const firstDetected = new Date(prevCandidate.firstDetectedAt).getTime();
  const durationMs = sampleCapturedAt.getTime() - firstDetected;
  const sampleCount = (prevCandidate.sampleCount || 1) + 1;

  const updatedCandidate = {
    firstDetectedAt: new Date(prevCandidate.firstDetectedAt),
    lastDetectedAt: sampleCapturedAt,
    sampleCount,
    lastDistanceMetres: distance,
    lastAccuracyMetres: accuracy,
  };

  // Check if sustained duration threshold and minimum sample count are met!
  if (
    durationMs >= ARRIVAL_CONFIG.MIN_SUSTAINED_DURATION_MS &&
    sampleCount >= ARRIVAL_CONFIG.MIN_QUALIFYING_SAMPLES
  ) {
    return {
      action: "TRIGGER_ARRIVAL",
      distanceMetres: distance,
      durationMs,
      sampleCount,
      candidate: updatedCandidate,
    };
  }

  // Not yet sustained for full duration -> update candidate
  return {
    action: "UPDATE_CANDIDATE",
    candidate: updatedCandidate,
    distanceMetres: distance,
    durationMs,
    sampleCount,
  };
}
