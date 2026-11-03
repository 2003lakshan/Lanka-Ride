/**
 * Strongly-typed DTOs and server-to-client serializers for bookings and package enquiries.
 *
 * Ensures all MongoDB ObjectIds, including approvedBy and nested subdocument IDs,
 * are converted to plain strings. All Dates are converted to ISO strings.
 * All prototypes are plain objects to satisfy React Server Components (Flight) serialization.
 */

export interface MyBookingAirportDTO {
  _id: string;
  name: string;
  code?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  pickupCharge?: number;
}

export interface MyBookingVehicleTypeDTO {
  _id: string;
  name: string;
  image?: string;
  description?: string;
  maxPassengers?: number;
  maxLuggage?: number;
}

export interface MyBookingDriverDTO {
  _id: string;
  name: string;
  phoneNumber?: string | null;
  vehicleRegistration?: string | null;
}

export interface MyBookingPassengerDetailsDTO {
  fullName: string;
  nationality?: string;
  country?: string;
  email: string;
  whatsappNumber?: string;
  alternativePhoneNumber?: string | null;
  adults: number;
  children: number;
  luggage: number;
  childSeatRequired?: boolean;
  meetAndGreetRequired?: boolean;
  specialRequests?: string | null;
}

export interface MyBookingFareBreakdownDTO {
  baseCharge: number;
  distanceCharge: number;
  airportPickupCharge: number;
  trafficCharge: number;
  nightCharge: number;
  highwayToll: number;
  additionalCharges: number;
  discount: number;
  totalEstimatedFare: number;
}

export interface MyCustomTripPlaceDTO {
  _id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  activityTime?: string;
  visited?: boolean;
  visitedAt?: string | null;
}

export interface MyCustomTripOvernightDTO {
  _id?: string;
  city?: string;
  hotel?: string;
  lat?: number;
  lng?: number;
  visited?: boolean;
  visitedAt?: string | null;
}

export interface MyCustomTripDayDTO {
  dayNumber: number;
  date?: string | null;
  startingLocation?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  departureTime?: string;
  placesToVisit: MyCustomTripPlaceDTO[];
  overnightLocation?: MyCustomTripOvernightDTO;
  notes?: string;
  distanceKm?: number;
  drivingTimeMins?: number;
}

export interface MyCustomTripDetailsDTO {
  isCustomTrip?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number;
  budgetCurrency?: "LKR" | "USD" | string;
  budgetCovers?: "Transport only" | "Entire trip" | string;
  budgetFlexibility?: "Fixed maximum" | "Negotiable" | string;
  budgetNotes?: string;
  pickupFlightNumber?: string;
  dropoffFlightNumber?: string;
  dropoffLocation?: {
    address?: string;
    lat?: number;
    lng?: number;
    visited?: boolean;
    visitedAt?: string | null;
  };
  dropoffTime?: string;
  itinerary?: MyCustomTripDayDTO[];
  confirmedAmount?: number;
  confirmedCurrency?: "LKR" | "USD" | "EUR" | "GBP" | string;
}


export interface MyPickMeStopDTO {
  address: string;
  lat: number;
  lng: number;
  stopOrder: number;
  visited?: boolean;
  visitedAt?: string | null;
  notes?: string;
}

export interface MyBookingDriverLocationDTO {
  lat: number;
  lng: number;
  accuracy?: number | null;
  capturedAt?: string | null;
  receivedAt?: string | null;
  updatedAt?: string | null;
}

export interface MyBookingDTO {
  _id: string;
  bookingReference: string;
  bookingType?: "AIRPORT_TRANSFER" | "CUSTOM_TRIP" | "LOCAL_RIDE";
  pickMeDetails?: {
    isPickMe?: boolean;
    vehicleCategory?: string;
    goodsDescription?: string | null;
    baseFare?: number;
    ratePerKm?: number;
    minimumFare?: number;
    estimatedFare?: number;
    pricingSnapshot?: any;
    rideNow?: boolean;
  } | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  pickupAddress?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  destinationAddress?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  arrivalDate?: string | null;
  arrivalTime?: string | null;
  flightNumber?: string | null;
  distanceKm?: number | null;
  durationMins?: number | null;
  isPackageBooking?: boolean;
  packageId?: string | null;
  packageEnquiryId?: string | null;
  packageItineraryDetails?: any;
  touristId?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  arrivedAt?: string | null;
  arrivalSource?: "GPS" | "MANUAL" | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  adminNotes?: Record<string, any> | null;
  airportId?: MyBookingAirportDTO | null;
  vehicleTypeId?: MyBookingVehicleTypeDTO | null;
  driverId?: MyBookingDriverDTO | string | null;
  passengerDetails?: MyBookingPassengerDetailsDTO | null;
  fareBreakdown?: MyBookingFareBreakdownDTO | null;
  customTripDetails?: MyCustomTripDetailsDTO | null;
  driverLocation?: MyBookingDriverLocationDTO | null;
  pickupInstructions?: string | null;
  intermediateStops?: MyPickMeStopDTO[] | null;
}

