import "dotenv/config";
import mongoose from "mongoose";
import Booking from "../src/models/Booking";
import User from "../src/models/User";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";

async function releaseAssignment() {
  await mongoose.connect(MONGODB_URI);

  const driverEmail = "rmnlakshan@gmail.com";
  const driver = await User.findOne({ email: driverEmail });

  if (!driver) {
    console.error(`Driver ${driverEmail} not found!`);
    await mongoose.disconnect();
    return;
  }

  console.log(`=== RELEASING BLOCKING ASSIGNMENT FOR DRIVER: ${driver.name} (${driver.email}) ===`);
  console.log(`Driver ID: ${driver._id.toString()}`);

  const activeTripStatuses = [
    "CONFIRMED",
    "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED",
    "PASSENGER_PICKED_UP",
    "TRIP_IN_PROGRESS",
  ];

  const assignedBookings = await Booking.find({
    driverId: driver._id,
    status: { $in: activeTripStatuses as any },
  }).sort({ createdAt: 1 });

  console.log(`Found ${assignedBookings.length} active-status bookings assigned to this driver:`);

  const corrections: any[] = [];
  let genuineActiveTripRemaining: any = null;

  for (const b of assignedBookings) {
    const ref = b.bookingReference;
    const status = b.status;
    const isUnstarted = status === "DRIVER_ASSIGNED";
    const isInProgress = ["PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS", "DRIVER_ARRIVED"].includes(status);
    const isStaleEnRoute = status === "DRIVER_EN_ROUTE" && b.dispatchStatus === "SEARCHING";

    console.log(`\n- Booking Ref: ${ref}, Status: ${status}, DispatchStatus: ${b.dispatchStatus}`);

    if (isInProgress) {
      // Per instructions: "If it is already in progress, report its exact reference/status rather than marking it completed or cancelled without instruction."
      console.log(`  -> Trip is ALREADY IN PROGRESS (${status}). Preserving as genuine active trip; NOT marking completed or cancelled without instruction.`);
      genuineActiveTripRemaining = { ref, status, id: b._id.toString() };
      corrections.push({
        ref,
        status,
        action: "REPORTED_IN_PROGRESS",
        notes: `Trip is currently in progress (${status}). Preserved without altering status or deleting records.`,
      });
    } else if (isUnstarted || isStaleEnRoute) {
      // Per instructions: "If it is an unstarted trip, unassign the driver and preserve the trip for admin management; do not silently redispatch an old request."
      console.log(`  -> Unstarted trip assignment. Unassigning driver and preserving for admin management.`);
      
      b.driverId = undefined;
      b.driverLocation = undefined;
      b.status = "CONFIRMED"; // Returned to confirmed pool for admin assignment
      if (b.dispatchStatus === "SEARCHING" || b.dispatchStatus === "OFFERED") {
        b.dispatchStatus = undefined; // Do not silently redispatch
      }
      await b.save();

      corrections.push({
        ref,
        status: "CONFIRMED (Unassigned)",
        previousStatus: status,
        action: "UNASSIGNED_DRIVER_PRESERVED_FOR_ADMIN",
        notes: `Unassigned driver ${driver.email}, cleared driverLocation, reset to CONFIRMED. Preserved booking, payment, and audit history. Not redispatched.`,
      });
    }
  }

  // Check remaining active trips for driver
  const remainingActiveCount = await Booking.countDocuments({
    driverId: driver._id,
    status: { $in: activeTripStatuses as any },
  });

  console.log(`\n=== CORRECTION SUMMARY ===`);
  console.log(JSON.stringify(corrections, null, 2));

  if (remainingActiveCount === 0) {
    console.log(`\nNo genuine active trips remain for ${driver.email}. Driver availability is FULLY RESTORED.`);
  } else {
    console.log(`\nDriver still has ${remainingActiveCount} genuine in-progress trip: ${genuineActiveTripRemaining?.ref} (${genuineActiveTripRemaining?.status}). Driver availability correctly reflects in-progress state.`);
  }

  await mongoose.disconnect();
}

releaseAssignment().catch(console.error);
