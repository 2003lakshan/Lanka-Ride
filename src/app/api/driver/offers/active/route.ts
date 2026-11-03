import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { getEligibleActiveOffersForDriver } from "@/lib/nearbyDispatch";

export const dynamic = "force-dynamic";

/**
 * GET /api/driver/offers/active
 * Returns all active unexpired Local Ride offers dispatched to this driver.
 * Enforces strict server eligibility rules:
 * - Approved, online, available (NO active conflicting trip), matching vehicle, fresh GPS, and within 15 km.
 * Used for page load reconciliation, websocket reconnect recovery, and polling fallback.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized. Driver access only." }, { status: 401 });
    }

    const driverId = (session.user as any).id;
    await dbConnect();

    const activeTripStatuses = [
      "CONFIRMED",
      "DRIVER_ASSIGNED",
      "DRIVER_EN_ROUTE",
      "DRIVER_ARRIVED",
      "PASSENGER_PICKED_UP",
      "TRIP_IN_PROGRESS",
    ] as const;
    const hasActiveTrip = await Booking.exists({
      driverId,
      status: { $in: activeTripStatuses as any },
    });

    if (hasActiveTrip) {
      return NextResponse.json({
        success: true,
        hasActiveTrip: true,
        count: 0,
        offers: [],
      });
    }

    const offers = await getEligibleActiveOffersForDriver(driverId);

    return NextResponse.json({
      success: true,
      hasActiveTrip: false,
      count: offers.length,
      offers,
    });
  } catch (err: any) {
    console.error("[Active Offers API Error]", err.message);
    return NextResponse.json({ error: "Failed to retrieve active offers." }, { status: 500 });
  }
}
