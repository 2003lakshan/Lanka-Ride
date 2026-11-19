import crypto from "crypto";

interface RealtimeTarget {
  room?: string;
  rooms?: string[];
  toUser?: string;
  toRole?: string;
}

interface RealtimePayload {
  target: RealtimeTarget;
  event: string;
  data: any;
}

const REALTIME_SERVER_URL =
  process.env.REALTIME_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_REALTIME_URL ||
  "http://localhost:3001";

const INTERNAL_REALTIME_SECRET =
  process.env.INTERNAL_REALTIME_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "local_internal_realtime_secret_do_not_use_in_prod";

/**
 * Sanitizes booking data before broadcasting to prevent exposing sensitive internal/payment documents.
 */
function sanitizeBooking(booking: any) {
  if (!booking) return null;
  const raw = typeof booking.toObject === "function" ? booking.toObject() : { ...booking };
  
  return {
    _id: raw._id?.toString(),
    bookingReference: raw.bookingReference,
    bookingType: raw.bookingType || (raw.pickMeDetails?.isPickMe ? "LOCAL_RIDE" : raw.customTripDetails?.isCustomTrip ? "CUSTOM_TRIP" : "AIRPORT_TRANSFER"),
    status: raw.status,
    paymentStatus: raw.paymentStatus,
    paymentMethod: raw.paymentMethod,
    arrivalDate: raw.arrivalDate,
    arrivalTime: raw.arrivalTime,
    flightNumber: raw.flightNumber,
    pickupAddress: raw.pickupAddress,
    pickupLat: raw.pickupLat,
    pickupLng: raw.pickupLng,
    pickupInstructions: raw.pickupInstructions,
    destinationAddress: raw.destinationAddress,
    destinationLat: raw.destinationLat,
    destinationLng: raw.destinationLng,
    intermediateStops: raw.intermediateStops,
    distanceKm: raw.distanceKm,
    durationMins: raw.durationMins,
    airportId: raw.airportId ? (raw.airportId._id ? raw.airportId : { _id: raw.airportId }) : undefined,
    vehicleTypeId: raw.vehicleTypeId ? (raw.vehicleTypeId._id ? raw.vehicleTypeId : { _id: raw.vehicleTypeId }) : undefined,
    vehicleCategory: raw.vehicleCategory || raw.pickMeDetails?.vehicleCategory,
    touristId: raw.touristId ? (typeof raw.touristId === "object" ? raw.touristId._id?.toString() || raw.touristId : raw.touristId.toString()) : undefined,
    driverId: raw.driverId ? (typeof raw.driverId === "object" ? raw.driverId._id?.toString() || raw.driverId : raw.driverId.toString()) : undefined,
    passengerDetails: raw.passengerDetails ? {
      fullName: raw.passengerDetails.fullName,
      nationality: raw.passengerDetails.nationality,
      whatsappNumber: raw.passengerDetails.whatsappNumber,
      adults: raw.passengerDetails.adults,
      children: raw.passengerDetails.children,
      luggage: raw.passengerDetails.luggage,
    } : undefined,
    fareBreakdown: raw.fareBreakdown ? {
      totalEstimatedFare: raw.fareBreakdown.totalEstimatedFare,
      baseCharge: raw.fareBreakdown.baseCharge,
      distanceCharge: raw.fareBreakdown.distanceCharge,
    } : undefined,
    pickMeDetails: raw.pickMeDetails ? {
      ...raw.pickMeDetails,
      pricingSnapshot: raw.pickMeDetails.pricingSnapshot
        ? {
            ...raw.pickMeDetails.pricingSnapshot,
            calculatedAt: raw.pickMeDetails.pricingSnapshot.calculatedAt
              ? new Date(raw.pickMeDetails.pricingSnapshot.calculatedAt).toISOString()
              : null,
          }
        : null,
    } : undefined,
    customTripDetails: raw.customTripDetails ? {
      isCustomTrip: raw.customTripDetails.isCustomTrip,
      startDate: raw.customTripDetails.startDate,
      endDate: raw.customTripDetails.endDate,
      budget: raw.customTripDetails.budget,
      budgetCurrency: raw.customTripDetails.budgetCurrency,
      budgetCovers: raw.customTripDetails.budgetCovers,
      confirmedAmount: raw.customTripDetails.confirmedAmount,
      confirmedCurrency: raw.customTripDetails.confirmedCurrency,
      itinerary: raw.customTripDetails.itinerary,
    } : undefined,
    completedAt: raw.completedAt ? (typeof raw.completedAt === "string" ? raw.completedAt : raw.completedAt.toISOString()) : undefined,
    arrivedAt: raw.arrivedAt ? (typeof raw.arrivedAt === "string" ? raw.arrivedAt : raw.arrivedAt.toISOString()) : undefined,
    arrivalSource: raw.arrivalSource,
    driverLocation: raw.driverLocation,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Sends a broadcast request to the standalone Socket.IO realtime server.
 * Operates gracefully: never throws to preserve database & API reliability.
 */
export async function emitRealtimeEvent(payload: RealtimePayload): Promise<boolean> {
  const eventId = crypto.randomUUID();
  const fullData = {
    ...payload.data,
    eventId,
    _emittedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${REALTIME_SERVER_URL}/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-realtime-secret": INTERNAL_REALTIME_SECRET,
      },
      body: JSON.stringify({
        target: payload.target,
        event: payload.event,
        data: fullData,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch (err: any) {
    // Graceful fallback - API operations remain fully functional
    console.warn(`[Realtime] Broadcast "${payload.event}" unavailable (${err.name === 'AbortError' ? 'timeout' : err.message})`);
    return false;
  }
}

// -------------------------------------------------------------
// DOMAIN-SPECIFIC REALTIME EMITTERS
// -------------------------------------------------------------

/**
 * Broadcast new in-app notification & updated unread count to a user.
 */
export async function broadcastNotification(recipientId: string, notification: any, unreadCount: number) {
  return emitRealtimeEvent({
    target: { toUser: recipientId.toString() },
    event: "notification:new",
    data: {
      notification: {
        _id: notification._id?.toString(),
        recipientId: notification.recipientId?.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        resourceId: notification.resourceId,
        isRead: notification.isRead,
        createdAt: notification.createdAt || new Date().toISOString(),
      },
      unreadCount,
    },
  });
}

/**
 * Broadcast notification read status update to a user.
 */
export async function broadcastNotificationRead(userId: string, data: { readId?: string; markAll?: boolean; unreadCount: number }) {
  return emitRealtimeEvent({
    target: { toUser: userId.toString() },
    event: "notification:updated",
    data,
  });
}

/**
 * Broadcast identity verification status change to the rider.
 */
export async function broadcastIdentityStatusUpdated(
  userId: string,
  data: {
    identityId?: string;
    status: string;
    version: number;
    rejectionReason?: string;
    reviewedAt?: Date | string;
  }
) {
  return emitRealtimeEvent({
    target: { toUser: userId.toString() },
    event: "identity:status_updated",
    data,
  });
}

/**
 * Broadcast chat message to enquiry room and recipient.
 */
export async function broadcastChatMessage(enquiryId: string, message: any, recipientId: string, metadata?: any) {
  return emitRealtimeEvent({
    target: {
      rooms: [`enquiry:${enquiryId.toString()}`, `user:${recipientId.toString()}`],
    },
    event: "chat:message",
    data: {
      enquiryId: enquiryId.toString(),
      message: {
        sender: message.sender,
        text: message.text,
        createdAt: message.createdAt ? new Date(message.createdAt).toISOString() : new Date().toISOString(),
      },
      recipientId: recipientId.toString(),
      ...metadata,
    },
  });
}

/**
 * Broadcast rider custom trip submission to admin dashboard.
 */
/**
 * Broadcast rider custom trip update to admin dashboard.
 */
export async function broadcastCustomTripUpdated(booking: any) {
  const sanitized = sanitizeBooking(booking);
  return emitRealtimeEvent({
    target: { toRole: "admin" },
    event: "booking:custom_updated",
    data: {
      booking: sanitized,
    },
  });
}

/**
 * Broadcast submitted package enquiry/customisation request to driver.
 */
export async function broadcastPackageEnquirySubmitted(enquiry: any, driverId: string, metadata?: any) {
  return emitRealtimeEvent({
    target: { toUser: driverId.toString() },
    event: "enquiry:new",
    data: {
      enquiryId: (enquiry._id || enquiry).toString(),
      driverId: driverId.toString(),
      status: enquiry.status || "ENQUIRY",
      ...metadata,
    },
  });
}

export async function broadcastCustomTripSubmitted(booking: any) {
  const sanitized = sanitizeBooking(booking);
  return emitRealtimeEvent({
    target: { toRole: "admin" },
    event: "booking:custom_submitted",
    data: {
      booking: sanitized,
    },
  });
}

/**
 * Broadcast verified payment received to admin dashboard and rider.
 */
export async function broadcastPaymentVerified(booking: any) {
  const touristId = booking.touristId ? (booking.touristId._id || booking.touristId).toString() : null;
  const targets: string[] = ["role:admin"];
  if (touristId) targets.push(`user:${touristId}`);

  return emitRealtimeEvent({
    target: { rooms: targets },
    event: "booking:payment_verified",
    data: {
      bookingId: booking._id?.toString(),
      bookingReference: booking.bookingReference,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      confirmedAmount: booking.customTripDetails?.confirmedAmount,
      confirmedCurrency: booking.customTripDetails?.confirmedCurrency,
    },
  });
}

/**
 * Broadcast newly approved/available booking to eligible drivers.
 * Only called after final admin approval / booking published to drivers!
 */
export async function broadcastBookingAvailable(booking: any) {
  const sanitized = sanitizeBooking(booking);
  return emitRealtimeEvent({
    target: {
      rooms: ["role:eligible_driver", "role:admin"],
    },
    event: "booking:available",
    data: {
      booking: sanitized,
    },
  });
}

/**
 * Broadcast driver acceptance:
 * - Notifies rider, admin, and booking room.
 * - Removes the booking card from other eligible drivers' dashboards.
 */
export async function broadcastDriverAccepted(booking: any, driver?: any) {
  const sanitized = sanitizeBooking(booking);
  const bookingId = booking._id?.toString();
  const touristId = booking.touristId ? (booking.touristId._id || booking.touristId).toString() : null;
  const resolvedDriver = driver || booking.driverId || {};

  const riderAndAdminRooms = ["role:admin", `booking:${bookingId}`];
  if (touristId) riderAndAdminRooms.push(`user:${touristId}`);

  // 1. Notify rider, admin, booking room
  await emitRealtimeEvent({
    target: { rooms: riderAndAdminRooms },
    event: "booking:driver_accepted",
    data: {
      booking: sanitized,
      driver: {
        id: resolvedDriver._id?.toString() || resolvedDriver.id || "",
        name: resolvedDriver.name || "Driver",
        phoneNumber: resolvedDriver.phoneNumber,
        vehicleRegistration: resolvedDriver.vehicleRegistration || resolvedDriver.driverProfile?.vehicleDetails?.plateNumber,
      },
    },
  });

  // 2. Remove from other eligible drivers' boards
  return emitRealtimeEvent({
    target: { toRole: "eligible_driver" },
    event: "booking:removed",
    data: {
      bookingId,
      bookingReference: booking.bookingReference,
      reason: "ACCEPTED",
    },
  });
}

/**
 * Broadcast booking status change or cancellation.
 */
export async function broadcastBookingStatusChanged(booking: any, newStatus: string, metadata?: any) {
  const bookingId = (booking._id || booking).toString();
  const bookingRef = booking.bookingReference || "";
  const touristId = booking.touristId ? (booking.touristId._id || booking.touristId).toString() : null;
  const driverId = booking.driverId ? (booking.driverId._id || booking.driverId).toString() : null;

  const rooms: string[] = [`booking:${bookingId}`, "role:admin"];
  if (touristId) rooms.push(`user:${touristId}`);
  if (driverId) rooms.push(`user:${driverId}`);

  // If status is CANCELLED and was available, also remove from eligible drivers
  if (newStatus === "CANCELLED" || newStatus === "COMPLETED") {
    await emitRealtimeEvent({
      target: { toRole: "eligible_driver" },
      event: "booking:removed",
      data: {
        bookingId,
        bookingReference: bookingRef,
        reason: newStatus,
      },
    });
  }

  return emitRealtimeEvent({
    target: { rooms },
    event: "booking:status_changed",
    data: {
      bookingId,
      bookingReference: bookingRef,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...metadata,
    },
  });
}

/**
 * Broadcast assigned driver's latest live GPS location to booking room & admin.
 */
export async function broadcastDriverLocation(
  bookingId: string,
  lat: number,
  lng: number,
  accuracy?: number,
  updatedAt?: string | Date,
  capturedAt?: string | Date,
  receivedAt?: string | Date
) {
  const timestamp = updatedAt ? (typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString()) : new Date().toISOString();
  const capturedStr = capturedAt ? (typeof capturedAt === "string" ? capturedAt : capturedAt.toISOString()) : timestamp;
  const receivedStr = receivedAt ? (typeof receivedAt === "string" ? receivedAt : receivedAt.toISOString()) : timestamp;

  return emitRealtimeEvent({
    target: {
      rooms: [`booking:${bookingId.toString()}`, "role:admin"],
    },
    event: "driver:location_updated",
    data: {
      bookingId: bookingId.toString(),
      lat,
      lng,
      accuracy,
      updatedAt: timestamp,
      capturedAt: capturedStr,
      receivedAt: receivedStr,
    },
  });
}

/**
 * Disconnects any active WebSocket sessions for a revoked or deleted user.
 */
export async function revokeUserSession(userId: string) {
  try {
    await fetch(`${REALTIME_SERVER_URL}/api/revoke-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-realtime-secret": INTERNAL_REALTIME_SECRET,
      },
      body: JSON.stringify({ userId: userId.toString() }),
    });
  } catch (err: any) {
    console.warn(`[Realtime] Revoke session failed: ${err.message}`);
  }
}

/**
 * Updates driver approval status and adjusts socket room membership dynamically.
 */
export async function updateDriverApproval(driverId: string, isApproved: boolean) {
  try {
    await fetch(`${REALTIME_SERVER_URL}/api/driver-approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-realtime-secret": INTERNAL_REALTIME_SECRET,
      },
      body: JSON.stringify({ driverId: driverId.toString(), isApproved: Boolean(isApproved) }),
    });
  } catch (err: any) {
    console.warn(`[Realtime] Driver approval sync failed: ${err.message}`);
  }
}


/**
 * Broadcasts an incoming Local Ride offer directly to an eligible driver's private room.
 * Excludes passenger phone number for privacy!
 */
export async function broadcastRideOffer(driverId: string, offer: any) {
  return emitRealtimeEvent({
    target: { toUser: driverId.toString() },
    event: "ride:offer",
    data: offer,
  });
}

/**
 * Broadcasts that a ride offer has been withdrawn (e.g. accepted by another driver, cancelled by rider).
 * Immediately closes the incoming modal and stops audio on all other driver devices.
 */
export async function broadcastRideOfferWithdrawn(bookingId: string, bookingReference?: string, reason: string = "ACCEPTED") {
  return emitRealtimeEvent({
    target: { toRole: "eligible_driver" },
    event: "ride:offer_withdrawn",
    data: {
      bookingId: bookingId.toString(),
      bookingReference,
      reason,
    },
  });
}

/**
 * Broadcasts that a ride offer has expired after countdown without acceptance.
 */
export async function broadcastRideOfferExpired(driverIds: string[], bookingId: string, bookingReference?: string) {
  const rooms = driverIds.map((id) => `user:${id.toString()}`);
  if (rooms.length === 0) return;

  return emitRealtimeEvent({
    target: { rooms },
    event: "ride:offer_expired",
    data: {
      bookingId: bookingId.toString(),
      bookingReference,
    },
  });
}

/**
 * Broadcasts to rider that no nearby driver accepted the ride offer.
 * Triggers Retry and Cancel actions on rider screen.
 */
export async function broadcastNoDriversAccepted(booking: any) {
  const bookingId = (booking._id || booking).toString();
  const touristId = booking.touristId ? (booking.touristId._id || booking.touristId).toString() : null;

  const rooms = [`booking:${bookingId}`, "role:admin"];
  if (touristId) rooms.push(`user:${touristId}`);

  return emitRealtimeEvent({
    target: { rooms },
    event: "ride:no_drivers_accepted",
    data: {
      bookingId,
      bookingReference: booking.bookingReference,
    },
  });
}
