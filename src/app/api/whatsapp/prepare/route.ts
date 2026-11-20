import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import Package from "@/models/Package";
import User from "@/models/User";
import "@/models/VehicleType";
import "@/models/Airport";
import "@/models/PackageEnquiry";
import { 
  normalizeWhatsAppPhone, 
  buildWhatsAppLink,
  getWhatsAppSupportNumber,
  generateBookingAcknowledgementMessage,
  generateBookingConfirmationMessage,
  generateNotifyDriverAssignmentMessage,
  generateNotifyTravellerDriverAssignedMessage,
  generatePackageApprovalMessage,
  generatePackageChangesRequestedMessage,
  generateCustomerSupportMessage
} from "@/lib/whatsapp";
import { formatSriLankanDate } from "@/lib/dateTime";
import { generateShareToken, hashShareToken, calculateShareTokenExpiry } from "@/lib/shareToken";
import { getPublicAppUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { type, bookingId, packageId, customPhone, customCountry } = body;

    if (!type) {
      return NextResponse.json({ error: "Action type is required." }, { status: 400 });
    }

    const adminActions = [
      "BOOKING_ACKNOWLEDGEMENT",
      "BOOKING_CONFIRMATION",
      "NOTIFY_ASSIGNED_DRIVER",
      "NOTIFY_TRAVELLER_ASSIGNMENT",
      "PACKAGE_APPROVAL",
      "PACKAGE_CHANGES_REQUESTED"
    ];

    const isAdminAction = adminActions.includes(type);

    // Permission enforcement: Admin actions require role ADMIN
    if (isAdminAction) {
      if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json(
          { error: "Unauthorized. Admin privileges required for administrative notifications." },
          { status: 401 }
        );
      }
    }

    await dbConnect();

    // ------------------------------------------------------------------------
    // CASE 1: Customer Support
    // ------------------------------------------------------------------------
    if (type === "CUSTOMER_SUPPORT") {
      const supportNumber = getWhatsAppSupportNumber();
      const normalizedPhone = normalizeWhatsAppPhone(supportNumber);

      let bookingRef: string | null = null;
      let riderName: string | null = null;
      let tripDate: string | null = null;

      if (bookingId) {
        const booking = await Booking.findById(bookingId)
          .populate("touristId", "name email phoneNumber")
          .populate("driverId", "name email phoneNumber")
          .lean();

        if (booking) {
          const userId = (session?.user as any)?.id;
          const userRole = (session?.user as any)?.role;
          const isRider = booking.touristId && (booking.touristId as any)._id?.toString() === userId;
          const isDriver = booking.driverId && (booking.driverId as any)._id?.toString() === userId;
          const isAdmin = userRole === "ADMIN";

          // Only attach booking context if user is authorized for this booking
          if (isAdmin || isRider || isDriver) {
            bookingRef = booking.bookingReference;
            riderName = booking.passengerDetails?.fullName || (booking.touristId as any)?.name || "Traveller";
            tripDate = booking.arrivalDate ? formatSriLankanDate(booking.arrivalDate) : null;
          }
        }
      }

      const message = generateCustomerSupportMessage({ bookingRef, riderName, tripDate });
      const waLink = buildWhatsAppLink(normalizedPhone.digits, message);

      return NextResponse.json({
        success: true,
        type,
        title: "Contact WhatsApp Business Support",
        recipientName: "At Your Service Support",
        recipientRole: "Customer Support",
        phone: normalizedPhone,
        message,
        waLink,
        bookingRef
      });
    }

    // ------------------------------------------------------------------------
    // CASE 2: Booking-Related Admin Actions
    // ------------------------------------------------------------------------
    if (
      type === "BOOKING_ACKNOWLEDGEMENT" ||
      type === "BOOKING_CONFIRMATION" ||
      type === "NOTIFY_ASSIGNED_DRIVER" ||
      type === "NOTIFY_TRAVELLER_ASSIGNMENT"
    ) {
      if (!bookingId) {
        return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
      }

      const booking = await Booking.findById(bookingId)
        .populate("airportId")
        .populate("vehicleTypeId")
        .populate("touristId", "name email phoneNumber nationality")
        .populate("driverId", "name email phoneNumber vehicleDetails vehicleRegistration")
        .populate({
          path: "packageEnquiryId",
          populate: { path: "riderId", select: "name email phoneNumber nationality" }
        })
        .populate("packageId", "title category")
        .lean();

      if (!booking) {
        return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      }

      // Resolve Passenger Name and Phone (Contact Model Hierarchy)
      const p = booking.passengerDetails;
      const tourist = booking.touristId as any;
      const enquiryRider = (booking.packageEnquiryId as any)?.riderId;

      const rawRiderName =
        (typeof p?.fullName === "string" ? p.fullName.trim() : "") ||
        (typeof tourist?.name === "string" ? tourist.name.trim() : "") ||
        (typeof enquiryRider?.name === "string" ? enquiryRider.name.trim() : "") ||
        "Valued Traveller";

      const rawRiderPhone =
        (typeof p?.whatsappNumber === "string" ? p.whatsappNumber.trim() : "") ||
        (typeof p?.alternativePhoneNumber === "string" ? p.alternativePhoneNumber.trim() : "") ||
        (typeof tourist?.phoneNumber === "string" ? tourist.phoneNumber.trim() : "") ||
        (typeof enquiryRider?.phoneNumber === "string" ? enquiryRider.phoneNumber.trim() : "") ||
        "";

      const countryHint = p?.country || p?.nationality || tourist?.nationality || enquiryRider?.nationality || "Sri Lanka";

      // Formatted trip details
      const tripDates = booking.arrivalDate
        ? formatSriLankanDate(booking.arrivalDate)
        : booking.customTripDetails?.startDate
        ? `${formatSriLankanDate(booking.customTripDetails.startDate)} - ${formatSriLankanDate(booking.customTripDetails.endDate || booking.customTripDetails.startDate)}`
        : "Scheduled Date";

      const pickupLocation =
        booking.pickupAddress || (booking.airportId as any)?.name || "Colombo Airport (CMB)";

      let destinationOrSummary = booking.destinationAddress || "Designated Destination";
      if (booking.customTripDetails?.isCustomTrip) {
        const stopsCount = (booking.customTripDetails?.itinerary || []).reduce(
          (acc: number, d: any) => acc + (d.placesToVisit?.length || 0),
          0
        );
        destinationOrSummary = `Custom Multi-Day Tour (${booking.customTripDetails.itinerary?.length || 1} Days, ${stopsCount} Stops)`;
      } else if (booking.packageId) {
        destinationOrSummary = `Tour Package: ${(booking.packageId as any)?.title || "Curated Tour"}`;
      }

      const vehicleName =
        (booking.driverId as any)?.vehicleDetails?.model ||
        (booking.vehicleTypeId as any)?.name ||
        "Comfort Sedan / Van";

      // Sub-case 2A: Booking Acknowledgement
      if (type === "BOOKING_ACKNOWLEDGEMENT") {
        const phone = normalizeWhatsAppPhone(customPhone || rawRiderPhone, customCountry || countryHint);
        const message = generateBookingAcknowledgementMessage({
          bookingRef: booking.bookingReference,
          bookingId: booking._id.toString(),
          riderName: rawRiderName,
          tripDates,
          pickup: pickupLocation,
          destination: destinationOrSummary,
          status: booking.status
        });

        return NextResponse.json({
          success: true,
          type,
          title: "Send Booking Acknowledgement via WhatsApp",
          recipientName: rawRiderName,
          recipientRole: "Traveller",
          phone,
          message,
          waLink: buildWhatsAppLink(phone.digits, message),
          bookingRef: booking.bookingReference
        });
      }

      // Sub-case 2B: Booking Confirmation
      if (type === "BOOKING_CONFIRMATION") {
        const agreedPrice =
          booking.customTripDetails?.confirmedAmount ||
          booking.fareBreakdown?.totalEstimatedFare ||
          null;

        const currency =
          booking.customTripDetails?.confirmedCurrency ||
          "USD";

        const pickupTime = booking.arrivalTime || (booking.customTripDetails?.itinerary?.[0] as any)?.departureTime;

        const phone = normalizeWhatsAppPhone(customPhone || rawRiderPhone, customCountry || countryHint);
        const message = generateBookingConfirmationMessage({
          bookingRef: booking.bookingReference,
          bookingId: booking._id.toString(),
          riderName: rawRiderName,
          confirmedDate: tripDates,
          pickupTime,
          pickupLocation,
          vehicleName,
          agreedPrice,
          currency,
          paymentStatus: booking.paymentStatus
        });

        return NextResponse.json({
          success: true,
          type,
          title: "Send Booking Confirmation via WhatsApp",
          recipientName: rawRiderName,
          recipientRole: "Traveller",
          phone,
          message,
          waLink: buildWhatsAppLink(phone.digits, message),
          bookingRef: booking.bookingReference
        });
      }

      // Sub-case 2C: Notify Assigned Driver
      if (type === "NOTIFY_ASSIGNED_DRIVER") {
        const driver = booking.driverId as any;
        if (!driver) {
          return NextResponse.json(
            { error: "No driver is assigned to this trip yet. Please assign a driver first." },
            { status: 400 }
          );
        }

        const partySize = `${p?.adults || 1} Adults${p?.children ? `, ${p.children} Children` : ""}`;
        const phone = normalizeWhatsAppPhone(customPhone || driver.phoneNumber, "Sri Lanka");

        const message = generateNotifyDriverAssignmentMessage({
          bookingRef: booking.bookingReference,
          driverName: driver.name || "Partner Driver",
          tripDates,
          pickupTime: booking.arrivalTime || (booking.customTripDetails?.itinerary?.[0] as any)?.departureTime,
          pickupLocation,
          destination: destinationOrSummary,
          riderName: rawRiderName,
          riderPhone: rawRiderPhone || "Provided in Driver Portal",
          partySize,
          luggageCount: p?.luggage || 0,
          vehicleName: driver.vehicleDetails?.model || (booking.vehicleTypeId as any)?.name,
          flightNumber: booking.flightNumber || booking.customTripDetails?.pickupFlightNumber
        });

        return NextResponse.json({
          success: true,
          type,
          title: "Notify Assigned Driver via WhatsApp",
          recipientName: driver.name,
          recipientRole: "Assigned Driver",
          phone,
          message,
          waLink: buildWhatsAppLink(phone.digits, message),
          bookingRef: booking.bookingReference
        });
      }

      // Sub-case 2D: Notify Traveller About Driver Assignment
      if (type === "NOTIFY_TRAVELLER_ASSIGNMENT") {
        const driver = booking.driverId as any;
        if (!driver) {
          return NextResponse.json(
            { error: "No driver has been assigned to this trip yet." },
            { status: 400 }
          );
        }

        // Generate fresh share token for safe, login-free live ride tracking
        const rawToken = generateShareToken();
        const tokenHash = hashShareToken(rawToken);
        const expiresAt = calculateShareTokenExpiry(booking);

        await Booking.findByIdAndUpdate(bookingId, {
          $set: {
            shareTokenHash: tokenHash,
            shareTokenCreatedAt: new Date(),
            shareTokenExpiresAt: expiresAt,
            shareTokenRevoked: false,
            shareTokenRevokedAt: null,
          },
        });

        const appUrl = getPublicAppUrl();
        const shareableTrackingUrl = `${appUrl}/track/shared/${rawToken}`;

        const phone = normalizeWhatsAppPhone(customPhone || rawRiderPhone, customCountry || countryHint);
        const message = generateNotifyTravellerDriverAssignedMessage({
          bookingRef: booking.bookingReference,
          bookingId: booking._id.toString(),
          riderName: rawRiderName,
          driverName: driver.name || "Verified Professional Driver",
          driverPhone: driver.phoneNumber || "Available upon pickup",
          vehicleModel: driver.vehicleDetails?.model || (booking.vehicleTypeId as any)?.name,
          registrationNumber: driver.vehicleDetails?.registrationNumber || driver.vehicleRegistration,
          pickupLocation,
          tripDates,
          pickupTime: booking.arrivalTime || (booking.customTripDetails?.itinerary?.[0] as any)?.departureTime,
          shareableTrackingUrl,
        });

        return NextResponse.json({
          success: true,
          type,
          title: "Notify Traveller of Driver Assignment via WhatsApp",
          recipientName: rawRiderName,
          recipientRole: "Traveller",
          phone,
          message,
          waLink: buildWhatsAppLink(phone.digits, message),
          bookingRef: booking.bookingReference
        });
      }
    }

    // ------------------------------------------------------------------------
    // CASE 3: Package-Related Admin Actions
    // ------------------------------------------------------------------------
    if (type === "PACKAGE_APPROVAL" || type === "PACKAGE_CHANGES_REQUESTED") {
      if (!packageId) {
        return NextResponse.json({ error: "Package ID is required." }, { status: 400 });
      }

      const pkg = await Package.findById(packageId).populate("driverId", "name email phoneNumber").lean();
      if (!pkg) {
        return NextResponse.json({ error: "Package not found." }, { status: 404 });
      }

      const driver = pkg.driverId as any;
      const driverName = driver?.name || "Partner Driver";
      const driverPhone = driver?.phoneNumber || "";
      const phone = normalizeWhatsAppPhone(customPhone || driverPhone, "Sri Lanka");

      if (type === "PACKAGE_APPROVAL") {
        const message = generatePackageApprovalMessage({
          packageTitle: pkg.title,
          packageId: pkg._id.toString(),
          driverName,
          revision: pkg.revision || 1
        });

        return NextResponse.json({
          success: true,
          type,
          title: "Notify Driver of Package Approval via WhatsApp",
          recipientName: driverName,
          recipientRole: "Package Driver",
          phone,
          message,
          waLink: buildWhatsAppLink(phone.digits, message)
        });
      }

      if (type === "PACKAGE_CHANGES_REQUESTED") {
        const feedback = pkg.changeRequest?.feedback || "Please inspect the change request notes in your driver portal.";
        const affectedSections = pkg.changeRequest?.affectedFields || [];

        const message = generatePackageChangesRequestedMessage({
          packageTitle: pkg.title,
          packageId: pkg._id.toString(),
          driverName,
          feedback,
          affectedSections
        });

        return NextResponse.json({
          success: true,
          type,
          title: "Notify Driver of Changes Requested via WhatsApp",
          recipientName: driverName,
          recipientRole: "Package Driver",
          phone,
          message,
          waLink: buildWhatsAppLink(phone.digits, message)
        });
      }
    }

    return NextResponse.json({ error: "Unsupported WhatsApp action type." }, { status: 400 });
  } catch (err: any) {
    console.error("WhatsApp prepare error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to prepare WhatsApp message." },
      { status: 500 }
    );
  }
}
