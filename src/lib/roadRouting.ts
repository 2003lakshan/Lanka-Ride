import { isValidCoordinate } from "@/lib/navigation";

export interface RoadRoutePoint {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface RoadRouteResult {
  status: "ok" | "unavailable";
  distanceKm: number;
  durationMins: number;
  coordinates: [number, number][];
  cached?: boolean;
  error?: string;
  waypointCount?: number;
}

const routeCache = new Map<string, { timestamp: number; data: RoadRouteResult }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Calculates genuine driving-road distance and duration using OpenStreetMap OSRM routing.
 * Supports multiple intermediate stops in ordered sequence:
 * Origin -> Stop 1 -> Stop 2 -> ... -> Destination
 * Never calculates using straight-line distance.
 */
export async function fetchRoadRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  intermediateStops: Array<{ lat: number; lng: number; address?: string }> = []
): Promise<RoadRouteResult> {
  // 1. Validate origin and destination
  if (!isValidCoordinate(origin?.lat, origin?.lng) || !isValidCoordinate(destination?.lat, destination?.lng)) {
    return {
      status: "unavailable",
      distanceKm: 0,
      durationMins: 0,
      coordinates: [],
      error: "Invalid origin or destination coordinates.",
    };
  }

  // 2. Validate all intermediate stops
  const validStops: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < intermediateStops.length; i++) {
    const s = intermediateStops[i];
    if (!isValidCoordinate(s?.lat, s?.lng)) {
      return {
        status: "unavailable",
        distanceKm: 0,
        durationMins: 0,
        coordinates: [],
        error: `Invalid coordinates for intermediate stop ${i + 1}.`,
      };
    }
    validStops.push({ lat: s.lat, lng: s.lng });
  }

  // Waypoint limit check (OSRM demo server works reliably under 15 waypoints)
  const MAX_STOPS = 8;
  if (validStops.length > MAX_STOPS) {
    return {
      status: "unavailable",
      distanceKm: 0,
      durationMins: 0,
      coordinates: [],
      error: `Too many waypoints. A maximum of ${MAX_STOPS} intermediate stops is supported.`,
    };
  }

  // 3. Build ordered waypoint sequence: Origin -> Stops... -> Destination
  const allWaypoints = [origin, ...validStops, destination];
  const coordsKey = allWaypoints
    .map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`)
    .join(";");

  const now = Date.now();
  const cached = routeCache.get(coordsKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsKey}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(osrmUrl, {
      headers: { "User-Agent": "LankaAirportRide-Routing/1.0" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        status: "unavailable",
        distanceKm: 0,
        durationMins: 0,
        coordinates: [],
        error: `Routing service returned HTTP ${res.status}. Road routing temporarily unavailable.`,
      };
    }

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return {
        status: "unavailable",
        distanceKm: 0,
        durationMins: 0,
        coordinates: [],
        error: "No road driving route found connecting all specified stops.",
      };
    }

    const route = data.routes[0];
    const distanceKm = Number((route.distance / 1000).toFixed(2));
    const durationMins = Math.round(route.duration / 60);

    const leafletCoordinates: [number, number][] = (route.geometry?.coordinates || []).map(
      (c: [number, number]) => [c[1], c[0]]
    );

    const result: RoadRouteResult = {
      status: "ok",
      distanceKm,
      durationMins,
      coordinates: leafletCoordinates,
      waypointCount: allWaypoints.length,
    };

    routeCache.set(coordsKey, { timestamp: now, data: result });
    return result;
  } catch (err: any) {
    clearTimeout(timeout);
    return {
      status: "unavailable",
      distanceKm: 0,
      durationMins: 0,
      coordinates: [],
      error: "Road routing service connection timed out or is unavailable. Please retry.",
    };
  }
}
