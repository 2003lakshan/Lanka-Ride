import { COUNTRIES, findCountry } from "@/lib/countries";

export interface NormalizedWhatsAppPhone {
  raw: string;
  digits: string;
  formatted: string;
  isValid: boolean;
  requiresCorrection: boolean;
  countryCode?: string;
  reason?: string;
}

/**
 * Normalizes any national or international phone number into official WhatsApp click-to-chat format.
 * WhatsApp requires digits only, in full international format, omitting any +, leading zeroes, brackets, dashes, or spaces.
 * E.g. Sri Lanka: "077 123 4567" -> "94771234567"
 * E.g. UK: "+44 7700 900123" -> "447700900123"
 */
export function normalizeWhatsAppPhone(
  phone?: string | null,
  countryHint?: string | null
): NormalizedWhatsAppPhone {
  const raw = (phone || "").trim();

  if (!raw || raw.toLowerCase().includes("no contact") || raw.toLowerCase().includes("unavailable")) {
    return {
      raw: "",
      digits: "",
      formatted: "",
      isValid: false,
      requiresCorrection: true,
      reason: "No phone number provided."
    };
  }

  // Clean characters, preserving leading '+' if present
  let hasPlus = raw.startsWith("+");
  let digitsOnly = raw.replace(/\D/g, "");

  if (!digitsOnly) {
    return {
      raw,
      digits: "",
      formatted: raw,
      isValid: false,
      requiresCorrection: true,
      reason: "Phone number contains no numeric digits."
    };
  }

  let finalDigits = digitsOnly;
  let detectedCountry = countryHint ? findCountry(countryHint) : undefined;

  // Case 1: Raw starts with '+'
  if (hasPlus) {
    finalDigits = digitsOnly;
  }
  // Case 2: Starts with national trunk prefix '0' (e.g. 077... in Sri Lanka or 07700... in UK)
  else if (raw.startsWith("0")) {
    const withoutZero = digitsOnly.replace(/^0+/, "");
    if (detectedCountry) {
      const dialDigits = detectedCountry.dialCode.replace(/\D/g, "");
      finalDigits = `${dialDigits}${withoutZero}`;
    } else {
      // Default national trunk prefix to Sri Lanka (+94)
      finalDigits = `94${withoutZero}`;
    }
  }
  // Case 3: Digits don't start with 0 or +, but might already have country dial code
  else {
    // If 9 digits starting with 7 (Sri Lanka mobile without 0 or 94)
    if (finalDigits.length === 9 && finalDigits.startsWith("7")) {
      finalDigits = `94${finalDigits}`;
    } else if (detectedCountry && !finalDigits.startsWith(detectedCountry.dialCode.replace(/\D/g, ""))) {
      finalDigits = `${detectedCountry.dialCode.replace(/\D/g, "")}${finalDigits}`;
    }
  }

  // Final length validation per E.164: between 7 and 15 digits
  const isValid = finalDigits.length >= 8 && finalDigits.length <= 15;

  // Pretty formatted representation for UI display
  let formatted = `+${finalDigits}`;
  if (finalDigits.startsWith("94") && finalDigits.length === 11) {
    formatted = `+94 ${finalDigits.slice(2, 4)} ${finalDigits.slice(4, 7)} ${finalDigits.slice(7)}`;
  } else if (finalDigits.startsWith("44") && finalDigits.length >= 11) {
    formatted = `+44 ${finalDigits.slice(2, 6)} ${finalDigits.slice(6)}`;
  } else if (finalDigits.startsWith("1") && finalDigits.length === 11) {
    formatted = `+1 (${finalDigits.slice(1, 4)}) ${finalDigits.slice(4, 7)}-${finalDigits.slice(7)}`;
  }

  return {
    raw,
    digits: finalDigits,
    formatted,
    isValid,
    requiresCorrection: !isValid,
    countryCode: detectedCountry?.code,
    reason: isValid ? undefined : "Phone number does not match international length requirements (8-15 digits)."
  };
}

/**
 * Builds official click-to-chat URL: https://wa.me/PHONENUMBER?text=ENCODED_MESSAGE
 */
