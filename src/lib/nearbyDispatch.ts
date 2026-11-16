import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import User, { IUser } from "@/models/User";
import Booking, { IBooking } from "@/models/Booking";
import { isValidCoordinate } from "@/lib/navigation";
import { fetchRoadRoute } from "@/lib/roadRouting";
import {
  broadcastRideOffer,
  broadcastRideOfferExpired,
  broadcastNoDriversAccepted,
} from "@/lib/realtime";

// Configuration with strict defaults (do not silently expand)
export const DISPATCH_MAX_RADIUS_KM = Number(process.env.DISPATCH_MAX_RADIUS_KM || 15);
export const DISPATCH_OFFER_EXPIRY_SECONDS = Number(process.env.DISPATCH_OFFER_EXPIRY_SECONDS || 7200); // Offers remain active until driver rejects or accepts
export const DISPATCH_LOCATION_FRESHNESS_MINS = Number(process.env.DISPATCH_LOCATION_FRESHNESS_MINS || 5);

/**
 * Calculates straight-line distance in kilometres using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export interface EligibleDriverMatch {
  driver: IUser;
  distanceKm: number;
  durationMins: number;
  isRoadDistance: boolean;
  straightLineDistanceKm: number;
}

/**
 * Evaluates whether a driver's registered vehicle category can fulfill the requested ride category.
 * Rules:
 * 1. Exact match (case-insensitive) always matches.
 * 2. High-capacity upgrades:
 *    - Van can fulfill Van, Mini Van, and Car requests.
 *    - Mini Van can fulfill Mini Van and Car requests.
 * 3. In dev / test mode (or when ALLOW_CROSS_CATEGORY_DISPATCH is enabled), Car and Mini Van
 *    are cross-compatible to ensure test rides ring driver devices cleanly.
 */
export function isVehicleCategoryCompatible(
  driverCategory: string | undefined,
  requestedCategory: string | undefined
): boolean {
  if (!driverCategory || !requestedCategory) return false;
  const d = driverCategory.trim().toLowerCase();
  const r = requestedCategory.trim().toLowerCase();

  // 1. Exact match
  if (d === r) return true;

  // 2. Van can fulfill Mini Van and Car
  if (d === "van" && (r === "mini van" || r === "car")) return true;

  // 3. Mini Van can fulfill Car
  if (d === "mini van" && r === "car") return true;

  // 4. In development / testing environment or when flexible dispatch is enabled,
  // allow Car drivers to receive Mini Van offers so single-driver test devices ring reliably
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_CROSS_CATEGORY_DISPATCH === "true") {
    if ((d === "car" && r === "mini van") || (d === "mini van" && r === "car")) {
      return true;
    }
  }

  return false;
}

export interface FindEligibleDriversOptions {
  pickupLat: number;
  pickupLng: number;
  vehicleCategory: string;
  excludeDriverIds?: string[];
  maxRadiusKm?: number;
  freshnessMins?: number;
}

/**
 * Discovers and filters eligible drivers strictly matching all criteria:
 * 1. Authenticated, approved (isApproved: true), online (isOnline: true), available.
 * 2. Registered vehicle category matches requested category.
 * 3. Has no conflicting active trip.
 * 4. Fresh valid GPS location (within freshness window, e.g. 5 minutes).
 * 5. Driver-to-pickup road distance <= 15 km (using Haversine pre-filter and driving-road check).
 */
