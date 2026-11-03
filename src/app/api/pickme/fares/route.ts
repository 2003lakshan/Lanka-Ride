import { NextResponse } from "next/server";
import { getPickMeFares } from "@/lib/fareCalculation";
import { isValidCoordinate } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const originLat = parseFloat(searchParams.get("originLat") || "");
    const originLng = parseFloat(searchParams.get("originLng") || "");
    const destLat = parseFloat(searchParams.get("destLat") || "");
    const destLng = parseFloat(searchParams.get("destLng") || "");

    if (!isValidCoordinate(originLat, originLng) || !isValidCoordinate(destLat, destLng)) {
      return NextResponse.json(
        { error: "Valid origin and destination coordinates are required." },
        { status: 400 }
      );
    }

    // Optional intermediate stops parsed from stops query param (JSON or coords)
    let stops: Array<{ lat: number; lng: number; address?: string }> = [];
    const stopsParam = searchParams.get("stops");
    if (stopsParam) {
      try {
        const parsed = JSON.parse(stopsParam);
        if (Array.isArray(parsed)) {
          stops = parsed.filter((s: any) => isValidCoordinate(s.lat, s.lng));
        }
      } catch {
        // Ignore JSON parse error on stops param
      }
    }

    const result = await getPickMeFares(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      stops
    );

    if (result.status !== "ok") {
      return NextResponse.json(
        {
          error: result.error || "Road routing temporarily unavailable.",
          status: "unavailable",
          retryAllowed: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("PickMe fares calculation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to calculate PickMe fares.", status: "unavailable" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickup, destination, intermediateStops = [] } = body;

    const originLat = pickup?.lat;
    const originLng = pickup?.lng;
    const destLat = destination?.lat;
    const destLng = destination?.lng;

    if (!isValidCoordinate(originLat, originLng) || !isValidCoordinate(destLat, destLng)) {
      return NextResponse.json(
        { error: "Valid pickup and destination coordinates are required." },
        { status: 400 }
      );
    }

    const validStops = Array.isArray(intermediateStops)
      ? intermediateStops.filter((s: any) => isValidCoordinate(s.lat, s.lng))
      : [];

    const result = await getPickMeFares(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      validStops
    );

    if (result.status !== "ok") {
      return NextResponse.json(
        {
          error: result.error || "Road routing temporarily unavailable.",
          status: "unavailable",
          retryAllowed: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("PickMe POST fares calculation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to calculate PickMe fares.", status: "unavailable" },
      { status: 500 }
    );
  }
}
