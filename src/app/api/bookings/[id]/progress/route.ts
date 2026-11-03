import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { broadcastBookingStatusChanged } from "@/lib/realtime";
import { getDriverTripNavigationTarget } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized: Login required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, dayIndex, stopIndex } = body;

    await dbConnect();
    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // Strict authorization checks:
    // Only the assigned driver (or ADMIN) can update stop progress!
    if (userRole === "ADMIN") {
      // Admin has authorization
    } else if (userRole === "DRIVER") {
      if (!booking.driverId || booking.driverId.toString() !== userId) {
        return NextResponse.json(
          { error: "Unauthorized: You are not the driver assigned to this booking" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Unauthorized role: Tourists and other users cannot alter trip progress" },
        { status: 403 }
      );
    }

    // Handle Local Ride intermediate stops
    if (action === "MARK_LOCAL_STOP_VISITED" || (action === "MARK_STOP_VISITED" && (!booking.customTripDetails?.isCustomTrip && Array.isArray(booking.intermediateStops)))) {
      const stops = booking.intermediateStops || booking.pickMeDetails?.intermediateStops || [];
      if (typeof stopIndex !== "number" || !stops[stopIndex]) {
        return NextResponse.json({ error: "Specified intermediate stop does not exist" }, { status: 404 });
      }

      stops[stopIndex].visited = true;
      stops[stopIndex].visitedAt = new Date();
      booking.markModified("intermediateStops");
      if (booking.pickMeDetails) {
        booking.pickMeDetails.intermediateStops = stops;
        booking.markModified("pickMeDetails");
      }

      await booking.save();

      try {
        await broadcastBookingStatusChanged(booking, booking.status, { progressAction: action, stopIndex });
      } catch (e) {
        console.error("Realtime progress broadcast error:", e);
      }

      const nextTarget = getDriverTripNavigationTarget(booking);
      return NextResponse.json({
        success: true,
        booking,
        nextTarget,
      });
    }

    const customTrip = booking.customTripDetails;
    if (!customTrip || !Array.isArray(customTrip.itinerary)) {
      return NextResponse.json(
        { error: "This booking does not contain a multi-stop itinerary" },
        { status: 400 }
      );
    }

    if (action === "MARK_STOP_VISITED" || action === "UNMARK_STOP_VISITED") {
      if (typeof dayIndex !== "number" || typeof stopIndex !== "number") {
        return NextResponse.json({ error: "Missing dayIndex or stopIndex" }, { status: 400 });
      }
      const day = customTrip.itinerary[dayIndex];
      if (!day || !Array.isArray(day.placesToVisit) || !day.placesToVisit[stopIndex]) {
        return NextResponse.json({ error: "Specified itinerary stop does not exist" }, { status: 404 });
      }

      const isMarking = action === "MARK_STOP_VISITED";
      day.placesToVisit[stopIndex].visited = isMarking;
      day.placesToVisit[stopIndex].visitedAt = isMarking ? new Date() : undefined;
      booking.markModified("customTripDetails");
    } else if (action === "MARK_OVERNIGHT_VISITED" || action === "UNMARK_OVERNIGHT_VISITED") {
      if (typeof dayIndex !== "number") {
        return NextResponse.json({ error: "Missing dayIndex" }, { status: 400 });
      }
      const day = customTrip.itinerary[dayIndex];
      if (!day || !day.overnightLocation) {
        return NextResponse.json({ error: "Specified overnight location does not exist" }, { status: 404 });
      }

      const isMarking = action === "MARK_OVERNIGHT_VISITED";
      day.overnightLocation.visited = isMarking;
      day.overnightLocation.visitedAt = isMarking ? new Date() : undefined;
      booking.markModified("customTripDetails");
    } else if (action === "MARK_DROPOFF_VISITED" || action === "UNMARK_DROPOFF_VISITED") {
      if (!customTrip.dropoffLocation) {
        customTrip.dropoffLocation = {};
      }
      const isMarking = action === "MARK_DROPOFF_VISITED";
      customTrip.dropoffLocation.visited = isMarking;
      customTrip.dropoffLocation.visitedAt = isMarking ? new Date() : undefined;
      booking.markModified("customTripDetails");
    } else {
      return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
    }

    await booking.save();

    // Broadcast update so all tracking clients stay synced
    try {
      await broadcastBookingStatusChanged(booking, booking.status, { progressAction: action });
    } catch (e) {
      console.error("Realtime progress broadcast error:", e);
    }

    const nextTarget = getDriverTripNavigationTarget(booking);

    return NextResponse.json({
      success: true,
      booking,
      nextTarget
    });
  } catch (error: any) {
    console.error("Update trip progress error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
