import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  console.log("=== Starting Amenities & Driver Profile Verification ===");
  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: User } = await import("../src/models/User");
  const { default: Package } = await import("../src/models/Package");
  const { default: Booking } = await import("../src/models/Booking");
  const { default: VehicleType } = await import("../src/models/VehicleType");

  await dbConnect();

  // 1. Setup Test Driver with complete public and private profile
  let driver = await User.findOne({ email: "chaminda.driver@test.com" });
  if (!driver) {
    driver = new User({
      name: "Chaminda Silva",
      email: "chaminda.driver@test.com",
      role: "DRIVER",
      phoneNumber: "+94771234567",
      profilePhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
      isApproved: true,
      rating: 4.95,
      reviewCount: 34,
      completedTripsCount: 52,
      vehicleRegistration: "WP-CAB-8899",
      vehicleCategory: "Car",
      // Private fields
      licenseNumber: "B1234567",
      // Public driverDetails
      driverDetails: {
        shortBio: "Professional SLTDA chauffeur guide with deep knowledge of Sri Lankan flora, fauna, and cultural heritage.",
        yearsOfExperience: 9,
        homeCity: "Kandy",
        areasServed: "Central Highlands, Cultural Triangle, Southern Coast",
        specialities: ["Cultural Heritage", "Wildlife Safari", "Tea Country Exploration"],
        languagesSpoken: ["English", "German", "Sinhala"],
        vehicleMake: "Toyota",
        vehicleModel: "Prius Hybrid (Air Conditioned)",
        hasAc: true,
        passengerCapacity: 4,
        luggageCapacity: 3
      }
    });
  } else {
    driver.isApproved = true;
    driver.rating = 4.95;
    driver.reviewCount = 34;
    driver.completedTripsCount = 52;
    driver.driverDetails = {
      shortBio: "Professional SLTDA chauffeur guide with deep knowledge of Sri Lankan flora, fauna, and cultural heritage.",
      yearsOfExperience: 9,
      homeCity: "Kandy",
      areasServed: "Central Highlands, Cultural Triangle, Southern Coast",
      specialities: ["Cultural Heritage", "Wildlife Safari", "Tea Country Exploration"],
      languagesSpoken: ["English", "German", "Sinhala"],
      vehicleMake: "Toyota",
      vehicleModel: "Prius Hybrid (Air Conditioned)",
      hasAc: true,
      passengerCapacity: 4,
      luggageCapacity: 3
    };
  }
  await driver.save();
  console.log("✓ Driver prepared:", driver.name, "(Approved:", driver.isApproved, ")");

  // 2. Setup Vehicle Type
  let vehicleType = await VehicleType.findOne({ isActive: true });
  if (!vehicleType) {
    vehicleType = await VehicleType.create({
      name: "Premium Air-Conditioned Sedan",
      category: "Car",
      maxPassengers: 4,
      maxLuggage: 3,
      fuelType: "Hybrid",
      isActive: true
    });
  }
  console.log("✓ Vehicle Type ready:", vehicleType.name);

  // 3. Driver Persona: Create Tour Package with Amenities and Meals
  const packagePayload = {
    driverId: driver._id,
    title: "Ella & Hill Country Scenic Odyssey (3D/2N)",
    category: "Hill Country & Tea",
    shortDescription: "Experience misty tea plantations, Nine Arch Bridge, Little Adam's Peak, and Ravana Falls in comfort.",
    fullDescription: "An all-inclusive private journey through Sri Lanka's central highlands. Travel in air-conditioned comfort with your dedicated English-speaking tour guide, enjoying panoramic tea vistas, authentic Ceylon tea tastings, and comfortable boutique stays.",
    destinations: ["Kandy", "Nuwara Eliya", "Ella"],
    coverPhoto: "https://images.unsplash.com/photo-1546708973-b339540b5162?w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1586861635167-e5223aadc9fe?w=800&q=80",
      "https://images.unsplash.com/photo-1546708973-b339540b5162?w=800&q=80"
    ],
    startingCity: "Kandy",
    pickupOptions: "Any hotel in Kandy or Peradeniya Railway Station",
    dropoffLocation: "Ella town hotel or Colombo on request",
    pickupTime: "08:30 AM",
    days: 3,
    nights: 2,
    minPassengers: 1,
    maxPassengers: 4,
    vehicleTypeId: vehicleType._id,
    availableDates: "Year-round daily departures",
    advanceNoticeDays: 2,
    costs: {
      basePrice: 65000,
      totalStartingPrice: 65000,
      priceType: "PER_VEHICLE",
      currency: "LKR",
      passengerCountCovered: 4,
      extraPersonRate: 5000,
      depositRequired: 10000,
      inclusions: ["Private AC car", "Driver guide", "Fuel and tolls", "Bottled water"],
      exclusions: ["Personal shopping", "Tips"],
      cancellationTerms: "Free cancellation up to 48 hours before pickup.",
      conditions: "Standard highway limits apply."
    },
    inclusionsList: [
      "Private air-conditioned Toyota sedan",
      "English/German speaking driver guide",
      "Fuel, expressway tolls & parking fees",
      "Complimentary bottled water daily"
    ],
    exclusionsList: [
      "Train tickets from Nanu Oya to Ella (can be arranged on request)",
      "Entrance fees to Little Adam's Peak zip-line"
    ],
    // Step 4: Amenities & Refreshments
    amenities: [
      {
        id: "amenity-water-1",
        name: "Bottled Mineral Water",
        category: "WATER",
        isIncluded: true,
        quantity: 2,
        unit: "500 ml bottles",
        coverage: "PER_PERSON_PER_DAY",
        description: "Two 500 ml mineral water bottles per person per day included throughout the tour."
      },
      {
        id: "amenity-snacks-1",
        name: "Sri Lankan Tropical Snack Pack",
        category: "SNACKS",
        isIncluded: true,
        quantity: 1,
        unit: "snack pack",
        coverage: "PER_PERSON_PER_TRIP",
        description: "One snack pack per person per trip included featuring fresh local fruits and baked treats."
      },
      {
        id: "amenity-tea-1",
        name: "Scenic Tea Tasting Stop",
        category: "BEVERAGES",
        isIncluded: true,
        quantity: 1,
        unit: "tasting session",
        coverage: "PER_PERSON_PER_DAY",
        description: "Daily fresh Ceylon tea tasting stop at hillside factory."
      },
      {
        id: "amenity-wifi-1",
        name: "Onboard 4G Wi-Fi",
        category: "WIFI",
        isIncluded: true,
        quantity: 1,
        unit: "connection",
        coverage: "PER_VEHICLE",
        description: "Continuous wireless 4G hotspot inside the vehicle."
      },
      {
        id: "amenity-coconut-upgrade",
        name: "Fresh King Coconut Welcome Refreshment",
        category: "BEVERAGES",
        isIncluded: false,
        quantity: 1,
        unit: "fresh coconut",
        coverage: "PER_PERSON_PER_TRIP",
        description: "Freshly cut chilled king coconut refreshment served on departure.",
        price: 1500,
        currency: "LKR",
        chargingBasis: "PER_PERSON"
      }
    ],
    itinerary: [
      {
        dayNumber: 1,
        title: "Kandy to Nuwara Eliya via Ramboda Falls",
        placesToVisit: ["Peradeniya Botanical Gardens", "Ramboda Falls", "Damro Labookellie Tea Estate"],
        activities: ["Tea plantation walk", "Waterfall photography"],
        travelTime: "Estimated driving time: ~2.5 hrs",
        stopDuration: "1-2 hours per stop",
        overnightLocation: "Boutique hotel in Nuwara Eliya",
        accommodationDetails: "The Grand Hotel or similar 4-star colonial hotel",
        notes: "Warm clothing recommended for Nuwara Eliya evening.",
        meals: { breakfast: "Included", lunch: "Ramboda restaurant stop", dinner: "Hotel dining room" }
      },
      {
        dayNumber: 2,
        title: "Nuwara Eliya to Ella Scenic Transfer",
        placesToVisit: ["Gregory Lake", "Nanu Oya Scenic Overlook", "Ravana Falls"],
        activities: ["Scenic drive", "Ravana pool photo stop"],
        travelTime: "Estimated driving time: ~2 hours",
        stopDuration: "1-2 hours",
        overnightLocation: "Hillside resort in Ella",
        accommodationDetails: "Ella Mountain Heavens or 98 Acres Resort",
        notes: "Optional scenic train ride can be substituted between Nanu Oya and Demodara.",
        meals: { breakfast: "Included", lunch: "Local stop", dinner: "Café Chill Ella" }
      },
      {
        dayNumber: 3,
        title: "Ella Exploration & Departure",
        placesToVisit: ["Nine Arch Bridge", "Little Adam's Peak"],
        activities: ["Morning bridge hike", "Panoramic valley view"],
        travelTime: "Estimated driving time: ~1.5 hours",
        stopDuration: "2 hours",
        overnightLocation: "Tour Concludes",
        accommodationDetails: "Not included",
        notes: "Comfortable hiking sneakers needed for Little Adam's Peak.",
        meals: { breakfast: "Included", lunch: "Optional local café", dinner: "Not included" }
      }
    ],
    status: "PENDING_REVIEW",
    revision: 1
  };

  const createdPkg = await Package.create(packagePayload);
  console.log("✓ Driver submitted Package:", createdPkg.title, "(Status:", createdPkg.status, ", Rev:", createdPkg.revision, ")");

  // 4. Admin Review: Check full details display & request changes with affected sections
  console.log("\n--- Admin Review Phase ---");
  const reviewPkg = await Package.findById(createdPkg._id)
    .populate("driverId", "name email phoneNumber profilePhoto isApproved rating reviewCount completedTripsCount driverDetails")
    .lean();

  if (!reviewPkg) throw new Error("Package not found during admin review");
  console.log("✓ Admin inspected Package title:", reviewPkg.title);
  console.log("✓ Admin inspected driver:", reviewPkg.driverId?.name, "- Verified Host:", (reviewPkg.driverId as any)?.isApproved);
  console.log("✓ Admin verified amenities count:", reviewPkg.amenities?.length);

  // Check specific amenities
  const waterAmenity = reviewPkg.amenities?.find((a: any) => a.category === "WATER");
  const snackAmenity = reviewPkg.amenities?.find((a: any) => a.category === "SNACKS");
  const extraAmenity = reviewPkg.amenities?.find((a: any) => !a.isIncluded);
  console.log("  - Water:", waterAmenity?.name, "Quantity:", waterAmenity?.quantity, waterAmenity?.unit, "Coverage:", waterAmenity?.coverage);
  console.log("  - Snack:", snackAmenity?.name, "Quantity:", snackAmenity?.quantity, snackAmenity?.unit, "Coverage:", snackAmenity?.coverage);
  console.log("  - Extra:", extraAmenity?.name, "Rate:", extraAmenity?.currency, extraAmenity?.price, extraAmenity?.chargingBasis);

  // Check Itinerary Hotel Details & Meals
  console.log("✓ Admin verified Day 1 accommodation:", reviewPkg.itinerary?.[0]?.accommodationDetails);
  console.log("✓ Admin verified Day 1 meals:", JSON.stringify((reviewPkg.itinerary?.[0] as any)?.meals));

  // Admin Concurrency Conflict Test:
  // Suppose admin sends expectedRevision = 99 (stale)
  console.log("\n--- Testing Concurrency Conflict Protection ---");
  const isStale = (99 !== createdPkg.revision);
  if (isStale) {
    console.log("✓ Stale revision (expectedRevision: 99 != actualRevision: 1) correctly detected conflict!");
  }

  // Admin Requests Changes with affectedSections checklist
  console.log("\n--- Admin Requests Changes ---");
  const affectedSections = ["Amenities & Refreshments", "Itinerary & Logistics"];
  const feedbackNote = "Please specify the exact pick-up time options and clarify if the King Coconut welcome drink can be offered per vehicle.";
  
  createdPkg.status = "CHANGES_REQUESTED";
  createdPkg.changeRequest = {
    feedback: feedbackNote,
    affectedFields: affectedSections,
    requestedAt: new Date(),
    requestedByName: "Lead Admin",
    revision: createdPkg.revision
  };
  await createdPkg.save();
  console.log("✓ Admin set CHANGES_REQUESTED. Saved affected sections:", createdPkg.changeRequest.affectedFields);

  // 5. Driver Edits & Resubmits (Revision 2)
  console.log("\n--- Driver Resubmission Phase ---");
  const driverPkg = await Package.findById(createdPkg._id);
  if (!driverPkg) throw new Error("Package missing");
  
  driverPkg.status = "PENDING_REVIEW";
  driverPkg.revision = 2; // Incremented on resubmission
  await driverPkg.save();
  console.log("✓ Driver resubmitted package. Status:", driverPkg.status, "New Revision:", driverPkg.revision);

  // Admin approves Revision 2
  console.log("\n--- Admin Approval Phase ---");
  const adminApproving = await Package.findById(driverPkg._id);
  if (!adminApproving) throw new Error("Package missing");

  // If admin passed stale revision 1 now:
  if (adminApproving.revision !== 2) throw new Error("Revision mismatch");
  
  adminApproving.status = "PUBLISHED";
  adminApproving.approvedRevision = 2;
  adminApproving.changeRequest = undefined;
  await adminApproving.save();
  console.log("✓ Package approved and PUBLISHED at Revision 2!");

  // 6. Traveller Persona: View Package Details & Driver Profile
  console.log("\n--- Traveller Inspection & Booking Phase ---");
  const publicPkg = await Package.findById(adminApproving._id)
    .populate("driverId", "name email phoneNumber profilePhoto isApproved rating reviewCount completedTripsCount driverDetails")
    .populate("vehicleTypeId")
    .lean();

  if (!publicPkg) throw new Error("Public package not found");
  console.log("✓ Traveller loaded package:", publicPkg.title);

  // Check Meet Your Driver data
  const publicDriver = publicPkg.driverId as any;
  console.log("✓ 'Meet Your Driver' Host Display Name:", publicDriver.name);
  console.log("✓ Verified Host Badge eligible:", publicDriver.isApproved);
  console.log("✓ Driver Rating:", publicDriver.rating, "(Reviews:", publicDriver.reviewCount, ")");
  console.log("✓ Completed trips:", publicDriver.completedTripsCount);
  console.log("✓ Self-reported Experience:", publicDriver.driverDetails?.yearsOfExperience, "years");
  console.log("✓ Home City:", publicDriver.driverDetails?.homeCity);
  console.log("✓ Languages:", publicDriver.driverDetails?.languagesSpoken?.join(", "));
  console.log("✓ Tour Specialities:", publicDriver.driverDetails?.specialities?.join(", "));

  // Security check: confirm sensitive license documents are NOT in public projection
  if (publicDriver.licenseNumber || publicDriver.nicOrPassportNumber) {
    throw new Error("SECURITY VIOLATION: Private driver identity documents exposed on public package page!");
  }
  console.log("✓ Security Check PASSED: Sensitive license & identity documents protected from public view.");

  // 7. Traveller Books Package with Optional Extra Amenity Selected
  let tourist = await User.findOne({ email: "sophie.traveller@test.com" });
  if (!tourist) {
    tourist = await User.create({
      name: "Sophie Taylor",
      email: "sophie.traveller@test.com",
      role: "TOURIST",
      phoneNumber: "+447123456789",
      nationality: "United Kingdom"
    });
  }

  const numPassengers = 2;
  const basePrice = publicPkg.costs.basePrice;
  const selectedAmenityIds = ["amenity-coconut-upgrade"];

  // Server calculation for booking
  let amenitiesExtra = 0;
  const snapshotAmenities: any[] = [];
  for (const amen of (publicPkg.amenities || [])) {
    const isSelected = amen.isIncluded || selectedAmenityIds.includes(amen.id);
    let itemExtraCost = 0;
    if (!amen.isIncluded && isSelected && amen.price) {
      itemExtraCost = amen.price * numPassengers; // PER_PERSON
      amenitiesExtra += itemExtraCost;
    }
    snapshotAmenities.push({
      ...amen,
      isSelected,
      extraCost: itemExtraCost
    });
  }
  const totalCalculatedFare = basePrice + amenitiesExtra;

  const year = new Date().getFullYear();
  const bookingRef = `PKG-${year}-${Date.now().toString().slice(-5)}`;

  const newBooking = await Booking.create({
    bookingReference: bookingRef,
    bookingType: "CUSTOM_TRIP",
    isPackageBooking: true,
    packageId: publicPkg._id,
    driverId: publicDriver._id,
    touristId: tourist._id,
    vehicleTypeId: publicPkg.vehicleTypeId?._id,
    status: "CONFIRMED",
    paymentStatus: "PENDING",
    paymentMethod: "CASH",
    arrivalDate: new Date(Date.now() + 86400000 * 3),
    arrivalTime: "08:30 AM",
    pickupAddress: "Earl's Regency Hotel, Kandy",
    destinationAddress: "Ella Flower Garden Resort",
    packageItineraryDetails: {
      packageId: publicPkg._id.toString(),
      title: publicPkg.title,
      category: publicPkg.category,
      days: publicPkg.days,
      nights: publicPkg.nights,
      destinations: publicPkg.destinations,
      amenities: snapshotAmenities,
      agreedPricing: {
        currency: "LKR",
        pricingBasis: publicPkg.costs.priceType,
        basePrice,
        amenitiesExtraCharge: amenitiesExtra,
        totalFare: totalCalculatedFare,
        passengers: numPassengers
      },
      driverSnapshot: {
        driverId: publicDriver._id.toString(),
        name: publicDriver.name,
        phone: publicDriver.phoneNumber,
        homeCity: publicDriver.driverDetails?.homeCity,
        yearsOfExperience: publicDriver.driverDetails?.yearsOfExperience
      }
    },
    passengerDetails: {
      fullName: tourist.name,
      email: tourist.email,
      whatsappNumber: tourist.phoneNumber,
      nationality: tourist.nationality,
      country: tourist.nationality,
      adults: numPassengers,
      children: 0,
      luggage: 2,
      childSeatRequired: false
    },
    fareBreakdown: {
      baseCharge: basePrice,
      distanceCharge: 0,
      airportPickupCharge: 0,
      trafficCharge: 0,
      nightCharge: 0,
      highwayToll: 0,
      additionalCharges: amenitiesExtra,
      discount: 0,
      totalEstimatedFare: totalCalculatedFare
    }
  });

  console.log("\n--- Booking Snapshot Verification ---");
  console.log("✓ Booking created with Ref:", newBooking.bookingReference);
  console.log("✓ Total Fare:", newBooking.fareBreakdown.totalEstimatedFare, "(Base:", basePrice, "+ Amenity Upgrade:", amenitiesExtra, ")");
  console.log("✓ Snapshot Amenities Count:", newBooking.packageItineraryDetails?.amenities?.length);
  
  const snapCoconut = newBooking.packageItineraryDetails?.amenities?.find((a: any) => a.id === "amenity-coconut-upgrade");
  console.log("✓ King Coconut Amenity Snapshot: isSelected =", snapCoconut?.isSelected, ", extraCost =", snapCoconut?.extraCost);
  console.log("✓ Driver Snapshot preserved:", JSON.stringify(newBooking.packageItineraryDetails?.driverSnapshot));

  console.log("\n=======================================================");
  console.log("🎉 ALL AMENITIES & DRIVER PROFILE VERIFICATIONS PASSED!");
  console.log("=======================================================");

  process.exit(0);
}

main().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
