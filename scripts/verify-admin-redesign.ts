import dbConnect from "../src/lib/mongodb";
import Booking from "../src/models/Booking";
import User from "../src/models/User";
import Package from "../src/models/Package";
import RiderIdentity from "../src/models/RiderIdentity";
import "../src/models/Airport";
import "../src/models/VehicleType";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function verify() {
  console.log("=== VERIFYING ADMIN DASHBOARD REDESIGN ===");
  await dbConnect();
  console.log("1. Connected to MongoDB successfully.");

  // Test 1: Operational Counts
  const pendingDriversCount = await User.countDocuments({ role: "DRIVER", isApproved: false });
  const pendingPackagesCount = await Package.countDocuments({ status: "PENDING_REVIEW" });
  const pendingIdentitiesCount = await RiderIdentity.countDocuments({ status: "PENDING_REVIEW" });
  const unassignedBookingsCount = await Booking.countDocuments({ 
    driverId: { $exists: false },
    status: { $in: ["PENDING", "CONFIRMED", "PENDING_APPROVAL"] }
  });
  const activeStatuses = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"];
  const activeTripsCount = await Booking.countDocuments({ status: { $in: activeStatuses as any } });
  const completedTripsCount = await Booking.countDocuments({ status: "COMPLETED" });
  const cancelledBookingsCount = await Booking.countDocuments({ status: "CANCELLED" });
  const totalDriversCount = await User.countDocuments({ role: "DRIVER" });
  const onlineDriversCount = await User.countDocuments({ role: "DRIVER", isOnline: true });

  console.log("2. Operational KPIs:", {
    pendingDriversCount,
    pendingPackagesCount,
    pendingIdentitiesCount,
    unassignedBookingsCount,
    activeTripsCount,
    completedTripsCount,
    cancelledBookingsCount,
    totalDrivers: totalDriversCount,
    onlineDrivers: onlineDriversCount
  });

  // Test 2: Financial Aggregations
  const bookings = await Booking.find({ status: { $ne: "CANCELLED" } }).select("fareBreakdown totalFare status paymentStatus").lean();
  let gross = 0;
  let commission = 0;
  let collected = 0;
  let pending = 0;

  for (const b of bookings as any[]) {
    const fare = Number(b.fareBreakdown?.totalEstimatedFare || b.totalFare || 0);
    if (fare > 0) {
      gross += fare;
      if (b.status === "COMPLETED" || b.status === "CONFIRMED" || activeStatuses.includes(b.status)) {
        commission += Math.round(fare * 0.15);
      }
      if (b.paymentStatus === "PAID") {
        collected += fare;
      } else {
        pending += fare;
      }
    }
  }

  const driverPayable = gross - commission;
  console.log("3. Financial Ledger Totals:", {
    grossBookingValue: gross,
    platformCommissionRevenue: commission,
    driverPayable,
    collected,
    pending
  });

  if (gross <= 0 || commission <= 0 || driverPayable <= 0) {
    throw new Error("Financial calculations returned invalid or non-positive numbers!");
  }

  // Test 3: Stale GPS Tracking logic
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const staleTrips = await Booking.find({
    status: { $in: activeStatuses as any },
    $or: [
      { driverLocation: { $exists: false } },
      { "driverLocation.updatedAt": { $lt: fiveMinutesAgo } }
    ]
  }).select("bookingReference status").lean();
  console.log(`4. Stale GPS active trips: ${staleTrips.length}`);

  // Test 4: Custom Trips Feed
  const customTrips = await Booking.find({
    "customTripDetails.isCustomTrip": true,
    status: { $ne: "DRAFT" }
  }).countDocuments();
  console.log(`5. Custom trips count: ${customTrips}`);

  console.log("=== ALL OPERATIONAL CHECKS PASSED SUCCESSFULLY ===");
}

verify()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  });
