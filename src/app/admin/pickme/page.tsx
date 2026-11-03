import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";
import { ensurePickMeCategories } from "@/lib/pickMeSeeder";
import AdminPickMeClient from "@/components/admin/AdminPickMeClient";

export const dynamic = "force-dynamic";

export default async function AdminPickMePage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/pickme");
  }

  await dbConnect();
  if (!User) console.log("User model registered");

  // Ensure 6 categories exist and fetch serialized
  const rawCategories = await ensurePickMeCategories();
  const serializedCategories = rawCategories.map((c: any) => ({
    _id: c._id ? c._id.toString() : "",
    category: c.category,
    displayName: c.displayName,
    description: c.description,
    passengerCapacity: c.passengerCapacity,
    luggageCapacity: c.luggageCapacity,
    isGoodsTransport: Boolean(c.isGoodsTransport),
    baseFare: c.baseFare,
    ratePerKm: c.ratePerKm,
    minimumFare: c.minimumFare,
    isActive: Boolean(c.isActive),
    iconName: c.iconName,
    sortOrder: c.sortOrder || 0,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  }));

  // Fetch local rides
  const rawBookings = await Booking.find({
    $or: [
      { bookingType: "LOCAL_RIDE" },
      { "pickMeDetails.isPickMe": true },
      { bookingReference: { $regex: "^PKM-" } },
    ],
  })
    .populate("driverId", "name phoneNumber vehicleRegistration vehicleCategory driverDetails")
    .populate("touristId", "name email phoneNumber")
    .sort({ createdAt: -1 })
    .limit(150)
    .lean();

  const serializedTrips = rawBookings.map((b: any) => ({
    _id: b._id.toString(),
    bookingReference: b.bookingReference,
    bookingType: b.bookingType || "LOCAL_RIDE",
    status: b.status,
    paymentStatus: b.paymentStatus || "PENDING",
    paymentMethod: b.paymentMethod || "CASH",
    pickupAddress: b.pickupAddress || "Pickup Location",
    pickupLat: b.pickupLat,
    pickupLng: b.pickupLng,
    destinationAddress: b.destinationAddress || "Destination",
    destinationLat: b.destinationLat,
    destinationLng: b.destinationLng,
    distanceKm: b.distanceKm || 0,
    durationMins: b.durationMins || 0,
    createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
    updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString() : null,
    assignedAt: b.assignedAt ? new Date(b.assignedAt).toISOString() : null,
    arrivedAt: b.arrivedAt ? new Date(b.arrivedAt).toISOString() : null,
    completedAt: b.completedAt ? new Date(b.completedAt).toISOString() : null,
    cancelledAt: b.cancelledAt ? new Date(b.cancelledAt).toISOString() : null,
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
    intermediateStops: Array.isArray(b.intermediateStops) && b.intermediateStops.length > 0
      ? b.intermediateStops
      : Array.isArray(b.pickMeDetails?.intermediateStops)
      ? b.pickMeDetails.intermediateStops
      : [],
    pickupInstructions: b.pickupInstructions || b.pickMeDetails?.pickupInstructions || null,
    rider: {
      fullName: b.passengerDetails?.fullName || b.touristId?.name || "Guest Rider",
      whatsappNumber: b.passengerDetails?.whatsappNumber || b.touristId?.phoneNumber || "N/A",
      email: b.passengerDetails?.email || b.touristId?.email || "N/A",
    },
    driver: b.driverId
      ? {
          id: b.driverId._id ? b.driverId._id.toString() : b.driverId.toString(),
          name: b.driverId.name || "Assigned Driver",
          phoneNumber: b.driverId.phoneNumber || "N/A",
          vehicleRegistration: b.driverId.vehicleRegistration || b.driverId.driverDetails?.vehicleRegistrationNumber || "N/A",
          vehicleCategory: b.driverId.vehicleCategory || b.driverId.driverDetails?.vehicleCategory || "N/A",
        }
      : null,
    pickMeDetails: b.pickMeDetails
      ? {
          isPickMe: Boolean(b.pickMeDetails.isPickMe),
          vehicleCategory: b.pickMeDetails.vehicleCategory,
          goodsDescription: b.pickMeDetails.goodsDescription || null,
          baseFare: b.pickMeDetails.baseFare,
          ratePerKm: b.pickMeDetails.ratePerKm,
          minimumFare: b.pickMeDetails.minimumFare,
          estimatedFare: b.pickMeDetails.estimatedFare,
          pricingSnapshot: b.pickMeDetails.pricingSnapshot
            ? {
                ...b.pickMeDetails.pricingSnapshot,
                calculatedAt: b.pickMeDetails.pricingSnapshot.calculatedAt
                  ? new Date(b.pickMeDetails.pricingSnapshot.calculatedAt).toISOString()
                  : null,
              }
            : null,
          rideNow: Boolean(b.pickMeDetails.rideNow),
        }
      : null,
    fareBreakdown: b.fareBreakdown || null,
  }));

  return (
    <AdminPickMeClient
      initialCategories={serializedCategories}
      initialTrips={serializedTrips}
    />
  );
}
