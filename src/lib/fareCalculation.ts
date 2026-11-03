import { ensurePickMeCategories } from "@/lib/pickMeSeeder";
import { fetchRoadRoute, RoadRouteResult } from "@/lib/roadRouting";
import PickMeCategory, { IPickMeCategory } from "@/models/PickMeCategory";

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

export interface PickMeRouteFareQuote {
  status: "ok" | "unavailable";
  distanceKm: number;
  durationMins: number;
  coordinates: [number, number][];
  estimates: CategoryFareEstimate[];
  error?: string;
}

/**
 * Calculates estimated fare according to the exact rule:
 * estimatedFare = Math.round(Math.max(minimumFare, baseFare + distanceKm * ratePerKm))
 */
export function computeFare(
  baseFare: number,
  ratePerKm: number,
  minimumFare: number,
  distanceKm: number
): number {
  const calculated = (baseFare || 0) + (distanceKm || 0) * (ratePerKm || 0);
  return Math.round(Math.max(minimumFare || 0, calculated));
}

/**
 * Calculates fares across all 6 vehicle categories based strictly on driving-road distance.
 * Never uses straight-line distance.
 * If road routing fails, returns unavailable with clear retry instruction.
 */
export async function getPickMeFares(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  intermediateStops: Array<{ lat: number; lng: number; address?: string }> = []
): Promise<PickMeRouteFareQuote> {
  // 1. Fetch real road driving route including intermediate stops
  const route: RoadRouteResult = await fetchRoadRoute(origin, destination, intermediateStops);
  if (route.status !== "ok" || !route.distanceKm) {
    return {
      status: "unavailable",
      distanceKm: 0,
      durationMins: 0,
      coordinates: [],
      estimates: [],
      error: route.error || "Unable to determine driving road route between the specified locations. Please retry.",
    };
  }

  // 2. Load configurable categories from DB
  const categories = await ensurePickMeCategories();

  // 3. Compute estimates
  const estimates: CategoryFareEstimate[] = categories.map((cat: any) => {
    const hasValidRates = typeof cat.ratePerKm === "number" && cat.ratePerKm > 0;
    const isAvailable = Boolean(cat.isActive && hasValidRates);

    const estimatedFare = isAvailable
      ? computeFare(cat.baseFare, cat.ratePerKm, cat.minimumFare, route.distanceKm)
      : 0;

    return {
      category: cat.category,
      displayName: cat.displayName,
      description: cat.description,
      maxPassengers: cat.maxPassengers,
      maxLuggage: cat.maxLuggage,
      loadCapacityKg: cat.loadCapacityKg,
      isGoodsTransport: Boolean(cat.isGoodsTransport),
      baseFare: cat.baseFare,
      ratePerKm: cat.ratePerKm,
      minimumFare: cat.minimumFare,
      estimatedFare,
      isAvailable,
      unavailableReason: !cat.isActive
        ? "Disabled by admin"
        : !hasValidRates
        ? "Pricing not configured"
        : undefined,
      sortOrder: cat.sortOrder || 99,
    };
  });

  return {
    status: "ok",
    distanceKm: route.distanceKm,
    durationMins: route.durationMins,
    coordinates: route.coordinates,
    estimates,
  };
}

/**
 * Validates and locks the fare on the server when creating a booking.
 * Never trusts client-sent totals.
 * Generates the immutable pricingSnapshot to store with the booking.
 */
export async function validateAndSnapshotPickMeFare(
  categoryName: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  intermediateStops: Array<{ lat: number; lng: number; address?: string }> = []
) {
  // 1. Get road route including intermediate stops
  const route = await fetchRoadRoute(origin, destination, intermediateStops);
  if (route.status !== "ok" || !route.distanceKm) {
    throw new Error(route.error || "Failed to calculate road distance for ride verification. Please retry.");
  }

  // 2. Load category pricing from database
  await ensurePickMeCategories();
  const categoryDoc = await PickMeCategory.findOne({ category: categoryName });
  if (!categoryDoc) {
    throw new Error(`Vehicle category "${categoryName}" does not exist.`);
  }

  if (!categoryDoc.isActive) {
    throw new Error(`Vehicle category "${categoryDoc.displayName}" is currently unavailable for bookings.`);
  }

  if (!categoryDoc.ratePerKm || categoryDoc.ratePerKm <= 0) {
    throw new Error(`Vehicle category "${categoryDoc.displayName}" does not have valid pricing configured.`);
  }

  // 3. Compute official server fare
  const estimatedFare = computeFare(
    categoryDoc.baseFare,
    categoryDoc.ratePerKm,
    categoryDoc.minimumFare,
    route.distanceKm
  );

  const pricingSnapshot = {
    category: categoryDoc.category,
    displayName: categoryDoc.displayName,
    isGoodsTransport: Boolean(categoryDoc.isGoodsTransport),
    baseFare: categoryDoc.baseFare,
    ratePerKm: categoryDoc.ratePerKm,
    minimumFare: categoryDoc.minimumFare,
    distanceKm: route.distanceKm,
    durationMins: route.durationMins,
    intermediateStopsCount: intermediateStops.length,
    estimatedFare,
    calculatedAt: new Date(),
  };

  return {
    categoryDoc,
    route,
    estimatedFare,
    pricingSnapshot,
  };
}