export interface MyEnquiryMessageDTO {
  _id?: string;
  sender: "RIDER" | "DRIVER" | string;
  text: string;
  createdAt: string;
}

export interface MyEnquiryPackageDTO {
  _id: string;
  title: string;
}

export interface MyPackageEnquiryDTO {
  _id: string;
  packageId?: MyEnquiryPackageDTO | null;
  riderId?: string | null;
  driverId?: string | null;
  status: string;
  riderUnread: boolean;
  driverUnread: boolean;
  requestedDates?: string | null;
  requestedPassengers?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  messages: MyEnquiryMessageDTO[];
  activeQuote?: any;
  historyQuotes?: any[];
}

/**
 * Safely converts an ObjectId, string, or object with _id into a plain string.
 * Avoids infinite recursion on Mongoose ObjectIds where `_id` getter returns `this`.
 */
export function toIdString(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val;
  if (
    val._bsontype === "ObjectID" ||
    val._bsontype === "ObjectId" ||
    val.constructor?.name === "ObjectId" ||
    typeof val.toHexString === "function"
  ) {
    return val.toString();
  }
  if (typeof val === "object" && val._id && val._id !== val) {
    return toIdString(val._id);
  }
  if (typeof val.toString === "function") {
    const str = val.toString();
    if (str !== "[object Object]") return str;
  }
  return String(val);
}

/**
 * Safely converts a Date, ISO string, or timestamp into an ISO string.
 * Returns null if the value is null, undefined, or invalid.
 */
export function toIsoString(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Recursively guarantees that NO BSON ObjectIds, Date objects, or objects with
 * `.toJSON` methods remain. Returns pure plain serializable objects, arrays, and primitives.
 */
export function sanitizePlainSerializable<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) {
    return (isNaN(val.getTime()) ? null : val.toISOString()) as unknown as T;
  }
  if (typeof val !== "object") {
    return val;
  }
  if (
    (val as any)._bsontype === "ObjectID" ||
    (val as any)._bsontype === "ObjectId" ||
    (val as any).constructor?.name === "ObjectId" ||
    (typeof (val as any).toHexString === "function" && typeof (val as any).equals === "function")
  ) {
    return (val as any).toString() as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizePlainSerializable) as unknown as T;
  }
  const plain: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    if (typeof value === "function" || typeof value === "symbol") continue;
    if (key === "__v") continue;
    plain[key] = sanitizePlainSerializable(value);
  }
  return plain as T;
}

/**
 * Transforms a raw Mongoose Booking document (lean or hydrated) into a pure, plain MyBookingDTO.
 * Explicitly converts ObjectIds (including approvedBy and nested IDs) to strings,
 * converts Dates to ISO strings, preserves populated references safely as plain objects,
 * and eliminates any prototype or `.toJSON` methods that React Flight rejects.
 */
