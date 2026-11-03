import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import bcrypt from "bcryptjs";
import dbConnect from "../src/lib/mongodb";
import User from "../src/models/User";
import Booking from "../src/models/Booking";
import { dispatchLocalRideOffer } from "../src/lib/nearbyDispatch";

async function main() {
  await dbConnect();

  const driverEmail = "e2e.test.driver@example.com";
  let driver = await User.findOne({ email: driverEmail });
  const hash = await bcrypt.hash("driver123", 10);

  if (!driver) {
    driver = await User.create({
      name: "E2E Test Driver",
      email: driverEmail,
      password: hash,
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: 6.9344,
      currentLng: 79.8428,
      locationUpdatedAt: new Date(),
    });
  } else {
    driver.password = hash;
    driver.isApproved = true;
    driver.isOnline = true;
    driver.vehicleCategory = "Car";
    driver.currentLat = 6.9344;
    driver.currentLng = 79.8428;
    driver.locationUpdatedAt = new Date();
    await driver.save();
  }

  // Clear any existing active trips for this driver
  await Booking.updateMany(
    {
      driverId: driver._id,
      status: { $in: ["CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"] },
    },
    { $set: { status: "COMPLETED", completedAt: new Date() } }
  );

  console.log("Prepared driver:", {
    email: driver.email,
    id: driver._id.toString(),
    isOnline: driver.isOnline,
    freshGps: driver.locationUpdatedAt,
  });

  // Find or create tourist
  let tourist = await User.findOne({ role: "TOURIST" });
  if (!tourist) {
    tourist = await User.create({
      name: "Kasun Perera",
      email: "kasun.perera.test@example.com",
      password: await bcrypt.hash("tourist123", 10),
      role: "TOURIST",
    });
  }

  // Create brand new live booking
  const bookingRef = `PKM-LIVE-${Date.now().toString().slice(-6)}`;
  const expiresAt = new Date(Date.now() + 120 * 1000); // 120 seconds expiry

  const booking = await Booking.create({
    bookingReference: bookingRef,
    bookingType: "LOCAL_RIDE",
    status: "PENDING",
    dispatchStatus: "SEARCHING",
    touristId: tourist._id,
    pickupAddress: "Colombo Fort Station, Olcott Mawatha",
    pickupLat: 6.9344,
    pickupLng: 79.8428,
    destinationAddress: "Independence Square, Colombo 07",
    destinationLat: 6.9034,
    destinationLng: 79.8678,
    distanceKm: 4.8,
    durationMins: 14,
    passengerDetails: {
      fullName: tourist.name || "Kasun Perera",
      email: tourist.email,
      nationality: "Sri Lankan",
      country: "Sri Lanka",
      adults: 1,
      children: 0,
      luggage: 1,
    },
    paymentMethod: "CASH",
    pickMeDetails: {
      isPickMe: true,
      vehicleCategory: "Car",
      estimatedFare: 1150,
      baseFare: 250,
      ratePerKm: 180,
      minimumFare: 300,
    },
    rejectedDriverIds: [],
    dispatchExpiresAt: expiresAt,
  });

  console.log("Created brand new booking:", {
    id: booking._id.toString(),
    ref: booking.bookingReference,
    status: booking.status,
  });

  // Dispatch it
  const result = await dispatchLocalRideOffer(booking);
  console.log("Dispatched result:", result);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
