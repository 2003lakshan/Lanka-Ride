import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";
import { encode } from "next-auth/jwt";
import { io } from "socket.io-client";
import User from "../src/models/User";
import { broadcastRideOffer } from "../src/lib/realtime";

async function main() {
  console.log("=== VERIFYING REALTIME NOTIFICATION OVER CLOUDFLARE TUNNEL ===");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride");

  const driver = await User.findOne({ email: "browser_driver@example.com" });
  if (!driver) {
    console.error("Driver browser_driver@example.com not found!");
    process.exit(1);
  }

  const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
  const token = await encode({
    token: {
      id: driver._id.toString(),
      name: driver.name,
      email: driver.email,
      role: driver.role,
      isApproved: Boolean(driver.isApproved),
      sessionVersion: driver.sessionVersion || 0,
    },
    secret,
  });

  const socketUrl = "https://puts-essentially-unknown-continent.trycloudflare.com";
  console.log(`[Test] Connecting to: ${socketUrl}`);

  const socket = io(socketUrl, {
    auth: { token },
    transports: ["websocket"],
    timeout: 5000,
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout connecting to Socket.IO server"));
    }, 8000);

    socket.on("connect", () => {
      clearTimeout(timer);
      console.log(`✓ [Socket.IO] Connected! ID=${socket.id}, Transport=${socket.io.engine.transport.name}`);
      resolve();
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  // Listen for ride:offer event
  const receivedOfferPromise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout waiting for realtime ride:offer event"));
    }, 8000);

    socket.on("ride:offer", (data) => {
      clearTimeout(timer);
      console.log("✓ [Socket.IO] Received 'ride:offer' event:", data.bookingReference, data.vehicleCategory, data.pickupAddress);
      resolve(data);
    });
  });

  // Dispatch offer via Next.js backend realtime broadcast
  console.log("[Test] Dispatching ride offer through backend realtime broadcast...");
  await broadcastRideOffer(driver._id.toString(), {
    bookingId: new mongoose.Types.ObjectId().toString(),
    bookingReference: `TEST-RT-${Date.now().toString().slice(-4)}`,
    pickupAddress: "Bandaranaike International Airport",
    pickupLat: 7.1808,
    pickupLng: 79.8841,
    destinationAddress: "Galle Face Green, Colombo",
    destinationLat: 6.9271,
    destinationLng: 79.8612,
    distanceKm: 34.5,
    estimatedFare: 4500,
    vehicleCategory: "Car",
    driverDistanceKm: 1.2,
    driverDurationMins: 3,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    expiresInSeconds: 60,
  });

  const receivedOffer = await receivedOfferPromise;
  console.log(`✓ [Realtime] Verified delivery of ride offer ${receivedOffer.bookingReference} over tunnel!`);

  socket.disconnect();
  await mongoose.disconnect();
  console.log("=== ALL NOTIFICATION DELIVERY CHECKS PASSED ===");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
