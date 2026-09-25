import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { origin, destination } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: "Origin and destination are required" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Google Maps API Key in backend configuration." }, { status: 500 });
    }

    const routesApiUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";
    
    const response = await fetch(routesApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: "DRIVE",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Compute Routes API Error:", data);
      return NextResponse.json({ 
        error: `Routes API Error: ${data.error?.message || "Unknown error"}`,
        details: data 
      }, { status: response.status });
    }

    const route = data.routes?.[0];
    if (!route) {
      return NextResponse.json({ error: "No route found between these locations." }, { status: 404 });
    }

    const distanceKm = Math.round((route.distanceMeters || 0) / 1000);
    const durationStr = route.duration || "0s";
    const durationMins = Math.round(parseInt(durationStr.replace("s", "")) / 60);
    
    return NextResponse.json(
      {
        distanceKm,
        durationMins,
        polyline: route.polyline?.encodedPolyline,
        isMock: false,
        origin,
        destination,
        apiUsed: "ComputeRoutes",
        status: "success"
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Calculate route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