export function serializeBookingToDTO(b: any): MyBookingDTO {
  if (!b) {
    throw new Error("Cannot serialize null or undefined booking");
  }

  const airportId = b.airportId
    ? typeof b.airportId === "object" && b.airportId._id
      ? {
          _id: toIdString(b.airportId._id) || "",
          name: b.airportId.name || "Unknown Airport",
          code: b.airportId.code || "",
          address: b.airportId.address || "",
          latitude: typeof b.airportId.latitude === "number" ? b.airportId.latitude : undefined,
          longitude: typeof b.airportId.longitude === "number" ? b.airportId.longitude : undefined,
          pickupCharge: typeof b.airportId.pickupCharge === "number" ? b.airportId.pickupCharge : 0,
        }
      : typeof b.airportId === "string" || b.airportId.constructor?.name === "ObjectId"
      ? { _id: toIdString(b.airportId) || "", name: "Unknown Airport" }
      : null
    : null;

  const vehicleTypeId = b.vehicleTypeId
    ? typeof b.vehicleTypeId === "object" && b.vehicleTypeId._id
      ? {
          _id: toIdString(b.vehicleTypeId._id) || "",
          name: b.vehicleTypeId.name || "Vehicle",
          image: b.vehicleTypeId.image || "",
          description: b.vehicleTypeId.description || "",
          maxPassengers: typeof b.vehicleTypeId.maxPassengers === "number" ? b.vehicleTypeId.maxPassengers : undefined,
          maxLuggage: typeof b.vehicleTypeId.maxLuggage === "number" ? b.vehicleTypeId.maxLuggage : undefined,
        }
      : typeof b.vehicleTypeId === "string" || b.vehicleTypeId.constructor?.name === "ObjectId"
      ? { _id: toIdString(b.vehicleTypeId) || "", name: "Vehicle" }
      : null
    : null;

  const driverId = b.driverId
    ? typeof b.driverId === "object" && b.driverId._id
      ? {
          _id: toIdString(b.driverId._id) || "",
          name: b.driverId.name || "Driver",
          phoneNumber: b.driverId.phoneNumber || null,
          vehicleRegistration: b.driverId.vehicleRegistration || null,
        }
      : toIdString(b.driverId)
    : null;

  const passengerDetails = b.passengerDetails
    ? {
        fullName: b.passengerDetails.fullName || "",
        email: b.passengerDetails.email || "",
        adults: typeof b.passengerDetails.adults === "number" ? b.passengerDetails.adults : 1,
        children: typeof b.passengerDetails.children === "number" ? b.passengerDetails.children : 0,
        luggage: typeof b.passengerDetails.luggage === "number" ? b.passengerDetails.luggage : 0,
        childSeatRequired: Boolean(b.passengerDetails.childSeatRequired),
        meetAndGreetRequired: Boolean(b.passengerDetails.meetAndGreetRequired),
        whatsappNumber: b.passengerDetails.whatsappNumber || "",
        alternativePhoneNumber: b.passengerDetails.alternativePhoneNumber || null,
        specialRequests: b.passengerDetails.specialRequests || null,
        nationality: b.passengerDetails.nationality || "",
        country: b.passengerDetails.country || "",
      }
    : null;

  const fareBreakdown = b.fareBreakdown
    ? {
        baseCharge: Number(b.fareBreakdown.baseCharge || 0),
        distanceCharge: Number(b.fareBreakdown.distanceCharge || 0),
        airportPickupCharge: Number(b.fareBreakdown.airportPickupCharge || 0),
        trafficCharge: Number(b.fareBreakdown.trafficCharge || 0),
        nightCharge: Number(b.fareBreakdown.nightCharge || 0),
        highwayToll: Number(b.fareBreakdown.highwayToll || 0),
        additionalCharges: Number(b.fareBreakdown.additionalCharges || 0),
        discount: Number(b.fareBreakdown.discount || 0),
        totalEstimatedFare: Number(b.fareBreakdown.totalEstimatedFare || 0),
      }
    : null;

  const customTripDetails = b.customTripDetails
    ? {
        isCustomTrip: Boolean(b.customTripDetails.isCustomTrip),
        startDate: toIsoString(b.customTripDetails.startDate),
        endDate: toIsoString(b.customTripDetails.endDate),
        budget: typeof b.customTripDetails.budget === "number" ? b.customTripDetails.budget : undefined,
        budgetCurrency: b.customTripDetails.budgetCurrency || "USD",
        budgetCovers: b.customTripDetails.budgetCovers || "Transport only",
        budgetFlexibility: b.customTripDetails.budgetFlexibility || "Negotiable",
        budgetNotes: b.customTripDetails.budgetNotes || "",
        pickupFlightNumber: b.customTripDetails.pickupFlightNumber || "",
        dropoffFlightNumber: b.customTripDetails.dropoffFlightNumber || "",
        dropoffLocation: b.customTripDetails.dropoffLocation
          ? {
              address: b.customTripDetails.dropoffLocation.address || "",
              lat: typeof b.customTripDetails.dropoffLocation.lat === "number" ? b.customTripDetails.dropoffLocation.lat : undefined,
              lng: typeof b.customTripDetails.dropoffLocation.lng === "number" ? b.customTripDetails.dropoffLocation.lng : undefined,
              visited: Boolean(b.customTripDetails.dropoffLocation.visited),
              visitedAt: toIsoString(b.customTripDetails.dropoffLocation.visitedAt),
            }
          : undefined,
        dropoffTime: b.customTripDetails.dropoffTime || "",
        confirmedAmount: typeof b.customTripDetails.confirmedAmount === "number" ? b.customTripDetails.confirmedAmount : undefined,
        confirmedCurrency: b.customTripDetails.confirmedCurrency || "USD",
        itinerary: Array.isArray(b.customTripDetails.itinerary)
          ? b.customTripDetails.itinerary.map((day: any) => ({
              dayNumber: typeof day.dayNumber === "number" ? day.dayNumber : 1,
              date: toIsoString(day.date),
              startingLocation: day.startingLocation
                ? {
                    address: day.startingLocation.address || "",
                    lat: typeof day.startingLocation.lat === "number" ? day.startingLocation.lat : undefined,
                    lng: typeof day.startingLocation.lng === "number" ? day.startingLocation.lng : undefined,
                  }
                : undefined,
              departureTime: day.departureTime || "",
              placesToVisit: Array.isArray(day.placesToVisit)
                ? day.placesToVisit.map((place: any) => ({
                    _id: toIdString(place._id) || undefined,
                    name: place.name || "",
                    lat: typeof place.lat === "number" ? place.lat : undefined,
                    lng: typeof place.lng === "number" ? place.lng : undefined,
                    activityTime: place.activityTime || "",
                    visited: Boolean(place.visited),
                    visitedAt: toIsoString(place.visitedAt),
                  }))
                : [],
              overnightLocation: day.overnightLocation
                ? {
                    _id: toIdString(day.overnightLocation._id) || undefined,
                    city: day.overnightLocation.city || "",
                    hotel: day.overnightLocation.hotel || "",
                    lat: typeof day.overnightLocation.lat === "number" ? day.overnightLocation.lat : undefined,
                    lng: typeof day.overnightLocation.lng === "number" ? day.overnightLocation.lng : undefined,
                    visited: Boolean(day.overnightLocation.visited),
                    visitedAt: toIsoString(day.overnightLocation.visitedAt),
                  }
                : undefined,
              notes: day.notes || "",
              distanceKm: typeof day.distanceKm === "number" ? day.distanceKm : undefined,
              drivingTimeMins: typeof day.drivingTimeMins === "number" ? day.drivingTimeMins : undefined,
            }))
          : [],
      }
    : null;

  const driverLocation = b.driverLocation
    ? {
        lat: Number(b.driverLocation.lat || 0),
        lng: Number(b.driverLocation.lng || 0),
        accuracy: typeof b.driverLocation.accuracy === "number" ? b.driverLocation.accuracy : null,
        capturedAt: toIsoString(b.driverLocation.capturedAt),
        receivedAt: toIsoString(b.driverLocation.receivedAt),
        updatedAt: toIsoString(b.driverLocation.updatedAt),
      }
    : null;

  
  const intermediateStops: MyPickMeStopDTO[] | null = Array.isArray(b.intermediateStops)
    ? b.intermediateStops.map((s: any, idx: number) => ({
        address: s.address || "",
        lat: Number(s.lat || 0),
        lng: Number(s.lng || 0),
        stopOrder: typeof s.stopOrder === "number" ? s.stopOrder : idx + 1,
        visited: Boolean(s.visited),
        visitedAt: toIsoString(s.visitedAt),
        notes: s.notes || undefined,
      }))
    : Array.isArray(b.pickMeDetails?.intermediateStops)
    ? b.pickMeDetails.intermediateStops.map((s: any, idx: number) => ({
        address: s.address || "",
        lat: Number(s.lat || 0),
        lng: Number(s.lng || 0),
        stopOrder: typeof s.stopOrder === "number" ? s.stopOrder : idx + 1,
        visited: Boolean(s.visited),
        visitedAt: toIsoString(s.visitedAt),
        notes: s.notes || undefined,
      }))
    : null;

  const pickupInstructions = b.pickupInstructions || b.pickMeDetails?.pickupInstructions || null;

  const rawDto: MyBookingDTO = {
    _id: toIdString(b._id) || "",
    bookingReference: b.bookingReference || "",
    bookingType: b.bookingType || (b.pickMeDetails?.isPickMe ? "LOCAL_RIDE" : "AIRPORT_TRANSFER"),
    pickMeDetails: b.pickMeDetails
      ? {
          isPickMe: Boolean(b.pickMeDetails.isPickMe),
          vehicleCategory: b.pickMeDetails.vehicleCategory || "Car",
          goodsDescription: b.pickMeDetails.goodsDescription || null,
          baseFare: typeof b.pickMeDetails.baseFare === "number" ? b.pickMeDetails.baseFare : undefined,
          ratePerKm: typeof b.pickMeDetails.ratePerKm === "number" ? b.pickMeDetails.ratePerKm : undefined,
          minimumFare: typeof b.pickMeDetails.minimumFare === "number" ? b.pickMeDetails.minimumFare : undefined,
          estimatedFare: typeof b.pickMeDetails.estimatedFare === "number" ? b.pickMeDetails.estimatedFare : undefined,
          pricingSnapshot: b.pickMeDetails.pricingSnapshot ? sanitizePlainSerializable(b.pickMeDetails.pricingSnapshot) : null,
          rideNow: Boolean(b.pickMeDetails.rideNow),
        }
      : null,
    status: b.status || "PENDING",
    paymentStatus: b.paymentStatus || "PENDING",
    paymentMethod: b.paymentMethod || null,
    pickupAddress: b.pickupAddress || null,
    pickupLat: typeof b.pickupLat === "number" ? b.pickupLat : null,
    pickupLng: typeof b.pickupLng === "number" ? b.pickupLng : null,
    destinationAddress: b.destinationAddress || null,
    destinationLat: typeof b.destinationLat === "number" ? b.destinationLat : null,
    destinationLng: typeof b.destinationLng === "number" ? b.destinationLng : null,
    arrivalDate: toIsoString(b.arrivalDate),
    arrivalTime: b.arrivalTime || null,
    flightNumber: b.flightNumber || null,
    distanceKm: typeof b.distanceKm === "number" ? b.distanceKm : null,
    durationMins: typeof b.durationMins === "number" ? b.durationMins : null,
    isPackageBooking: Boolean(b.isPackageBooking),
    packageId: toIdString(b.packageId),
    packageEnquiryId: toIdString(b.packageEnquiryId),
    packageItineraryDetails: b.packageItineraryDetails ? sanitizePlainSerializable(b.packageItineraryDetails) : null,
    touristId: toIdString(b.touristId),
    approvedBy: toIdString(b.approvedBy),
    approvedAt: toIsoString(b.approvedAt),
    completedAt: toIsoString(b.completedAt),
    arrivedAt: toIsoString(b.arrivedAt),
    arrivalSource: b.arrivalSource || null,
    createdAt: toIsoString(b.createdAt),
    updatedAt: toIsoString(b.updatedAt),
    adminNotes: b.adminNotes ? sanitizePlainSerializable(b.adminNotes) : null,
    airportId,
    vehicleTypeId,
    driverId,
    passengerDetails,
    fareBreakdown,
    customTripDetails,
    driverLocation,
    pickupInstructions,
    intermediateStops,
  };

  return sanitizePlainSerializable(rawDto);
}

