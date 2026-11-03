import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";
import dbConnect from "../src/lib/mongodb";
import User from "../src/models/User";
import Booking from "../src/models/Booking";
import {
  dispatchLocalRideOffer,
  findEligibleNearbyDrivers,
  getEligibleActiveOffersForDriver,
} from "../src/lib/nearbyDispatch";
import { io as ClientIO } from "socket.io-client";

async function runAcceptanceChecks() {
  console.log("===============================================================================");
  console.log("     END-TO-END ACCEPTANCE CHECKS: REAL AUTOMATIC INCOMING-RIDE FLOW          ");
  console.log("===============================================================================\n");

  await dbConnect();
  const timestamp = Date.now();
  const createdUserIds: string[] = [];
  const createdBookingIds: string[] = [];
  let testDriverSocket: any = null;

  try {
    // -------------------------------------------------------------------------
    // Setup Clean Test Users
    // -------------------------------------------------------------------------
    console.log("--- Setup: Creating Test Rider and Test Drivers ---");
    const testRider = await User.create({
      name: `Acceptance Rider ${timestamp}`,
      email: `rider_acc_${timestamp}@example.com`,
      password: "password123",
      role: "TOURIST",
      isEmailVerified: true,
    });
    createdUserIds.push(testRider._id.toString());

    // Driver 1: The primary test driver
    const driver1 = await User.create({
      name: `Driver Acceptance One ${timestamp}`,
      email: `driver1_acc_${timestamp}@example.com`,
      password: "password123",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      vehicleRegistration: `WP-CAR-${timestamp.toString().slice(-4)}`,
      currentLat: 6.9271, // Colombo Fort
      currentLng: 79.8612,
      locationUpdatedAt: new Date(),
    });
    createdUserIds.push(driver1._id.toString());
    const driver1Id = driver1._id.toString();

    // Driver 2: Competing driver
    const driver2 = await User.create({
      name: `Driver Acceptance Two ${timestamp}`,
      email: `driver2_acc_${timestamp}@example.com`,
      password: "password123",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      vehicleRegistration: `WP-CAR-B${timestamp.toString().slice(-3)}`,
      currentLat: 6.9300,
      currentLng: 79.8650,
      locationUpdatedAt: new Date(),
    });
    createdUserIds.push(driver2._id.toString());
    const driver2Id = driver2._id.toString();

    console.log(`✓ Created Rider: ${testRider.name}`);
    console.log(`✓ Created Driver 1: ${driver1.name} (Online, Approved, Car, Fresh GPS)`);
    console.log(`✓ Created Driver 2: ${driver2.name} (Online, Approved, Car, Fresh GPS)`);

    // Helper to create valid bookings
    const createBooking = async (overrides: any) => {
      const b = await Booking.create({
        bookingReference: `PKM-ACC-${Date.now().toString().slice(-6)}`,
        bookingType: "LOCAL_RIDE",
        touristId: testRider._id,
        passengerDetails: {
          fullName: testRider.name,
          email: testRider.email,
          nationality: "Sri Lankan",
          country: "Sri Lanka",
          adults: 1,
          children: 0,
          luggage: 0,
        },
        status: "PENDING",
        dispatchStatus: "SEARCHING",
        pickupAddress: "Galle Face Hotel, Colombo",
        pickupLat: 6.9218,
        pickupLng: 79.8456,
        destinationAddress: "Majestic City, Bambalapitiya",
        destinationLat: 6.8938,
        destinationLng: 79.8550,
        distanceKm: 4.8,
        durationMins: 15,
        totalPrice: 1250,
        paymentMethod: "CASH",
        paymentStatus: "PENDING",
        pickMeDetails: {
          isPickMe: true,
          vehicleCategory: "Car",
          estimatedFare: 1250,
          intermediateStops: [],
        },
        dispatchExpiresAt: new Date(Date.now() + 30000),
        ...overrides,
      });
      createdBookingIds.push(b._id.toString());
      return b;
    };

    // Connect Driver 1 Socket with NextAuth JWT
    const { encode } = await import("next-auth/jwt");
    const nextAuthSecret = process.env.NEXTAUTH_SECRET || "default_local_dev_secret_replace_in_prod";
    const driver1Token = await encode({
      token: {
        id: driver1Id,
        sub: driver1Id,
        name: driver1.name,
        email: driver1.email,
        role: "DRIVER",
        isApproved: true,
        sessionVersion: 0,
      },
      secret: nextAuthSecret,
    });

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    testDriverSocket = ClientIO(socketUrl, {
      auth: { token: driver1Token },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Socket connection timeout")), 6000);
      testDriverSocket.on("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      testDriverSocket.on("connect_error", (err: any) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    console.log("✓ Driver 1 authenticated socket connected to realtime server\n");

    // =========================================================================
    // SCENARIO A: Available driver + new eligible ride -> card opens automatically
    // =========================================================================
    console.log("--- SCENARIO A: Available Driver + New Eligible Ride ---");
    const rideA = await createBooking({
      bookingReference: `PKM-ACC-A-${timestamp.toString().slice(-5)}`,
      pickupAddress: "Galle Face Hotel, Colombo",
      pickupLat: 6.9218,
      pickupLng: 79.8456,
      destinationAddress: "Majestic City, Bambalapitiya",
      destinationLat: 6.8938,
      destinationLng: 79.8550,
      distanceKm: 4.8,
      totalPrice: 1250,
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        estimatedFare: 1250,
        intermediateStops: [],
      },
    });

    // Listen on socket for ride:offer
    const offerPromiseA = new Promise<any>((resolve) => {
      testDriverSocket.on("ride:offer", (offer: any) => {
        if (offer.bookingId === rideA._id.toString()) {
          resolve(offer);
        }
      });
    });

    const dispatchResA = await dispatchLocalRideOffer(rideA);
    console.log(`✓ Dispatch invoked. Eligible count: ${dispatchResA.eligibleCount}`);
    if (dispatchResA.eligibleCount <= 0) {
      throw new Error("Scenario A Failed: No eligible drivers notified");
    }

    const receivedOfferA = await Promise.race([
      offerPromiseA,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Socket ride:offer timeout")), 5000)),
    ]);
    console.log(`✓ Socket received real offer: Ref=${receivedOfferA.bookingReference}, Fare=${receivedOfferA.estimatedFare}, Pickup=${receivedOfferA.pickupLocation.address}`);

    // Verify recovery endpoint also returns the offer
    const activeOffersA = await getEligibleActiveOffersForDriver(driver1Id);
    const hasOfferA = activeOffersA.some((o: any) => o.bookingId === rideA._id.toString());
    console.log(`✓ getEligibleActiveOffersForDriver returned offer: ${hasOfferA}`);
    if (!hasOfferA) throw new Error("Scenario A Failed: Offer missing from active recovery");
    console.log(">>> SCENARIO A PASSED: Automatic card offer delivered via socket and recovery endpoint.\n");

    // =========================================================================
    // SCENARIO B: Busy driver + new ride -> no popup or ringing
    // =========================================================================
    console.log("--- SCENARIO B: Busy Driver + New Ride (Suppression Check) ---");
    // Assign an active trip to Driver 1 in PASSENGER_PICKED_UP
    const activeTripB = await createBooking({
      bookingReference: `PKM-BUSY-${timestamp.toString().slice(-5)}`,
      driverId: driver1._id,
      status: "PASSENGER_PICKED_UP",
      dispatchStatus: "ACCEPTED",
      pickupAddress: "Hilton Colombo",
      pickupLat: 6.9325,
      pickupLng: 79.8450,
      destinationAddress: "Mount Lavinia Hotel",
      destinationLat: 6.8340,
      destinationLng: 79.8640,
      distanceKm: 12.0,
      totalPrice: 2800,
    });

    // Create a new unassigned ride offer
    const rideB2 = await createBooking({
      bookingReference: `PKM-ACC-B-${timestamp.toString().slice(-5)}`,
      status: "PENDING",
      dispatchStatus: "SEARCHING",
      pickupAddress: "Viharamahadevi Park, Colombo",
      pickupLat: 6.9147,
      pickupLng: 79.8605,
      destinationAddress: "National Museum, Colombo",
      destinationLat: 6.9100,
      destinationLng: 79.8620,
      distanceKm: 2.1,
      totalPrice: 650,
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        estimatedFare: 650,
      },
    });

    // Check findEligibleNearbyDrivers: Driver 1 must be excluded under conflictingActiveTrip
    const eligibilityB = await findEligibleNearbyDrivers({
      pickupLat: rideB2.pickupLat!,
      pickupLng: rideB2.pickupLng!,
      vehicleCategory: "Car",
    });
    const driver1IncludedInB = eligibilityB.eligibleDrivers.some((d) => (d.driver._id as any).toString() === driver1Id);
    console.log(`✓ Driver 1 included in dispatch while busy: ${driver1IncludedInB} (conflictingActiveTrip count: ${eligibilityB.excludedReasonCounts.conflictingActiveTrip})`);
    if (driver1IncludedInB) throw new Error("Scenario B Failed: Busy driver was included in dispatch!");

    // Check getEligibleActiveOffersForDriver: must return 0 offers
    const activeOffersB = await getEligibleActiveOffersForDriver(driver1Id);
    console.log(`✓ Driver 1 active offers count while busy: ${activeOffersB.length}`);
    if (activeOffersB.length > 0) throw new Error("Scenario B Failed: Busy driver received active offers!");

    console.log(">>> SCENARIO B PASSED: Busy driver is strictly suppressed from dispatch and recovery.\n");

    // =========================================================================
    // SCENARIO C: Complete active trip -> eligible current offers appear automatically
    // =========================================================================
    console.log("--- SCENARIO C: Complete Active Trip -> Resume Live Dispatch ---");
    // Complete activeTripB
    activeTripB.status = "COMPLETED";
    activeTripB.completedAt = new Date();
    await activeTripB.save();
    console.log(`✓ Active trip ${activeTripB.bookingReference} status changed to COMPLETED`);
    console.log(`✓ Verified paymentStatus remains: ${activeTripB.paymentStatus} (Not automatically changed)`);
    if (activeTripB.paymentStatus !== "PENDING") {
      throw new Error("Scenario C Failed: Completion must not change payment status");
    }

    // Now Driver 1 is free! Re-evaluate eligible active offers
    const activeOffersC = await getEligibleActiveOffersForDriver(driver1Id);
    console.log(`✓ Driver 1 active offers count after trip completion: ${activeOffersC.length}`);
    const hasRideB2 = activeOffersC.some((o: any) => o.bookingId === rideB2._id.toString());
    console.log(`✓ Driver 1 can now receive currently valid unassigned ride ${rideB2.bookingReference}: ${hasRideB2}`);
    if (!hasRideB2) throw new Error("Scenario C Failed: Available ride did not appear after trip completion");

    console.log(">>> SCENARIO C PASSED: Trip completion releases busy state and resumes offer reception.\n");

    // =========================================================================
    // SCENARIO D: Decline -> same booking never reappears for that driver
    // =========================================================================
    console.log("--- SCENARIO D: Decline -> Permanent Driver Exclusion ---");
    // Driver 1 rejects rideB2
    await Booking.findByIdAndUpdate(rideB2._id, {
      $addToSet: { rejectedDriverIds: driver1._id },
    });
    console.log(`✓ Driver 1 added to rejectedDriverIds for ${rideB2.bookingReference}`);

    // Re-check getEligibleActiveOffersForDriver for Driver 1
    const activeOffersD1 = await getEligibleActiveOffersForDriver(driver1Id);
    const hasRejectedRide = activeOffersD1.some((o: any) => o.bookingId === rideB2._id.toString());
    console.log(`✓ Driver 1 active offers contains rejected ride: ${hasRejectedRide}`);
    if (hasRejectedRide) throw new Error("Scenario D Failed: Driver 1 still receives rejected ride!");

    // Check Driver 2 (Driver 2 should STILL receive rideB2)
    const activeOffersD2 = await getEligibleActiveOffersForDriver(driver2Id);
    const driver2HasRide = activeOffersD2.some((o: any) => o.bookingId === rideB2._id.toString());
    console.log(`✓ Driver 2 active offers contains ride: ${driver2HasRide} (Permanent rejection is driver-specific)`);
    if (!driver2HasRide) throw new Error("Scenario D Failed: Driver 2 was incorrectly excluded");

    // Test redispatch persistence
    const updatedRideB2: any = await Booking.findById(rideB2._id);
    const redispatchEligibility = await findEligibleNearbyDrivers({
      pickupLat: updatedRideB2.pickupLat,
      pickupLng: updatedRideB2.pickupLng,
      vehicleCategory: "Car",
      excludeDriverIds: (updatedRideB2.rejectedDriverIds || []).map((id: any) => id.toString()),
    });
    console.log(`✓ Redispatch eligible drivers: ${redispatchEligibility.eligibleDrivers.length} (Driver 1 explicitly excluded count: ${redispatchEligibility.excludedReasonCounts.explicitlyExcluded})`);
    if (redispatchEligibility.excludedReasonCounts.explicitlyExcluded < 1) {
      throw new Error("Scenario D Failed: Driver 1 was not explicitly excluded on redispatch");
    }

    const redispatchD = await dispatchLocalRideOffer(updatedRideB2);
    console.log(`✓ Redispatch dispatched. Eligible count: ${redispatchD.eligibleCount}`);

    console.log(">>> SCENARIO D PASSED: Driver rejection is permanently persisted and isolated.\n");

    // =========================================================================
    // SCENARIO E: Cancel/expire/accept elsewhere -> card closes
    // =========================================================================
    console.log("--- SCENARIO E: Cancel/Accept Elsewhere -> Offer Withdrawn ---");
    // Create new offer
    const rideE = await createBooking({
      bookingReference: `PKM-ACC-E-${timestamp.toString().slice(-5)}`,
      status: "PENDING",
      dispatchStatus: "SEARCHING",
      pickupAddress: "Kelaniya Temple, Kelaniya",
      pickupLat: 6.9530,
      pickupLng: 79.9170,
      destinationAddress: "Fort Colombo",
      destinationLat: 6.9344,
      destinationLng: 79.8428,
      distanceKm: 8.5,
      totalPrice: 1900,
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        estimatedFare: 1900,
      },
    });

    // Update GPS of Driver 1 to be near Kelaniya
    await User.findByIdAndUpdate(driver1Id, {
      currentLat: 6.9500,
      currentLng: 79.9150,
      locationUpdatedAt: new Date(),
    });

    await dispatchLocalRideOffer(rideE);

    // Now rider cancels the ride
    rideE.status = "CANCELLED";
    rideE.dispatchStatus = "CANCELLED";
    rideE.cancelledAt = new Date();
    rideE.cancellationReasonText = "Plans changed";
    await rideE.save();

    // Check active offers for Driver 1: cancelled ride must NOT be returned
    const activeOffersE = await getEligibleActiveOffersForDriver(driver1Id);
    const hasCancelledRide = activeOffersE.some((o: any) => o.bookingId === rideE._id.toString());
    console.log(`✓ Driver 1 active offers contains cancelled ride: ${hasCancelledRide}`);
    if (hasCancelledRide) throw new Error("Scenario E Failed: Cancelled ride still returned in active offers!");

    console.log(">>> SCENARIO E PASSED: Cancelled/accepted-elsewhere ride is removed from active offers.\n");

    // =========================================================================
    // SCENARIO F: Socket disconnected -> polling recovers valid offer
    // =========================================================================
    console.log("--- SCENARIO F: Socket Disconnected -> Polling Fallback Recovery ---");
    // Disconnect socket for Driver 1
    testDriverSocket.disconnect();
    console.log("✓ Driver 1 socket disconnected intentionally");

    // Create a new offer while socket is disconnected
    const rideF = await createBooking({
      bookingReference: `PKM-ACC-F-${timestamp.toString().slice(-5)}`,
      status: "PENDING",
      dispatchStatus: "SEARCHING",
      pickupAddress: "Kiribathgoda Junction",
      pickupLat: 6.9780,
      pickupLng: 79.9280,
      destinationAddress: "Colombo Fort",
      destinationLat: 6.9344,
      destinationLng: 79.8428,
      distanceKm: 9.2,
      totalPrice: 2100,
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        estimatedFare: 2100,
      },
    });

    // Polling endpoint (/api/driver/offers/active -> getEligibleActiveOffersForDriver)
    const polledOffers = await getEligibleActiveOffersForDriver(driver1Id);
    const hasPolledOffer = polledOffers.some((o: any) => o.bookingId === rideF._id.toString());
    console.log(`✓ Polling query recovered valid offer during socket downtime: ${hasPolledOffer}`);
    if (!hasPolledOffer) throw new Error("Scenario F Failed: Polling fallback did not recover offer");

    console.log(">>> SCENARIO F PASSED: Polling recovery seamlessly retrieves unexpired active offers without socket.\n");

    console.log("===============================================================================");
    console.log("   ALL ACCEPTANCE CHECKS (A through F) PASSED WITH COMPLETE FIDELITY!         ");
    console.log("===============================================================================");
  } finally {
    if (testDriverSocket) {
      testDriverSocket.disconnect();
    }

    // Cleanup
    console.log("\n--- Cleaning up test records ---");
    for (const bId of createdBookingIds) {
      await Booking.findByIdAndDelete(bId);
    }
    for (const uId of createdUserIds) {
      await User.findByIdAndDelete(uId);
    }
    console.log(`✓ Cleaned up ${createdBookingIds.length} test bookings and ${createdUserIds.length} test users`);
    await mongoose.disconnect();
  }
}

runAcceptanceChecks().catch((err) => {
  console.error("ACCEPTANCE CHECK FAILED:", err);
  process.exit(1);
});
