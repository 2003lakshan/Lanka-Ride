import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";
import { validateAndSnapshotPickMeFare } from "@/lib/fareCalculation";
import { isValidCoordinate } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await dbConnect();

    // 1. Enforce Rider Authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: "Authentication required. Please sign in to request a local ride.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (userRole === "DRIVER" || userRole === "ADMIN") {
      return NextResponse.json(
        {
          error: "Driver and admin accounts cannot place rider bookings. Please sign in with a passenger (tourist) account.",
          code: "FORBIDDEN_ROLE",
        },
        { status: 403 }
      );
    }

    const touristId = (session.user as any).id;
    const user = await User.findById(touristId).lean();
    if (!user) {
      return NextResponse.json(
        { error: "Rider user profile not found. Please log in again.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      pickupLocation,
      destinationLocation,
      intermediateStops = [],
      pickupInstructions,
      vehicleCategory,
      goodsDescription,
      hasWhatsAppConfirmed,
      paymentMethod = "CASH",
      rideNow = true,
      scheduledDate,
      scheduledTime,
    } = body;

    // 2. Validate pickup and destination locations
    if (!pickupLocation || !isValidCoordinate(pickupLocation.lat, pickupLocation.lng)) {
      return NextResponse.json(
        { error: "Valid pickup location coordinates are required." },
        { status: 400 }
      );
    }

    if (!destinationLocation || !isValidCoordinate(destinationLocation.lat, destinationLocation.lng)) {
      return NextResponse.json(
        { error: "Valid destination location coordinates are required." },
        { status: 400 }
      );
    }

    // 3. Validate and sanitize intermediate stops
    const MAX_INTERMEDIATE_STOPS = 5;
    if (!Array.isArray(intermediateStops)) {
      return NextResponse.json(
        { error: "Intermediate stops must be an array." },
        { status: 400 }
      );
    }

    if (intermediateStops.length > MAX_INTERMEDIATE_STOPS) {
      return NextResponse.json(
        { error: `A maximum of ${MAX_INTERMEDIATE_STOPS} intermediate stops is allowed per ride.` },
        { status: 400 }
      );
    }

    const sanitizedStops: Array<{
      name?: string;
      address: string;
      lat: number;
      lng: number;
      stopOrder: number;
      visited: boolean;
      notes?: string;
    }> = [];

    for (let i = 0; i < intermediateStops.length; i++) {
      const stop = intermediateStops[i];
      if (!stop || !isValidCoordinate(stop.lat, stop.lng)) {
        return NextResponse.json(
          { error: `Invalid coordinates for intermediate stop ${i + 1}.` },
          { status: 400 }
        );
      }
      sanitizedStops.push({
        name: stop.name ? String(stop.name).trim() : `Stop ${i + 1}`,
        address: stop.address ? String(stop.address).trim() : `Stop ${i + 1}`,
        lat: Number(stop.lat),
        lng: Number(stop.lng),
        stopOrder: i + 1,
        visited: false,
        notes: stop.notes ? String(stop.notes).trim() : undefined,
      });
    }

    // 4. Validate vehicle category
    const validCategories = ["Bike", "Three-wheeler", "Car", "Mini Van", "Van", "Lorry"];
    if (!vehicleCategory || !validCategories.includes(vehicleCategory)) {
      return NextResponse.json(
        { error: `Invalid vehicle category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // 5. For Lorry, enforce goods description
    if (vehicleCategory === "Lorry") {
      if (!goodsDescription || typeof goodsDescription !== "string" || !goodsDescription.trim()) {
        return NextResponse.json(
          { error: "A brief description of goods being transported is required for Lorry bookings." },
          { status: 400 }
        );
      }
    }

    // 6. Read contact details strictly from authenticated user's database record (never trust client-supplied identity)
    const resolvedFullName = (user.name || session.user.name || "Rider").trim();
    const rawPhone = (user.phoneNumber || "").trim();
    const phoneDigits = rawPhone.replace(/[^0-9]/g, "");
    // Phone number is optional: use existing if valid, allow absent, never invent placeholder
    const resolvedPhone = phoneDigits.length >= 7 ? rawPhone : undefined;
    const resolvedEmail = (user.email || session.user.email || "guest@lankaairportride.com").trim();
    const resolvedNationality = (user.nationality || "Sri Lankan").trim();

    // Do not assume the phone number supports WhatsApp unless confirmed and phone exists
    const isWhatsAppConfirmed = Boolean(resolvedPhone && (hasWhatsAppConfirmed || (body as any).hasWhatsApp));

    // 7. Server-Side Fare Calculation & Snapshotting
    // Never trust client totals! Calculate driving road distance through all stops.
    let verified;
    try {
      verified = await validateAndSnapshotPickMeFare(
        vehicleCategory,
        { lat: pickupLocation.lat, lng: pickupLocation.lng },
        { lat: destinationLocation.lat, lng: destinationLocation.lng },
        sanitizedStops
      );
    } catch (fareErr: any) {
      return NextResponse.json(
        { error: fareErr.message || "Failed to calculate road fare. Please retry." },
        { status: 400 }
      );
    }

    const { route, estimatedFare, pricingSnapshot } = verified;

    // 8. Generate unique booking reference (PKM-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const count = await Booking.countDocuments({
      bookingReference: { $regex: `^PKM-${year}-` },
    });
    const refSeq = String(count + 1).padStart(5, "0");
    const bookingReference = `PKM-${year}-${refSeq}`;

    const instructions = pickupInstructions ? String(pickupInstructions).trim() : undefined;

    // 9. Create booking record with intermediate stops & instructions
    const booking = await Booking.create({
      bookingReference,
      bookingType: "LOCAL_RIDE",
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod,
      touristId,
      pickupAddress: pickupLocation.address || "Pickup Location",
      pickupLat: pickupLocation.lat,
      pickupLng: pickupLocation.lng,
      pickupInstructions: instructions,
      destinationAddress: destinationLocation.address || "Destination",
      destinationLat: destinationLocation.lat,
      destinationLng: destinationLocation.lng,
      intermediateStops: sanitizedStops,
      distanceKm: route.distanceKm,
      durationMins: route.durationMins,
      arrivalDate: rideNow ? new Date() : scheduledDate ? new Date(scheduledDate) : new Date(),
      arrivalTime: rideNow
        ? new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : scheduledTime || "12:00",
      passengerDetails: {
        fullName: resolvedFullName,
        email: resolvedEmail,
        whatsappNumber: resolvedPhone,
        alternativePhoneNumber: undefined,
        nationality: resolvedNationality,
        country: "Sri Lanka",
        adults: 1,
        children: 0,
        luggage: 0,
        childSeatRequired: false,
        meetAndGreetRequired: false,
        specialRequests: instructions || undefined,
        hasWhatsApp: isWhatsAppConfirmed,
      },
      fareBreakdown: {
        baseCharge: pricingSnapshot.baseFare,
        distanceCharge: Math.round(pricingSnapshot.distanceKm * pricingSnapshot.ratePerKm),
        airportPickupCharge: 0,
        trafficCharge: 0,
        nightCharge: 0,
        highwayToll: 0,
        additionalCharges: 0,
        discount: 0,
        totalEstimatedFare: estimatedFare,
      },
      pickMeDetails: {
        isPickMe: true,
        vehicleCategory,
        goodsDescription: goodsDescription ? goodsDescription.trim() : undefined,
        pickupInstructions: instructions,
        intermediateStops: sanitizedStops,
        baseFare: pricingSnapshot.baseFare,
        ratePerKm: pricingSnapshot.ratePerKm,
        minimumFare: pricingSnapshot.minimumFare,
        estimatedFare,
        pricingSnapshot,
        rideNow: Boolean(rideNow),
      },
    });

    // 10. Nearby Driver Geospatial & Road Dispatch (15 km radius, fresh GPS, matched vehicle category)
    try {
      const { dispatchLocalRideOffer } = await import("@/lib/nearbyDispatch");
      await dispatchLocalRideOffer(booking);
    } catch (err: any) {
      console.error("[PickMe Dispatch Error]", err);
    }

    // Keep admin board updated
    import("@/lib/realtime").then(({ broadcastBookingAvailable }) => {
      broadcastBookingAvailable(booking);
    }).catch(console.error);

    // 11. Notifications for rider, matching online drivers, and admin
    import("@/lib/notifications").then(async ({ sendNotification, notifyAdmins, notifyEligibleDrivers }) => {
      if (touristId) {
        await sendNotification({
          recipientId: touristId,
          type: "BOOKING_SUBMITTED",
          title: "Ride Requested",
          message: `Your PickMe ride request ${bookingReference} has been placed. Searching for nearby ${vehicleCategory} drivers...`,
          link: `/track?ref=${bookingReference}`,
          deduplicationKey: `pkm_submit_rider_${booking._id.toString()}`,
        });
      }

      const stopsLabel = sanitizedStops.length > 0 ? ` (via ${sanitizedStops.length} stops)` : "";
      await notifyAdmins({
        type: "NEW_PICKME_RIDE",
        title: "New PickMe Ride Request",
        message: `New local ${vehicleCategory} ride request ${bookingReference} from ${pickupLocation.address} to ${destinationLocation.address}${stopsLabel} (LKR ${estimatedFare.toLocaleString()}).`,
        link: `/admin/pickme`,
        deduplicationKey: `pkm_submit_admin_${booking._id.toString()}`,
      });

      await notifyEligibleDrivers({
        type: "NEW_AVAILABLE_TRIP",
        title: `New ${vehicleCategory} Ride Available!`,
        message: `New ${vehicleCategory} ride (${route.distanceKm} km${stopsLabel}, LKR ${estimatedFare.toLocaleString()}) available for acceptance.`,
        link: `/driver`,
        deduplicationKey: `pkm_submit_drv_${booking._id.toString()}`,
      });
    }).catch(console.error);

    return NextResponse.json(
      {
        success: true,
        message: "Ride request created successfully",
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        estimatedFare,
        distanceKm: route.distanceKm,
        durationMins: route.durationMins,
        intermediateStops: sanitizedStops,
        status: booking.status,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("PickMe booking creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create ride request." },
      { status: 500 }
    );
  }
}
