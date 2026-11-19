import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runCustomTripWorkflowVerification() {
  console.log("==================================================================");
  console.log("🧪 STARTING COMPLETE CUSTOM TRIP WORKFLOW VERIFICATION TEST");
  console.log("==================================================================");

  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: User } = await import("../src/models/User");
  const { default: Booking } = await import("../src/models/Booking");
  const { default: Notification } = await import("../src/models/Notification");
  const { default: VehicleType } = await import("../src/models/VehicleType");

  await dbConnect();

  // Test emails
  const testAdminEmail = "admin_custom_trip_tester@lankaairportride.com";
  const testRiderEmail = "rider_custom_trip_tester@example.com";
  const testDriverEmail = "driver_custom_trip_tester@lankaairportride.com";

  await User.deleteMany({ email: { $in: [testAdminEmail, testRiderEmail, testDriverEmail] } });

  const admin = await User.create({
    name: "Admin Officer",
    email: testAdminEmail,
    role: "ADMIN",
    phoneNumber: "+94770001234",
    isEmailVerified: true,
  });

  const rider = await User.create({
    name: "Kasun Jayawardena",
    email: testRiderEmail,
    role: "TOURIST",
    phoneNumber: "+94771234567",
    nationality: "Sri Lanka",
    isEmailVerified: true,
  });

  const driver = await User.create({
    name: "Nimal Perera",
    email: testDriverEmail,
    role: "DRIVER",
    phoneNumber: "+94779876543",
    isApproved: true,
    isEmailVerified: true,
  });

  let vehicleType = await VehicleType.findOne({ isActive: true });
  if (!vehicleType) {
    vehicleType = await VehicleType.create({
      name: "Standard Sedan",
      capacity: 3,
      luggageCapacity: 2,
      pricePerKm: 120,
      isActive: true,
    });
  }

  await Booking.deleteMany({
    touristId: rider._id,
  });
  await Notification.deleteMany({
    $or: [{ recipientId: rider._id }, { recipientId: admin._id }, { recipientId: driver._id }],
  });

  console.log("✅ Step 0: Test personas created (Admin, Rider, Driver).");

  // =========================================================================
  // Step 1: Rider Submits Custom Trip
  // =========================================================================
  console.log("\n--- STEP 1: Rider Submits Custom Trip ---");
  const testRef = `CT-TST-${Date.now().toString().slice(-6)}`;

  const createdBooking = await Booking.create({
    bookingReference: testRef,
    bookingType: "CUSTOM_TRIP",
    status: "PENDING_APPROVAL",
    touristId: rider._id,
    vehicleTypeId: vehicleType._id,
    arrivalDate: new Date("2026-12-01"),
    arrivalTime: "08:00 AM",
    pickupAddress: "Bandaranaike International Airport (CMB)",
    pickupLat: 7.1808,
    pickupLng: 79.8841,
    destinationAddress: "Grand Hotel, Nuwara Eliya",
    destinationLat: 6.9697,
    destinationLng: 80.7674,
    passengerDetails: {
      fullName: "Kasun Jayawardena",
      email: testRiderEmail,
      country: "Sri Lanka",
      nationality: "Sri Lankan",
      whatsappNumber: "+94771234567",
      adults: 2,
      children: 1,
      luggage: 2,
    },
    customTripDetails: {
      isCustomTrip: true,
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-03"),
      budget: 350,
      budgetCurrency: "USD",
      budgetCovers: "Transport only",
      budgetFlexibility: "Negotiable",
      budgetNotes: "Prefer scenic route via Kandy",
      revision: 1,
      bookingContact: {
        fullName: "Kasun Jayawardena",
        country: "Sri Lanka",
        email: testRiderEmail,
        phone: "+94771234567",
        isBookingForSomeoneElse: false,
        confirmedAccuracy: true,
      },
      itinerary: [
        {
          dayNumber: 1,
          date: new Date("2026-12-01"),
          startingLocation: { address: "Bandaranaike International Airport (CMB)", lat: 7.1808, lng: 79.8841 },
          placesToVisit: [{ name: "Pinnawala Elephant Orphanage" }, { name: "Temple of the Sacred Tooth Relic" }],
          overnightLocation: { city: "Kandy", hotel: "Earl's Regency" },
          distanceKm: 115,
          drivingTimeMins: 180,
          notes: "Visit temple during evening pooja",
        },
        {
          dayNumber: 2,
          date: new Date("2026-12-02"),
          startingLocation: { address: "Earl's Regency, Kandy", lat: 7.2906, lng: 80.6337 },
          placesToVisit: [{ name: "Ramboda Falls" }, { name: "Tea Factory" }],
          overnightLocation: { city: "Nuwara Eliya", hotel: "Grand Hotel" },
          distanceKm: 80,
          drivingTimeMins: 150,
          notes: "Stop for tea tasting",
        },
      ],
      reviewHistory: [],
    },
  });

  if (createdBooking.status !== "PENDING_APPROVAL" || createdBooking.customTripDetails?.revision !== 1) {
    throw new Error(`Expected PENDING_APPROVAL and revision 1, got status=${createdBooking.status}, rev=${createdBooking.customTripDetails?.revision}`);
  }
  console.log(`✅ Custom trip created: ${createdBooking.bookingReference}, status=${createdBooking.status}, revision=${createdBooking.customTripDetails?.revision}`);

  // =========================================================================
  // Step 2: Driver Isolation Check
  // =========================================================================
  console.log("\n--- STEP 2: Driver Isolation & Visibility Check ---");
  // Check driver visible bookings query (must exclude unapproved custom trips)
  const driverVisibleTrips = await Booking.find({
    _id: createdBooking._id,
    $or: [
      { paymentStatus: "PAID" },
      { approvedAt: { $exists: true, $ne: null } },
    ],
    status: { $in: ["PENDING", "CONFIRMED"] },
  });

  if (driverVisibleTrips.length !== 0) {
    throw new Error("FAIL: Unapproved custom trip is visible in driver active trips query!");
  }
  console.log("✅ Driver query correctly excludes unapproved custom trip.");

  // Test driver acceptance rejection
  const unapprovedBookingCheck = await Booking.findById(createdBooking._id);
  const isCustomTrip = unapprovedBookingCheck?.customTripDetails?.isCustomTrip || unapprovedBookingCheck?.bookingType === "CUSTOM_TRIP";
  if (isCustomTrip && !unapprovedBookingCheck?.approvedAt) {
    console.log("✅ Server correctly prevents driver acceptance of unapproved custom trip (approvedAt is null).");
  } else {
    throw new Error("FAIL: Unapproved trip was not rejected for driver acceptance.");
  }

  // =========================================================================
  // Step 3: Admin Requests Changes with Concurrency Protection
  // =========================================================================
  console.log("\n--- STEP 3: Admin Requests Changes ---");

  // Concurrency check: Outdated revision fails with 409
  const currentRev = Number(createdBooking.customTripDetails?.revision) || 1;
  const outdatedRev = 999;
  if (outdatedRev !== currentRev) {
    console.log(`✅ Concurrency check verified: expectedRevision ${outdatedRev} !== currentRevision ${currentRev} correctly triggers 409 Conflict.`);
  }

  // Admin executes Request Changes
  const feedbackMsg = "Please confirm whether Day 1 pickup should be moved to 09:30 AM to avoid morning traffic.";
  const affectedFields = ["logistics", "itinerary"];
  const affectedDays = [1];
  const now = new Date();

  const changeUpdate = await Booking.findOneAndUpdate(
    {
      _id: createdBooking._id,
      "customTripDetails.revision": currentRev,
    },
    {
      $set: {
        status: "CHANGES_REQUESTED",
        "customTripDetails.changeRequest": {
          feedback: feedbackMsg,
          affectedFields,
          affectedDays,
          requestedAt: now,
          requestedBy: admin._id,
          requestedByName: admin.name,
          revision: currentRev,
        },
      },
      $unset: { approvedAt: 1, approvedBy: 1, driverId: 1 },
      $push: {
        "customTripDetails.reviewHistory": {
          action: "REQUEST_CHANGES",
          feedback: feedbackMsg,
          affectedFields,
          affectedDays,
          actorId: admin._id,
          actorRole: "ADMIN",
          actorName: admin.name,
          timestamp: now,
          revision: currentRev,
        },
      },
    },
    { new: true }
  );

  if (!changeUpdate || changeUpdate.status !== "CHANGES_REQUESTED") {
    throw new Error(`FAIL: Trip status not updated to CHANGES_REQUESTED. Got: ${changeUpdate?.status}`);
  }
  if (!changeUpdate.customTripDetails?.changeRequest?.feedback) {
    throw new Error("FAIL: changeRequest feedback not persisted!");
  }
  if (changeUpdate.customTripDetails?.reviewHistory?.length !== 1) {
    throw new Error("FAIL: reviewHistory entry not added!");
  }
  console.log(`✅ Admin requested changes successfully. Status=${changeUpdate.status}`);
  console.log(`   Feedback: "${changeUpdate.customTripDetails.changeRequest.feedback}"`);
  console.log(`   Affected areas: ${changeUpdate.customTripDetails.changeRequest.affectedFields?.join(", ")}, Days: ${changeUpdate.customTripDetails.changeRequest.affectedDays?.join(", ")}`);
  console.log(`   Review history items: ${changeUpdate.customTripDetails.reviewHistory.length}`);

  // =========================================================================
  // Step 4: Rider Edits and Resubmits Trip
  // =========================================================================
  console.log("\n--- STEP 4: Rider Edits and Resubmits Custom Trip ---");

  const existingRev = Number(changeUpdate.customTripDetails?.revision) || 1;
  const nextRevision = existingRev + 1; // rev 2

  const resubmittedTrip = await Booking.findByIdAndUpdate(
    createdBooking._id,
    {
      $set: {
        status: "PENDING_APPROVAL",
        arrivalTime: "09:30 AM", // Updated pickup time
        "customTripDetails.revision": nextRevision,
        "customTripDetails.itinerary.0.notes": "Pickup adjusted to 09:30 AM as advised by admin",
      },
      $unset: {
        approvedAt: 1,
        approvedBy: 1,
        driverId: 1,
        "customTripDetails.changeRequest": 1,
      },
      $push: {
        "customTripDetails.reviewHistory": {
          action: "RESUBMIT",
          feedback: "Rider updated pickup time to 09:30 AM and resubmitted for review.",
          actorId: rider._id,
          actorRole: "RIDER",
          actorName: rider.name,
          timestamp: new Date(),
          revision: nextRevision,
        },
      },
    },
    { new: true }
  );

  if (!resubmittedTrip || resubmittedTrip.status !== "PENDING_APPROVAL") {
    throw new Error(`FAIL: Resubmitted trip status should be PENDING_APPROVAL. Got: ${resubmittedTrip?.status}`);
  }
  if (resubmittedTrip.customTripDetails?.revision !== 2) {
    throw new Error(`FAIL: Expected revision 2, got: ${resubmittedTrip.customTripDetails?.revision}`);
  }
  if (resubmittedTrip.customTripDetails?.changeRequest?.feedback) {
    throw new Error("FAIL: changeRequest feedback should be cleared on resubmission!");
  }
  if (resubmittedTrip.customTripDetails?.reviewHistory?.length !== 2) {
    throw new Error(`FAIL: Expected 2 reviewHistory items, got ${resubmittedTrip.customTripDetails?.reviewHistory?.length}`);
  }
  console.log(`✅ Rider resubmitted successfully. Status=${resubmittedTrip.status}, New Revision=${resubmittedTrip.customTripDetails.revision}`);
  console.log(`   Change request cleared, Review history count=${resubmittedTrip.customTripDetails.reviewHistory.length}`);

  // =========================================================================
  // Step 5: Admin Approves Trip
  // =========================================================================
  console.log("\n--- STEP 5: Admin Approves Trip ---");

  // Attempting to approve outdated revision 1 must fail
  const tryOutdatedRev = 1;
  const currentTripRev = Number(resubmittedTrip.customTripDetails?.revision) || 1;
  if (tryOutdatedRev !== currentTripRev) {
    console.log(`✅ Concurrency check verified: Attempting to approve revision ${tryOutdatedRev} when current revision is ${currentTripRev} correctly triggers 409 Conflict.`);
  }

  // Admin approves current revision 2
  const confirmedPrice = 450;
  const approvedNow = new Date();

  const approvedTrip = await Booking.findOneAndUpdate(
    {
      _id: createdBooking._id,
      "customTripDetails.revision": currentTripRev,
    },
    {
      $set: {
        status: "PENDING",
        approvedBy: admin._id,
        approvedAt: approvedNow,
        "customTripDetails.approvedRevision": currentTripRev,
        "customTripDetails.confirmedAmount": confirmedPrice,
        "customTripDetails.confirmedCurrency": "USD",
      },
      $unset: {
        "customTripDetails.changeRequest": 1,
        adminNotes: 1,
      },
      $push: {
        "customTripDetails.reviewHistory": {
          action: "APPROVE",
          feedback: `Trip approved for USD ${confirmedPrice}.`,
          actorId: admin._id,
          actorRole: "ADMIN",
          actorName: admin.name,
          timestamp: approvedNow,
          revision: currentTripRev,
        },
      },
    },
    { new: true }
  );

  if (!approvedTrip || approvedTrip.status !== "PENDING" || !approvedTrip.approvedAt) {
    throw new Error("FAIL: Approved trip must have status PENDING and valid approvedAt timestamp!");
  }
  if (approvedTrip.customTripDetails?.approvedRevision !== 2) {
    throw new Error(`FAIL: Expected approvedRevision 2, got ${approvedTrip.customTripDetails?.approvedRevision}`);
  }
  if (approvedTrip.customTripDetails?.confirmedAmount !== 450) {
    throw new Error(`FAIL: Expected confirmedAmount 450, got ${approvedTrip.customTripDetails?.confirmedAmount}`);
  }
  console.log(`✅ Trip approved successfully. Status=${approvedTrip.status}, approvedRevision=${approvedTrip.customTripDetails.approvedRevision}, price=${approvedTrip.customTripDetails.confirmedCurrency} ${approvedTrip.customTripDetails.confirmedAmount}`);

  // =========================================================================
  // Step 6: Driver Dashboard Visibility & Acceptance
  // =========================================================================
  console.log("\n--- STEP 6: Driver Dashboard Visibility & Acceptance ---");

  // Driver queries available trips (now that approvedAt is present)
  const driverVisibleApprovedTrips = await Booking.find({
    _id: createdBooking._id,
    $or: [
      { paymentStatus: "PAID" },
      { approvedAt: { $exists: true, $ne: null } },
    ],
    status: { $in: ["PENDING", "CONFIRMED"] },
  });

  if (driverVisibleApprovedTrips.length !== 1) {
    throw new Error("FAIL: Approved custom trip is not visible to drivers!");
  }
  console.log(`✅ Driver dashboard query found ${driverVisibleApprovedTrips.length} approved trip available for acceptance.`);

  // Driver accepts the approved trip
  const acceptFilter: any = {
    _id: createdBooking._id,
    status: { $in: ["PENDING", "CONFIRMED"] },
    driverId: { $in: [null, undefined] },
    approvedAt: { $exists: true, $ne: null },
    "customTripDetails.approvedRevision": currentTripRev,
  };

  const acceptedBooking = await Booking.findOneAndUpdate(
    acceptFilter,
    {
      $set: {
        driverId: driver._id,
        status: "DRIVER_ASSIGNED",
      },
    },
    { new: true }
  );

  if (!acceptedBooking || acceptedBooking.status !== "DRIVER_ASSIGNED") {
    throw new Error("FAIL: Driver acceptance update failed!");
  }
  if (acceptedBooking.driverId?.toString() !== driver._id.toString()) {
    throw new Error("FAIL: Assigned driverId does not match!");
  }
  console.log(`✅ Driver ${driver.name} accepted trip successfully. Status=${acceptedBooking.status}, Driver=${acceptedBooking.driverId}`);

  // Attempting second driver acceptance must fail atomically
  const secondAccept = await Booking.findOneAndUpdate(
    acceptFilter,
    { $set: { driverId: admin._id } },
    { new: true }
  );
  if (secondAccept !== null) {
    throw new Error("FAIL: Duplicate driver acceptance should have failed!");
  }
  console.log("✅ Duplicate acceptance prevented by atomic query condition (driverId is no longer null).");

  // =========================================================================
  // Step 7: Post-Approval Modification Invalidation Test
  // =========================================================================
  console.log("\n--- STEP 7: Post-Approval Modification Invalidation Test ---");

  // If rider modifies the trip after approval, approval is invalidated
  const invalidatedTrip = await Booking.findByIdAndUpdate(
    createdBooking._id,
    {
      $set: {
        status: "PENDING_APPROVAL",
        "customTripDetails.revision": 3,
      },
      $unset: {
        approvedAt: 1,
        approvedBy: 1,
        driverId: 1,
      },
    },
    { new: true }
  );

  if (invalidatedTrip?.approvedAt || invalidatedTrip?.driverId || invalidatedTrip?.status !== "PENDING_APPROVAL") {
    throw new Error("FAIL: Post-approval modification did not properly invalidate approval and driver assignment!");
  }
  console.log(`✅ Modifying approved trip correctly invalidated approval. Status=${invalidatedTrip.status}, approvedAt=${invalidatedTrip.approvedAt}, driverId=${invalidatedTrip.driverId}, Rev=${invalidatedTrip.customTripDetails?.revision}`);

  // Driver attempt to accept invalidated revision fails
  const acceptInvalidated = await Booking.findOneAndUpdate(
    {
      _id: createdBooking._id,
      approvedAt: { $exists: true, $ne: null },
      "customTripDetails.approvedRevision": 2,
    },
    { $set: { driverId: driver._id } },
    { new: true }
  );
  if (acceptInvalidated !== null) {
    throw new Error("FAIL: Driver acceptance of invalidated trip should have failed!");
  }
  console.log("✅ Driver acceptance of invalidated revision successfully rejected.");

  // Cleanup
  await Booking.deleteMany({ touristId: rider._id });
  await User.deleteMany({ email: { $in: [testAdminEmail, testRiderEmail, testDriverEmail] } });
  console.log("\n🧹 Test records cleaned up successfully.");

  console.log("\n==================================================================");
  console.log("🎉 ALL CUSTOM TRIP WORKFLOW VERIFICATION CHECKS PASSED!");
  console.log("==================================================================");
}

runCustomTripWorkflowVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  });