/**
 * Transforms a raw Mongoose PackageEnquiry document (lean or hydrated) into a pure, plain MyPackageEnquiryDTO.
 * Explicitly converts ObjectIds and Dates to strings/ISO strings, ensuring only plain serializable data.
 */
export function serializeEnquiryToDTO(e: any): MyPackageEnquiryDTO {
  if (!e) {
    throw new Error("Cannot serialize null or undefined enquiry");
  }

  const packageId = e.packageId
    ? typeof e.packageId === "object" && e.packageId._id
      ? {
          _id: toIdString(e.packageId._id) || "",
          title: e.packageId.title || "Custom Package",
        }
      : typeof e.packageId === "string" || e.packageId.constructor?.name === "ObjectId"
      ? { _id: toIdString(e.packageId) || "", title: "Custom Package" }
      : null
    : null;

  const messages: MyEnquiryMessageDTO[] = Array.isArray(e.messages)
    ? e.messages.map((m: any) => ({
        _id: toIdString(m._id) || undefined,
        sender: m.sender || "RIDER",
        text: m.text || "",
        createdAt: toIsoString(m.createdAt) || new Date().toISOString(),
      }))
    : [];

  const rawDto: MyPackageEnquiryDTO = {
    _id: toIdString(e._id) || "",
    packageId,
    riderId: toIdString(e.riderId),
    driverId: toIdString(e.driverId),
    status: e.status || "ENQUIRY",
    riderUnread: Boolean(e.riderUnread),
    driverUnread: Boolean(e.driverUnread),
    requestedDates: e.requestedDates || null,
    requestedPassengers: typeof e.requestedPassengers === "number" ? e.requestedPassengers : null,
    createdAt: toIsoString(e.createdAt),
    updatedAt: toIsoString(e.updatedAt),
    messages,
    activeQuote: e.activeQuote ? sanitizePlainSerializable(e.activeQuote) : null,
    historyQuotes: Array.isArray(e.historyQuotes) ? sanitizePlainSerializable(e.historyQuotes) : [],
  };

  return sanitizePlainSerializable(rawDto);
}