export function buildWhatsAppLink(digits: string, message: string): string {
  const cleanDigits = digits.replace(/\D/g, "");
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanDigits}?text=${encodedText}`;
}

/**
 * Retrieves the public support number from environment or defaults to official business number.
 */
export function getWhatsAppSupportNumber(): string {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ||
    process.env.WHATSAPP_SUPPORT_NUMBER ||
    "+94771234567"
  );
}

/**
 * Resolves public application base URL for inclusion in click-to-chat links.
 */
export function getPublicAppUrl(): string {
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "");
  }
  // Sensible fallback for local development or public staging
  return envUrl ? envUrl.replace(/\/$/, "") : "https://lankaairportride.com";
}

// ============================================================================
// MESSAGE TEMPLATES (Concise, Readable, Branded)
// ============================================================================

export interface BookingAcknowledgementData {
  bookingRef: string;
  bookingId: string;
  riderName: string;
  tripDates?: string | null;
  pickup?: string | null;
  destination?: string | null;
  status?: string | null;
  appUrl?: string;
}

export function generateBookingAcknowledgementMessage(data: BookingAcknowledgementData): string {
  const appUrl = data.appUrl || getPublicAppUrl();
  const rider = data.riderName || "Valued Traveller";
  const dates = data.tripDates || "Scheduled Date";
  const pickup = data.pickup || "Designated Pickup";
  const dest = data.destination || "Designated Destination";
  const status = data.status ? data.status.replace(/_/g, " ") : "Under Review";

  return `Hello ${rider},

Thank you for choosing *At Your Service – Powered by Pexora*! 🚗🇱🇰

We have received your booking request:
• *Booking Ref:* ${data.bookingRef}
• *Trip Date(s):* ${dates}
• *Pickup:* ${pickup}
• *Destination/Route:* ${dest}
• *Current Status:* ${status}

Our operations team is reviewing your schedule and driver availability. We will notify you once your booking is approved and your driver is assigned.

Track your booking:
${appUrl}/bookings/${data.bookingId}

If you have any questions, feel free to reply directly here!`;
}

export interface BookingConfirmationData {
  bookingRef: string;
  bookingId: string;
  riderName: string;
  confirmedDate?: string | null;
  pickupTime?: string | null;
  pickupLocation?: string | null;
  vehicleName?: string | null;
  agreedPrice?: number | string | null;
  currency?: string | null;
  paymentStatus?: string | null;
  appUrl?: string;
}

export function generateBookingConfirmationMessage(data: BookingConfirmationData): string {
  const appUrl = data.appUrl || getPublicAppUrl();
  const rider = data.riderName || "Valued Traveller";
  const date = data.confirmedDate || "Confirmed Schedule";
  const time = data.pickupTime ? ` at ${data.pickupTime}` : "";
  const pickup = data.pickupLocation || "Designated Pickup Location";
  const vehicle = data.vehicleName || "Approved Travel Vehicle";
  const curr = data.currency || "LKR";
  const price = data.agreedPrice ? `${curr} ${Number(data.agreedPrice).toLocaleString()}` : "As agreed";
  const payStatus = data.paymentStatus ? data.paymentStatus.replace(/_/g, " ") : "Confirmed";

  return `Hello ${rider},

Great news! Your booking with *At Your Service – Powered by Pexora* is *CONFIRMED*! 🎉

• *Booking Ref:* ${data.bookingRef}
• *Date & Time:* ${date}${time}
• *Pickup:* ${pickup}
• *Vehicle:* ${vehicle}
• *Agreed Price:* ${price}
• *Payment Status:* ${payStatus}

View your complete itinerary and booking voucher:
${appUrl}/bookings/${data.bookingId}

We look forward to hosting you in Sri Lanka! Safe travels!`;
}

export interface NotifyDriverAssignmentData {
  bookingRef: string;
  driverName: string;
  tripDates?: string | null;
  pickupTime?: string | null;
  pickupLocation?: string | null;
  destination?: string | null;
  riderName: string;
  riderPhone?: string | null;
  partySize?: string | null;
  luggageCount?: number | null;
  vehicleName?: string | null;
  flightNumber?: string | null;
  appUrl?: string;
}

export function generateNotifyDriverAssignmentMessage(data: NotifyDriverAssignmentData): string {
  const appUrl = data.appUrl || getPublicAppUrl();
  const driver = data.driverName || "Driver";
  const dates = data.tripDates || "Upcoming Trip";
  const time = data.pickupTime ? ` (${data.pickupTime})` : "";
  const pickup = data.pickupLocation || "Pickup Point";
  const dest = data.destination || "Destination Itinerary";
  const rider = data.riderName || "Passenger";
  const phone = data.riderPhone || "Contact in Driver Portal";
  const party = data.partySize || "Passenger Group";
  const luggage = data.luggageCount ? ` • ${data.luggageCount} Luggage` : "";
  const flight = data.flightNumber ? `\n• *Flight:* ${data.flightNumber}` : "";

  return `Hello ${driver},

You have been assigned to an upcoming trip by *At Your Service – Powered by Pexora*! 🚖

