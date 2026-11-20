import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import Package from "@/models/Package";
import VehicleType from "@/models/VehicleType";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "TOURIST") {
      return NextResponse.json({ error: "Unauthorized. Please sign in as a tourist to book a package." }, { status: 401 });
    }

    await dbConnect();
    const touristId = (session.user as any).id;
    const touristUser = await User.findById(touristId);
    if (!touristUser) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const body = await req.json();
    const {
      packageId,
      travelDate,
      passengers,
      luggage,
      pickupAddress,
      dropoffAddress,
      pickupTime,
      contactDetails,
      paymentMethod = "CASH",
      specialRequests,
      selectedAmenities = []
    } = body;

    if (!packageId) {
      return NextResponse.json({ error: "Package ID is required." }, { status: 400 });
    }

    // 1. Fetch package and verify it is PUBLISHED
    const pkg = await Package.findById(packageId).populate("driverId", "name email phoneNumber driverDetails");
    if (!pkg) {
      return NextResponse.json({ error: "Package not found." }, { status: 404 });
    }

    if (pkg.status !== "PUBLISHED") {
      return NextResponse.json({ error: "This travel package is currently not available for booking." }, { status: 400 });
    }

    // 2. Validate Travel Date
    if (!travelDate) {
      return NextResponse.json({ error: "Please select a valid travel date." }, { status: 400 });
    }

    const selectedDate = new Date(travelDate);
    if (isNaN(selectedDate.getTime())) {
      return NextResponse.json({ error: "Invalid travel date provided." }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const advanceDays = pkg.advanceNoticeDays ?? 2;
    const minBookingDate = new Date(today);
    minBookingDate.setDate(minBookingDate.getDate() + advanceDays);

    if (selectedDate < minBookingDate) {
      return NextResponse.json({
        error: `This package requires at least ${advanceDays} day(s) advance booking notice. Earliest available date is ${minBookingDate.toLocaleDateString()}.`
      }, { status: 400 });
    }

    // 3. Validate Passenger & Luggage counts against Package and Vehicle
    const numPassengers = Number(passengers) || 1;
    const numLuggage = Number(luggage) || 0;

    if (numPassengers < (pkg.minPassengers || 1)) {
      return NextResponse.json({
        error: `Minimum group size for this package is ${pkg.minPassengers || 1} passenger(s).`
      }, { status: 400 });
    }

    if (pkg.maxPassengers && numPassengers > pkg.maxPassengers) {
      return NextResponse.json({
        error: `Maximum group size for this package is ${pkg.maxPassengers} passengers.`
      }, { status: 400 });
    }

    // Verify against vehicle type limits
    let vehicle = null;
    if (pkg.vehicleTypeId) {
      vehicle = await VehicleType.findById(pkg.vehicleTypeId);
      if (vehicle) {
        if (numPassengers > vehicle.maxPassengers) {
          return NextResponse.json({
            error: `The vehicle assigned to this tour (${vehicle.name}) accommodates a maximum of ${vehicle.maxPassengers} passengers.`
          }, { status: 400 });
        }
        if (numLuggage > vehicle.maxLuggage) {
          return NextResponse.json({
            error: `The vehicle assigned to this tour (${vehicle.name}) accommodates a maximum of ${vehicle.maxLuggage} luggage pieces.`
          }, { status: 400 });
        }
      }
    }

    // 4. Calculate Authoritative Server-Side Fare
    const currency = pkg.costs?.currency || "LKR";
    const pricingBasis = pkg.costs?.priceType || "PER_VEHICLE";
    const basePrice = pkg.costs?.totalStartingPrice || pkg.costs?.basePrice || pkg.price || 0;
    const coveredPax = pkg.costs?.passengerCountCovered || pkg.minPassengers || 1;
    const extraRate = pkg.costs?.extraPersonRate || 0;

    let totalFare = basePrice;
    let extraCharge = 0;

    if (pricingBasis === "PER_PERSON") {
      totalFare = basePrice * numPassengers;
    } else {
      // PER_VEHICLE or ENTIRE_PACKAGE
      if (numPassengers > coveredPax && extraRate > 0) {
        extraCharge = extraRate * (numPassengers - coveredPax);
        totalFare = basePrice + extraCharge;
      }
    }

    // Process Amenities and optional extra charges
    let amenitiesExtraCharge = 0;
    const selectedAmenityRecords: any[] = [];
    if (pkg.amenities && Array.isArray(pkg.amenities)) {
      for (const amen of pkg.amenities) {
        const amenKey = amen.id || amen.name;
        const isSelected = amen.isIncluded || selectedAmenities.includes(amenKey);
        let itemExtraCost = 0;
        if (!amen.isIncluded && isSelected && amen.price) {
          if (amen.chargingBasis === "PER_PERSON") {
            itemExtraCost = amen.price * numPassengers;
          } else if (amen.chargingBasis === "PER_ITEM") {
            itemExtraCost = amen.price * (amen.quantity || 1);
          } else {
            itemExtraCost = amen.price; // PER_VEHICLE
          }
          amenitiesExtraCharge += itemExtraCost;
        }

        selectedAmenityRecords.push({
          id: amen.id,
          name: amen.name,
          category: amen.category,
          isIncluded: amen.isIncluded,
          isSelected,
          quantity: amen.quantity,
          unit: amen.unit,
          coverage: amen.coverage,
          description: amen.description,
          price: amen.price,
          currency: amen.currency || currency,
          chargingBasis: amen.chargingBasis,
          extraCost: itemExtraCost
        });
      }
    }
    totalFare += amenitiesExtraCharge;

    // 5. Contact information
    const fullName = contactDetails?.fullName?.trim() || touristUser.name || "Traveller";
    const email = contactDetails?.email?.trim() || touristUser.email || "";
    const phone = contactDetails?.phone?.trim() || touristUser.phoneNumber || "Unknown";
    const country = contactDetails?.country?.trim() || touristUser.nationality || "Sri Lanka";

    // 6. Generate unique booking reference (PKG-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const count = await Booking.countDocuments({
      bookingReference: { $regex: `^PKG-${year}-` }
    });
    const refSeq = String(count + 1).padStart(5, "0");
    const bookingReference = `PKG-${year}-${refSeq}`;

    // 7. Snapshot Agreed Package Details to preserve exact terms
    const packageSnapshot = {
      packageId: pkg._id.toString(),
      title: pkg.title,
      category: pkg.category,
      days: pkg.days,
      nights: pkg.nights ?? Math.max(0, pkg.days - 1),
      destinations: pkg.destinations || [],
      shortDescription: pkg.shortDescription,
      fullDescription: pkg.fullDescription,
      coverPhoto: pkg.coverPhoto,
      startingCity: pkg.startingCity,
      pickupOptions: pkg.pickupOptions,
      pickupTime: pickupTime || pkg.pickupTime || "08:00 AM",
      dropoffLocation: dropoffAddress || pkg.dropoffLocation,
      itinerary: pkg.itinerary || [],
      inclusions: pkg.inclusionsList || pkg.costs?.inclusions || [],
      exclusions: pkg.exclusionsList || pkg.costs?.exclusions || [],
      includedServicesDetails: pkg.includedServicesDetails,
      amenities: selectedAmenityRecords,
      languages: pkg.languages || [],
      cancellationPolicy: pkg.cancellationPolicy || pkg.costs?.cancellationTerms,
      weatherPolicy: pkg.weatherPolicy,
      extraChargeConditions: pkg.extraChargeConditions || pkg.costs?.conditions,
      agreedPricing: {
        currency,
        pricingBasis,
        basePrice,
        extraCharge,
        amenitiesExtraCharge,
        totalFare,
        passengers: numPassengers
      },
      driverSnapshot: {
        driverId: pkg.driverId?._id ? pkg.driverId._id.toString() : pkg.driverId?.toString(),
        name: (pkg.driverId as any)?.name || "Tour Driver",
        phone: (pkg.driverId as any)?.phoneNumber || "",
        homeCity: (pkg.driverId as any)?.driverDetails?.homeCity || "",
        yearsOfExperience: (pkg.driverId as any)?.driverDetails?.yearsOfExperience || null
      },
      vehicleSnapshot: vehicle ? {
        name: vehicle.name,
        category: vehicle.category,
        maxPassengers: vehicle.maxPassengers,
        maxLuggage: vehicle.maxLuggage
      } : undefined
    };

    // 8. Create authoritative Booking record
    const booking = await Booking.create({
      bookingReference,
      bookingType: "CUSTOM_TRIP",
      isPackageBooking: true,
      packageId: pkg._id,
      driverId: pkg.driverId?._id || pkg.driverId,
      touristId: touristUser._id,
      vehicleTypeId: pkg.vehicleTypeId || (vehicle ? vehicle._id : undefined),
      status: "CONFIRMED", // Driver created this package, so the booking is directly confirmed with them!
      paymentStatus: "PENDING",
      paymentMethod,
      arrivalDate: selectedDate,
      arrivalTime: pickupTime || pkg.pickupTime || "08:00 AM",
      pickupAddress: pickupAddress || pkg.pickupOptions || pkg.startingCity,
      destinationAddress: dropoffAddress || pkg.dropoffLocation || "Tour Conclusion",
      packageItineraryDetails: packageSnapshot,
      passengerDetails: {
        fullName,
        email,
        whatsappNumber: phone,
        nationality: country,
        country,
        adults: numPassengers,
        children: 0,
        luggage: numLuggage,
        childSeatRequired: Boolean(body.childSeatRequired),
        meetAndGreetRequired: false,
        specialRequests: specialRequests ? String(specialRequests).trim() : undefined
      },
      fareBreakdown: {
        baseCharge: basePrice,
        distanceCharge: 0,
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: extraCharge + amenitiesExtraCharge,
        discount: 0,
        totalEstimatedFare: totalFare
      }
    });

    // 9. Dispatch notifications
    const driverIdStr = (pkg.driverId?._id || pkg.driverId).toString();
    const tourTitle = pkg.title || "Tour Package";

    // Notify Driver
    import("@/lib/notifications").then(async ({ sendNotification }) => {
      await sendNotification({
        recipientId: driverIdStr,
        type: "NEW_BOOKING",
        title: "New Package Booking!",
        message: `${fullName} booked your package "${tourTitle}" for ${selectedDate.toLocaleDateString()}. Total: ${currency} ${totalFare.toLocaleString()}.`,
        link: `/driver`,
        resourceId: booking._id.toString(),
        deduplicationKey: `pkg_booking_${booking._id.toString()}_driver`
      });
    }).catch(console.error);

    // Notify Admin
    import("@/lib/notifications").then(async ({ notifyAdmins }) => {
      await notifyAdmins({
        type: "BOOKING_CREATED",
        title: "New Package Tour Booked",
        message: `Booking ${bookingReference} confirmed for "${tourTitle}" (${currency} ${totalFare.toLocaleString()}).`,
        link: `/admin/trips`,
        deduplicationKey: `pkg_booking_${booking._id.toString()}_admin`
      });
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      bookingReference,
      bookingId: booking._id.toString(),
      message: "Package booked successfully!"
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating package booking:", error);
    return NextResponse.json({ error: error.message || "Failed to book package." }, { status: 500 });
  }
}

