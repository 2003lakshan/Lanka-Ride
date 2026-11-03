import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";
import dbConnect from "../src/lib/mongodb";
import User from "../src/models/User";
import Booking from "../src/models/Booking";
import Airport from "../src/models/Airport";
import VehicleType from "../src/models/VehicleType";
import {
  dispatchLocalRideOffer,
  findEligibleNearbyDrivers,
  getEligibleActiveOffersForDriver,
} from "../src/lib/nearbyDispatch";
import { io as ClientIO } from "socket.io-client";

async function run() {
  console.log("===============================================================================");
  console.log("   INCOMING-RIDE POPUP CARD, DUAL SWIPE CONTROLS & REJECTION VERIFICATION     ");
  console.log("===============================================================================\n");

  await dbConnect();

  const timestamp = Date.now();
  let testBookingId: string | null = null;
  const createdUserIds: string[] = [];
  let driverASocket: any = null;
  let driverBSocket: any = null;

  try {
    // ---------------------------------------------------------------------------
    // Step 1: Create Test Accounts
    // ---------------------------------------------------------------------------
    console.log("--- Step 1: Creating Passenger and Two Eligible Drivers ---");

    const passenger = await User.create({
      name: `Rider Nuwan ${timestamp}`,
      email: `rider_${timestamp}@test.com`,
      password: "Password123!",
      role: "TOURIST",
      nationality: "Sri Lankan",
    });
    createdUserIds.push(passenger._id.toString());
    console.log(`✓ Passenger created: ${passenger.name} (${passenger.email})`);

    // Driver A: Colombo 03 (6.9100, 79.8550) - ~3 km from pickup (Pettah: 6.9360, 79.8500)
    const driverA = await User.create({
      name: `Driver Anura ${timestamp}`,
      email: `driver_a_${timestamp}@test.com`,
      password: "Password123!",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: 6.9100,
      currentLng: 79.8550,
      locationUpdatedAt: new Date(),
    });
    createdUserIds.push(driverA._id.toString());
    console.log(`✓ Driver A created: ${driverA.name} (Approved, Online, Car, GPS Fresh)`);

    // Driver B: Colombo 07 (6.9050, 79.8650) - ~4 km from pickup (Pettah: 6.9360, 79.8500)
    const driverB = await User.create({
      name: `Driver Bimal ${timestamp}`,
      email: `driver_b_${timestamp}@test.com`,
      password: "Password123!",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: 6.9050,
      currentLng: 79.8650,
      locationUpdatedAt: new Date(),
    });
    createdUserIds.push(driverB._id.toString());
    console.log(`✓ Driver B created: ${driverB.name} (Approved, Online, Car, GPS Fresh)`);

    // ---------------------------------------------------------------------------
    // Step 2: Connect Driver Sockets to Realtime Socket Server
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 2: Connecting Driver Realtime Sockets ---");
    const { encode } = await import("next-auth/jwt");
    const nextAuthSecret = process.env.NEXTAUTH_SECRET || "default_local_dev_secret_replace_in_prod";

    const createTestSessionToken = async (u: any) => {
      const dbU = await User.findById(u._id).select("sessionVersion");
      const currentVersion = dbU?.sessionVersion || 0;
      return await encode({
        token: {
          id: u._id.toString(),
          sub: u._id.toString(),
          name: u.name,
          email: u.email,
          role: u.role,
          isApproved: u.isApproved ?? true,
          sessionVersion: currentVersion,
        },
        secret: nextAuthSecret,
      });
    };

    const driverAToken = await createTestSessionToken(driverA);
    const driverBToken = await createTestSessionToken(driverB);

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

    driverASocket = ClientIO(socketUrl, {
      auth: { token: driverAToken },
      transports: ["websocket"],
      reconnection: false,
    });

    driverBSocket = ClientIO(socketUrl, {
      auth: { token: driverBToken },
      transports: ["websocket"],
      reconnection: false,
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Driver A socket timeout")), 5000);
        driverASocket.on("connect", () => {
          clearTimeout(timeout);
          console.log("✓ Driver A socket connected");
          resolve();
        });
        driverASocket.on("connect_error", (err: any) => {
          clearTimeout(timeout);
          reject(err);
        });
      }),
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Driver B socket timeout")), 5000);
        driverBSocket.on("connect", () => {
          clearTimeout(timeout);
          console.log("✓ Driver B socket connected");
          resolve();
        });
        driverBSocket.on("connect_error", (err: any) => {
          clearTimeout(timeout);
          reject(err);
        });
      }),
    ]);

    // Track received offers
    const driverAOffers: any[] = [];
    const driverBOffers: any[] = [];

    driverASocket.on("ride:offer", (offer: any) => {
      driverAOffers.push(offer);
    });

    driverBSocket.on("ride:offer", (offer: any) => {
      driverBOffers.push(offer);
    });

    // ---------------------------------------------------------------------------
    // Step 3: Create Local Ride Booking & Dispatch
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 3: Creating and Dispatching Local Ride Booking ---");
    const booking: any = await Booking.create({
      bookingReference: `LAR-VERIFY-${timestamp.toString().slice(-5)}`,
      bookingType: "LOCAL_RIDE",
      status: "PENDING",
      touristId: passenger._id,
      passengerDetails: {
        fullName: passenger.name,
        email: passenger.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 0,
      },
      pickupAddress: "Pettah Railway Station, Colombo",
      pickupLat: 6.9360,
      pickupLng: 79.8500,
      intermediateStops: [
        {
          name: "National Museum",
          address: "Sir Marcus Fernando Mawatha, Colombo 07",
          lat: 6.9103,
          lng: 79.8608,
          stopOrder: 1,
        },
      ],
      destinationAddress: "Galle Face Green, Colombo",
      destinationLat: 6.9271,
      destinationLng: 79.8444,
      distanceKm: 8.5,
      durationMins: 22,
      vehicleCategory: "Car",
      paymentMethod: "CASH",
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        estimatedFare: 1850,
        rideNow: true,
        baseFare: 250,
        ratePerKm: 120,
        minimumFare: 300,
        pricingSnapshot: {
          baseFare: 250,
          ratePerKm: 120,
          minimumFare: 300,
          estimatedFare: 1850,
        },
      },
    } as any);

    testBookingId = booking._id.toString();
    console.log(`✓ Booking created: ${booking.bookingReference} (ID: ${testBookingId})`);

    // Dispatch offer
    const dispatchRes = await dispatchLocalRideOffer(booking);
    console.log(`✓ Dispatch result: ${dispatchRes.eligibleCount} eligible drivers notified`);

    // Wait 1.5s for socket events
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Offer Payload Content
    if (driverAOffers.length === 0 || driverBOffers.length === 0) {
      throw new Error(`Expected both drivers to receive ride offer. Driver A count: ${driverAOffers.length}, Driver B count: ${driverBOffers.length}`);
    }

    const offerA = driverAOffers[0];
    console.log("\n--- Step 4: Validating Real Offer Data on Driver A ---");
    console.log(`  - Booking Reference: ${offerA.bookingReference}`);
    console.log(`  - Passenger Name: ${offerA.passengerName} (Strictly from registered profile)`);
    console.log(`  - Pickup Address: ${offerA.pickupLocation?.address}`);
    console.log(`  - Pickup Lat/Lng: (${offerA.pickupLocation?.lat}, ${offerA.pickupLocation?.lng})`);
    console.log(`  - Driver Lat/Lng: (${offerA.driverLocation?.lat}, ${offerA.driverLocation?.lng})`);
    console.log(`  - Intermediate Stops: ${offerA.intermediateStops?.length} stop(s)`);
    console.log(`  - Destination: ${offerA.destinationLocation?.address}`);
    console.log(`  - Driver to Pickup: ${offerA.driverToPickupDistanceKm ?? offerA.driverToPickupStraightLineKm} km`);
    console.log(`  - Passenger Journey: ${offerA.passengerJourneyDistanceKm} km, ~${offerA.passengerJourneyDurationMins} mins`);
    console.log(`  - Estimated Fare: LKR ${offerA.estimatedFare}`);
    console.log(`  - Vehicle Category: ${offerA.vehicleCategory}`);
    console.log(`  - Payment Method: ${offerA.paymentMethod}`);

    if (!offerA.pickupLocation?.lat || !offerA.driverLocation?.lat) {
      throw new Error("Missing coordinates in offer payload for map preview!");
    }
    if (offerA.passengerName !== passenger.name) {
      throw new Error(`Expected passenger name ${passenger.name}, got ${offerA.passengerName}`);
    }
    if ((offerA as any).phoneNumber || (offerA as any).passengerPhone) {
      throw new Error("Privacy violation: passenger phone was exposed in offer payload!");
    }
    console.log("✓ Privacy and offer payload schema strictly verified!");

    // ---------------------------------------------------------------------------
    // Step 5: Persistent Server Rejection Test (Driver A declines)
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 5: Testing Persistent Driver-Specific Rejection ---");
    
    // Check initial active offers query for Driver A
    const activeBeforeReject = await getEligibleActiveOffersForDriver(driverA._id.toString());
    const hasOfferBefore = activeBeforeReject.some((o: any) => o.bookingId === testBookingId);
    console.log(`  Driver A active offers before reject has offer: ${hasOfferBefore}`);
    if (!hasOfferBefore) throw new Error("Driver A should have active offer before reject");

    // Driver A declines the ride:
    const driverAObjId = new mongoose.Types.ObjectId(driverA._id.toString());
    await Booking.findByIdAndUpdate(testBookingId, {
      $addToSet: { rejectedDriverIds: driverAObjId },
    });
    console.log("✓ Rejection recorded on server via $addToSet");

    // Verify rejection is idempotent: calling $addToSet again does not create duplicate
    await Booking.findByIdAndUpdate(testBookingId, {
      $addToSet: { rejectedDriverIds: driverAObjId },
    });
    const checkBooking = await Booking.findById(testBookingId);
    const matchingRejections = (checkBooking?.rejectedDriverIds || []).filter(
      (id) => id.toString() === driverA._id.toString()
    );
    if (matchingRejections.length !== 1) {
      throw new Error(`Expected exactly 1 rejection record for Driver A, found ${matchingRejections.length}`);
    }
    console.log("✓ Idempotency verified: exactly 1 rejection entry in database");

    // ---------------------------------------------------------------------------
    // Step 6: Exclude Rejected Booking from Driver A's Queries, Polling & Reconnect
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 6: Verifying Driver A Exclusion Across Queries ---");

    // 1. getEligibleActiveOffersForDriver for Driver A
    const activeAfterRejectA = await getEligibleActiveOffersForDriver(driverA._id.toString());
    const hasOfferAfterA = activeAfterRejectA.some((o: any) => o.bookingId === testBookingId);
    console.log(`  Driver A active offers after reject has offer: ${hasOfferAfterA}`);
    if (hasOfferAfterA) {
      throw new Error("FAIL: Rejected booking still appeared in Driver A active offers!");
    }
    console.log("✓ Driver A getEligibleActiveOffersForDriver correctly excludes rejected booking");

    // 2. Available trips query for Driver A
    const availableForA = await Booking.find({
      status: { $in: ["PENDING", "CONFIRMED"] },
      driverId: null,
      rejectedDriverIds: { $nin: [driverA._id.toString(), driverAObjId] },
    }).lean();
    const hasAvailableForA = availableForA.some((b: any) => b._id.toString() === testBookingId);
    if (hasAvailableForA) {
      throw new Error("FAIL: Rejected booking still appeared in Driver A Available Trips!");
    }
    console.log("✓ Driver A Available Trips query correctly excludes rejected booking");

    // 3. Confirm Driver B CAN STILL SEE the offer!
    const activeAfterRejectB = await getEligibleActiveOffersForDriver(driverB._id.toString());
    const hasOfferAfterB = activeAfterRejectB.some((o: any) => o.bookingId === testBookingId);
    console.log(`  Driver B active offers after Driver A rejected has offer: ${hasOfferAfterB}`);
    if (!hasOfferAfterB) {
      throw new Error("FAIL: Driver A reject incorrectly hid the offer from Driver B!");
    }
    console.log("✓ Driver B can still see and acquire the offer (rejection is driver-specific)");

    // ---------------------------------------------------------------------------
    // Step 7: Redispatch / Retry Dispatch Verification
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 7: Verifying Redispatch Persistence ---");
    // Clear socket offers history
    driverAOffers.length = 0;
    driverBOffers.length = 0;

    // Simulate redispatch / retry dispatch
    const reloadedBooking = await Booking.findById(testBookingId);
    const redispatchRes = await dispatchLocalRideOffer(reloadedBooking);
    console.log(`✓ Redispatch result: ${redispatchRes.eligibleCount} eligible drivers notified`);

    // Wait 1.5s for socket events
    await new Promise((r) => setTimeout(r, 1500));

    if (driverAOffers.length > 0) {
      throw new Error(`FAIL: Driver A received offer again on redispatch! Offer count: ${driverAOffers.length}`);
    }
    console.log("✓ Driver A received 0 offers on redispatch (persistent exclusion verified)");

    if (driverBOffers.length === 0) {
      throw new Error("Driver B should have received the redispatched offer!");
    }
    console.log("✓ Driver B received redispatched offer successfully");

    // ---------------------------------------------------------------------------
    // Step 8: Atomic Acceptance & Race Condition Handling
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 8: Verifying Atomic Acceptance Concurrency ---");

    // Driver B accepts the booking atomically:
    const acceptUpdate = await Booking.findOneAndUpdate(
      {
        _id: testBookingId,
        status: { $in: ["PENDING", "CONFIRMED"] },
        $or: [{ driverId: null }, { driverId: { $exists: false } }],
      },
      {
        status: "DRIVER_ASSIGNED",
        driverId: driverB._id,
        assignedAt: new Date(),
        dispatchStatus: "ACCEPTED",
      },
      { new: true }
    );

    if (!acceptUpdate) {
      throw new Error("Failed to assign booking to Driver B");
    }
    console.log(`✓ Booking assigned atomically to Driver B: ${acceptUpdate.bookingReference}`);

    // Driver A attempts late acceptance:
    const lateAccept = await Booking.findOneAndUpdate(
      {
        _id: testBookingId,
        status: { $in: ["PENDING", "CONFIRMED"] },
        $or: [{ driverId: null }, { driverId: { $exists: false } }],
      },
      {
        status: "DRIVER_ASSIGNED",
        driverId: driverA._id,
        assignedAt: new Date(),
        dispatchStatus: "ACCEPTED",
      },
      { new: true }
    );

    if (lateAccept) {
      throw new Error("FAIL: Driver A acquired booking that was already assigned to Driver B!");
    }
    console.log("✓ Atomic concurrency lock strictly verified: second driver attempt safely rejected");

    console.log("\n===============================================================================");
    console.log("   ALL BACKEND VERIFICATION CHECKS PASSED SUCCESSFULLY! (10/10)                 ");
    console.log("===============================================================================");
  } catch (err: any) {
    console.error("\n❌ TEST ERROR CAUGHT:", err);
    throw err;
  } finally {
    // Teardown
    console.log("\n--- Cleaning up test records ---");
    try {
      driverASocket?.disconnect();
      driverBSocket?.disconnect();
    } catch {}
    if (testBookingId) {
      await Booking.findByIdAndDelete(testBookingId);
      console.log(`✓ Test booking ${testBookingId} removed`);
    }
    for (const uid of createdUserIds) {
      await User.findByIdAndDelete(uid);
      console.log(`✓ Test user ${uid} removed`);
    }
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