• *Booking Ref:* ${data.bookingRef}
• *Date & Time:* ${dates}${time}
• *Pickup:* ${pickup}
• *Destination/Route:* ${dest}
• *Passenger:* ${rider} (${party}${luggage})
• *Passenger Contact:* ${phone}${flight}

Please inspect your driver portal to view full route details and update your live status:
${appUrl}/driver/trips

Thank you for delivering premium hospitality!`;
}

export interface NotifyTravellerDriverAssignedData {
  bookingRef: string;
  bookingId: string;
  riderName: string;
  driverName: string;
  driverPhone?: string | null;
  vehicleModel?: string | null;
  registrationNumber?: string | null;
  pickupLocation?: string | null;
  tripDates?: string | null;
  pickupTime?: string | null;
  appUrl?: string;
}

export function generateNotifyTravellerDriverAssignedMessage(data: NotifyTravellerDriverAssignedData): string {
  const appUrl = data.appUrl || getPublicAppUrl();
  const rider = data.riderName || "Valued Traveller";
  const driver = data.driverName || "Assigned Driver";
  const driverContact = data.driverPhone || "Provided in booking voucher";
  const vehicle = data.vehicleModel || "Verified Tourism Vehicle";
  const reg = data.registrationNumber ? ` (Plate: ${data.registrationNumber})` : "";
  const pickup = data.pickupLocation || "Pickup Location";
  const dates = data.tripDates || "Scheduled Date";
  const time = data.pickupTime ? ` at ${data.pickupTime}` : "";

  return `Hello ${rider},

Your driver has been assigned for your upcoming trip with *At Your Service – Powered by Pexora*! 🚗

• *Booking Ref:* ${data.bookingRef}
• *Driver Name:* ${driver}
• *Driver Contact:* ${driverContact}
• *Vehicle:* ${vehicle}${reg}
• *Pickup:* ${pickup} on ${dates}${time}

On the day of your trip, you can track your driver live on the map:
${appUrl}/track/${data.bookingRef}

Have a wonderful and safe journey in Sri Lanka!`;
}

export interface PackageApprovalData {
  packageTitle: string;
  packageId: string;
  driverName: string;
  revision?: number;
  appUrl?: string;
}

export function generatePackageApprovalMessage(data: PackageApprovalData): string {
  const appUrl = data.appUrl || getPublicAppUrl();
  const driver = data.driverName || "Partner Driver";
  const rev = data.revision ? ` (Revision ${data.revision})` : "";

  return `Hello ${driver},

Congratulations! Your travel package has been *APPROVED & PUBLISHED* by admin at *At Your Service – Powered by Pexora*! 🎉

• *Package Title:* "${data.packageTitle}"
• *Status:* Published & Live${rev}

Travellers can now discover and book your package directly:
${appUrl}/packages/${data.packageId}

Manage your packages in your driver portal:
${appUrl}/driver/packages

Thank you for partnering with Lanka Airport Ride!`;
}

export interface PackageChangesRequestedData {
  packageTitle: string;
  packageId: string;
  driverName: string;
  feedback: string;
  affectedSections?: string[];
  appUrl?: string;
}

export function generatePackageChangesRequestedMessage(data: PackageChangesRequestedData): string {
  const appUrl = data.appUrl || getPublicAppUrl();
  const driver = data.driverName || "Partner Driver";
  const sections = data.affectedSections && data.affectedSections.length > 0 
    ? `\n• *Affected Sections:* ${data.affectedSections.join(", ")}` 
    : "";

  return `Hello ${driver},

Admin has reviewed your travel package *" ${data.packageTitle} "* and requested adjustments:

• *Status:* Changes Requested${sections}
• *Admin Feedback:* "${data.feedback}"

Please update your package details and resubmit for approval:
${appUrl}/driver/packages/${data.packageId}/edit

Feel free to reply if you need any clarification!
*At Your Service – Powered by Pexora*`;
}

export interface CustomerSupportData {
  bookingRef?: string | null;
  riderName?: string | null;
  tripDate?: string | null;
}

export function generateCustomerSupportMessage(data?: CustomerSupportData): string {
  if (data?.bookingRef) {
    const rider = data.riderName ? ` (${data.riderName})` : "";
    const date = data.tripDate ? ` on ${data.tripDate}` : "";
    return `Hello At Your Service Support,

I need assistance regarding my booking:
• *Booking Ref:* ${data.bookingRef}${rider}${date}

Could you please assist me? Thank you!`;
  }

  return `Hello At Your Service Support,

I would like to enquire about your airport transfer and tour package services in Sri Lanka.`;
}

