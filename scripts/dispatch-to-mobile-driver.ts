import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";
import dbConnect from "../src/lib/mongodb";
import Booking from "../src/models/Booking";
import User from "../src/models/User";
import { dispatchLocalRideOffer, getEligibleActiveOffersForDriver } from "../src/lib/nearbyDispatch";

async function main() {
  console.log("=== PREPARING DRIVER AND DISPATCHING PKM-MOB-1793590719651 ===");
  await dbConnect();

  const driverEmail = "rmnlakshan@gmail.com";
  const driver = await User.findOne({ email: driverEmail });
  if (!driver) {
    console.error(`Driver ${driverEmail} not found!`);
    process.exit(1);
  }

  console.log(`Driver found: ${driver.name} (ID: ${driver._id.toString()})`);

  // 1. Complete conflicting trip CT-OUWR4R so driver is free for incoming rides
  const completedConflict = await Booking.updateMany(
    {
      driverId: driver._id,
      status: { $in: ["PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"] }
    },
    {
      $set: {
        status: "COMPLETED",
        completedAt: new Date()
      }
    }
  );
  console.log(`✓ Completed ${completedConflict.modifiedCount} conflicting active trips for driver`);

  // 2. Refresh driver online state and GPS location
  driver.isOnline = true;
  driver.isApproved = true;
  driver.vehicleCategory = "Car";
  driver.currentLat = 6.9344;
  driver.currentLng = 79.8428;
  driver.locationUpdatedAt = new Date();
  await driver.save();
  console.log(`✓ Driver status updated: Online, Approved, GPS fresh at (${driver.currentLat}, ${driver.currentLng})`);

  // 3. Find booking PKM-MOB-1793590719651
  const booking = await Booking.findOne({ bookingReference: /PKM-MOB-1793590719651/ });
  if (!booking) {
    console.error("Booking PKM-MOB-1793590719651 not found!");
    process.exit(1);
  }

  // 4. Reset booking to PENDING, unassigned, unrejected, with 10-minute expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  booking.status = "PENDING";
  booking.driverId = undefined as any;
  booking.rejectedDriverIds = [];
  booking.dispatchStatus = "SEARCHING";
  booking.dispatchExpiresAt = expiresAt;
  booking.pickupLat = 6.9344;
  booking.pickupLng = 79.8428;
  booking.pickupAddress = "Colombo Fort Station, Olcott Mawatha";
  booking.destinationAddress = "Galle Face Hotel, 2 Galle Road, Colombo 03";
  booking.destinationLat = 6.9202;
  booking.destinationLng = 79.8436;
  (booking as any).vehicleCategory = "Car";
  if (!booking.pickMeDetails) {
    booking.pickMeDetails = {} as any;
  }
  booking.pickMeDetails!.vehicleCategory = "Car";
  booking.pickMeDetails!.estimatedFare = 1850;
  booking.pickMeDetails!.isPickMe = true;
  await booking.save();
  console.log(`✓ Booking PKM-MOB-1793590719651 reset to PENDING with expiry in 10 mins`);

  // 5. Trigger dispatchLocalRideOffer
  const dispatchRes = await dispatchLocalRideOffer(booking);
  console.log("✓ Dispatch result:", dispatchRes);

  // 6. Check active offers for this driver
  const activeOffers = await getEligibleActiveOffersForDriver(driver._id.toString());
  console.log(`✓ Active offers returned for driver: ${activeOffers.length}`);
  if (activeOffers.length > 0) {
    console.log("  Offer details:", {
      bookingReference: activeOffers[0].bookingReference,
      passengerName: activeOffers[0].passengerName,
      pickup: activeOffers[0].pickupLocation?.address,
      fare: activeOffers[0].estimatedFare,
      vehicle: activeOffers[0].vehicleCategory,
      expiresAt: new Date(activeOffers[0].expiresAt).toLocaleTimeString(),
    });
  }

  console.log("\n===============================================================================");
  console.log("   POPUP CARD OFFER IS NOW ACTIVE FOR DRIVER!                                  ");
  console.log("   The driver's phone (http://2.168.8.100:3000) will immediately show the card!");
  console.log("===============================================================================");
  process.exit(0);
}

main().catch(e => {
  console.error("Dispatch error:", e);
  process.exit(1);
});
