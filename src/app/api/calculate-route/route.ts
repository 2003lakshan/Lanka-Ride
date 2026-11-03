import { NextResponse } from "next/server";

interface Coordinate {
  lat: number;
  lng: number;
}

// In-memory cache for OSRM routes to prevent duplicate requests & throttle traffic
interface CachedRoute {
  timestamp: number;
  data: any;
}
const routeCache = new Map<string, CachedRoute>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return false;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let waypoints: Coordinate[] = [];

    if (Array.isArray(body.waypoints) && body.waypoints.length >= 2) {
      waypoints = body.waypoints;
    } else if (body.origin && body.destination) {
      waypoints = [body.origin, body.destination];
    } else {
      return NextResponse.json(
        { error: "Valid origin and destination or at least 2 waypoints are required" },
        { status: 400 }
      );
    }

    // Validate all coordinates
    for (let i = 0; i < waypoints.length; i++) {
      const pt = waypoints[i];
      if (!isValidCoordinate(pt.lat, pt.lng)) {
        return NextResponse.json(
          { 
            status: "unavailable",
            error: `Invalid coordinates at index ${i}: (${pt.lat}, ${pt.lng})`
          },
          { status: 400 }
        );
      }
    }

    // Round coordinates to 5 decimal places (~1m accuracy) for caching key
    const coordsKey = waypoints
      .map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`)
      .join(";");

    // Check in-memory cache
    const now = Date.now();
    const cached = routeCache.get(coordsKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.data, cached: true }, { status: 200 });
    }

    // Query OpenStreetMap OSRM driving service
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsKey}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    let res: Response;
    try {
      res = await fetch(osrmUrl, {
        headers: { "User-Agent": "LankaAirportRide-Routing/1.0" },
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      return NextResponse.json(
        {
          status: "unavailable",
          error: "Routing service timed out or connection failed. Road distance is currently unavailable.",
        },
        { status: 200 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          status: "unavailable",
          error: `Routing service returned HTTP ${res.status}. Road routing is temporarily unavailable.`,
        },
        { status: 200 }
      );
    }

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return NextResponse.json(
        {
          status: "unavailable",
          error: "No road route found between the specified locations.",
        },
        { status: 200 }
      );
    }

    const route = data.routes[0];
    const totalDistanceKm = Number((route.distance / 1000).toFixed(2));
    const totalDurationMins = Math.round(route.duration / 60);

    // OSRM GeoJSON geometry coordinates are [lng, lat], Leaflet requires [lat, lng]
    const leafletCoordinates: [number, number][] = (route.geometry?.coordinates || []).map(
      (c: [number, number]) => [c[1], c[0]]
    );

    const legs = (route.legs || []).map((leg: any, idx: number) => ({
      legIndex: idx,
      distanceKm: Number((leg.distance / 1000).toFixed(2)),
      durationMins: Math.round(leg.duration / 60),
    }));

    const responsePayload = {
      status: "ok",
      distanceKm: totalDistanceKm,
      durationMins: totalDurationMins,
      coordinates: leafletCoordinates,
      legs,
      waypointsCount: waypoints.length,
      cached: false,
    };

    // Store in cache
    routeCache.set(coordsKey, { timestamp: now, data: responsePayload });

    // Clean up stale cache entries if too large
    if (routeCache.size > 200) {
      for (const [k, v] of routeCache.entries()) {
        if (now - v.timestamp >= CACHE_TTL_MS) {
          routeCache.delete(k);
        }
      }
    }

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error: any) {
    console.error("Calculate route error:", error);
    return NextResponse.json(
      { status: "unavailable", error: error.message || "Failed to calculate road route" },
      { status: 500 }
    );
  }
}