export async function findEligibleNearbyDrivers(
  options: FindEligibleDriversOptions
): Promise<{
  eligibleDrivers: EligibleDriverMatch[];
  totalCandidates: number;
  excludedReasonCounts: Record<string, number>;
}> {
  await dbConnect();

  const {
    pickupLat,
    pickupLng,
    vehicleCategory,
    excludeDriverIds = [],
    maxRadiusKm = DISPATCH_MAX_RADIUS_KM,
    freshnessMins = DISPATCH_LOCATION_FRESHNESS_MINS,
  } = options;

  const excludedReasonCounts: Record<string, number> = {
    missingOrStaleGps: 0,
    vehicleMismatch: 0,
    conflictingActiveTrip: 0,
    outsideRadiusStraightLine: 0,
    outsideRadiusRoadDistance: 0,
    explicitlyExcluded: 0,
  };

  if (!isValidCoordinate(pickupLat, pickupLng)) {
    throw new Error("Invalid pickup coordinates for nearby driver search.");
  }

  const freshnessCutoff = new Date(Date.now() - freshnessMins * 60 * 1000);

  // 1. Initial database query for approved, online drivers
  const candidateDrivers = await User.find({
    role: "DRIVER",
    isApproved: true,
    isOnline: true,
  }).lean();

  const activeTripStatuses = [
    "CONFIRMED",
    "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED",
    "PASSENGER_PICKED_UP",
    "TRIP_IN_PROGRESS",
  ] as const;

  const eligibleDrivers: EligibleDriverMatch[] = [];

  for (const driver of candidateDrivers) {
    const driverIdStr = (driver._id as any).toString();

    // Check if explicitly excluded (e.g. driver rejected this offer)
    if (excludeDriverIds.includes(driverIdStr)) {
      excludedReasonCounts.explicitlyExcluded++;
      continue;
    }

    // Check GPS presence and freshness
    const hasValidGps = isValidCoordinate(driver.currentLat, driver.currentLng);
    const lastLocationTime = driver.locationUpdatedAt || (driver as any).lastLocationUpdate;
    const isGpsFresh = lastLocationTime && new Date(lastLocationTime) >= freshnessCutoff;
    if (!hasValidGps || !isGpsFresh) {
      excludedReasonCounts.missingOrStaleGps++;
      continue;
    }

    // Check vehicle category compatibility
    const driverCategory =
      driver.vehicleCategory ||
      driver.driverDetails?.vehicleCategory ||
      (driver as any).driverProfile?.vehicleDetails?.category;
    if (!isVehicleCategoryCompatible(driverCategory, vehicleCategory)) {
      excludedReasonCounts.vehicleMismatch++;
      continue;
    }

    // Check for conflicting active trips
    const hasActiveTrip = await Booking.exists({
      driverId: driver._id,
      status: { $in: activeTripStatuses },
    });
    if (hasActiveTrip) {
      excludedReasonCounts.conflictingActiveTrip++;
      continue;
    }

    // 2. Geospatial initial filtering (Driver-to-pickup distance)
    const straightLineKm = calculateHaversineDistanceKm(
      driver.currentLat!,
      driver.currentLng!,
      pickupLat,
      pickupLng
    );

    // If straight-line distance exceeds max radius, road distance will certainly exceed it
    if (straightLineKm > maxRadiusKm) {
      excludedReasonCounts.outsideRadiusStraightLine++;
      continue;
    }

    // 3. Road distance verification via routing provider
    let roadDistanceKm = straightLineKm;
    let roadDurationMins = Math.max(1, Math.round((straightLineKm / 35) * 60));
    let isRoadDistance = false;

    try {
      const roadRoute = await fetchRoadRoute(
        { lat: driver.currentLat!, lng: driver.currentLng! },
        { lat: pickupLat, lng: pickupLng }
      );

      if (roadRoute.status === "ok") {
        if (roadRoute.distanceKm > maxRadiusKm) {
          excludedReasonCounts.outsideRadiusRoadDistance++;
          continue; // Exclude drivers whose genuine road distance exceeds 15 km!
        }
        roadDistanceKm = roadRoute.distanceKm;
        roadDurationMins = roadRoute.durationMins;
        isRoadDistance = true;
      } else {
        // Road routing unavailable: fallback accurately labelled as straight-line
        isRoadDistance = false;
      }
    } catch {
      // Routing provider network issue: retain geospatial filter, clearly labelled
      isRoadDistance = false;
    }

    eligibleDrivers.push({
      driver: driver as IUser,
      distanceKm: roadDistanceKm,
      durationMins: roadDurationMins,
      isRoadDistance,
      straightLineDistanceKm: straightLineKm,
    });
  }

  // Sort closest drivers first
  eligibleDrivers.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    eligibleDrivers,
    totalCandidates: candidateDrivers.length,
    excludedReasonCounts,
  };
}

/**
 * Initiates the dispatch process for a Local Ride booking:
 * - Queries eligible drivers within 15 km of pickup.
 * - Dispatches authenticated realtime offer to each eligible driver.
 * - Schedules offer expiry (30s) and rider notifications if no driver accepts.
 */
