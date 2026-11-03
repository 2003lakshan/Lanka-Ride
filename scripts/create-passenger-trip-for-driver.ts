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

  // 1. Ensure test driver is approved, online, Car, with fresh GPS
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
      currentLat: 6.9360,
      currentLng: 79.8520,
      locationUpdatedAt: new Date(),
    });
  } else {
    driver.isApproved = true;
    driver.isOnline = true;
    driver.vehicleCategory = "Car";
    driver.currentLat = 6.9360;
    driver.currentLng = 79.8520;
    driver.locationUpdatedAt = new Date();
    await driver.save();
  }

  // Clear any conflicting active assignments for this driver
  await Booking.updateMany(
    {
      driverId: driver._id,
      status: { $in: ["CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"] },
    },
    { $set: { status: "COMPLETED", completedAt: new Date() } }
  );

  console.log("✓ Driver ready:", {
    email: driver.email,
    id: driver._id.toString(),
    isOnline: driver.isOnline,
    freshGps: driver.locationUpdatedAt,
  });

  // 2. Passenger creates a ride
  let tourist = await User.findOne({ role: "TOURIST" });
  if (!tourist) {
    tourist = await User.create({
      name: "Amara",
      email: "amara.passenger@example.com",
      password: await bcrypt.hash("password123", 10),
      role: "TOURIST",
      isEmailVerified: true,
    });
  } else {
    tourist.name = "Amara";
    await tourist.save();
  }

  const bookingRef = `PKM-${Date.now().toString().slice(-6)}`;
  const expiresAt = new Date(Date.now() + 7200 * 1000); // 2 hours so offer remains active until accepted/declined

  const booking = await Booking.create({
    bookingReference: bookingRef,
    bookingType: "LOCAL_RIDE",
    status: "PENDING",
    dispatchStatus: "SEARCHING",
    touristId: tourist._id,
    passengerDetails: {
      fullName: "Amara",
      email: tourist.email || "amara.passenger@example.com",
      nationality: "Sri Lankan",
      country: "Sri Lanka",
      adults: 1,
      children: 0,
      luggage: 0,
      childSeatRequired: false,
      meetAndGreetRequired: false,
    },
    pickupAddress: "Colombo Fort Railway Station",
    pickupLat: 6.9344,
    pickupLng: 79.8500,
    intermediateStops: [
      {
        name: "ATM, Kollupitiya",
        address: "ATM, Kollupitiya",
        lat: 6.9050,
        lng: 79.8520,
        stopOrder: 1,
      },
    ],
    destinationAddress: "Mount Lavinia Hotel",
    destinationLat: 6.8340,
    destinationLng: 79.8640,
    distanceKm: 12.8,
    durationMins: 32,
    fareBreakdown: {
      baseCharge: 300,
      distanceCharge: 1550,
      airportPickupCharge: 0,
      trafficCharge: 0,
      nightCharge: 0,
      highwayToll: 0,
      additionalCharges: 0,
      discount: 0,
      totalEstimatedFare: 1850,
    },
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
    pickMeDetails: {
      isPickMe: true,
      vehicleCategory: "Car",
      estimatedFare: 1850,
      baseFare: 300,
      ratePerKm: 120,
      minimumFare: 350,
      intermediateStops: [
        {
          name: "ATM, Kollupitiya",
          address: "ATM, Kollupitiya",
          lat: 6.9050,
          lng: 79.8520,
          stopOrder: 1,
        },
      ],
    },
    rejectedDriverIds: [],
    dispatchExpiresAt: expiresAt,
  });

  console.log("✓ Passenger created trip:", {
    id: booking._id.toString(),
    ref: booking.bookingReference,
    passenger: "Amara",
    fare: 1850,
    pickup: "Colombo Fort Railway Station",
    destination: "Mount Lavinia Hotel",
  });

  // 3. Dispatch to nearby drivers (triggers realtime popup card)
  const result = await dispatchLocalRideOffer(booking);
  console.log("✓ Dispatch completed:", result);

  // 4. Send notification bell alert to eligible drivers (triggers bell icon + audio)
  const { notifyEligibleDrivers } = await import("../src/lib/notifications");
  await notifyEligibleDrivers({
    type: "NEW_AVAILABLE_TRIP",
    title: `New ${booking.pickMeDetails?.vehicleCategory || "Car"} Ride Available!`,
    message: `New ride (${booking.distanceKm} km, LKR ${booking.fareBreakdown?.totalEstimatedFare?.toLocaleString()}) available for acceptance.`,
    link: `/driver`,
    deduplicationKey: `pkm_submit_drv_${booking._id.toString()}`,
  });
  console.log("✓ Bell notification emitted to driver bell!");

  process.exit(0);
}

main().catch((err) => {
  console.error("Error creating passenger trip:", err);
  process.exit(1);
});
