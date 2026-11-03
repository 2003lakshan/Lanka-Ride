import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import dbConnect from "../src/lib/mongodb";
import User from "../src/models/User";
import Booking from "../src/models/Booking";

async function main() {
  await dbConnect();

  const drivers = await User.find({ role: "DRIVER" }).lean();
  console.log(`Found ${drivers.length} drivers:`);

  const activeTripStatuses = [
    "CONFIRMED",
    "DRIVER_ASSIGNED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED",
    "PASSENGER_PICKED_UP",
    "TRIP_IN_PROGRESS",
  ];

  for (const d of drivers) {
    const activeTrips = await Booking.find({
      driverId: d._id,
      status: { $in: activeTripStatuses as any },
    }).select("bookingReference status").lean();

    const locationAgeMin = d.locationUpdatedAt
      ? ((Date.now() - new Date(d.locationUpdatedAt).getTime()) / 60000).toFixed(1)
      : "N/A";

    console.log({
      id: d._id.toString(),
      name: d.name,
      email: d.email,
      isApproved: d.isApproved,
      isOnline: d.isOnline,
      vehicleCategory: d.vehicleCategory,
      currentLat: d.currentLat,
      currentLng: d.currentLng,
      locationUpdatedAt: d.locationUpdatedAt,
      locationAgeMin,
      activeTripsCount: activeTrips.length,
      activeTrips: activeTrips.map((t) => `${t.bookingReference} (${t.status})`),
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