export async function dispatchLocalRideOffer(bookingIdOrDoc: string | any) {
  await dbConnect();

  const booking =
    typeof bookingIdOrDoc === "string"
      ? await Booking.findById(bookingIdOrDoc)
      : bookingIdOrDoc;

  if (!booking) {
    throw new Error("Booking not found for dispatch");
  }

  const bookingId = (booking._id as any).toString();
  const vehicleCategory =
    booking.pickMeDetails?.vehicleCategory ||
    booking.vehicleCategory ||
    "Car";

  const pickupLat = booking.pickupLat;
  const pickupLng = booking.pickupLng;

  if (!isValidCoordinate(pickupLat, pickupLng)) {
    throw new Error("Booking pickup coordinates are missing or invalid");
  }

  // Find eligible drivers (excluding any who already rejected this specific booking)
  const rejectedIds = (booking.rejectedDriverIds || []).map((id: any) => id.toString());
  const { eligibleDrivers } = await findEligibleNearbyDrivers({
    pickupLat,
    pickupLng,
    vehicleCategory,
    excludeDriverIds: rejectedIds,
  });

  const touristId = booking.touristId ? (booking.touristId._id || booking.touristId).toString() : null;

  if (eligibleDrivers.length === 0) {
    // No nearby drivers eligible or online
    await Booking.findByIdAndUpdate(bookingId, {
      $set: { dispatchStatus: "EXPIRED" },
    });

    await broadcastNoDriversAccepted(booking);

    return {
      success: false,
      reason: "NO_ELIGIBLE_DRIVERS_FOUND",
      eligibleCount: 0,
      bookingId,
    };
  }

  const serverTime = Date.now();
  const expiresAt = serverTime + DISPATCH_OFFER_EXPIRY_SECONDS * 1000;
  const offeredDriverIds = eligibleDrivers.map((m) => m.driver._id);

  // Update booking with offered drivers and expiry timestamp
  await Booking.findByIdAndUpdate(bookingId, {
    $set: {
      offeredDriverIds,
      dispatchStatus: "OFFERED",
      dispatchExpiresAt: new Date(expiresAt),
    },
  });

  // Intermediate stops formatted
  const intermediateStops = (booking.intermediateStops || []).map((s: any, idx: number) => ({
    name: s.name || `Stop ${idx + 1}`,
    address: s.address || `Stop ${idx + 1}`,
    lat: s.lat,
    lng: s.lng,
    stopOrder: s.stopOrder || idx + 1,
  }));

  // Resolve passenger name from registered profile without exposing contact numbers
  let passengerName = (booking.passengerDetails?.fullName || "").trim();
  if (!passengerName && booking.touristId) {
    if (typeof booking.touristId === "object" && (booking.touristId.name || booking.touristId.fullName)) {
      passengerName = (booking.touristId.name || booking.touristId.fullName).trim();
    } else {
      const touristUser = await User.findById(booking.touristId).select("name fullName");
      if (touristUser) {
        passengerName = (touristUser.name || (touristUser as any).fullName || "").trim();
      }
    }
  }
  if (!passengerName) {
    passengerName = "Passenger";
  }

  // Send individualized offer to each eligible driver
  for (const match of eligibleDrivers) {
    const driverId = (match.driver._id as any).toString();

    // PRIVACY ENFORCEMENT: Never include rider phone number or email in offer payload!
    const offerPayload = {
      offerId: `offer_${bookingId}_${serverTime}`,
      bookingId,
      bookingReference: booking.bookingReference,
      pickupLocation: {
        address: booking.pickupAddress || "Pickup Point",
        lat: pickupLat,
        lng: pickupLng,
      },
      driverLocation: {
        lat: match.driver.currentLat!,
        lng: match.driver.currentLng!,
      },
      driverToPickupDistanceKm: match.isRoadDistance ? match.distanceKm : null,
      driverToPickupDurationMins: match.isRoadDistance ? match.durationMins : null,
      driverToPickupStraightLineKm: match.straightLineDistanceKm,
      isRoadDistance: match.isRoadDistance,
      intermediateStops,
      destinationLocation: {
        address: booking.destinationAddress || "Designated Destination",
        lat: booking.destinationLat,
        lng: booking.destinationLng,
      },
      passengerJourneyDistanceKm: booking.distanceKm || 0,
      passengerJourneyDurationMins: booking.durationMins || 0,
      vehicleCategory,
      passengerName,
      estimatedFare:
        booking.pickMeDetails?.estimatedFare ||
        booking.fareBreakdown?.totalEstimatedFare ||
        0,
      paymentMethod: booking.paymentMethod || "CASH",
      expiresAt,
      serverTime,
    };

    broadcastRideOffer(driverId, offerPayload).catch((err) => {
      console.warn(`[Dispatch] Failed to send offer to driver ${driverId}:`, err.message);
    });
  }

  // Schedule server-side expiry reconciliation timer
  setTimeout(async () => {
    try {
      await dbConnect();
      const currentBooking = await Booking.findById(bookingId).select(
        "status driverId bookingReference touristId dispatchStatus"
      );

      // Only expire if booking is still PENDING and has not been assigned to a driver
      if (
        currentBooking &&
        currentBooking.status === "PENDING" &&
        !currentBooking.driverId
      ) {
        await Booking.findByIdAndUpdate(bookingId, {
          $set: { dispatchStatus: "EXPIRED" },
        });

        // Broadcast expiry to offered drivers to withdraw the popup and stop ringing
        const driverIdStrs = offeredDriverIds.map((id) => id.toString());
        await broadcastRideOfferExpired(
          driverIdStrs,
          bookingId,
          currentBooking.bookingReference
        );

        // Notify rider that no driver accepted, offering Retry and Cancel actions
        await broadcastNoDriversAccepted(currentBooking);
      }
    } catch (err: any) {
      console.error("[Dispatch Expiry Check Error]", err.message);
    }
  }, DISPATCH_OFFER_EXPIRY_SECONDS * 1000 + 500); // Expiry time + grace buffer

  return {
    success: true,
    eligibleCount: eligibleDrivers.length,
    bookingId,
    expiresAt,
  };
}

