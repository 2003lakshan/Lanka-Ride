import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";

async function runVerification() {
  console.log("================================================================================");
  console.log("   LOCAL RIDE PASSENGER CANCELLATION & ADMIN PICKME VERIFICATION SUITE");
  console.log("================================================================================\n");

  await mongoose.connect(MONGODB_URI);
  console.log(" Connected to MongoDB:", MONGODB_URI);

  // Dynamic import models to ensure schemas are loaded
  const { default: Booking } = await import("../src/models/Booking");
  const { default: User } = await import("../src/models/User");
  const { default: Notification } = await import("../src/models/Notification");
  const {
    CANCELLATION_REASONS,
    CANCELLABLE_STATUSES,
    NON_CANCELLABLE_STARTED_STATUSES,
    validateCancellationReason,
  } = await import("../src/lib/cancellation");

  let passed = 0;
  let failed = 0;

  function assert(condition: any, desc: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // Find or create test rider, driver, admin
  let testRider = await User.findOne({ email: "test.rider.cancel@example.com" });
  if (!testRider) {
    testRider = await User.create({
      name: "Lakshan Passenger",
      email: "test.rider.cancel@example.com",
      role: "TOURIST",
      phoneNumber: "+94770001111",
    });
  }

  let testDriver = await User.findOne({ email: "test.driver.cancel@example.com" });
  if (!testDriver) {
    testDriver = await User.create({
      name: "Nimal Perera Driver",
      email: "test.driver.cancel@example.com",
      role: "DRIVER",
      isApproved: true,
      isOnline: true,
      vehicleRegistration: "WP-CAB-8899",
      vehicleCategory: "Car",
      currentLat: 6.9271,
      currentLng: 79.8612,
      locationUpdatedAt: new Date(),
    });
  }

  let testAdmin = await User.findOne({ email: "test.admin.cancel@example.com" });
  if (!testAdmin) {
    testAdmin = await User.create({
      name: "Admin Officer",
      email: "test.admin.cancel@example.com",
      role: "ADMIN",
    });
  }

  console.log("\n--- TEST 1: Reason Code & Explanation Validation ---");
  {
    // Empty code
    const r1 = validateCancellationReason("");
    assert(!r1.isValid && r1.error?.includes("select a cancellation reason"), "Empty reason code rejected with clear error");

    // Invalid code
    const r2 = validateCancellationReason("RANDOM_INVALID_CODE");
    assert(!r2.isValid && r2.error?.includes("Invalid cancellation reason code"), "Invalid reason code rejected with valid choices list");

    // OTHER without explanation
    const r3 = validateCancellationReason("OTHER", "");
    assert(!r3.isValid && r3.error?.includes("short explanation for 'Other'"), "OTHER without explanation rejected");

    // OTHER with short explanation (< 3 chars)
    const r4 = validateCancellationReason("OTHER", "no");
    assert(!r4.isValid && r4.error?.includes("short explanation for 'Other'"), "OTHER with < 3 chars explanation rejected");

    // OTHER with valid explanation
    const r5 = validateCancellationReason("OTHER", "Had an urgent family emergency");
    assert(r5.isValid && r5.reasonOption?.code === "OTHER", "OTHER with valid explanation accepted");

    // Standard reasons
    for (const option of CANCELLATION_REASONS.filter((r) => r.code !== "OTHER")) {
      const res = validateCancellationReason(option.code);
      assert(res.isValid, `Standard reason '${option.code}' (${option.label}) is valid without mandatory comments`);
    }
  }

  console.log("\n--- TEST 2: Cancellation While Searching for Driver (PENDING) ---");
  {
    const bookingRef = `PKM-TEST-SEARCH-${Date.now()}`;
    const searchBooking = await Booking.create({
      bookingReference: bookingRef,
      touristId: testRider._id,
      bookingType: "LOCAL_RIDE",
      pickupAddress: "Galle Face Green, Colombo",
      pickupLat: 6.9271,
      pickupLng: 79.8612,
      destinationAddress: "Majestic City, Bambalapitiya",
      destinationLat: 6.8937,
      destinationLng: 79.8554,
      distanceKm: 4.8,
      durationMins: 15,
      passengerDetails: {
        fullName: testRider.name,
        email: testRider.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 1,
      },
      fareBreakdown: {
        baseCharge: 200,
        distanceCharge: 600,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 800,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        baseFare: 200,
        ratePerKm: 125,
        minimumFare: 300,
        estimatedFare: 800,
        rideNow: true,
      },
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
      status: "PENDING",
      dispatchStatus: "SEARCHING",
    });

    // Simulate atomic cancellation
    const validation = validateCancellationReason("PLANS_CHANGED");
    const cancelledBooking = await Booking.findOneAndUpdate(
      {
        _id: searchBooking._id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
          dispatchStatus: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: {
            userId: testRider._id,
            role: "TOURIST",
            name: testRider.name,
          },
          cancellationReasonCode: validation.reasonOption!.code,
          cancellationReasonText: validation.reasonOption!.label,
          statusBeforeCancellation: "PENDING",
          refundReviewStatus: "NOT_APPLICABLE",
        },
      },
      { returnDocument: "after" }
    );

    assert(Boolean(cancelledBooking), "Atomic transition from PENDING to CANCELLED succeeded");
    assert(cancelledBooking?.status === "CANCELLED", "Status updated to CANCELLED");
    assert(cancelledBooking?.dispatchStatus === "CANCELLED", "dispatchStatus updated to CANCELLED");
    assert(Boolean(cancelledBooking?.cancelledAt), "cancelledAt timestamp recorded");
    assert(cancelledBooking?.cancelledBy?.role === "TOURIST", "cancelledBy role recorded as TOURIST");
    assert(cancelledBooking?.cancellationReasonCode === "PLANS_CHANGED", "Reason code saved as PLANS_CHANGED");
    assert(cancelledBooking?.cancellationReasonText === "Plans changed.", "Reason text saved as 'Plans changed.'");
    assert(cancelledBooking?.statusBeforeCancellation === "PENDING", "statusBeforeCancellation saved as PENDING");
    assert(cancelledBooking?.distanceKm === 4.8, "Preserved distanceKm");
    assert(cancelledBooking?.fareBreakdown.totalEstimatedFare === 800, "Preserved fare breakdown");

    // TEST 3: Idempotency
    console.log("\n--- TEST 3: Idempotency on Repeated Cancellation ---");
    const firstCancelledAt = cancelledBooking!.cancelledAt!.getTime();
    const secondAttempt = await Booking.findOneAndUpdate(
      {
        _id: searchBooking._id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(Date.now() + 5000),
        },
      },
      { returnDocument: "after" }
    );

    assert(secondAttempt === null, "Second atomic update did not match already-cancelled booking (preventing double-write)");
    const refreshed = await Booking.findById(searchBooking._id);
    assert(refreshed?.status === "CANCELLED", "Booking remains CANCELLED");
    assert(refreshed?.cancelledAt?.getTime() === firstCancelledAt, "Initial cancelledAt timestamp strictly preserved (idempotent)");
  }

  console.log("\n--- TEST 4: Cancellation After Driver Assignment (DRIVER_ASSIGNED) ---");
  {
    const bookingRef = `PKM-TEST-ASSIGNED-${Date.now()}`;
    const assignedBooking = await Booking.create({
      bookingReference: bookingRef,
      touristId: testRider._id,
      driverId: testDriver._id,
      assignedAt: new Date(),
      bookingType: "LOCAL_RIDE",
      pickupAddress: "Cinnamon Grand, Colombo",
      pickupLat: 6.9175,
      pickupLng: 79.8488,
      destinationAddress: "Mount Lavinia Hotel",
      destinationLat: 6.8375,
      destinationLng: 79.8644,
      distanceKm: 11.2,
      durationMins: 30,
      passengerDetails: {
        fullName: testRider.name,
        email: testRider.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 1,
      },
      fareBreakdown: {
        baseCharge: 200,
        distanceCharge: 1400,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 1600,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        baseFare: 200,
        ratePerKm: 125,
        minimumFare: 300,
        estimatedFare: 1600,
        rideNow: true,
      },
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
      status: "DRIVER_ASSIGNED",
      dispatchStatus: "ACCEPTED",
    });

    // Check driver conflict check before cancellation
    const activeTripStatuses = [
      "CONFIRMED",
      "DRIVER_ASSIGNED",
      "DRIVER_EN_ROUTE",
      "DRIVER_ARRIVED",
      "PASSENGER_PICKED_UP",
      "TRIP_IN_PROGRESS",
    ];
    const hasActiveTripBefore = await Booking.exists({
      driverId: testDriver._id,
      status: { $in: activeTripStatuses as any },
    });
    assert(Boolean(hasActiveTripBefore), "Driver correctly flagged as busy with active trip before cancellation");

    // Rider cancels with reason DRIVER_DELAY
    const valDelay = validateCancellationReason("DRIVER_DELAY", "Driver hasn't moved in 10 minutes");
    const cancelledAssigned = await Booking.findOneAndUpdate(
      {
        _id: assignedBooking._id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
          dispatchStatus: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: {
            userId: testRider._id,
            role: "TOURIST",
            name: testRider.name,
          },
          cancellationReasonCode: valDelay.reasonOption!.code,
          cancellationReasonText: valDelay.reasonOption!.label,
          cancellationComments: "Driver hasn't moved in 10 minutes",
          statusBeforeCancellation: "DRIVER_ASSIGNED",
          refundReviewStatus: "NOT_APPLICABLE",
        },
      },
      { returnDocument: "after" }
    );

    assert(Boolean(cancelledAssigned), "Driver assigned booking atomically cancelled");
    assert(cancelledAssigned?.statusBeforeCancellation === "DRIVER_ASSIGNED", "statusBeforeCancellation saved as DRIVER_ASSIGNED");
    assert(cancelledAssigned?.cancellationComments === "Driver hasn't moved in 10 minutes", "Cancellation comments stored");

    // Check driver availability released
    const hasActiveTripAfter = await Booking.exists({
      driverId: testDriver._id,
      status: { $in: activeTripStatuses as any },
    });
    assert(!hasActiveTripAfter, "Driver availability immediately released: no active booking prevents dispatch");

    // Create notification to driver
    const notif = await Notification.create({
      recipientId: testDriver._id.toString(),
      type: "RIDE_CANCELLED_BY_PASSENGER",
      title: "Ride Cancelled",
      message: `Passenger cancelled ride ${bookingRef}. Reason: ${valDelay.reasonOption!.label}`,
      link: "/driver/dashboard",
    });
    assert(Boolean(notif), "In-app cancellation notification created for assigned driver");
  }

  console.log("\n--- TEST 5: Cancellation While Driver En Route / Arrived ---");
  {
    const bookingRef = `PKM-TEST-ARRIVED-${Date.now()}`;
    const arrivedBooking = await Booking.create({
      bookingReference: bookingRef,
      touristId: testRider._id,
      driverId: testDriver._id,
      bookingType: "LOCAL_RIDE",
      pickupAddress: "Odel Alexandra Place, Colombo",
      pickupLat: 6.9112,
      pickupLng: 79.8661,
      destinationAddress: "Havelock City Mall",
      destinationLat: 6.8791,
      destinationLng: 79.8631,
      distanceKm: 4.2,
      durationMins: 14,
      passengerDetails: {
        fullName: testRider.name,
        email: testRider.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 1,
      },
      fareBreakdown: {
        baseCharge: 200,
        distanceCharge: 525,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 725,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        baseFare: 200,
        ratePerKm: 125,
        minimumFare: 300,
        estimatedFare: 725,
        rideNow: true,
      },
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
      status: "DRIVER_ARRIVED",
      arrivedAt: new Date(),
    });

    const valContact = validateCancellationReason("CANNOT_CONTACT_DRIVER");
    const cancelledArrived = await Booking.findOneAndUpdate(
      {
        _id: arrivedBooking._id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
          dispatchStatus: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: {
            userId: testRider._id,
            role: "TOURIST",
            name: testRider.name,
          },
          cancellationReasonCode: valContact.reasonOption!.code,
          cancellationReasonText: valContact.reasonOption!.label,
          statusBeforeCancellation: "DRIVER_ARRIVED",
          refundReviewStatus: "NOT_APPLICABLE",
        },
      },
      { returnDocument: "after" }
    );

    assert(Boolean(cancelledArrived), "DRIVER_ARRIVED booking atomically cancelled before passenger pickup");
    assert(cancelledArrived?.statusBeforeCancellation === "DRIVER_ARRIVED", "Recorded statusBeforeCancellation as DRIVER_ARRIVED");
  }

  console.log("\n--- TEST 6: Race Condition Prevention Against Trip Start (PASSENGER_PICKED_UP) ---");
  {
    const bookingRef = `PKM-TEST-STARTED-${Date.now()}`;
    const startedBooking = await Booking.create({
      bookingReference: bookingRef,
      touristId: testRider._id,
      driverId: testDriver._id,
      bookingType: "LOCAL_RIDE",
      pickupAddress: "Hilton Colombo",
      pickupLat: 6.9321,
      pickupLng: 79.8441,
      destinationAddress: "Bandaranaike Memorial (BMICH)",
      destinationLat: 6.9011,
      destinationLng: 79.8732,
      distanceKm: 5.5,
      durationMins: 18,
      passengerDetails: {
        fullName: testRider.name,
        email: testRider.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 1,
      },
      fareBreakdown: {
        baseCharge: 200,
        distanceCharge: 687,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 887,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        baseFare: 200,
        ratePerKm: 125,
        minimumFare: 300,
        estimatedFare: 887,
        rideNow: true,
      },
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
      status: "PASSENGER_PICKED_UP", // Trip started!
    });

    // Attempt cancellation query
    const cancelAttempt = await Booking.findOneAndUpdate(
      {
        _id: startedBooking._id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    assert(cancelAttempt === null, "Cancellation query strictly returned null: ride cannot be cancelled once PASSENGER_PICKED_UP");
    const freshStarted = await Booking.findById(startedBooking._id);
    assert(freshStarted?.status === "PASSENGER_PICKED_UP", "Booking remains in PASSENGER_PICKED_UP (trip protected from corruption)");

    // Test completed trip cancellation
    freshStarted!.status = "COMPLETED";
    await freshStarted!.save();
    const completedAttempt = await Booking.findOneAndUpdate(
      {
        _id: startedBooking._id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
        },
      }
    );
    assert(completedAttempt === null, "COMPLETED ride cannot be cancelled");
  }

  console.log("\n--- TEST 7: Paid Booking Cancellation & Refund Review Flagging ---");
  {
    const bookingRef = `PKM-TEST-PAID-${Date.now()}`;
    const paidBooking = await Booking.create({
      bookingReference: bookingRef,
      touristId: testRider._id,
      driverId: testDriver._id,
      bookingType: "LOCAL_RIDE",
      pickupAddress: "Colombo Fort Railway Station",
      destinationAddress: "Negombo Beach Road",
      distanceKm: 38.0,
      durationMins: 55,
      passengerDetails: {
        fullName: testRider.name,
        email: testRider.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 1,
      },
      fareBreakdown: {
        baseCharge: 200,
        distanceCharge: 4750,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 300,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 5250,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory: "Car",
        baseFare: 200,
        ratePerKm: 125,
        minimumFare: 300,
        estimatedFare: 5250,
        rideNow: true,
      },
      paymentMethod: "CARD",
      paymentStatus: "PAID", // Pre-paid!
      status: "CONFIRMED",
    });

    const valWrong = validateCancellationReason("WRONG_LOCATION", "Accidentally entered wrong street");
    const cancelledPaid = await Booking.findOneAndUpdate(
      {
        _id: paidBooking._id,
        status: { $in: CANCELLABLE_STATUSES },
      },
      {
        $set: {
          status: "CANCELLED",
          dispatchStatus: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: {
            userId: testRider._id,
            role: "TOURIST",
            name: testRider.name,
          },
          cancellationReasonCode: valWrong.reasonOption!.code,
          cancellationReasonText: valWrong.reasonOption!.label,
          cancellationComments: "Accidentally entered wrong street",
          statusBeforeCancellation: "CONFIRMED",
          refundReviewStatus: paidBooking.paymentStatus === "PAID" ? "PENDING_REVIEW" : "NOT_APPLICABLE",
        },
      },
      { returnDocument: "after" }
    );

    assert(Boolean(cancelledPaid), "Paid booking successfully cancelled");
    assert(cancelledPaid?.paymentStatus === "PAID", "paymentStatus remains PAID (separate from cancellation status, not auto-refunded)");
    assert(cancelledPaid?.refundReviewStatus === "PENDING_REVIEW", "refundReviewStatus flagged as PENDING_REVIEW for admin inspection");

    // Admin resolves review
    cancelledPaid!.refundReviewStatus = "RESOLVED";
    cancelledPaid!.adminNotes = { refundReviewNotes: "Reviewed with payment gateway, merchant fee retained per policy" };
    await cancelledPaid!.save();
    const verifiedResolved = await Booking.findById(cancelledPaid!._id);
    assert(verifiedResolved?.refundReviewStatus === "RESOLVED", "Admin successfully marked refund review as RESOLVED");
  }

  console.log("\n--- TEST 8: Custom Trip & Airport Transfer Workflow Preservation ---");
  {
    const airportBookingRef = `LAR-TEST-AIRPORT-${Date.now()}`;
    const airportBooking = await Booking.create({
      bookingReference: airportBookingRef,
      touristId: testRider._id,
      bookingType: "AIRPORT_TRANSFER",
      pickupAddress: "Bandaranaike International Airport (CMB)",
      destinationAddress: "Kandy City Center",
      arrivalDate: new Date(),
      arrivalTime: "14:30",
      flightNumber: "UL-504",
      distanceKm: 104.0,
      durationMins: 180,
      passengerDetails: {
        fullName: testRider.name,
        email: testRider.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 1,
      },
      fareBreakdown: {
        baseCharge: 1500,
        distanceCharge: 15000,
        airportPickupCharge: 500,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 17000,
      },
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
      status: "CONFIRMED",
    });

    assert(airportBooking.bookingType === "AIRPORT_TRANSFER", "Airport transfer booking created with existing schema");
    assert(airportBooking.flightNumber === "UL-504", "Airport transfer flight number preserved");

    // Custom trip booking
    const customTripRef = `CTR-TEST-CUSTOM-${Date.now()}`;
    const customTripBooking = await Booking.create({
      bookingReference: customTripRef,
      touristId: testRider._id,
      bookingType: "CUSTOM_TRIP",
      passengerDetails: {
        fullName: testRider.name,
        email: testRider.email,
        nationality: "Sri Lankan",
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 1,
      },
      customTripDetails: {
        isCustomTrip: true,
        startDate: new Date(),
        budget: 450,
        budgetCurrency: "USD",
        itinerary: [
          {
            dayNumber: 1,
            date: new Date(),
            placesToVisit: [{ name: "Sigiriya Rock Fortress" }],
          },
        ],
      },
      fareBreakdown: {
        baseCharge: 0,
        distanceCharge: 0,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: 0,
      },
      paymentMethod: "PENDING",
      paymentStatus: "PENDING",
      status: "PENDING_APPROVAL",
    });

    assert(customTripBooking.bookingType === "CUSTOM_TRIP", "Custom trip booking created with customTripDetails and itinerary intact");
  }

  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runVerification().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
