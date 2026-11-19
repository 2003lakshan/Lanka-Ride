import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import VehicleType from "@/models/VehicleType";
import User from "@/models/User";
import RiderIdentity from "@/models/RiderIdentity";
import AdminCustomTripsClient from "./AdminCustomTripsClient";

export const dynamic = "force-dynamic";

export default async function AdminCustomTripsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();

  // Ensure models are registered
  if (VehicleType || User || RiderIdentity) {}

  const searchParams = await props.searchParams;
  const rawStatus = searchParams?.status;
  const activeTab =
    rawStatus &&
    ["PENDING_APPROVAL", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ALL"].includes(rawStatus)
      ? rawStatus
      : "PENDING_APPROVAL";

  const customTripBaseFilter: any = {
    $or: [{ "customTripDetails.isCustomTrip": true }, { bookingType: "CUSTOM_TRIP" }],
  };

  // Counts for tabs
  const [pendingApprovalCount, changesRequestedCount, approvedCount, completedCount, allCount] =
    await Promise.all([
      Booking.countDocuments({
        ...customTripBaseFilter,
        status: "PENDING_APPROVAL",
      } as any),
      Booking.countDocuments({
        ...customTripBaseFilter,
        status: "CHANGES_REQUESTED",
      } as any),
      Booking.countDocuments({
        ...customTripBaseFilter,
        $or: [
          { approvedAt: { $exists: true, $ne: null } },
          { status: { $in: ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED"] } },
        ],
      } as any),
      Booking.countDocuments({
        ...customTripBaseFilter,
        status: "COMPLETED",
      } as any),
      Booking.countDocuments(customTripBaseFilter as any),
    ]);

  // Construct query for active tab
  let filterQuery: any = { ...customTripBaseFilter };
  if (activeTab === "PENDING_APPROVAL") {
    filterQuery.status = "PENDING_APPROVAL";
  } else if (activeTab === "CHANGES_REQUESTED") {
    filterQuery.status = "CHANGES_REQUESTED";
  } else if (activeTab === "APPROVED") {
    filterQuery.$or = [
      { approvedAt: { $exists: true, $ne: null } },
      { status: { $in: ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED"] } },
    ];
  } else if (activeTab === "COMPLETED") {
    filterQuery.status = "COMPLETED";
  }

  const rawBookings = await Booking.find(filterQuery)
    .populate("vehicleTypeId")
    .populate("touristId", "name email phoneNumber nationality")
    .populate("driverId", "name email phoneNumber")
    .sort({ createdAt: -1 })
    .lean();

  const serializedTrips = JSON.parse(JSON.stringify(rawBookings));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <AdminCustomTripsClient
        trips={serializedTrips}
        counts={{
          pendingApproval: pendingApprovalCount,
          changesRequested: changesRequestedCount,
          approved: approvedCount,
          completed: completedCount,
          all: allCount,
        }}
        activeTab={activeTab}
      />
    </div>
  );
}

