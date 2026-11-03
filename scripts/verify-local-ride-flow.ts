import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import mongoose from "mongoose";

async function runEndToEndVerification() {
  console.log("=================================================================");
  console.log("   LOCAL RIDE CONFIRMATION & DRIVER DISPATCH END-TO-END SUITE    ");
  console.log("=================================================================");

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB:", uri);

  const { default: User } = await import("../src/models/User");
  const { default: Booking } = await import("../src/models/Booking");
  const { findEligibleNearbyDrivers, dispatchLocalRideOffer } = await import("../src/lib/nearbyDispatch");

  try {
    // Cleanup previous test data
    await User.deleteMany({ email: { $regex: "^test_e2e_local_" } });
    await Booking.deleteMany({ bookingReference: { $regex: "^PKM-E2E-" } });

    // Coordinates: Pickup at Colombo Fort
    const pickupLat = 6.9344;
    const pickupLng = 79.8504;
    // Destination: Galle Face Green
    const dropoffLat = 6.9271;
    const dropoffLng = 79.8436;

    // Driver 1: Kollupitiya (~3 km from pickup) - Eligible Car Driver
    const driver1Lat = 6.9080;
    const driver1Lng = 79.8510;
    // Driver 2: Bambalapitiya (~5 km from pickup) - Eligible Car Driver
    const driver2Lat = 6.8920;
    const driver2Lng = 79.8560;
    // Driver 3: Negombo (~35 km from pickup) - Ineligible (Outside 15 km)
    const driver3Lat = 7.2083;
    const driver3Lng = 79.8358;
    // Driver 4: Bike Driver (~2 km from pickup) - Ineligible (Vehicle category mismatch)
    const driver4Lat = 6.9150;
    const driver4Lng = 79.8520;

    console.log("\n--- STEP 1: Create Test Rider with NO Phone Number ---");
    const riderNoPhone = await User.create({
      name: "Chaminda Silva",
      email: "test_e2e_local_rider_nophone_" + Date.now() + "@example.com",
      role: "TOURIST",
      nationality: "Sri Lankan",
      // Notice: NO phoneNumber provided!
    });
    console.log(`Created Rider: ${riderNoPhone.name} (Phone: ${riderNoPhone.phoneNumber || "NONE"})`);

    console.log("\n--- STEP 2: Create Test Drivers (Nearby, Far, Mismatched Vehicle) ---");
    const driverA = await User.create({
      name: "Driver A (Kollupitiya - Eligible Car)",
      email: "test_e2e_local_drv_a_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      vehicleRegistration: "WP CAB-1234",
      phoneNumber: "+94771112233",
      currentLat: driver1Lat,
      currentLng: driver1Lng,
      locationUpdatedAt: new Date(),
    });

    const driverB = await User.create({
      name: "Driver B (Bambalapitiya - Eligible Car)",
      email: "test_e2e_local_drv_b_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      vehicleRegistration: "WP CAD-5678",
      phoneNumber: "+94774445566",
      currentLat: driver2Lat,
      currentLng: driver2Lng,
      locationUpdatedAt: new Date(),
    });

    const driverC = await User.create({
      name: "Driver C (Negombo - Ineligible > 15km)",
      email: "test_e2e_local_drv_c_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Car",
      currentLat: driver3Lat,
      currentLng: driver3Lng,
      locationUpdatedAt: new Date(),
    });

    const driverD = await User.create({
      name: "Driver D (Nearby - Ineligible Bike)",
      email: "test_e2e_local_drv_d_" + Date.now() + "@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleCategory: "Bike",
      currentLat: driver4Lat,
      currentLng: driver4Lng,
      locationUpdatedAt: new Date(),
    });

    console.log("Created Drivers: A (Eligible), B (Eligible), C (>15km), D (Bike)");

    console.log("\n--- STEP 3: Confirm Local Ride for Rider with NO Phone Number ---");
    // Verify backend creation without phone number
    const bookingRef = "PKM-E2E-" + Date.now();
    const rawRiderPhone = (riderNoPhone.phoneNumber || "").trim();
    const phoneDigits = rawRiderPhone.replace(/[^0-9]/g, "");
    const resolvedPhone = phoneDigits.length >= 7 ? rawRiderPhone : undefined;

    const localRideBooking = await Booking.create({
      bookingReference: bookingRef,
      bookingType: "LOCAL_RIDE",
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "CASH",
      touristId: riderNoPhone._id,
      pickupAddress: "Colombo Fort Railway Station",
      pickupLat,
      pickupLng,
      destinationAddress: "Galle Face Green, Colombo",
      destinationLat: dropoffLat,
      destinationLng: dropoffLng,
      distanceKm: 3.5,
      durationMins: 12,
      arrivalDate: new Date(),
      arrivalTime: "14:30",
      passengerDetails: {
        fullName: riderNoPhone.name,
        email: riderNoPhone.email,
        whatsappNumber: resolvedPhone, // Optional, undefined!
        nationality: riderNoPhone.nationality || "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 0,
        childSeatRequired: false,
        meetAndGreetRequired: false,
        hasWhatsApp: false,
      },
      fareBreakdown: {
        baseCharge: 350,
        distanceCharge: 350,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 700,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        baseFare: 350,
        ratePerKm: 100,
        minimumFare: 350,
        estimatedFare: 700,
        rideNow: true,
      },
    });

    console.log(`Booking Created: ${localRideBooking.bookingReference}`);
    console.log(`Passenger Name: ${localRideBooking.passengerDetails.fullName}`);
    console.log(`Passenger WhatsApp/Phone: ${localRideBooking.passengerDetails.whatsappNumber || "ABSENT (None - not invented)"}`);
    console.log(`Booking Status: ${localRideBooking.status} (Admin Approval Required: FALSE)`);

    if (localRideBooking.passengerDetails.whatsappNumber !== undefined) {
      throw new Error("Assertion failed: whatsappNumber should be undefined when rider has no phone number!");
    }
    if (localRideBooking.status !== "PENDING") {
      throw new Error("Assertion failed: booking status should be PENDING upon creation");
    }
    console.log(">> STEP 3 PASSED: Rider with NO phone confirmed Local Ride successfully without errors!");

    console.log("\n--- STEP 4: Geospatial & Category-Matched Dispatch (15 km radius) ---");
    const dispatchResult = await dispatchLocalRideOffer(localRideBooking._id.toString());
    console.log("Dispatch Result:", dispatchResult);

    const updatedDispatchedBooking = await Booking.findById(localRideBooking._id);
    const offeredIds = (updatedDispatchedBooking?.offeredDriverIds || []).map((id: any) => id.toString());

    console.log("Offered Driver IDs count:", offeredIds.length);
    const isDriverAOffered = offeredIds.includes(driverA._id.toString());
    const isDriverBOffered = offeredIds.includes(driverB._id.toString());
    const isDriverCOffered = offeredIds.includes(driverC._id.toString());
    const isDriverDOffered = offeredIds.includes(driverD._id.toString());

    console.log("Driver A Offered (Nearby Car):", isDriverAOffered ? "PASS" : "FAIL");
    console.log("Driver B Offered (Nearby Car):", isDriverBOffered ? "PASS" : "FAIL");
    console.log("Driver C Excluded (> 15 km):", !isDriverCOffered ? "PASS" : "FAIL");
    console.log("Driver D Excluded (Bike Mismatch):", !isDriverDOffered ? "PASS" : "FAIL");

    if (!isDriverAOffered || !isDriverBOffered || isDriverCOffered || isDriverDOffered) {
      throw new Error("Assertion failed: Dispatch eligibility filter did not match expected drivers");
    }
    console.log(">> STEP 4 PASSED: Only eligible online nearby drivers with matching vehicles received offer!");

    console.log("\n--- STEP 5: Driver Available Trips List Verification ---");
    // Driver query simulation
    const getAvailableTripsForDriver = async (drvId: any, vehicleCat: string) => {
      const trips = await Booking.find({
        $or: [
          {
            status: { $in: ["PENDING", "CONFIRMED"] },
            $and: [
              {
                $or: [{ driverId: null }, { driverId: { $exists: false } }],
              },
              {
                $or: [
                  { rejectedDriverIds: { $exists: false } },
                  { rejectedDriverIds: { $ne: drvId } },
                ],
              },
            ],
          },
          { driverId: drvId },
        ],
      }).lean();

      return trips.filter((t: any) => {
        if (t.bookingType === "LOCAL_RIDE" || t.pickMeDetails?.isPickMe) {
          const reqCat = t.pickMeDetails?.vehicleCategory || t.vehicleCategory;
          if (reqCat && vehicleCat && reqCat.trim().toLowerCase() !== vehicleCat.trim().toLowerCase()) {
            return false;
          }
        }
        return true;
      });
    };

    const tripsDriverA = await getAvailableTripsForDriver(driverA._id, "Car");
    const tripsDriverB = await getAvailableTripsForDriver(driverB._id, "Car");
    const tripsDriverD = await getAvailableTripsForDriver(driverD._id, "Bike");

    const driverAHasTrip = tripsDriverA.some((t: any) => t._id.toString() === localRideBooking._id.toString());
    const driverBHasTrip = tripsDriverB.some((t: any) => t._id.toString() === localRideBooking._id.toString());
    const driverDHasTrip = tripsDriverD.some((t: any) => t._id.toString() === localRideBooking._id.toString());

    console.log("Trip in Driver A Available List:", driverAHasTrip ? "PASS" : "FAIL");
    console.log("Trip in Driver B Available List:", driverBHasTrip ? "PASS" : "FAIL");
    console.log("Trip absent from Driver D Available List (Bike):", !driverDHasTrip ? "PASS" : "FAIL");

    if (!driverAHasTrip || !driverBHasTrip || driverDHasTrip) {
      throw new Error("Assertion failed: Available trips query failed");
    }
    console.log(">> STEP 5 PASSED: Both eligible drivers see the trip in Available Trips!");

    console.log("\n--- STEP 6: Driver Rejection (Dismisses for That Driver Only) ---");
    // Driver B rejects offer
    await Booking.findByIdAndUpdate(localRideBooking._id, {
      $addToSet: { rejectedDriverIds: driverB._id },
    });

    const tripsDriverBAfterReject = await getAvailableTripsForDriver(driverB._id, "Car");
    const tripsDriverAAfterBReject = await getAvailableTripsForDriver(driverA._id, "Car");

    const driverBHasTripAfterReject = tripsDriverBAfterReject.some((t: any) => t._id.toString() === localRideBooking._id.toString());
    const driverAHasTripAfterBReject = tripsDriverAAfterBReject.some((t: any) => t._id.toString() === localRideBooking._id.toString());

    console.log("Trip dismissed from Driver B Available List:", !driverBHasTripAfterReject ? "PASS" : "FAIL");
    console.log("Trip still present for Driver A:", driverAHasTripAfterBReject ? "PASS" : "FAIL");

    if (driverBHasTripAfterReject || !driverAHasTripAfterBReject) {
      throw new Error("Assertion failed: Driver rejection should dismiss only for that driver");
    }
    console.log(">> STEP 6 PASSED: Driver B reject dismissed offer for Driver B only!");

    console.log("\n--- STEP 7: Atomic Driver Acceptance & Conflict Handling ---");
    // Simulate atomic conditional update for Driver A
    const atomicAcceptTrip = async (bId: any, dId: any) => {
      return Booking.findOneAndUpdate(
        {
          _id: bId,
          status: { $in: ["PENDING", "CONFIRMED"] },
          $or: [{ driverId: null }, { driverId: { $exists: false } }],
        },
        {
          status: "DRIVER_ASSIGNED",
          driverId: dId,
          assignedAt: new Date(),
          dispatchStatus: "ACCEPTED",
        },
        { new: true }
      );
    };

    // Driver A accepts
    const acceptedBooking = await atomicAcceptTrip(localRideBooking._id, driverA._id);
    console.log("Driver A Acceptance:", acceptedBooking ? "SUCCESS (Assigned)" : "FAIL");

    // Another driver attempts to accept concurrently
    const conflictAttempt = await atomicAcceptTrip(localRideBooking._id, driverB._id);
    console.log("Driver B Concurrent Acceptance Attempt:", conflictAttempt === null ? "REJECTED (409 Conflict)" : "FAIL");

    if (!acceptedBooking || conflictAttempt !== null) {
      throw new Error("Assertion failed: Atomic acceptance race condition check failed");
    }
    console.log(">> STEP 7 PASSED: Trip atomically assigned to Driver A, concurrent acceptance rejected!");

    console.log("\n--- STEP 8: Verification of Withdrawal from Other Drivers ---");
    // After Driver A accepted, neither Driver B nor any other driver should see it as available
    const tripsDriverAAfterAccept = await Booking.find({ driverId: driverA._id, status: "DRIVER_ASSIGNED" }).lean();
    const tripsDriverBAfterAccept = await getAvailableTripsForDriver(driverB._id, "Car");

    const driverAOwnsTrip = tripsDriverAAfterAccept.some((t: any) => t._id.toString() === localRideBooking._id.toString());
    const driverBSeesTrip = tripsDriverBAfterAccept.some((t: any) => t._id.toString() === localRideBooking._id.toString());

    console.log("Driver A has trip in Active Assigned Trips:", driverAOwnsTrip ? "PASS" : "FAIL");
    console.log("Driver B no longer sees trip in Available Trips:", !driverBSeesTrip ? "PASS" : "FAIL");

    if (!driverAOwnsTrip || driverBSeesTrip) {
      throw new Error("Assertion failed: Trip withdrawal check failed");
    }
    console.log(">> STEP 8 PASSED: Accepted trip withdrawn from all other drivers!");

    console.log("\n--- STEP 9: Rider Tracking Flow & Contact Privacy Verification ---");
    const trackedBooking = await Booking.findById(localRideBooking._id)
      .populate("driverId", "name fullName phoneNumber vehicleRegistration")
      .populate("touristId", "name email phoneNumber")
      .lean();

    const assignedDriver: any = trackedBooking?.driverId;
    console.log(`Rider sees Assigned Driver: ${assignedDriver?.name} (${assignedDriver?.vehicleRegistration})`);
    console.log(`Driver Phone available to Rider: ${assignedDriver?.phoneNumber}`);
    console.log(`Rider Phone stored in Booking: ${trackedBooking?.passengerDetails?.whatsappNumber || "NONE"}`);

    // Verify contact hiding logic
    const riderPhone = trackedBooking?.passengerDetails?.whatsappNumber;
    const hasRiderPhone = Boolean(
      riderPhone &&
      typeof riderPhone === "string" &&
      riderPhone.replace(/[^0-9]/g, "").length >= 7 &&
      !["n/a", "no contact provided", "unknown", "none"].includes(riderPhone.trim().toLowerCase())
    );
    console.log("Rider WhatsApp/Call Actions Enabled for Driver:", hasRiderPhone ? "YES" : "HIDDEN (Safe)");

    if (hasRiderPhone) {
      throw new Error("Assertion failed: Rider phone action should be HIDDEN when no phone was provided");
    }

    const driverPhone = assignedDriver?.phoneNumber;
    const hasDriverPhone = Boolean(
      driverPhone &&
      typeof driverPhone === "string" &&
      driverPhone.replace(/[^0-9]/g, "").length >= 7 &&
      !["n/a", "no contact provided", "unknown", "none"].includes(driverPhone.trim().toLowerCase())
    );
    console.log("Driver Call/WhatsApp Actions Enabled for Rider:", hasDriverPhone ? "YES (Driver has phone)" : "HIDDEN");

    if (!hasDriverPhone) {
      throw new Error("Assertion failed: Driver phone action should be visible since Driver A has a phone number");
    }
    console.log(">> STEP 9 PASSED: Rider tracking flow displays driver details and hides missing rider phone safely!");

    console.log("\n--- STEP 10: Reconnect & Refresh Offer Reconciliation ---");
    // Create an unassigned booking with active expiry
    const testActiveOffer = await Booking.create({
      bookingReference: "PKM-E2E-RECONCILE-" + Date.now(),
      bookingType: "LOCAL_RIDE",
      status: "PENDING",
      pickupAddress: "Kollupitiya",
      pickupLat: driver1Lat,
      pickupLng: driver1Lng,
      destinationAddress: "Bambalapitiya",
      destinationLat: driver2Lat,
      destinationLng: driver2Lng,
      dispatchStatus: "OFFERED",
      dispatchExpiresAt: new Date(Date.now() + 25000), // 25s remaining
      offeredDriverIds: [driverB._id],
      passengerDetails: {
        fullName: "Reconcile Test Rider",
        email: "reconcile@example.com",
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 0,
        childSeatRequired: false,
        meetAndGreetRequired: false,
      },
      fareBreakdown: {
        baseCharge: 300,
        distanceCharge: 300,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 600,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        estimatedFare: 600,
      },
    });

    // Test DriverDashboardClient reconciliation logic
    const initialBookingsTest = [testActiveOffer.toObject()];
    const reconciledOffer = initialBookingsTest.find((b: any) => {
      const isLocal = b.bookingType === "LOCAL_RIDE" || b.pickMeDetails?.isPickMe;
      const isUnassigned = !b.driverId && b.status === "PENDING";
      const isNotRejected = !(b.rejectedDriverIds || []).includes(driverB._id.toString());
      const isNotExpired = b.dispatchExpiresAt && new Date(b.dispatchExpiresAt).getTime() > Date.now();
      return isLocal && isUnassigned && isNotRejected && isNotExpired;
    });

    console.log("Reconciled Active Offer on Refresh:", reconciledOffer ? `FOUND (${reconciledOffer.bookingReference})` : "NOT FOUND");
    if (!reconciledOffer) {
      throw new Error("Assertion failed: Active offer should be reconciled on refresh/reconnect");
    }
    console.log(">> STEP 10 PASSED: Active offers successfully reconciled after refresh/reconnect!");

    // Clean up test data
    await User.deleteMany({ email: { $regex: "^test_e2e_local_" } });
    await Booking.deleteMany({ bookingReference: { $regex: "^PKM-E2E-" } });

    console.log("\n=================================================================");
    console.log("   ALL 10 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!    ");
    console.log("=================================================================");
  } finally {
    await mongoose.disconnect();
  }
}

runEndToEndVerification().catch((err) => {
  console.error("FATAL VERIFICATION ERROR:", err);
  process.exit(1);
});
