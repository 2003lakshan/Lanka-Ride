import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { dispatchLocalRideOffer } from "@/lib/nearbyDispatch";

export const dynamic = "force-dynamic";

/**
 * Retries dispatching a local ride when no drivers accepted.
 * Clears prior rejection records so nearby drivers who were busy can be re-offered.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const role = (session.user as any).role;

    await dbConnect();

    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Only booking owner or admin can retry dispatch
    if (role !== "ADMIN" && (!booking.touristId || booking.touristId.toString() !== userId)) {
      return NextResponse.json({ error: "Unauthorized: You do not own this booking" }, { status: 403 });
    }

    if (booking.status !== "PENDING" || booking.driverId) {
      return NextResponse.json(
        { error: "Booking is already assigned or no longer pending." },
        { status: 400 }
      );
    }

    // Preserve persistent rejections (do NOT wipe rejectedDriverIds) and set dispatchStatus to SEARCHING
    booking.dispatchStatus = "SEARCHING";
    await booking.save();

    // Trigger dispatch asynchronously
    const dispatchResult = await dispatchLocalRideOffer(booking);

    return NextResponse.json({
      success: true,
      message: "Nearby driver search restarted.",
      dispatchResult,
    });
  } catch (error: any) {
    console.error("Retry dispatch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retry driver search" },
      { status: 500 }
    );
  }
}
