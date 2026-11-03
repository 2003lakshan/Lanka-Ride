import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import dbConnect from "../src/lib/mongodb";
import Booking from "../src/models/Booking";
import User from "../src/models/User";

async function main() {
  await dbConnect();

  const booking = await Booking.findOne({ bookingReference: /PKM-MOB-1793590719651/ }).lean();
  console.log("=== BOOKING PKM-MOB-1793590719651 ===");
  if (booking) {
    console.log({
      id: booking._id,
      ref: booking.bookingReference,
      status: booking.status,
      dispatchStatus: (booking as any).dispatchStatus,
      dispatchExpiresAt: (booking as any).dispatchExpiresAt,
      driverId: booking.driverId,
      pickupAddress: booking.pickupAddress,
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      vehicleCategory: (booking as any).vehicleCategory,
      pickMeCategory: booking.pickMeDetails?.vehicleCategory,
      rejectedDriverIds: booking.rejectedDriverIds,
      createdAt: (booking as any).createdAt,
    });
  } else {
    console.log("Not found by exact ref, searching latest bookings...");
    const latest = await Booking.find().sort({ createdAt: -1 }).limit(5).lean();
    console.log(latest.map(b => ({ id: b._id, ref: b.bookingReference, status: b.status, dispatchStatus: (b as any).dispatchStatus, type: b.bookingType, pickMe: b.pickMeDetails?.isPickMe })));
  }

  console.log("\n=== ALL ACTIVE TRIPS IN DB ===");
  const activeTrips = await Booking.find({
    status: { $in: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"] }
  }).lean();
  console.log(activeTrips.map(t => ({
    id: t._id,
    ref: t.bookingReference,
    status: t.status,
    driverId: t.driverId,
    pickup: t.pickupAddress,
    destination: t.destinationAddress,
  })));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
