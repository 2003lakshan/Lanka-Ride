import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import dbConnect from "../src/lib/mongodb";
import Booking from "../src/models/Booking";

async function main() {
  await dbConnect();

  const b = await Booking.findOne({ bookingReference: "CT-OUWR4R" });
  console.log("CT-OUWR4R audit before restoration:", b ? {
    id: b._id,
    ref: b.bookingReference,
    status: b.status,
    driverId: b.driverId,
    completedAt: b.completedAt,
  } : "Not found");

  if (b) {
    b.status = "PASSENGER_PICKED_UP";
    b.completedAt = undefined;
    await b.save();
    console.log("Restored CT-OUWR4R to PASSENGER_PICKED_UP");
  }

  const restored = await Booking.findOne({ bookingReference: "CT-OUWR4R" }).lean();
  console.log("CT-OUWR4R verified state:", {
    ref: restored?.bookingReference,
    status: restored?.status,
    driverId: restored?.driverId,
  });

  // Also restore PKM-MOB-1793590719651 to its original expired state
  const pkm = await Booking.findOne({ bookingReference: /PKM-MOB-1793590719651/ });
  if (pkm) {
    pkm.dispatchStatus = "EXPIRED";
    pkm.dispatchExpiresAt = new Date("2026-11-02T03:39:04.669Z");
    await pkm.save();
    console.log("Restored PKM-MOB-1793590719651 to original expired state");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
