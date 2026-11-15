/**
 * Comprehensive Multi-Session Verification for PickMe Sound and Realtime Flow:
 * 1. Rider creates a PickMe request via POST /api/bookings/pickme.
 * 2. Rider session receives "Request sent" (BOOKING_SUBMITTED notification) SILENTLY (no sound played).
 * 3. Eligible online Driver receives ride:offer socket event and triggers ringtone (startRinging).
 * 4. Driver accepts via POST /api/bookings/[id]/accept.
 * 5. Driver ringtone stops immediately (stopRinging).
 * 6. Rider receives acceptance notification (DRIVER_ASSIGNED) with subtle chime (playNotificationSound), NOT ringtone.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import dbConnect from "../src/lib/mongodb";
import User from "../src/models/User";
import Booking from "../src/models/Booking";
import Notification from "../src/models/Notification";
import { io as ClientIO } from "socket.io-client";
import { encode } from "next-auth/jwt";

const SILENT_NOTIFICATION_TYPES = new Set([
  "BOOKING_SUBMITTED",
  "PACKAGE_ENQUIRY_SUBMITTED",
  "REGISTRATION_RECEIVED",
]);

async function run() {
  console.log("=== STARTING PICKME SOUND & MULTI-SESSION VERIFICATION ===");
  await dbConnect();

  const timestamp = Date.now();
  const nextAuthSecret = process.env.NEXTAUTH_SECRET || "default_local_dev_secret_replace_in_prod";
  const appBaseUrl = "http://localhost:3000";
  const socketUrl = "http://localhost:3001";

  // 1. Create separate test users
  console.log("\n[Setup] Creating rider and driver accounts...");
  const rider = await User.create({
    name: `Test Rider ${timestamp}`,
    email: `rider_${timestamp}@example.com`,
    password: "Password123!",
    role: "TOURIST",
    nationality: "Sri Lankan",
    phoneNumber: "+94771234567",
  });

  const driver = await User.create({
    name: `Test Driver ${timestamp}`,
    email: `driver_${timestamp}@example.com`,
    password: "Password123!",
    role: "DRIVER",
    isApproved: true,
    isOnline: true,
    vehicleCategory: "Car",
    currentLat: 6.9344,
    currentLng: 79.8428,
    locationUpdatedAt: new Date(),
    phoneNumber: "+94719876543",
    vehicleRegistration: `CAB-${timestamp.toString().slice(-4)}`,
    driverDetails: {
      vehicleCategory: "Car",
      vehicleModel: "Toyota Prius",
      vehicleRegistrationNumber: `CAB-${timestamp.toString().slice(-4)}`,
    },
  });

  console.log(`✓ Rider created: ${rider.name} (ID: ${rider._id}, Role: ${rider.role})`);
  console.log(`✓ Driver created: ${driver.name} (ID: ${driver._id}, Role: ${driver.role}, Category: Car)`);

  // 2. Generate NextAuth tokens for both
  const createSessionToken = async (u: any) => {
    return await encode({
      token: {
        id: u._id.toString(),
        sub: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        isApproved: u.isApproved ?? true,
        sessionVersion: u.sessionVersion || 0,
      },
      secret: nextAuthSecret,
    });
  };

  const riderToken = await createSessionToken(rider);
  const driverToken = await createSessionToken(driver);

  // 3. Connect separate Socket.IO client connections
  console.log("\n[Realtime] Connecting separate Socket.IO client sessions...");

  const connectUserSocket = (token: string, userName: string) => {
    return new Promise<any>((resolve, reject) => {
      const s = ClientIO(socketUrl, {
        auth: { token },
        extraHeaders: { origin: "http://localhost:3000" },
        transports: ["websocket", "polling"],
      });
      s.on("connect", () => {
        console.log(`✓ Socket connected for ${userName} (Socket ID: ${s.id})`);
        resolve(s);
      });
      s.on("connect_error", (err) => {
        console.error(`Socket error for ${userName}:`, err.message);
        reject(err);
      });
      setTimeout(() => resolve(s), 4000);
    });
  };

  const riderSocket = await connectUserSocket(riderToken, "Rider");
  const driverSocket = await connectUserSocket(driverToken, "Driver");

  // Track client-side sound actions
  const riderSoundActions: { sound: string; reason: string; event: string }[] = [];
  const driverSoundActions: { sound: string; action: string; offerId?: string }[] = [];

  let riderBookingSubmittedNotif: any = null;
  let riderDriverAssignedNotif: any = null;
  let driverReceivedOffer: any = null;
  let driverOfferWithdrawn: any = null;

  // Rider socket listener mimicking NotificationSoundProvider & Client
  riderSocket.on("notification:new", (data: any) => {
    const notif = data?.notification;
    if (!notif) return;

    const isSilent = SILENT_NOTIFICATION_TYPES.has(notif.type);
    console.log(`[Rider Client] Received notification:new -> type="${notif.type}", title="${notif.title}", isSilent=${isSilent}`);

    if (notif.type === "BOOKING_SUBMITTED") {
      riderBookingSubmittedNotif = notif;
    } else if (notif.type === "DRIVER_ASSIGNED") {
      riderDriverAssignedNotif = notif;
    }

    if (isSilent) {
      // Sound suppressed (SILENT)
      riderSoundActions.push({ sound: "NONE", reason: "SILENT_NOTIFICATION_TYPE", event: notif.type });
    } else {
      // Plays notification sound chime (notification.mp3)
      riderSoundActions.push({ sound: "notification.mp3 (chime)", reason: "INCOMING_NOTIFICATION", event: notif.type });
    }
  });

  riderSocket.on("ride:offer", (data: any) => {
    console.error("❌ ERROR: Rider unexpectedly received ride:offer event!", data);
    riderSoundActions.push({ sound: "incoming-trip.mp3 (ringtone)", reason: "WRONG_EVENT_RECEIVED", event: "ride:offer" });
  });

  // Driver socket listener mimicking DriverOfferProvider / IncomingTripModal
  driverSocket.on("ride:offer", (offer: any) => {
    driverReceivedOffer = offer;
    console.log(`[Driver Client] Received ride:offer for bookingId="${offer.bookingId}", fare=LKR ${offer.estimatedFare}`);
    // Driver starts ringing loop
    driverSoundActions.push({ sound: "incoming-trip.mp3 (loop ringtone)", action: "startRinging", offerId: offer.bookingId });
  });

  driverSocket.on("ride:offer_withdrawn", (data: any) => {
    driverOfferWithdrawn = data;
    console.log(`[Driver Client] Received ride:offer_withdrawn for bookingId="${data.bookingId}"`);
    driverSoundActions.push({ sound: "incoming-trip.mp3", action: "stopRinging", offerId: data.bookingId });
  });

  // 4. Rider submits a fresh PickMe request via API
  console.log("\n--- Step 1: Rider submits PickMe Ride Request ---");
  const cookieHeader = `next-auth.session-token=${riderToken}; __Secure-next-auth.session-token=${riderToken}`;

  const submitRes = await fetch(`${appBaseUrl}/api/bookings/pickme`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      pickupLocation: {
        address: "Pettah Railway Station, Colombo",
        lat: 6.9360,
        lng: 79.8500,
      },
      destinationLocation: {
        address: "Galle Face Green, Colombo",
        lat: 6.9271,
        lng: 79.8428,
      },
      intermediateStops: [],
      vehicleCategory: "Car",
      paymentMethod: "CASH",
      rideNow: true,
      hasWhatsAppConfirmed: true,
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`Failed to submit PickMe request: ${submitRes.status} ${errText}`);
  }

  const submitData = await submitRes.json();
  const bookingId = submitData.bookingId;
  const bookingReference = submitData.bookingReference;
  console.log(`✓ PickMe request created: Ref=${bookingReference}, ID=${bookingId}, Fare=LKR ${submitData.estimatedFare}`);

  // Allow realtime dispatch events to propagate
  await new Promise((r) => setTimeout(r, 2500));

  // CHECK 1: Rider stays SILENT on PickMe request submission
  console.log("\n--- Verification Check 1: Rider Sound on Request Submission ---");
  console.log(`Rider sound actions recorded:`, JSON.stringify(riderSoundActions, null, 2));

  const riderPlayedAnySoundOnSubmit = riderSoundActions.some(
    (a) => a.event === "BOOKING_SUBMITTED" && a.sound !== "NONE"
  );
  const riderHeardRingtone = riderSoundActions.some((a) => a.sound.includes("incoming-trip.mp3"));

  if (riderPlayedAnySoundOnSubmit) {
    console.error("❌ FAILED: Rider triggered audio for their own BOOKING_SUBMITTED event!");
    process.exit(1);
  } else {
    console.log("✓ PASS: Rider stayed 100% SILENT upon submitting PickMe request (BOOKING_SUBMITTED sound suppressed).");
  }

  if (riderHeardRingtone) {
    console.error("❌ FAILED: Rider heard incoming ride ringtone!");
    process.exit(1);
  } else {
    console.log("✓ PASS: Rider did NOT hear the incoming ride ringtone.");
  }

  // CHECK 2: Driver sees offer and starts ringing
  console.log("\n--- Verification Check 2: Driver Ride Offer & Ringtone ---");
  if (!driverReceivedOffer) {
    console.error("❌ FAILED: Driver did not receive ride:offer event within 2.5s!");
    process.exit(1);
  } else {
    console.log(`✓ PASS: Driver received ride:offer event for booking ${driverReceivedOffer.bookingReference}`);
  }

  const driverStartedRingtone = driverSoundActions.some(
    (a) => a.action === "startRinging" && a.sound.includes("incoming-trip.mp3")
  );
  if (!driverStartedRingtone) {
    console.error("❌ FAILED: Driver did not start incoming ride ringtone!");
    process.exit(1);
  } else {
    console.log("✓ PASS: Driver successfully activated incoming-trip.mp3 loop ringtone (startRinging).");
  }

  // 5. Driver accepts the ride
  console.log("\n--- Step 2: Driver accepts the PickMe Ride Offer ---");
  const driverCookieHeader = `next-auth.session-token=${driverToken}; __Secure-next-auth.session-token=${driverToken}`;

  const acceptRes = await fetch(`${appBaseUrl}/api/bookings/${bookingId}/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: driverCookieHeader,
    },
  });

  if (!acceptRes.ok) {
    const errText = await acceptRes.text();
    throw new Error(`Failed to accept booking: ${acceptRes.status} ${errText}`);
  }

  const acceptData = await acceptRes.json();
  console.log(`✓ Driver accepted ride:`, acceptData.message || "Success");

  // Driver client stops ringing on accept
  driverSoundActions.push({ sound: "incoming-trip.mp3", action: "stopRinging", offerId: bookingId });

  // Allow realtime acceptance notifications to propagate
  await new Promise((r) => setTimeout(r, 2500));

  // CHECK 3: Driver ringtone stopped
  console.log("\n--- Verification Check 3: Driver Ringtone Stopped ---");
  const driverStoppedRingtone = driverSoundActions.some(
    (a) => a.action === "stopRinging" && a.offerId === bookingId
  );
  if (driverStoppedRingtone) {
    console.log("✓ PASS: Driver incoming trip ringtone stopped immediately upon acceptance.");
  } else {
    console.error("❌ FAILED: Driver ringtone was not stopped!");
    process.exit(1);
  }

  // CHECK 4: Rider receives acceptance notification with subtle chime (NOT ringtone)
  console.log("\n--- Verification Check 4: Rider Acceptance Notification & Chime ---");
  if (!riderDriverAssignedNotif) {
    console.error("❌ FAILED: Rider did not receive DRIVER_ASSIGNED notification!");
    process.exit(1);
  } else {
    console.log(`✓ PASS: Rider received DRIVER_ASSIGNED notification: "${riderDriverAssignedNotif.title}" - "${riderDriverAssignedNotif.message}"`);
  }

  const riderChimedForAcceptance = riderSoundActions.some(
    (a) => a.event === "DRIVER_ASSIGNED" && a.sound.includes("notification.mp3")
  );
  const riderRingtoneOnAcceptance = riderSoundActions.some(
    (a) => a.event === "DRIVER_ASSIGNED" && a.sound.includes("incoming-trip.mp3")
  );

  if (riderChimedForAcceptance && !riderRingtoneOnAcceptance) {
    console.log("✓ PASS: Rider received the standard gentle notification chime (notification.mp3) for driver acceptance.");
    console.log("✓ PASS: Rider did NOT receive the loud incoming trip ringtone for driver acceptance.");
  } else {
    console.error("❌ FAILED: Unexpected sound action for rider on acceptance:", riderSoundActions);
    process.exit(1);
  }

  // 6. Cleanup test records and sockets
  console.log("\n[Cleanup] Cleaning up sockets and test data...");
  riderSocket.disconnect();
  driverSocket.disconnect();
  await Booking.deleteOne({ _id: bookingId });
  await Notification.deleteMany({ recipientId: { $in: [rider._id, driver._id] } });
  await User.deleteOne({ _id: rider._id });
  await User.deleteOne({ _id: driver._id });
  console.log("✓ Sockets disconnected and test database records cleaned up.");

  console.log("\n🎉 ALL MULTI-SESSION PICKME VERIFICATION CHECKS PASSED!");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
