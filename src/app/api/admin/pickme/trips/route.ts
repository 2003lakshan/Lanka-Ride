import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 401 });
    }

    await dbConnect();
    // Ensure User model registered for populate
    if (!User) console.log("User model registered");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const filter: any = {
      $or: [
        { bookingType: "LOCAL_RIDE" },
        { "pickMeDetails.isPickMe": true },
        { bookingReference: { $regex: "^PKM-" } },
      ],
    };

    if (status && status !== "ALL") {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$and = [
        {
          $or: [
            { bookingReference: { $regex: q, $options: "i" } },
            { "passengerDetails.fullName": { $regex: q, $options: "i" } },
            { "passengerDetails.whatsappNumber": { $regex: q, $options: "i" } },
            { "pickMeDetails.vehicleCategory": { $regex: q, $options: "i" } },
            { pickupAddress: { $regex: q, $options: "i" } },
            { destinationAddress: { $regex: q, $options: "i" } },
          ],
        },
      ];
    }

    const bookings = await Booking.find(filter)
      .populate("driverId", "name phoneNumber vehicleRegistration vehicleCategory driverDetails")
      .populate("touristId", "name email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();

    const trips = bookings.map((b: any) => ({
      _id: b._id.toString(),
      bookingReference: b.bookingReference,
      bookingType: b.bookingType || "LOCAL_RIDE",
      status: b.status,
      paymentStatus: b.paymentStatus,
      paymentMethod: b.paymentMethod,
      pickupAddress: b.pickupAddress,
      pickupLat: b.pickupLat,
      pickupLng: b.pickupLng,
      destinationAddress: b.destinationAddress,
      destinationLat: b.destinationLat,
      destinationLng: b.destinationLng,
      distanceKm: b.distanceKm,
      durationMins: b.durationMins,
      createdAt: b.createdAt ? b.createdAt.toISOString() : null,
      updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
      assignedAt: b.assignedAt ? b.assignedAt.toISOString() : null,
      arrivedAt: b.arrivedAt ? b.arrivedAt.toISOString() : null,
      arrivalSource: b.arrivalSource || null,
      completedAt: b.completedAt ? b.completedAt.toISOString() : null,
      cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
      cancelledBy: b.cancelledBy
        ? {
            userId: b.cancelledBy.userId ? b.cancelledBy.userId.toString() : undefined,
            role: b.cancelledBy.role,
            name: b.cancelledBy.name,
          }
        : null,
      cancellationReasonCode: b.cancellationReasonCode || null,
      cancellationReasonText: b.cancellationReasonText || null,
      cancellationComments: b.cancellationComments || null,
      statusBeforeCancellation: b.statusBeforeCancellation || null,
      refundReviewStatus:
        b.refundReviewStatus ||
        (b.paymentStatus === "PAID" && b.status === "CANCELLED"
          ? "PENDING_REVIEW"
          : "NOT_APPLICABLE"),
      rider: {
        fullName: b.passengerDetails?.fullName || b.touristId?.name || "Guest Rider",
        whatsappNumber: b.passengerDetails?.whatsappNumber || b.touristId?.phoneNumber || "N/A",
        email: b.passengerDetails?.email || b.touristId?.email || "N/A",
      },
      driver: b.driverId
        ? {
            id: b.driverId._id ? b.driverId._id.toString() : b.driverId.toString(),
            name: b.driverId.name,
            phoneNumber: b.driverId.phoneNumber,
            vehicleRegistration: b.driverId.vehicleRegistration,
            vehicleCategory: b.driverId.vehicleCategory || b.driverId.driverDetails?.vehicleCategory,
          }
        : null,
      pickMeDetails: b.pickMeDetails || {
        isPickMe: true,
        vehicleCategory: b.vehicleTypeId?.name || "Car",
        estimatedFare: b.fareBreakdown?.totalEstimatedFare || 0,
      },
      pickupInstructions: b.pickupInstructions || b.pickMeDetails?.pickupInstructions || null,
      intermediateStops: b.intermediateStops || b.pickMeDetails?.intermediateStops || [],
      fareBreakdown: b.fareBreakdown,
    }));

    return NextResponse.json({ success: true, trips, totalCount: trips.length }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch PickMe trips error:", error);
    return NextResponse.json({ error: error.message || "Failed to load PickMe trips." }, { status: 500 });
  }
}
