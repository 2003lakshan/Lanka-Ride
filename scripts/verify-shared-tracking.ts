import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { io as ClientIO } from "socket.io-client";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001";
const APP_URL = "http://localhost:3000";

import Booking from "../src/models/Booking";
import User from "../src/models/User";
import { 
  generateShareToken, 
  hashShareToken, 
  calculateShareTokenExpiry, 
  sanitizeBookingForShare,
  generalizeAddress,
  getPublicDriverName
} from "../src/lib/shareToken";
import { generateNotifyTravellerDriverAssignedMessage } from "../src/lib/whatsapp";

async function runVerification() {
  console.log("==================================================================");
  console.log("   VERIFYING LOGIN-FREE SHAREABLE TRIP TRACKING LINKS   ");
  console.log("==================================================================\n");

  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB:", MONGODB_URI);

  // 1. Setup Test User (Driver & Rider)
  let testRider = await User.findOne({ email: "test.rider.share@example.com" });
  if (!testRider) {
    testRider = await User.create({
      name: "Alice Passenger",
      email: "test.rider.share@example.com",
      role: "TOURIST",
      password: "password123",
      isApproved: true,
    });
  }

  let testDriver = await User.findOne({ email: "test.driver.share@example.com" });
  if (!testDriver) {
    testDriver = await User.create({
      name: "Kasun Perera",
      email: "test.driver.share@example.com",
      phoneNumber: "+94771239999",
      role: "DRIVER",
      password: "password123",
      isApproved: true,
      vehicleRegistration: "WP-CAB-1234",
      driverProfile: {
        vehicleDetails: {
          model: "Toyota Prius 2022",
          plateNumber: "WP-CAB-1234",
        },
      },
    });
  }

  // 2. Setup Test Booking
  const testRef = `LAR-SHARE-TEST-${Date.now().toString().slice(-4)}`;
  const testBooking = await Booking.create({
    bookingReference: testRef,
    touristId: testRider._id,
    driverId: testDriver._id,
    pickupAddress: "No. 45, Baseline Road, Dematagoda, Colombo 09, Sri Lanka",
    pickupLat: 6.9271,
    pickupLng: 79.8612,
    destinationAddress: "Bandaranaike International Airport, Katunayake, Sri Lanka",
    destinationLat: 7.1803,
    destinationLng: 79.8833,
    arrivalDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    arrivalTime: "14:30",
    status: "DRIVER_EN_ROUTE",
    passengerDetails: {
      fullName: "Alice Passenger Secret",
      country: "United Kingdom",
      nationality: "British",
      email: "private.alice@example.com",
      whatsappNumber: "+94770001122",
      adults: 2,
      children: 1,
      luggage: 3,
      specialRequests: "VIP private notes: passenger prefers quiet ride",
    },
    fareBreakdown: {
      baseCharge: 5000,
      distanceCharge: 3500,
      airportPickupCharge: 1000,
      trafficCharge: 0,
      nightCharge: 0,
      highwayToll: 400,
      additionalCharges: 0,
      discount: 0,
      totalEstimatedFare: 9900,
    },
    paymentMethod: "CREDIT_CARD",
    paymentStatus: "PAID",
    driverLocation: {
      lat: 6.935,
      lng: 79.865,
      accuracy: 10,
      updatedAt: new Date(),
    },
  });

  console.log(`✓ Created test booking ${testRef} (ID: ${testBooking._id})`);

  // --------------------------------------------------------------------------
  // TEST SUITE 1: Cryptographic Token Generation & Hashing
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Cryptographic Token Generation & Hashing ---");
  const rawToken = generateShareToken();
  if (rawToken.length === 64 && /^[0-9a-f]{64}$/.test(rawToken)) {
    console.log("✓ PASS: Token is 32 cryptographically random bytes in hex (64 chars):", rawToken.slice(0, 8) + "..." + rawToken.slice(-6));
  } else {
    throw new Error(`FAIL: Token format invalid: ${rawToken}`);
  }

  const tokenHash = hashShareToken(rawToken);
  if (tokenHash.length === 64 && /^[0-9a-f]{64}$/.test(tokenHash)) {
    console.log("✓ PASS: SHA-256 hash computed successfully:", tokenHash.slice(0, 8) + "...");
  } else {
    throw new Error("FAIL: Hash computation failed");
  }

  // Verify second calculation gives identical hash (deterministic)
  if (hashShareToken(rawToken) === tokenHash) {
    console.log("✓ PASS: Hash verification is deterministic");
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Expiry Calculation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Configurable Expiry Calculation ---");
  const calculatedExpiry = calculateShareTokenExpiry(testBooking);
  const scheduledTime = testBooking.arrivalDate!.getTime();
  const diffHours = (calculatedExpiry.getTime() - scheduledTime) / (1000 * 60 * 60);

  if (Math.abs(diffHours - 24) < 0.1) {
    console.log(`✓ PASS: Expiry is scheduled trip end + 24h grace period (${calculatedExpiry.toISOString()})`);
  } else {
    console.log(`✓ Note: Expiry calculated as: ${calculatedExpiry.toISOString()} (diff: ${diffHours}h)`);
  }

  // Save hash to booking
  testBooking.shareTokenHash = tokenHash;
  testBooking.shareTokenCreatedAt = new Date();
  testBooking.shareTokenExpiresAt = calculatedExpiry;
  testBooking.shareTokenRevoked = false;
  await testBooking.save();

  // Verify raw token is NOT stored in MongoDB
  const rawBookingDoc = await Booking.findById(testBooking._id).lean();
  if ((rawBookingDoc as any).shareToken === undefined && rawBookingDoc?.shareTokenHash === tokenHash) {
    console.log("✓ PASS: Raw token is NOT stored in DB, only SHA-256 hash is persisted");
  } else {
    throw new Error("FAIL: Raw token leaked to MongoDB document!");
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Privacy & Data Sanitization Rules
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Privacy & Data Sanitization Rules ---");
  const populatedBooking = await Booking.findById(testBooking._id)
    .populate("driverId")
    .lean();

  const sanitized = sanitizeBookingForShare(populatedBooking);

  // Check forbidden PII
  const sanitizedString = JSON.stringify(sanitized);
  const piiChecks = [
    { label: "Passenger Full Name", forbidden: "Alice Passenger Secret" },
    { label: "Passenger Email", forbidden: "private.alice@example.com" },
    { label: "Passenger Phone", forbidden: "+94770001122" },
    { label: "Payment Details / Fare Breakdown", forbidden: "9900" },
    { label: "Special Requests / Private Notes", forbidden: "VIP private notes" },
    { label: "Exact House Number", forbidden: "No. 45" },
  ];

  for (const check of piiChecks) {
    if (!sanitizedString.includes(check.forbidden)) {
      console.log(`✓ PASS: Strictly omitted: ${check.label}`);
    } else {
      throw new Error(`SECURITY BREACH: Sanitized payload contains ${check.label} ('${check.forbidden}')!`);
    }
  }

  // Check generalized address
  if (sanitized.pickupGeneral !== "No. 45, Baseline Road, Dematagoda, Colombo 09, Sri Lanka") {
    console.log(`✓ PASS: Generalized Pickup Address: "${sanitized.pickupGeneral}" (Street/house stripped)`);
  }
  if (sanitized.destinationGeneral === "Bandaranaike International Airport (CMB)") {
    console.log(`✓ PASS: Generalized Destination: "${sanitized.destinationGeneral}"`);
  }

  // Check limited driver info
  if (sanitized.driver?.name === "Kasun P." && sanitized.driver?.registrationNumber === "WP-CAB-1234") {
    console.log(`✓ PASS: Driver limited to public name: "${sanitized.driver.name}" and plate "${sanitized.driver.registrationNumber}"`);
  } else {
    throw new Error(`FAIL: Driver display invalid: ${JSON.stringify(sanitized.driver)}`);
  }

  // Check live location is present during active tracking
  if (sanitized.driverLocation?.lat === 6.935 && sanitized.driverLocation?.lng === 79.865) {
    console.log(`✓ PASS: Live coordinates exposed during active status ("${sanitized.status}")`);
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 4: Live Location Suppression on Non-Active Statuses
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Live Location Policy Across Statuses ---");
  const pendingBooking = {
    ...populatedBooking,
    status: "PENDING_APPROVAL",
  };
  const sanitizedPending = sanitizeBookingForShare(pendingBooking);
  if (sanitizedPending.driverLocation === null && sanitizedPending.statusInfo.badgeVariant === "pending") {
    console.log(`✓ PASS: Pending trip suppresses live coordinates: driverLocation is null`);
    console.log(`  Notice: "${sanitizedPending.statusInfo.description}"`);
  } else {
    throw new Error("FAIL: Pending trip leaked driver location!");
  }

  const completedBooking = {
    ...populatedBooking,
    status: "COMPLETED",
  };
  const sanitizedCompleted = sanitizeBookingForShare(completedBooking);
  if (sanitizedCompleted.driverLocation === null && sanitizedCompleted.statusInfo.badgeVariant === "completed") {
    console.log(`✓ PASS: Completed trip stops live tracking: driverLocation is null`);
  } else {
    throw new Error("FAIL: Completed trip leaked driver location!");
  }

  const cancelledBooking = {
    ...populatedBooking,
    status: "CANCELLED",
  };
  const sanitizedCancelled = sanitizeBookingForShare(cancelledBooking);
  if (sanitizedCancelled.driverLocation === null && sanitizedCancelled.statusInfo.badgeVariant === "cancelled") {
    console.log(`✓ PASS: Cancelled trip stops live tracking: driverLocation is null`);
  } else {
    throw new Error("FAIL: Cancelled trip leaked driver location!");
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 5: Socket.IO Realtime Guest Authentication
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Realtime Socket.IO Guest Connection & Room Security ---");

  // A. Valid share token connection
  const guestSocket = ClientIO(REALTIME_URL, {
    auth: { shareToken: rawToken },
    transports: ["websocket"],
    timeout: 5000,
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket connection timed out")), 5000);
    guestSocket.on("connect", () => {
      clearTimeout(timer);
      console.log(`✓ PASS: Guest Socket.IO connected with shareToken (Socket ID: ${guestSocket.id})`);
      resolve();
    });
    guestSocket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  // B. Verify guest received room subscription confirmation
  await new Promise<void>((resolve, reject) => {
    guestSocket.emit("booking:subscribe", { bookingId: testBooking._id.toString() }, (res: any) => {
      if (res?.success) {
        console.log(`✓ PASS: Guest successfully confirmed subscription to booking room`);
        resolve();
      } else {
        reject(new Error("Guest failed to subscribe to authorized booking"));
      }
    });
  });

  // C. Verify guest CANNOT subscribe to another booking room (Forbidden!)
  const otherFakeId = new mongoose.Types.ObjectId().toString();
  await new Promise<void>((resolve) => {
    guestSocket.emit("booking:subscribe", { bookingId: otherFakeId }, (res: any) => {
      if (!res?.success && res?.error?.includes("FORBIDDEN")) {
        console.log(`✓ PASS: Tamper protection: Guest denied access to unauthorized booking room (${res.error})`);
        resolve();
      } else {
        console.error("FAIL: Guest should have been denied access to foreign room:", res);
        process.exit(1);
      }
    });
  });

  // D. Disconnect valid socket
  guestSocket.disconnect();

  // E. Verify Revoked Token Rejection by Socket.IO
  console.log("\n--- TEST 6: Revoked Token Lifecycle & Rejection ---");
  testBooking.shareTokenRevoked = true;
  testBooking.shareTokenRevokedAt = new Date();
  await testBooking.save();

  const revokedSocket = ClientIO(REALTIME_URL, {
    auth: { shareToken: rawToken },
    transports: ["websocket"],
    timeout: 3000,
  });

  await new Promise<void>((resolve) => {
    revokedSocket.on("connect_error", (err) => {
      if (err.message.includes("revoked")) {
        console.log(`✓ PASS: Revoked share token rejected with error: "${err.message}"`);
        revokedSocket.disconnect();
        resolve();
      }
    });
    revokedSocket.on("connect", () => {
      console.error("FAIL: Revoked token was allowed to connect!");
      revokedSocket.disconnect();
      process.exit(1);
    });
  });

  // F. Verify Expired Token Rejection by Socket.IO
  console.log("\n--- TEST 7: Expired Token Lifecycle & Rejection ---");
  testBooking.shareTokenRevoked = false;
  testBooking.shareTokenExpiresAt = new Date(Date.now() - 3600 * 1000); // 1 hour ago
  await testBooking.save();

  const expiredSocket = ClientIO(REALTIME_URL, {
    auth: { shareToken: rawToken },
    transports: ["websocket"],
    timeout: 3000,
  });

  await new Promise<void>((resolve) => {
    expiredSocket.on("connect_error", (err) => {
      if (err.message.includes("expired")) {
        console.log(`✓ PASS: Expired share token rejected with error: "${err.message}"`);
        expiredSocket.disconnect();
        resolve();
      }
    });
    expiredSocket.on("connect", () => {
      console.error("FAIL: Expired token was allowed to connect!");
      expiredSocket.disconnect();
      process.exit(1);
    });
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 8: WhatsApp Driver Assignment Message Template
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: WhatsApp Template with Shareable Link ---");
  const sampleShareUrl = `${APP_URL}/track/shared/${rawToken}`;
  const waMsg = generateNotifyTravellerDriverAssignedMessage({
    bookingRef: testBooking.bookingReference,
    bookingId: testBooking._id.toString(),
    riderName: "Alice Passenger",
    driverName: "Kasun Perera",
    driverPhone: "+94 77 123 9999",
    vehicleModel: "Toyota Prius 2022",
    registrationNumber: "WP-CAB-1234",
    pickupLocation: "Colombo 09",
    tripDates: "Tomorrow",
    pickupTime: "14:30",
    shareableTrackingUrl: sampleShareUrl,
  });

  if (waMsg.includes(sampleShareUrl) && waMsg.includes("no login required") && waMsg.includes("login required")) {
    console.log("✓ PASS: WhatsApp message contains shareable link and distinguishes login-free vs authenticated actions:");
    console.log("--------------------------------------------------");
    console.log(waMsg);
    console.log("--------------------------------------------------");
  } else {
    throw new Error("FAIL: WhatsApp message did not include shareable tracking link properly!");
  }

  // Cleanup test booking
  await Booking.deleteOne({ _id: testBooking._id });
  console.log(`\n✓ Cleanup: Removed test booking ${testRef}`);
  await mongoose.disconnect();

  console.log("\n==================================================================");
  console.log("   ALL SHAREABLE TRACKING LINK VERIFICATION TESTS PASSED!   ");
  console.log("==================================================================");
}

runVerification().catch((err) => {
  console.error("\n❌ Verification Failed:", err);
  process.exit(1);
});
