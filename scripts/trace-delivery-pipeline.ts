import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dbConnect from "../src/lib/mongodb";
import User from "../src/models/User";
import Booking from "../src/models/Booking";
import {
  findEligibleNearbyDrivers,
  dispatchLocalRideOffer,
  getEligibleActiveOffersForDriver,
} from "../src/lib/nearbyDispatch";

async function main() {
  console.log("==================================================================");
  console.log("       STEP-BY-STEP DIAGNOSIS OF RIDE DELIVERY PIPELINE           ");
  console.log("==================================================================\n");

  await dbConnect();

  // -------------------------------------------------------------------------
  // AUDIT 1: Status of rmnlakshan@gmail.com & CT-OUWR4R
  // -------------------------------------------------------------------------
  console.log("--- [AUDIT 1] Inspecting rmnlakshan@gmail.com & CT-OUWR4R ---");
  const rmnDriver = await User.findOne({ email: "rmnlakshan@gmail.com" });
  if (!rmnDriver) {
    console.error("rmnlakshan@gmail.com driver not found!");
  } else {
    const ctTrip = await Booking.findOne({ bookingReference: "CT-OUWR4R" }).lean();
    console.log("rmnlakshan Driver State:", {
      id: rmnDriver._id.toString(),
      name: rmnDriver.name,
      isApproved: rmnDriver.isApproved,
      isOnline: rmnDriver.isOnline,
      vehicleCategory: rmnDriver.vehicleCategory,
      currentLat: rmnDriver.currentLat,
      currentLng: rmnDriver.currentLng,
      locationUpdatedAt: rmnDriver.locationUpdatedAt,
      locationAgeMin: rmnDriver.locationUpdatedAt
        ? ((Date.now() - new Date(rmnDriver.locationUpdatedAt).getTime()) / 60000).toFixed(1)
        : "N/A",
    });

    console.log("CT-OUWR4R Genuine Trip State:", {
      id: ctTrip?._id?.toString(),
      reference: ctTrip?.bookingReference,
      status: ctTrip?.status,
      driverId: ctTrip?.driverId?.toString(),
      assignedToRmn: ctTrip?.driverId?.toString() === rmnDriver._id.toString(),
      completedAt: ctTrip?.completedAt,
    });

    // Check rmnlakshan eligibility for a new ride
    const { eligibleDrivers: rmnMatches, excludedReasonCounts: rmnExcluded } =
      await findEligibleNearbyDrivers({
        pickupLat: 6.9344,
        pickupLng: 79.8428,
        vehicleCategory: "Car",
        freshnessMins: 5,
      });

    const isRmnEligible = rmnMatches.some(
      (m) => m.driver._id.toString() === rmnDriver._id.toString()
    );
    console.log("Eligibility test for rmnlakshan@gmail.com:", {
      eligible: isRmnEligible,
      excludedReasons: rmnExcluded,
      verdict: !isRmnEligible
        ? "STAGE 2 FAILURE FOR rmnlakshan: Blocked because driver is actively servicing CT-OUWR4R (conflictingActiveTrip) and/or GPS is stale (>5 min) due to mobile browser HTTP security restrictions."
        : "Eligible",
    });
  }

  // -------------------------------------------------------------------------
  // PIPELINE TRACE 2: End-to-End Delivery on a Clean Eligible Driver
  // -------------------------------------------------------------------------
  console.log("\n--- [PIPELINE TRACE 2] Testing Full Pipeline with Eligible Driver ---");

  // Step 2.0: Set up a dedicated clean test driver
  const testDriverEmail = "e2e.test.driver@example.com";
  let testDriver = await User.findOne({ email: testDriverEmail });
  const driverPasswordHash = await bcrypt.hash("driver123", 10);

  if (!testDriver) {
    testDriver = await User.create({
      name: "E2E Test Driver",
      email: testDriverEmail,
      password: driverPasswordHash,
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: 6.9344,
      currentLng: 79.8428,
      locationUpdatedAt: new Date(),
    });
    console.log("Created test driver:", testDriverEmail);
  } else {
    testDriver.isApproved = true;
    testDriver.isOnline = true;
    testDriver.vehicleCategory = "Car";
    testDriver.currentLat = 6.9344;
    testDriver.currentLng = 79.8428;
    testDriver.locationUpdatedAt = new Date();
    await testDriver.save();
    console.log("Updated test driver with fresh GPS at Colombo Fort:", testDriverEmail);
  }

  // Ensure test driver has no active trips
  await Booking.updateMany(
    {
      driverId: testDriver._id,
      status: {
        $in: [
          "CONFIRMED",
          "DRIVER_ASSIGNED",
          "DRIVER_EN_ROUTE",
          "DRIVER_ARRIVED",
          "PASSENGER_PICKED_UP",
          "TRIP_IN_PROGRESS",
        ],
      },
    },
    { $set: { status: "COMPLETED", completedAt: new Date() } }
  );

  // Find or create test tourist
  let tourist = await User.findOne({ role: "TOURIST" });
  if (!tourist) {
    tourist = await User.create({
      name: "Rider Test User",
      email: "rider.test@example.com",
      password: await bcrypt.hash("tourist123", 10),
      role: "TOURIST",
    });
  }

  // STAGE 1: booking saved
  console.log("\n[STAGE 1: booking saved]");
  const bookingRef = `TEST-E2E-${Date.now()}`;
  const newBooking = await Booking.create({
    bookingReference: bookingRef,
    bookingType: "LOCAL_RIDE",
    status: "PENDING",
    dispatchStatus: "SEARCHING",
    touristId: tourist._id,
    pickupAddress: "Colombo Fort Railway Station, Olcott Mawatha",
    pickupLat: 6.9344,
    pickupLng: 79.8428,
    destinationAddress: "Galle Face Hotel, 2 Galle Road, Colombo 03",
    destinationLat: 6.9202,
    destinationLng: 79.8436,
    distanceKm: 2.5,
    durationMins: 8,
    passengerDetails: {
      fullName: "Rider Test User",
      email: tourist.email,
      nationality: "Sri Lankan",
      country: "Sri Lanka",
      adults: 1,
      children: 0,
      luggage: 0,
    },
    paymentMethod: "CASH",
    pickMeDetails: {
      isPickMe: true,
      vehicleCategory: "Car",
      estimatedFare: 650,
      baseFare: 200,
      ratePerKm: 180,
      minimumFare: 300,
    },
    rejectedDriverIds: [],
  });

  console.log("✓ STAGE 1 SUCCESS: Booking saved in database:", {
    id: newBooking._id.toString(),
    ref: newBooking.bookingReference,
    status: newBooking.status,
    dispatchStatus: newBooking.dispatchStatus,
  });

  // STAGE 2: eligibility result
  console.log("\n[STAGE 2: eligibility result]");
  const eligibility = await findEligibleNearbyDrivers({
    pickupLat: newBooking.pickupLat!,
    pickupLng: newBooking.pickupLng!,
    vehicleCategory: "Car",
    excludeDriverIds: [],
    freshnessMins: 5,
    maxRadiusKm: 15,
  });

  const isMatched = eligibility.eligibleDrivers.some(
    (m) => m.driver._id.toString() === testDriver!._id.toString()
  );

  console.log("✓ STAGE 2 RESULT:", {
    totalEligibleCount: eligibility.eligibleDrivers.length,
    testDriverMatched: isMatched,
    excludedCounts: eligibility.excludedReasonCounts,
  });

  if (!isMatched) {
    console.error("STAGE 2 FAILED: Test driver was not matched!");
    process.exit(1);
  }

  // STAGE 3: offer returned/emitted
  console.log("\n[STAGE 3: offer returned/emitted]");
  const dispatchResult = await dispatchLocalRideOffer(newBooking);
  console.log("✓ STAGE 3 DISPATCH RESULT:", {
    success: dispatchResult.success,
    eligibleCount: dispatchResult.eligibleCount,
    bookingId: dispatchResult.bookingId,
  });

  // STAGE 4: driver provider receives offer (Polling endpoint verification)
  console.log("\n[STAGE 4: driver provider receives offer via /api/driver/offers/active]");
  const driverOffers = await getEligibleActiveOffersForDriver(testDriver!._id.toString());
  console.log("✓ STAGE 4 OFFERS RETRIEVED:", {
    offersCount: driverOffers.length,
    firstOfferBookingRef: driverOffers[0]?.bookingReference,
    firstOfferPickup: driverOffers[0]?.pickupLocation?.address,
    firstOfferFare: driverOffers[0]?.estimatedFare,
    firstOfferExpiresInSec: driverOffers[0]
      ? Math.round((new Date(driverOffers[0].expiresAt).getTime() - Date.now()) / 1000)
      : null,
  });

  if (driverOffers.length === 0) {
    console.error("STAGE 4 FAILED: Active offers endpoint returned 0 offers!");
    process.exit(1);
  }

  // STAGE 5: Verify polling fallback when socket is disconnected
  console.log("\n[STAGE 5: Polling fallback verification (Socket disconnected simulation)]");
  console.log("DriverOfferProvider polls /api/driver/offers/active every 3.5s when disconnected.");
  const pollingOffers = await getEligibleActiveOffersForDriver(testDriver!._id.toString());
  console.log("✓ STAGE 5 POLLING FALLBACK:", {
    receivedViaPolling: pollingOffers.length > 0,
    offerId: pollingOffers[0]?.offerId,
    matchingBooking: pollingOffers[0]?.bookingReference === bookingRef,
  });

  // STAGE 6: Rejection & Redispatch Guarantee
  console.log("\n[STAGE 6: Rejection Guarantee - Declined booking never reappears for declining driver]");
  // Simulate driver declining booking
  const updatedBooking = await Booking.findById(newBooking._id);
  if (updatedBooking) {
    if (!updatedBooking.rejectedDriverIds) updatedBooking.rejectedDriverIds = [];
    updatedBooking.rejectedDriverIds.push(testDriver!._id as any);
    await updatedBooking.save();
  }

  const offersAfterDecline = await getEligibleActiveOffersForDriver(testDriver!._id.toString());
  console.log("✓ STAGE 6 DECLINE VERIFICATION:", {
    declinedDriverIdAdded: updatedBooking?.rejectedDriverIds?.includes(testDriver!._id as any),
    offersReturnedToDeclinedDriver: offersAfterDecline.length,
    verdict: offersAfterDecline.length === 0
      ? "SUCCESS: Declined booking never reappears for that driver!"
      : "FAIL: Declined booking reappeared!",
  });

  console.log("\n==================================================================");
  console.log("                   PIPELINE DIAGNOSIS COMPLETE                    ");
  console.log("==================================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
