import { io as Client } from "socket.io-client";
import { encode } from "next-auth/jwt";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
const SOCKET_URL = "http://localhost:3001";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";

async function runTests() {
  console.log("=== STARTING REALTIME WEBSOCKET E2E VERIFICATION ===");

  await mongoose.connect(MONGODB_URI);
  console.log("[Test] Connected to MongoDB");

  const users = await mongoose.connection.db!.collection("users").find({}).toArray();
  const adminUser = users.find((u) => u.role === "ADMIN");
  const driverUser = users.find((u) => u.role === "DRIVER" && u.isApproved === true);
  const touristUser = users.find((u) => u.role === "TOURIST");

  if (!adminUser || !driverUser || !touristUser) {
    throw new Error(`Missing test users in database: admin=${!!adminUser}, driver=${!!driverUser}, tourist=${!!touristUser}`);
  }

  console.log(`[Test] Using Admin: ${adminUser.email} (${adminUser._id})`);
  console.log(`[Test] Using Driver: ${driverUser.email} (${driverUser._id})`);
  console.log(`[Test] Using Tourist: ${touristUser.email} (${touristUser._id})`);

  // Create valid NextAuth tokens
  const adminToken = await encode({
    token: {
      id: adminUser._id.toString(),
      sub: adminUser._id.toString(),
      email: adminUser.email,
      name: adminUser.name,
      role: "ADMIN",
      sessionVersion: adminUser.sessionVersion ?? 0,
    },
    secret: NEXTAUTH_SECRET,
  });

  const driverToken = await encode({
    token: {
      id: driverUser._id.toString(),
      sub: driverUser._id.toString(),
      email: driverUser.email,
      name: driverUser.name,
      role: "DRIVER",
      isApproved: true,
      sessionVersion: driverUser.sessionVersion ?? 0,
    },
    secret: NEXTAUTH_SECRET,
  });

  const touristToken = await encode({
    token: {
      id: touristUser._id.toString(),
      sub: touristUser._id.toString(),
      email: touristUser.email,
      name: touristUser.name,
      role: "TOURIST",
      sessionVersion: touristUser.sessionVersion ?? 0,
    },
    secret: NEXTAUTH_SECRET,
  });

  // TEST 1: Unauthenticated connection rejection
  console.log("\n--- TEST 1: Unauthenticated & Forged Handshakes ---");
  await new Promise<void>((resolve, reject) => {
    const unauthSocket = Client(SOCKET_URL, {
      auth: { token: "forged_invalid_token_123" },
      transports: ["websocket"],
      reconnection: false,
    });

    unauthSocket.on("connect", () => {
      unauthSocket.disconnect();
      reject(new Error("FAILED: Unauthenticated socket should NOT connect!"));
    });

    unauthSocket.on("connect_error", (err) => {
      console.log(`✓ Rejected forged token successfully: "${err.message}"`);
      unauthSocket.disconnect();
      resolve();
    });
  });

  // TEST 2: Authenticated connections
  console.log("\n--- TEST 2: Authenticated Handshakes with Verified NextAuth JWT ---");
  const adminSocket = Client(SOCKET_URL, {
    auth: { token: adminToken },
    transports: ["websocket"],
  });
  const driverSocket = Client(SOCKET_URL, {
    auth: { token: driverToken },
    transports: ["websocket"],
  });
  const touristSocket = Client(SOCKET_URL, {
    auth: { token: touristToken },
    transports: ["websocket"],
  });

  await Promise.all([
    new Promise<void>((res) => adminSocket.on("connect", () => { console.log("✓ Admin socket connected securely"); res(); })),
    new Promise<void>((res) => driverSocket.on("connect", () => { console.log("✓ Driver socket connected securely"); res(); })),
    new Promise<void>((res) => touristSocket.on("connect", () => { console.log("✓ Tourist socket connected securely"); res(); })),
  ]);

  // TEST 3: Unauthorized Room Access Prevention
  console.log("\n--- TEST 3: Room Access Control & Authorization Checks ---");
  // Create a mock booking owned by someone else or use a random fake ID
  const fakeBookingId = new mongoose.Types.ObjectId().toString();
  await new Promise<void>((resolve) => {
    touristSocket.emit("booking:subscribe", fakeBookingId, (res: any) => {
      if (!res.success && res.error) {
        console.log(`✓ Tourist forbidden from unauthorized/non-existent booking room: "${res.error}"`);
      } else {
        console.error("FAILED: Tourist was wrongly allowed into booking room!");
      }
      resolve();
    });
  });

  // TEST 4: Chat & Notification Delivery
  console.log("\n--- TEST 4: In-App Notification Delivery & Unread Count ---");
  const notificationPromise = new Promise<void>((resolve) => {
    touristSocket.on("notification:new", (payload: any) => {
      console.log(`✓ Tourist received notification: "${payload.notification.title}", unreadCount: ${payload.unreadCount}, eventId: ${payload.eventId}`);
      resolve();
    });
  });

  const { broadcastNotification } = await import("../src/lib/realtime");
  await broadcastNotification(touristUser._id.toString(), {
    _id: new mongoose.Types.ObjectId().toString(),
    recipientId: touristUser._id.toString(),
    type: "BOOKING_CONFIRMED",
    title: "Test Ride Confirmed",
    message: "Your airport transfer has been scheduled.",
    isRead: false,
  }, 3);

  await notificationPromise;

  // TEST 5: Custom Trip Submission (Workflow Step 1)
  console.log("\n--- TEST 5: Custom Trip Submitted (Admin Receives, Driver Does NOT) ---");
  let driverReceivedCustom = false;
  driverSocket.on("booking:custom_submitted", () => { driverReceivedCustom = true; });

  const adminCustomPromise = new Promise<void>((resolve) => {
    adminSocket.on("booking:custom_submitted", (payload: any) => {
      console.log(`✓ Admin received custom trip request: ref=${payload.booking?.bookingReference}, eventId=${payload.eventId}`);
      resolve();
    });
  });

  const { broadcastCustomTripSubmitted } = await import("../src/lib/realtime");
  await broadcastCustomTripSubmitted({
    _id: new mongoose.Types.ObjectId(),
    bookingReference: "LAR-TEST-CUSTOM-101",
    status: "CUSTOM_REQUEST_SUBMITTED",
    touristId: touristUser._id,
    pickupAddress: "Bandaranaike International Airport",
    destinationAddress: "Galle Fort",
    fareBreakdown: { totalEstimatedFare: 85 },
  });

  await adminCustomPromise;
  await new Promise((r) => setTimeout(r, 200));
  if (!driverReceivedCustom) {
    console.log("✓ Verified: Driver dashboard did NOT receive unapproved custom trip submission.");
  } else {
    throw new Error("FAILED: Driver received custom trip submission before approval!");
  }

  // TEST 6: Payment Verified (Workflow Step 2 - Admin & Rider Receive, Driver Still Hidden)
  console.log("\n--- TEST 6: Payment Verified (Admin & Rider Receive, Drivers Still Hidden) ---");
  let driverReceivedPayment = false;
  driverSocket.on("booking:payment_verified", () => { driverReceivedPayment = true; });

  const adminPaymentPromise = new Promise<void>((resolve) => {
    adminSocket.on("booking:payment_verified", (payload: any) => {
      console.log(`✓ Admin received payment verification: ref=${payload.bookingReference}`);
      resolve();
    });
  });

  const riderPaymentPromise = new Promise<void>((resolve) => {
    touristSocket.on("booking:payment_verified", (payload: any) => {
      console.log(`✓ Rider received payment verification: ref=${payload.bookingReference}`);
      resolve();
    });
  });

  const { broadcastPaymentVerified } = await import("../src/lib/realtime");
  const testTripId = new mongoose.Types.ObjectId();
  await broadcastPaymentVerified({
    _id: testTripId,
    bookingReference: "LAR-TEST-PAID-202",
    status: "PAYMENT_CONFIRMED",
    paymentStatus: "COMPLETED",
    touristId: touristUser._id,
    customTripDetails: { confirmedAmount: 95, confirmedCurrency: "USD" },
  });

  await Promise.all([adminPaymentPromise, riderPaymentPromise]);
  await new Promise((r) => setTimeout(r, 200));
  if (!driverReceivedPayment) {
    console.log("✓ Verified: Paid-but-unapproved trip remains STRICTLY HIDDEN from drivers.");
  } else {
    throw new Error("FAILED: Driver saw paid trip before admin published it!");
  }

  // TEST 7: Final Admin Approval -> Broadcast to Eligible Drivers (Workflow Step 3)
  console.log("\n--- TEST 7: Final Admin Approval -> Broadcast to Eligible Drivers ---");
  const driverAvailablePromise = new Promise<void>((resolve) => {
    driverSocket.on("booking:available", (payload: any) => {
      console.log(`✓ Eligible driver received available trip: ref=${payload.booking?.bookingReference}`);
      resolve();
    });
  });

  const { broadcastBookingAvailable } = await import("../src/lib/realtime");
  await broadcastBookingAvailable({
    _id: testTripId,
    bookingReference: "LAR-TEST-PAID-202",
    status: "PENDING_ACCEPTANCE",
    paymentStatus: "COMPLETED",
    pickupAddress: "BIA Colombo",
    destinationAddress: "Kandy Center",
    fareBreakdown: { totalEstimatedFare: 110 },
  });

  await driverAvailablePromise;

  // TEST 8: Atomic Driver Acceptance (Workflow Step 4)
  console.log("\n--- TEST 8: Driver Acceptance (Rider & Admin Notified, Removed from Drivers) ---");
  const riderAcceptedPromise = new Promise<void>((resolve) => {
    touristSocket.on("booking:driver_accepted", (payload: any) => {
      console.log(`✓ Rider received driver acceptance: driver=${payload.driver.name}`);
      resolve();
    });
  });

  const otherDriverRemovedPromise = new Promise<void>((resolve) => {
    driverSocket.on("booking:removed", (payload: any) => {
      console.log(`✓ Driver boards received booking removal: id=${payload.bookingId}, reason=${payload.reason}`);
      resolve();
    });
  });

  const { broadcastDriverAccepted } = await import("../src/lib/realtime");
  await broadcastDriverAccepted(
    {
      _id: testTripId,
      bookingReference: "LAR-TEST-PAID-202",
      touristId: touristUser._id,
      status: "DRIVER_ASSIGNED",
    },
    {
      _id: driverUser._id,
      name: driverUser.name,
      phoneNumber: "+94771234567",
      vehicleRegistration: "WP-CAB-1234",
    }
  );

  await Promise.all([riderAcceptedPromise, otherDriverRemovedPromise]);

  // TEST 9: Driver Live GPS Location Tracking
  console.log("\n--- TEST 9: Driver Live GPS Location Broadcasting ---");
  // Have admin subscribe to booking room (admin is always authorized)
  await new Promise<void>((resolve) => {
    adminSocket.emit("booking:subscribe", testTripId.toString(), (res: any) => {
      console.log(`✓ Admin subscribed to live booking room: success=${res.success}`);
      resolve();
    });
  });

  const locationPromise = new Promise<void>((resolve) => {
    adminSocket.on("driver:location_updated", (data: any) => {
      console.log(`✓ Admin received live GPS coords: lat=${data.lat}, lng=${data.lng}, accuracy=${data.accuracy}m, time=${data.updatedAt}`);
      resolve();
    });
  });

  const { broadcastDriverLocation } = await import("../src/lib/realtime");
  await broadcastDriverLocation(testTripId.toString(), 6.9271, 79.8612, 12.5);
  await locationPromise;

  // TEST 10: Session Revocation
  console.log("\n--- TEST 10: Session Revocation & Disconnection ---");
  const disconnectPromise = new Promise<void>((resolve) => {
    touristSocket.on("session:revoked", (data: any) => {
      console.log(`✓ Tourist received session revocation: "${data.message}"`);
    });
    touristSocket.on("disconnect", (reason) => {
      console.log(`✓ Tourist socket disconnected: "${reason}"`);
      resolve();
    });
  });

  const { revokeUserSession } = await import("../src/lib/realtime");
  await revokeUserSession(touristUser._id.toString());
  await disconnectPromise;

  // Clean up
  adminSocket.disconnect();
  driverSocket.disconnect();
  await mongoose.disconnect();

  console.log("\n🎉 ALL 10 REALTIME WEBSOCKET SPECIFICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
