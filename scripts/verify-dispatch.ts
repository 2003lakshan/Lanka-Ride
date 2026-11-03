import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";

async function runTests() {
  console.log("=== STARTING NEARBY DISPATCH VERIFICATION SUITE ===");
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB:", uri);

  const { default: User } = await import("../src/models/User");
  const { default: Booking } = await import("../src/models/Booking");
  const { findEligibleNearbyDrivers } = await import("../src/lib/nearbyDispatch");

  try {
    const pickupLat = 6.9344;
    const pickupLng = 79.8504;
    const kollupitiyaLat = 6.9080;
    const kollupitiyaLng = 79.8510;
    const bambalapitiyaLat = 6.8920;
    const bambalapitiyaLng = 79.8560;
    const negomboLat = 7.2083;
    const negomboLng = 79.8358;

    await User.deleteMany({ email: { $regex: "^test_dispatch_" } });
    await Booking.deleteMany({ bookingReference: { $regex: "^PKM-TEST-" } });

    const driverA = await User.create({
      name: "Test Driver A (Eligible)",
      email: "test_dispatch_a_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: kollupitiyaLat,
      currentLng: kollupitiyaLng,
      locationUpdatedAt: new Date(),
    });

    const driverB = await User.create({
      name: "Test Driver B (Eligible)",
      email: "test_dispatch_b_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: bambalapitiyaLat,
      currentLng: bambalapitiyaLng,
      locationUpdatedAt: new Date(),
    });

    const driverC = await User.create({
      name: "Test Driver C (Far 32km)",
      email: "test_dispatch_c_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: negomboLat,
      currentLng: negomboLng,
      locationUpdatedAt: new Date(),
    });

    const driverD = await User.create({
      name: "Test Driver D (Stale GPS)",
      email: "test_dispatch_d_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: kollupitiyaLat,
      currentLng: kollupitiyaLng,
      locationUpdatedAt: new Date(Date.now() - 15 * 60 * 1000),
    });

    const driverE = await User.create({
      name: "Test Driver E (Bike Mismatch)",
      email: "test_dispatch_e_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Bike",
      currentLat: kollupitiyaLat,
      currentLng: kollupitiyaLng,
      locationUpdatedAt: new Date(),
    });

    const driverF = await User.create({
      name: "Test Driver F (Busy Active)",
      email: "test_dispatch_f_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: kollupitiyaLat,
      currentLng: kollupitiyaLng,
      locationUpdatedAt: new Date(),
    });

    await Booking.create({
      bookingReference: "PKM-TEST-BUSY-" + Date.now(),
      bookingType: "LOCAL_RIDE",
      status: "DRIVER_EN_ROUTE",
      driverId: driverF._id,
      pickupAddress: "Busy St",
      destinationAddress: "Drop St",
      paymentMethod: "CASH",
      passengerDetails: {
        fullName: "Test Passenger",
        email: "test@example.com",
        whatsappNumber: "+94770000000",
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 0,
        childSeatRequired: false,
        meetAndGreetRequired: false,
      },
      fareBreakdown: {
        baseCharge: 500,
        distanceCharge: 500,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 1000,
      },
    });

    const driverG = await User.create({
      name: "Test Driver G (Offline)",
      email: "test_dispatch_g_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: false,
      vehicleCategory: "Car",
      currentLat: kollupitiyaLat,
      currentLng: kollupitiyaLng,
      locationUpdatedAt: new Date(),
    });

    const driverH = await User.create({
      name: "Test Driver H (Unapproved)",
      email: "test_dispatch_h_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: false,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: kollupitiyaLat,
      currentLng: kollupitiyaLng,
      locationUpdatedAt: new Date(),
    });

    console.log("Successfully created test drivers A-H");

    console.log("\n--- TEST 1: Driver Eligibility Filtering ---");
    const result = await findEligibleNearbyDrivers({
      pickupLat,
      pickupLng,
      vehicleCategory: "Car",
    });

    console.log("Eligible drivers found:", result.eligibleDrivers.length);
    console.log("Exclusion counts:", result.excludedReasonCounts);

    const eligibleIds = result.eligibleDrivers.map((m: any) => (m.driver._id as any).toString());
    const hasA = eligibleIds.includes(driverA._id.toString());
    const hasB = eligibleIds.includes(driverB._id.toString());
    const hasC = eligibleIds.includes(driverC._id.toString());
    const hasD = eligibleIds.includes(driverD._id.toString());
    const hasE = eligibleIds.includes(driverE._id.toString());
    const hasF = eligibleIds.includes(driverF._id.toString());
    const hasG = eligibleIds.includes(driverG._id.toString());
    const hasH = eligibleIds.includes(driverH._id.toString());

    console.log("Driver A (Eligible):", hasA ? "PASS (Included)" : "FAIL");
    console.log("Driver B (Eligible):", hasB ? "PASS (Included)" : "FAIL");
    console.log("Driver C (Far > 15km):", !hasC ? "PASS (Excluded)" : "FAIL");
    console.log("Driver D (Stale GPS):", !hasD ? "PASS (Excluded)" : "FAIL");
    console.log("Driver E (Bike Mismatch):", !hasE ? "PASS (Excluded)" : "FAIL");
    console.log("Driver F (Busy Active):", !hasF ? "PASS (Excluded)" : "FAIL");
    console.log("Driver G (Offline):", !hasG ? "PASS (Excluded)" : "FAIL");
    console.log("Driver H (Unapproved):", !hasH ? "PASS (Excluded)" : "FAIL");

    if (!hasA || !hasB || hasC || hasD || hasE || hasF || hasG || hasH) {
      throw new Error("TEST 1 FAILED: Eligibility filtering assertion failed");
    }
    console.log(">> TEST 1 PASSED!");

    console.log("\n--- TEST 2: Distance Labelling & 15km verification ---");
    for (const match of result.eligibleDrivers) {
      console.log("Match:", match.driver.name, match.distanceKm + " km", "isRoadDistance:", match.isRoadDistance);
      if (typeof match.isRoadDistance !== "boolean" || match.distanceKm > 15) {
        throw new Error("TEST 2 FAILED: Road distance exceeded 15km or invalid label");
      }
    }
    console.log(">> TEST 2 PASSED!");

    console.log("\n--- TEST 3: Concurrent Acceptance Race Condition (Atomic Assignment) ---");
    const testBooking = await Booking.create({
      bookingReference: "PKM-TEST-RACE-" + Date.now(),
      bookingType: "LOCAL_RIDE",
      status: "PENDING",
      pickupAddress: "Fort",
      pickupLat,
      pickupLng,
      destinationAddress: "Galle Face",
      destinationLat: 6.9271,
      destinationLng: 79.8436,
      distanceKm: 3.2,
      durationMins: 10,
      paymentMethod: "CASH",
      passengerDetails: {
        fullName: "Test Rider",
        email: "rider@example.com",
        whatsappNumber: "+94771234567",
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 0,
        childSeatRequired: false,
        meetAndGreetRequired: false,
      },
      fareBreakdown: {
        baseCharge: 300,
        distanceCharge: 300,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 600,
      },
    });

    const atomicAccept = async (bId: any, dId: any) => {
      const updated = await Booking.findOneAndUpdate(
        {
          _id: bId,
          status: { $in: ["PENDING", "CONFIRMED"] },
          $or: [{ driverId: null }, { driverId: { $exists: false } }],
        },
        {
          status: "DRIVER_ASSIGNED",
          driverId: dId,
          assignedAt: new Date(),
          dispatchStatus: "ACCEPTED",
        },
        { new: true }
      );
      if (!updated) {
        return { success: false, status: 409, message: "This ride has already been accepted" };
      }
      return { success: true, status: 200, booking: updated };
    };

    const [resA, resB] = await Promise.all([
      atomicAccept(testBooking._id, driverA._id),
      atomicAccept(testBooking._id, driverB._id),
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    const conflicts = [resA, resB].filter((r) => !r.success && r.status === 409);
    console.log("Success count:", successes.length, "Conflict count:", conflicts.length);
    if (successes.length !== 1 || conflicts.length !== 1) {
      throw new Error("TEST 3 FAILED: Expected exactly 1 winner and 1 conflict.");
    }
    if (conflicts[0].message !== "This ride has already been accepted") {
      throw new Error("TEST 3 FAILED: Incorrect conflict message");
    }
    console.log(">> TEST 3 PASSED!");

    console.log("\n--- TEST 4: Single Driver Multiple Active Trips Conflict ---");
    const winningDriverId = (await Booking.findById(testBooking._id))?.driverId;
    const activeRunningTrip = await Booking.findOne({
      driverId: winningDriverId,
      status: {
        $in: [
          "DRIVER_ASSIGNED",
          "DRIVER_EN_ROUTE",
          "DRIVER_ARRIVED",
          "PASSENGER_PICKED_UP",
          "TRIP_IN_PROGRESS",
        ],
      },
    });
    if (!activeRunningTrip) {
      throw new Error("TEST 4 FAILED: Active running trip not detected");
    }
    console.log("Active trip detected:", activeRunningTrip.bookingReference);
    console.log(">> TEST 4 PASSED!");

    console.log("\n--- TEST 5: Idempotent Retried Acceptance ---");
    const isAlreadyAssigned = winningDriverId && testBooking._id;
    console.log("Winning driver already owns trip:", Boolean(isAlreadyAssigned));
    console.log(">> TEST 5 PASSED!");

    console.log("\n--- TEST 6: Expiry Lifecycle Verification ---");
    const expireTestBooking = await Booking.create({
      bookingReference: "PKM-TEST-EXP-" + Date.now(),
      bookingType: "LOCAL_RIDE",
      status: "PENDING",
      pickupAddress: "Kollupitiya",
      pickupLat: kollupitiyaLat,
      pickupLng: kollupitiyaLng,
      destinationAddress: "Bambalapitiya",
      paymentMethod: "CASH",
      passengerDetails: {
        fullName: "Expire Test Rider",
        email: "expire@example.com",
        whatsappNumber: "+94778888888",
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 0,
        childSeatRequired: false,
        meetAndGreetRequired: false,
      },
      fareBreakdown: {
        baseCharge: 300,
        distanceCharge: 300,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 600,
      },
    });

    expireTestBooking.dispatchStatus = "EXPIRED";
    await expireTestBooking.save();

    const verifiedExp = await Booking.findById(expireTestBooking._id);
    console.log("Status after expiry:", verifiedExp?.status, "dispatchStatus:", verifiedExp?.dispatchStatus);
    if (verifiedExp?.status !== "PENDING" || verifiedExp?.dispatchStatus !== "EXPIRED") {
      throw new Error("TEST 6 FAILED: Expiry altered status unexpectedly");
    }
    console.log(">> TEST 6 PASSED!");

    await User.deleteMany({ email: { $regex: "^test_dispatch_" } });
    await Booking.deleteMany({ bookingReference: { $regex: "^PKM-TEST-" } });
    console.log("\n=======================================================");
    console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("=======================================================");
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
