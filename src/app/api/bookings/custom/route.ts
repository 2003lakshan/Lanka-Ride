import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import User from "@/models/User";
import ContactVerification from "@/models/ContactVerification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "TOURIST") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const payload = await req.json();
    const { bookingId, isDraft, contactDetails, basics, logistics, itinerary } = payload;
    
    const user = await User.findById((session.user as any).id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Server-side enforcement of Contact Details & Verification
    if (!isDraft) {
      if (!contactDetails) {
        return NextResponse.json({ error: "Booking contact details are required." }, { status: 400 });
      }

      const { fullName, country, email, phone, isBookingForSomeoneElse, passengerDetails, confirmedAccuracy } = contactDetails;

      if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
        return NextResponse.json({ error: "Full name is required for booking contact." }, { status: 400 });
      }

      if (!country || typeof country !== "string" || !country.trim()) {
        return NextResponse.json({ error: "Country of residence is required." }, { status: 400 });
      }

      if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
      }

      if (!phone || typeof phone !== "string" || phone.replace(/\D/g, "").length < 7) {
        return NextResponse.json({ error: "A valid mobile number is required." }, { status: 400 });
      }

      if (!confirmedAccuracy) {
        return NextResponse.json({ error: "You must confirm that your contact and trip details are accurate." }, { status: 400 });
      }

      if (isBookingForSomeoneElse) {
        if (!passengerDetails?.fullName || !passengerDetails.fullName.trim()) {
          return NextResponse.json({ error: "Travelling passenger's full name is required when booking for someone else." }, { status: 400 });
        }
        if (!passengerDetails?.phone || passengerDetails.phone.replace(/\D/g, "").length < 7) {
          return NextResponse.json({ error: "Travelling passenger's mobile number is required when booking for someone else." }, { status: 400 });
        }
      }

      // Verify email status on server
      const cleanEmail = email.toLowerCase().trim();
      const hasVerifiedEmailDoc = await ContactVerification.findOne({
        userId: user._id,
        type: "EMAIL",
        target: cleanEmail,
        verifiedAt: { $exists: true, $ne: null },
      });
      const isEmailAccountVerified = user.email && user.email.toLowerCase().trim() === cleanEmail && user.isEmailVerified;

      if (!hasVerifiedEmailDoc && !isEmailAccountVerified) {
        return NextResponse.json(
          { error: `The email address "${email}" has not been verified. Please complete email verification.` },
          { status: 400 }
        );
      }

      // Verify phone status on server
      const cleanPhone = phone.trim().replace(/[^\d+]/g, "");
      const hasVerifiedPhoneDoc = await ContactVerification.findOne({
        userId: user._id,
        type: "PHONE",
        target: cleanPhone,
        verifiedAt: { $exists: true, $ne: null },
      });
      const isPhoneAccountVerified = user.phoneNumber && user.phoneNumber.replace(/[^\d+]/g, "") === cleanPhone && user.isPhoneVerified;

      if (!hasVerifiedPhoneDoc && !isPhoneAccountVerified) {
        return NextResponse.json(
          { error: `The mobile number "${phone}" has not been verified. Please complete mobile verification.` },
          { status: 400 }
        );
      }
    }

    let booking;
    const targetStatus = isDraft ? "DRAFT" : "PENDING_APPROVAL";

    if (bookingId) {
      booking = await Booking.findOne({ _id: bookingId, touristId: user._id });
      if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      
      booking.status = targetStatus;
    } else {
      const bookingReference = "CT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      booking = new Booking({
        bookingReference,
        touristId: user._id,
        isPackageBooking: false,
        status: targetStatus,
      });
    }

    // Update common fields
    booking.arrivalDate = basics.startDate ? new Date(basics.startDate) : undefined;
    booking.arrivalTime = logistics.pickupTime;
    booking.flightNumber = logistics.pickupFlight;
    booking.vehicleTypeId = basics.vehicleTypeId;
    
    booking.pickupAddress = logistics.pickupLocation?.address;
    booking.pickupLat = logistics.pickupLocation?.lat;
    booking.pickupLng = logistics.pickupLocation?.lng;
    
    booking.destinationAddress = logistics.dropoffLocation?.address;
    booking.destinationLat = logistics.dropoffLocation?.lat;
    booking.destinationLng = logistics.dropoffLocation?.lng;
    
    const isForOther = Boolean(contactDetails?.isBookingForSomeoneElse);
    const resolvedContactName = contactDetails?.fullName || user.name;
    const resolvedContactEmail = contactDetails?.email || user.email;
    const resolvedContactPhone = contactDetails?.phone || user.phoneNumber || "Unknown";
    const resolvedCountry = contactDetails?.country || user.nationality || "Unknown";

    booking.passengerDetails = {
      fullName: isForOther ? (contactDetails?.passengerDetails?.fullName || resolvedContactName) : resolvedContactName,
      nationality: resolvedCountry,
      country: resolvedCountry,
      email: resolvedContactEmail,
      whatsappNumber: isForOther ? (contactDetails?.passengerDetails?.phone || resolvedContactPhone) : resolvedContactPhone,
      alternativePhoneNumber: isForOther ? resolvedContactPhone : undefined,
      adults: basics.adults,
      children: basics.children,
      luggage: basics.luggage,
      childSeatRequired: false,
      meetAndGreetRequired: false,
    };
    
    booking.distanceKm = payload.totalDistanceKm || 0;
    booking.durationMins = payload.totalDurationMins || 0;
    
    booking.customTripDetails = {
      isCustomTrip: true,
      bookingContact: contactDetails ? {
        fullName: resolvedContactName,
        country: resolvedCountry,
        email: resolvedContactEmail,
        phone: resolvedContactPhone,
        isBookingForSomeoneElse: isForOther,
        passenger: isForOther ? {
          fullName: contactDetails.passengerDetails?.fullName || "",
          phone: contactDetails.passengerDetails?.phone || "",
        } : undefined,
        confirmedAccuracy: Boolean(contactDetails.confirmedAccuracy),
        verifiedAt: new Date(),
      } : undefined,
      startDate: basics.startDate ? new Date(basics.startDate) : undefined,
      endDate: basics.endDate ? new Date(basics.endDate) : undefined,
      budget: basics.budget ? Number(basics.budget) : undefined,
      budgetCurrency: basics.budgetCurrency || "USD",
      budgetCovers: basics.budgetCovers || "Transport only",
      budgetFlexibility: basics.budgetFlexibility || "Negotiable",
      budgetNotes: basics.budgetNotes || "",
      pickupFlightNumber: logistics.pickupFlight,
      dropoffFlightNumber: logistics.dropoffFlight,
      dropoffLocation: logistics.dropoffLocation,
      dropoffTime: logistics.dropoffTime,
      itinerary: itinerary.map((day: any) => ({
        dayNumber: day.dayNumber,
        date: new Date(day.date),
        startingLocation: day.startingLocation ? {
          address: day.startingLocation.address,
          lat: day.startingLocation.lat,
          lng: day.startingLocation.lng
        } : undefined,
        departureTime: day.departureTime,
        placesToVisit: day.placesToVisit.map((p: any) => ({
          name: p.location.address,
          lat: p.location.lat,
          lng: p.location.lng,
          activityTime: p.activityTime
        })),
        overnightLocation: day.overnightLocation ? {
          city: day.overnightLocation.address.split(',')[0],
          hotel: day.overnightLocation.address,
          lat: day.overnightLocation.lat,
          lng: day.overnightLocation.lng
        } : undefined,
        notes: day.notes,
        distanceKm: day.distanceKm,
        drivingTimeMins: day.drivingTimeMins
      }))
    };

    await booking.save();

    if (!isDraft) {
      const isUpdate = Boolean(bookingId);

      if (isUpdate) {
        import("@/lib/realtime").then(({ broadcastCustomTripUpdated }) => {
          broadcastCustomTripUpdated(booking);
        }).catch(console.error);

        import("@/lib/notifications").then(async ({ notifyAdmins }) => {
          await notifyAdmins({
            type: "TRIP_UPDATED",
            title: "Trip Request Updated",
            message: `Rider updated custom trip ${booking.bookingReference}.`,
            link: `/admin/custom-trips/${booking._id.toString()}`,
            deduplicationKey: `custom_update_admin_${booking._id.toString()}_${Date.now()}`
          });
        }).catch(console.error);
      } else {
        import("@/lib/realtime").then(({ broadcastCustomTripSubmitted }) => {
          broadcastCustomTripSubmitted(booking);
        }).catch(console.error);

        import("@/lib/notifications").then(async ({ sendNotification, notifyAdmins }) => {
          await sendNotification({
            recipientId: user._id.toString(),
            type: "BOOKING_SUBMITTED",
            title: "Custom Trip Submitted",
            message: `Your custom trip request ${booking.bookingReference} has been submitted for review.`,
            link: `/my-bookings?ref=${booking.bookingReference}`,
            deduplicationKey: `custom_submit_rider_${booking._id.toString()}`
          });
          await notifyAdmins({
            type: "NEW_CUSTOM_TRIP",
            title: "New Custom Trip Request",
            message: `A new custom trip ${booking.bookingReference} requires approval and pricing.`,
            link: `/admin/custom-trips/${booking._id.toString()}`,
            deduplicationKey: `custom_submit_admin_${booking._id.toString()}`
          });
        }).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, bookingId: booking._id });

  } catch (error: any) {
    console.error("Error saving custom trip:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
