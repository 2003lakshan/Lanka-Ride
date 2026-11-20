import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";
const APP_URL = "http://localhost:3000";

import Booking from "../src/models/Booking";
import User from "../src/models/User";
import { generateShareToken, hashShareToken } from "../src/lib/shareToken";

async function verifyApiRoutes() {
  console.log("==================================================================");
  console.log("   VERIFYING PUBLIC SHARE TRACKING REST API ENDPOINTS   ");
  console.log("==================================================================\n");

  await mongoose.connect(MONGODB_URI);

  // Setup test booking
  const rawToken = generateShareToken();
  const tokenHash = hashShareToken(rawToken);

  const testRef = `LAR-API-TEST-${Date.now().toString().slice(-4)}`;
  const testBooking = await Booking.create({
    bookingReference: testRef,
    pickupAddress: "No. 12, Sea View Avenue, Mount Lavinia, Sri Lanka",
    pickupLat: 6.8385,
    pickupLng: 79.8647,
    destinationAddress: "Galle Fort, Church Street, Galle, Sri Lanka",
    destinationLat: 6.0329,
    destinationLng: 80.2168,
    arrivalDate: new Date(Date.now() + 48 * 3600 * 1000),
    status: "DRIVER_EN_ROUTE",
    shareTokenHash: tokenHash,
    shareTokenCreatedAt: new Date(),
    shareTokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    shareTokenRevoked: false,
    passengerDetails: {
      fullName: "Secret Passenger",
      country: "Germany",
      nationality: "German",
      email: "secret.passenger@example.com",
      whatsappNumber: "+491512345678",
      adults: 2,
      children: 0,
      luggage: 2,
    },
    driverLocation: {
      lat: 6.84,
      lng: 79.87,
      updatedAt: new Date(),
    },
  });

  console.log(`✓ Test Booking Created: ${testRef} (ID: ${testBooking._id})`);

  // 1. Test Valid Share Token GET (Login-free)
  console.log("\n--- TEST 1: Public GET with Valid Unguessable Token ---");
  const res1 = await fetch(`${APP_URL}/api/track/shared/${rawToken}`);
  console.log(`HTTP Status: ${res1.status}`);

  // Headers check
  const cacheControl = res1.headers.get("cache-control");
  const robotsTag = res1.headers.get("x-robots-tag");
  const referrerPolicy = res1.headers.get("referrer-policy");

  if (cacheControl?.includes("no-store") && robotsTag?.includes("noindex") && referrerPolicy === "no-referrer") {
    console.log(`✓ PASS: Privacy headers verified:`);
    console.log(`  Cache-Control: ${cacheControl}`);
    console.log(`  X-Robots-Tag: ${robotsTag}`);
    console.log(`  Referrer-Policy: ${referrerPolicy}`);
  } else {
    throw new Error(`FAIL: Missing privacy headers: ${cacheControl}, ${robotsTag}, ${referrerPolicy}`);
  }

  const json1 = await res1.json();
  if (res1.status === 200 && json1.success && json1.data.bookingReference === testRef) {
    console.log(`✓ PASS: Public API returned sanitized trip data without login`);
    console.log(`  Status Label: "${json1.data.statusInfo.label}"`);
    console.log(`  Generalized Pickup: "${json1.data.pickupGeneral}"`);
    console.log(`  Generalized Destination: "${json1.data.destinationGeneral}"`);
  } else {
    throw new Error(`FAIL: API response invalid: ${JSON.stringify(json1)}`);
  }

  // Verify NO PII in response
  const rawBody = JSON.stringify(json1);
  if (rawBody.includes("Secret Passenger") || rawBody.includes("secret.passenger@example.com") || rawBody.includes("+491512345678") || rawBody.includes("No. 12")) {
    throw new Error("SECURITY FAILURE: Passenger PII or exact house number leaked in public API!");
  } else {
    console.log(`✓ PASS: Verified 0% PII leakage in HTTP response`);
  }

  // 2. Test Booking ID Tampering (Attempting access via booking ID instead of token)
  console.log("\n--- TEST 2: Tamper Protection - Booking ID Access Must Be Blocked ---");
  const res2 = await fetch(`${APP_URL}/api/track/shared/${testBooking._id}`);
  console.log(`HTTP Status for booking ID attempt: ${res2.status}`);
  if (res2.status === 400 || res2.status === 404) {
    console.log(`✓ PASS: Booking ID alone cannot access shared tracking (Status ${res2.status})`);
  } else {
    throw new Error(`SECURITY FAILURE: Booking ID granted tracking access! Status: ${res2.status}`);
  }

  // 3. Test Invalid Random Token
  console.log("\n--- TEST 3: Invalid / Unguessable Token Protection ---");
  const fakeToken = "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";
  const res3 = await fetch(`${APP_URL}/api/track/shared/${fakeToken}`);
  console.log(`HTTP Status for unknown token: ${res3.status}`);
  if (res3.status === 404) {
    console.log(`✓ PASS: Unknown token returns 404 Not Found`);
  } else {
    throw new Error(`FAIL: Expected 404 for unknown token, got ${res3.status}`);
  }

  // 4. Test Revoked Token
  console.log("\n--- TEST 4: Revoked Token Public Endpoint Behavior ---");
  testBooking.shareTokenRevoked = true;
  testBooking.shareTokenRevokedAt = new Date();
  await testBooking.save();

  const res4 = await fetch(`${APP_URL}/api/track/shared/${rawToken}`);
  const json4 = await res4.json();
  console.log(`HTTP Status for revoked token: ${res4.status}`);
  if (res4.status === 410 && json4.code === "REVOKED") {
    console.log(`✓ PASS: Revoked token returns HTTP 410 with code "REVOKED": "${json4.error}"`);
  } else {
    throw new Error(`FAIL: Expected 410 REVOKED, got ${res4.status}: ${JSON.stringify(json4)}`);
  }

  // 5. Test Expired Token
  console.log("\n--- TEST 5: Expired Token Public Endpoint Behavior ---");
  testBooking.shareTokenRevoked = false;
  testBooking.shareTokenExpiresAt = new Date(Date.now() - 3600 * 1000); // 1 hour ago
  await testBooking.save();

  const res5 = await fetch(`${APP_URL}/api/track/shared/${rawToken}`);
  const json5 = await res5.json();
  console.log(`HTTP Status for expired token: ${res5.status}`);
  if (res5.status === 410 && json5.code === "EXPIRED") {
    console.log(`✓ PASS: Expired token returns HTTP 410 with code "EXPIRED": "${json5.error}"`);
  } else {
    throw new Error(`FAIL: Expected 410 EXPIRED, got ${res5.status}: ${JSON.stringify(json5)}`);
  }

  // Cleanup
  await Booking.deleteOne({ _id: testBooking._id });
  console.log(`\n✓ Cleanup: Deleted test booking ${testRef}`);
  await mongoose.disconnect();

  console.log("\n==================================================================");
  console.log("   ALL PUBLIC SHARE REST API TESTS PASSED!   ");
  console.log("==================================================================");
}

verifyApiRoutes().catch((err) => {
  console.error("\n❌ REST API Verification Failed:", err);
  process.exit(1);
});