/**
 * Retrieves valid unexpired Local Ride offers for a driver strictly applying
 * authoritative server eligibility rules:
 * - Driver is approved (isApproved: true) and online (isOnline: true)
 * - Driver has no conflicting active trip
 * - Driver has fresh GPS coordinates (within 5 minutes)
 * - Booking is PENDING, unassigned, unexpired, and not rejected by driver
 * - Matching vehicle category
 * - Straight-line & road distance <= 15 km limit
 */
export async function getEligibleActiveOffersForDriver(driverId: string) {
  await dbConnect();

  const driver = await User.findById(driverId).select(
    "currentLat currentLng locationUpdatedAt isOnline isApproved vehicleCategory driverDetails driverProfile"
  );
  if (!driver || !driver.isApproved || !driver.isOnline) {
    return [];
  }

  const activeTripStatuses = [
    "CONFIRMED",
    "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED",
    "PASSENGER_PICKED_UP",
    "TRIP_IN_PROGRESS",
  ];
  const hasActiveTrip = await Booking.exists({
    driverId,
    status: { $in: activeTripStatuses as any },
  });
  if (hasActiveTrip) {
    return [];
  }

  const hasValidGps =
    typeof driver.currentLat === "number" &&
    typeof driver.currentLng === "number" &&
    !isNaN(driver.currentLat) &&
    !isNaN(driver.currentLng);
  const freshnessCutoff = new Date(Date.now() - DISPATCH_LOCATION_FRESHNESS_MINS * 60 * 1000);
  const lastUpdate = driver.locationUpdatedAt || (driver as any).lastLocationUpdate;
  const isGpsFresh = lastUpdate && new Date(lastUpdate) >= freshnessCutoff;

  if (!hasValidGps || !isGpsFresh) {
    return [];
  }

  const driverVehicleCategory =
    driver.vehicleCategory ||
    driver.driverDetails?.vehicleCategory ||
    (driver as any).driverProfile?.vehicleDetails?.category ||
    "";

  const now = new Date();
  const driverObjectId = mongoose.Types.ObjectId.isValid(driverId)
    ? new mongoose.Types.ObjectId(driverId)
    : null;
  const rejectedExclusion = driverObjectId ? [driverId, driverObjectId] : [driverId];

  const activeBookings = await Booking.find({
    status: "PENDING",
    driverId: null,
    rejectedDriverIds: { $nin: rejectedExclusion },
    $or: [
      { dispatchExpiresAt: { $exists: false } },
      { dispatchExpiresAt: null },
      { dispatchExpiresAt: { $gt: now } },
    ],
  })
    .populate("touristId", "name fullName")
    .sort({ createdAt: -1 })
    .lean();

  const serverTime = Date.now();
  const offers = [];

  for (const booking of activeBookings) {
    const bookingId = (booking._id as any).toString();

    // Check vehicle category compatibility
    const bookingCategory =
      booking.pickMeDetails?.vehicleCategory ||
      (booking as any).vehicleCategory ||
      "";
    if (!isVehicleCategoryCompatible(driverVehicleCategory, bookingCategory)) {
      continue;
    }

    if (
      typeof booking.pickupLat !== "number" ||
      typeof booking.pickupLng !== "number"
    ) {
      continue;
    }

    const straightLineKm = calculateHaversineDistanceKm(
      driver.currentLat!,
      driver.currentLng!,
      booking.pickupLat,
      booking.pickupLng
    );

    if (straightLineKm > DISPATCH_MAX_RADIUS_KM) {
      continue;
    }

    let driverToPickupDistanceKm: number | null = null;
    let driverToPickupDurationMins: number | null = null;
    let isRoadDistance = false;

    try {
      const roadRoute = await fetchRoadRoute(
        { lat: driver.currentLat!, lng: driver.currentLng! },
        { lat: booking.pickupLat, lng: booking.pickupLng }
      );
      if (roadRoute.status === "ok") {
        if (roadRoute.distanceKm > DISPATCH_MAX_RADIUS_KM) {
          continue;
        }
        driverToPickupDistanceKm = roadRoute.distanceKm;
        driverToPickupDurationMins = roadRoute.durationMins;
        isRoadDistance = true;
      }
    } catch {
      isRoadDistance = false;
    }

    const expiresAt = booking.dispatchExpiresAt
      ? new Date(booking.dispatchExpiresAt).getTime()
      : serverTime + DISPATCH_OFFER_EXPIRY_SECONDS * 1000;

    const intermediateStops = (booking.intermediateStops || []).map((s: any, idx: number) => ({
      name: s.name || `Stop ${idx + 1}`,
      address: s.address || `Stop ${idx + 1}`,
      lat: s.lat,
      lng: s.lng,
      stopOrder: s.stopOrder || idx + 1,
    }));

    let passengerName = (booking.passengerDetails?.fullName || "").trim();
    if (!passengerName && booking.touristId) {
      passengerName = ((booking.touristId as any).name || (booking.touristId as any).fullName || "").trim();
    }
    if (!passengerName) {
      passengerName = "Passenger";
    }

    const vehicleCategory =
      booking.pickMeDetails?.vehicleCategory ||
      (booking as any).vehicleCategory ||
      "Standard Vehicle";

    offers.push({
      offerId: `offer_${bookingId}_${serverTime}`,
      bookingId,
      bookingReference: booking.bookingReference,
      pickupLocation: {
        address: booking.pickupAddress || "Pickup Point",
        lat: booking.pickupLat,
        lng: booking.pickupLng,
      },
      driverLocation: {
        lat: driver.currentLat!,
        lng: driver.currentLng!,
      },
      driverToPickupDistanceKm,
      driverToPickupDurationMins,
      driverToPickupStraightLineKm: straightLineKm,
      isRoadDistance,
      intermediateStops,
      destinationLocation: {
        address: booking.destinationAddress || "Designated Destination",
        lat: booking.destinationLat,
        lng: booking.destinationLng,
      },
      passengerJourneyDistanceKm: booking.distanceKm || 0,
      passengerJourneyDurationMins: booking.durationMins || 0,
      vehicleCategory,
      passengerName,
      estimatedFare:
        booking.pickMeDetails?.estimatedFare ||
        booking.fareBreakdown?.totalEstimatedFare ||
        0,
      paymentMethod: booking.paymentMethod || "CASH",
      expiresAt,
      serverTime,
    });
  }

  return offers;
}

