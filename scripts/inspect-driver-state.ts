import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User";
import Booking from "../src/models/Booking";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";

async function check() {
  await mongoose.connect(MONGODB_URI);

  const drivers = await User.find({ role: "DRIVER" }).lean();
  console.log("=== DRIVERS ===");
  for (const d of drivers) {
    console.log({
      id: d._id.toString(),
      name: d.name,
      email: d.email,
      isApproved: d.isApproved,
      isOnline: d.isOnline,
      vehicleCategory: d.vehicleCategory,
      vehicleRegistration: d.vehicleRegistration,
      currentLat: d.currentLat,
      currentLng: d.currentLng,
      locationUpdatedAt: d.locationUpdatedAt,
    });
  }

  const activeTripStatuses = [
    "CONFIRMED",
    "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED",
    "PASSENGER_PICKED_UP",
    "TRIP_IN_PROGRESS",
  ];

  console.log("\n=== ALL BOOKINGS ASSIGNED TO ANY DRIVER ===");
  const assignedBookings = await Booking.find({
    driverId: { $ne: null },
  })
    .populate("driverId touristId")
    .sort({ updatedAt: -1 })
    .lean();

  for (const b of assignedBookings) {
    const driver = b.driverId as any;
    console.log({
      id: b._id.toString(),
      ref: b.bookingReference,
      status: b.status,
      dispatchStatus: b.dispatchStatus,
      bookingType: b.bookingType,
      driverName: driver?.name,
      driverEmail: driver?.email,
      driverId: driver?._id?.toString(),
      pickup: b.pickupAddress,
      destination: b.destinationAddress,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    });
  }

  console.log("\n=== ACTIVE STATUS BOOKINGS (status in activeTripStatuses) ===");
  const activeBookings = await Booking.find({
    status: { $in: activeTripStatuses as any },
  })
    .populate("driverId touristId")
    .sort({ updatedAt: -1 })
    .lean();

  for (const b of activeBookings) {
    const driver = b.driverId as any;
    console.log({
      id: b._id.toString(),
      ref: b.bookingReference,
      status: b.status,
      dispatchStatus: b.dispatchStatus,
      bookingType: b.bookingType,
      driver: driver ? `${driver.name} (${driver.email})` : "UNASSIGNED",
      driverId: driver?._id?.toString(),
      pickup: b.pickupAddress,
      destination: b.destinationAddress,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    });
  }

  await mongoose.disconnect();
}

check().catch(console.error);
