import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import dbConnect from "../src/lib/mongodb";
import Booking from "../src/models/Booking";
import User from "../src/models/User";

async function check() {
  await dbConnect();
  const b = await Booking.findOne({ bookingReference: "LAR-2026-00002" }).lean();
  console.log("LAR-2026-00002:", { driverId: b?.driverId, status: b?.status });
  if (b?.driverId) {
    const u = await User.findById(b.driverId).lean();
    console.log("Assigned Driver:", { email: u?.email, id: u?._id });
  }

  const testDriver = await User.findOne({ email: "e2e.test.driver@example.com" }).lean();
  console.log("Test Driver ID:", testDriver?._id?.toString());

  const activeTripStatuses = [
    "CONFIRMED",
    "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED",
    "PASSENGER_PICKED_UP",
    "TRIP_IN_PROGRESS",
  ];

  const activeForTestDriver = await Booking.find({
    driverId: testDriver?._id,
    status: { $in: activeTripStatuses as any },
  }).select("bookingReference status").lean();
  console.log("Active trips for e2e.test.driver:", activeForTestDriver);

  const availableOffers = await Booking.find({
    status: "PENDING",
    driverId: null,
  }).select("bookingReference status dispatchStatus dispatchExpiresAt").lean();
  console.log("Pending available offers:", availableOffers);
}

check().then(() => process.exit(0));
