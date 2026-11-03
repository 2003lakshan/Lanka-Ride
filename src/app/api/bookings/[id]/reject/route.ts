import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * Rejects an incoming ride offer for the current driver only.
 * Adds driver to rejectedDriverIds.
 * Does NOT cancel the rider's booking or withdraw from other drivers.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized: Driver access only" }, { status: 401 });
    }

    const { id } = await params;
    const driverId = (session.user as any).id;

    await dbConnect();

    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const driverObjectId = (mongoose.Types.ObjectId.isValid(driverId))
      ? new mongoose.Types.ObjectId(driverId)
      : driverId;

    // Add driver to rejectedDriverIds idempotently
    await Booking.findByIdAndUpdate(id, {
      $addToSet: { rejectedDriverIds: driverObjectId },
    });

    return NextResponse.json({
      success: true,
      message: "Offer rejected and dismissed for this driver.",
      bookingId: id,
    });
  } catch (error: any) {
    console.error("Reject ride error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reject ride offer" },
      { status: 500 }
    );
  }
}
