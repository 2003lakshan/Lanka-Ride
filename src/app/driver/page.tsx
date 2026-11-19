import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";
import Airport from "@/models/Airport";
import VehicleType from "@/models/VehicleType";
import PackageEnquiry from "@/models/PackageEnquiry";
import Package from "@/models/Package";
import { Clock } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import DriverDashboardClient from "@/components/driver/DriverDashboardClient";

// Ensure we don't cache this page so driver sees latest
export const dynamic = "force-dynamic";

export default async function DriverDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "DRIVER") {
    redirect("/login");
  }

  if (!(session.user as any).isApproved) {
    return (
      <div className="bg-slate-50 min-h-screen py-20 px-4 flex items-center justify-center">
        <div className="bg-white p-10 md:p-16 rounded-3xl shadow-xl border border-slate-100 max-w-lg text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-yellow-400"></div>
          <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="text-yellow-500" size={32} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Pending Approval</h2>
          <p className="text-slate-600 mb-8 text-lg">
            Your application is currently under review by our admin team. You will be able to view and accept rides once approved.
          </p>
          <a
            href="/"
            className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-medium transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  await dbConnect();

  if (!Airport) console.log("Airport model loaded");
  if (!VehicleType) console.log("VehicleType model loaded");
  if (!Package) console.log("Package model loaded");

  const driverId = (session.user as any).id;

  // Active trip statuses for assigned trips (preserve legitimate active trips and scheduled assignments)
  const activeTripStatuses = [
    "CONFIRMED",
    "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED",
    "PASSENGER_PICKED_UP",
    "TRIP_IN_PROGRESS",
  ];

  // Query:
  // 1. Available trips awaiting acceptance:
  //    - Status is PENDING or CONFIRMED and driverId is unassigned
  //    - Exclude offers explicitly rejected by this driver (rejectedDriverIds)
  //    - For custom trips, strictly require paymentStatus === "PAID" and approvedAt is set
  // 2. Active trips assigned to this driver (never completed, cancelled, or expired)
  const bookings = await Booking.find({
    $or: [
      {
        status: { $in: ["PENDING", "CONFIRMED"] },
        $and: [
          {
            $or: [{ driverId: null }, { driverId: { $exists: false } }],
          },
          {
            rejectedDriverIds: {
              $nin: [
                driverId,
                ...(mongoose.Types.ObjectId.isValid(driverId) ? [new mongoose.Types.ObjectId(driverId)] : [])
              ]
            },
          },
          {
            $or: [
              { "customTripDetails.isCustomTrip": { $ne: true } },
              {
                "customTripDetails.isCustomTrip": true,
                approvedAt: { $exists: true, $ne: null },
              },
            ],
          },
        ],
      },
      {
        driverId,
        status: { $in: activeTripStatuses as any },
      },
    ],
  })
    .populate("airportId")
    .populate("vehicleTypeId")
    .populate("touristId", "name email phoneNumber nationality")
    .sort({ arrivalDate: 1, arrivalTime: 1 })
    .lean();

  const currentDriverUser = await User.findById(driverId).lean();
  const driverVehicleCategory = currentDriverUser?.vehicleCategory || currentDriverUser?.driverDetails?.vehicleCategory || null;

  const enquiries = await PackageEnquiry.find({ driverId })
    .populate("packageId", "title")
    .populate("riderId", "name")
    .sort({ updatedAt: -1 })
    .lean();

  const serializedBookings = bookings.map((b: any) => ({
    ...b,
    _id: b._id.toString(),
    touristId: b.touristId
      ? typeof b.touristId === "object"
        ? {
            _id: b.touristId._id?.toString() || b.touristId.toString(),
            name: b.touristId.name,
            email: b.touristId.email,
            phoneNumber: b.touristId.phoneNumber,
            nationality: b.touristId.nationality,
          }
        : b.touristId.toString()
      : null,
    driverId: b.driverId
      ? typeof b.driverId === "object"
        ? { ...b.driverId, _id: b.driverId._id?.toString() }
        : b.driverId.toString()
      : null,
    airportId: b.airportId ? { ...b.airportId, _id: b.airportId._id?.toString() } : null,
    vehicleTypeId: b.vehicleTypeId ? { ...b.vehicleTypeId, _id: b.vehicleTypeId._id?.toString() } : null,
    arrivalDate: b.arrivalDate ? b.arrivalDate.toISOString() : null,
    completedAt: b.completedAt ? b.completedAt.toISOString() : null,
    createdAt: b.createdAt ? b.createdAt.toISOString() : null,
    updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
    approvedAt: b.approvedAt ? b.approvedAt.toISOString() : null,
    dispatchExpiresAt: b.dispatchExpiresAt ? new Date(b.dispatchExpiresAt).toISOString() : null,
    offeredDriverIds: (b.offeredDriverIds || []).map((id: any) => id.toString()),
    rejectedDriverIds: (b.rejectedDriverIds || []).map((id: any) => id.toString()),
    bookingType: b.bookingType || (b.pickMeDetails?.isPickMe ? "LOCAL_RIDE" : "AIRPORT_TRANSFER"),
    intermediateStops: (b.intermediateStops || []).map((s: any) => ({
      _id: s._id ? s._id.toString() : undefined,
      name: s.name || "",
      address: s.address || "",
      lat: typeof s.lat === "number" ? s.lat : Number(s.lat) || 0,
      lng: typeof s.lng === "number" ? s.lng : Number(s.lng) || 0,
      stopOrder: typeof s.stopOrder === "number" ? s.stopOrder : Number(s.stopOrder) || 1,
      visited: Boolean(s.visited),
    })),
    pickMeDetails: b.pickMeDetails
      ? {
          ...b.pickMeDetails,
          intermediateStops: (b.pickMeDetails.intermediateStops || []).map((s: any) => ({
            _id: s._id ? s._id.toString() : undefined,
            name: s.name || "",
            address: s.address || "",
            lat: typeof s.lat === "number" ? s.lat : Number(s.lat) || 0,
            lng: typeof s.lng === "number" ? s.lng : Number(s.lng) || 0,
            stopOrder: typeof s.stopOrder === "number" ? s.stopOrder : Number(s.stopOrder) || 1,
            visited: Boolean(s.visited),
          })),
          pricingSnapshot: b.pickMeDetails.pricingSnapshot
            ? {
                ...b.pickMeDetails.pricingSnapshot,
                calculatedAt: b.pickMeDetails.pricingSnapshot.calculatedAt
                  ? new Date(b.pickMeDetails.pricingSnapshot.calculatedAt).toISOString()
                  : null,
              }
            : null,
        }
      : null,
    customTripDetails: b.customTripDetails
      ? {
          ...b.customTripDetails,
          startDate: b.customTripDetails.startDate ? new Date(b.customTripDetails.startDate).toISOString() : null,
          endDate: b.customTripDetails.endDate ? new Date(b.customTripDetails.endDate).toISOString() : null,
          itinerary: (b.customTripDetails.itinerary || []).map((day: any) => ({
            ...day,
            date: day.date ? new Date(day.date).toISOString() : null,
          })),
        }
      : null,
  }));

  const serializedEnquiries = enquiries.map((e: any) => ({
    ...e,
    _id: e._id.toString(),
    packageId: e.packageId ? { ...e.packageId, _id: e.packageId._id?.toString() } : null,
    riderId: e.riderId ? { ...e.riderId, _id: e.riderId._id?.toString() } : null,
    driverId: e.driverId ? e.driverId.toString() : null,
    createdAt: e.createdAt ? e.createdAt.toISOString() : null,
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
    messages: (e.messages || []).map((m: any) => ({
      ...m,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    })),
  }));

  // Ensure 100% plain objects with no toJSON methods for Next.js Client Component boundary
  const safeBookings = JSON.parse(JSON.stringify(serializedBookings));
  const safeEnquiries = JSON.parse(JSON.stringify(serializedEnquiries));

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DriverDashboardClient
          initialBookings={safeBookings}
          initialEnquiries={safeEnquiries}
          currentUserId={(session.user as any).id}
          driverVehicleCategory={driverVehicleCategory}
        />
      </div>
    </div>
  );
}
