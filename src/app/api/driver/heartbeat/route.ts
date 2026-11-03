import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { isValidCoordinate } from "@/lib/navigation";

export const dynamic = "force-dynamic";

// Configurable GPS freshness limit (defaults to 5 minutes)
const LOCATION_FRESHNESS_MINS = Number(process.env.DISPATCH_LOCATION_FRESHNESS_MINS || 5);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized: Driver access only" }, { status: 401 });
    }

    await dbConnect();
    const driverId = (session.user as any).id;
    const driver = await User.findById(driverId).select(
      "isOnline currentLat currentLng locationUpdatedAt isApproved vehicleCategory"
    ).lean();

    if (!driver) {
      return NextResponse.json({ error: "Driver account not found" }, { status: 404 });
    }

    const hasLocation = isValidCoordinate(driver.currentLat, driver.currentLng);
    const now = Date.now();
    const updatedTime = driver.locationUpdatedAt ? new Date(driver.locationUpdatedAt).getTime() : 0;
    const isFresh = Boolean(hasLocation && updatedTime && now - updatedTime <= LOCATION_FRESHNESS_MINS * 60 * 1000);

    return NextResponse.json({
      success: true,
      isOnline: Boolean(driver.isOnline),
      isApproved: Boolean(driver.isApproved),
      vehicleCategory: driver.vehicleCategory,
      currentLat: driver.currentLat,
      currentLng: driver.currentLng,
      locationUpdatedAt: driver.locationUpdatedAt,
      hasLocation,
      isFresh,
      freshnessThresholdMins: LOCATION_FRESHNESS_MINS,
    });
  } catch (err: any) {
    console.error("Driver heartbeat GET error:", err);
    return NextResponse.json({ error: err.message || "Failed to get driver status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized: Driver access only" }, { status: 401 });
    }

    await dbConnect();
    const driverId = (session.user as any).id;

    const body = await request.json().catch(() => ({}));
    const { lat, lng, isOnline } = body;

    const updateFields: any = {};

    if (typeof isOnline === "boolean") {
      updateFields.isOnline = isOnline;
    }

    if (lat !== undefined && lng !== undefined) {
      if (!isValidCoordinate(lat, lng)) {
        return NextResponse.json(
          { error: "Invalid GPS coordinates. Latitude must be between -90 and 90, longitude between -180 and 180." },
          { status: 400 }
        );
      }
      updateFields.currentLat = Number(lat);
      updateFields.currentLng = Number(lng);
      updateFields.locationUpdatedAt = new Date();
    }


    const updatedDriver = await User.findByIdAndUpdate(
      driverId,
      { $set: updateFields },
      { new: true }
    ).select("isOnline currentLat currentLng locationUpdatedAt isApproved vehicleCategory").lean();

    if (!updatedDriver) {
      return NextResponse.json({ error: "Driver account not found" }, { status: 404 });
    }

    const hasLocation = isValidCoordinate(updatedDriver.currentLat, updatedDriver.currentLng);
    const now = Date.now();
    const updatedTime = updatedDriver.locationUpdatedAt ? new Date(updatedDriver.locationUpdatedAt).getTime() : 0;
    const isFresh = Boolean(hasLocation && updatedTime && now - updatedTime <= LOCATION_FRESHNESS_MINS * 60 * 1000);

    return NextResponse.json({
      success: true,
      isOnline: Boolean(updatedDriver.isOnline),
      isApproved: Boolean(updatedDriver.isApproved),
      vehicleCategory: updatedDriver.vehicleCategory,
      currentLat: updatedDriver.currentLat,
      currentLng: updatedDriver.currentLng,
      locationUpdatedAt: updatedDriver.locationUpdatedAt,
      hasLocation,
      isFresh,
    });
  } catch (err: any) {
    console.error("Driver heartbeat POST error:", err);
    return NextResponse.json({ error: err.message || "Failed to update driver status" }, { status: 500 });
  }
}
