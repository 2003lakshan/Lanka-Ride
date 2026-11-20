export interface NormalizedRider {
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  nationality: string | null;
  country: string | null;
  adults: number;
  children: number;
  luggage: number;
  childSeatRequired: boolean;
  meetAndGreetRequired: boolean;
  specialRequests: string | null;
  isRegisteredUser: boolean;
  userId: string | null;
}

export interface NormalizedDriver {
  _id: string;
  id: string;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  licenseNumber: string | null;
  vehicleRegistration: string | null;
  vehicleModel: string | null;
  vehicleDetails?: {
    model?: string;
    registrationNumber?: string;
  };
}

export interface NormalizedVehicleType {
  _id: string;
  id: string;
  name: string;
  capacity?: number;
  luggageCapacity?: number;
}

export interface NormalizedItineraryPlace {
  name: string;
  lat: number;
  lng: number;
  activityTime: string | null;
  visited: boolean;
  visitedAt: string | null;
}

export interface NormalizedItineraryDay {
  dayNumber: number;
  date: string | null;
  startingLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null;
  placesToVisit: NormalizedItineraryPlace[];
  overnightLocation: {
    city: string;
    hotel: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    visited: boolean;
    visitedAt: string | null;
  } | null;
  notes: string;
  distanceKm: number;
  drivingTimeMins: number;
}

export interface NormalizedCustomTripDetails {
  isCustomTrip: boolean;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  budgetCurrency: "LKR" | "USD";
  budgetCovers: "Transport only" | "Entire trip";
  budgetFlexibility: "Fixed maximum" | "Negotiable";
  budgetNotes: string;
  pickupFlightNumber: string | null;
  dropoffFlightNumber: string | null;
  dropoffLocation: {
    address: string;
    lat: number;
    lng: number;
    visited: boolean;
    visitedAt: string | null;
  } | null;
  dropoffTime: string | null;
  confirmedAmount: number | null;
  confirmedCurrency: "LKR" | "USD" | "EUR" | "GBP";
  itinerary: NormalizedItineraryDay[];
}

export interface NormalizedFareBreakdown {
  baseCharge: number;
  distanceCharge: number;
  airportPickupCharge: number;
  trafficCharge: number;
  nightCharge: number;
  highwayToll: number;
  additionalCharges: number;
  discount: number;
  totalEstimatedFare: number | null;
}

export interface NormalizedDriverLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  updatedAt: string | null;
}

export interface AdminTripViewModel {
  _id: string;
  bookingReference: string;
  status: string;
  paymentStatus: "PENDING" | "VERIFYING_PAYMENT" | "PAID" | "FAILED" | "REFUNDED";
  paymentMethod: string | null;
  tripType: "STANDARD" | "CUSTOM" | "PACKAGE";
  isPackageBooking: boolean;
  isCustomTrip: boolean;

  createdAt: string | null;
  updatedAt: string | null;
  arrivalDate: string | null;
  arrivalTime: string | null;
  completedAt: string | null;
  arrivedAt: string | null;
  arrivalSource: "GPS" | "MANUAL" | null;
  approvedAt: string | null;
  approvedBy: string | null;
  flightNumber: string | null;

  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  distanceKm: number;
  durationMins: number;

  rider: NormalizedRider;
  // Guaranteed non-null passengerDetails for backward compatibility
  passengerDetails: {
    fullName: string;
    email: string;
    whatsappNumber: string;
    nationality: string;
    country: string;
    adults: number;
    children: number;
    luggage: number;
    childSeatRequired: boolean;
    meetAndGreetRequired: boolean;
    specialRequests: string;
  };

  driverId: NormalizedDriver | null;
  vehicleTypeId: NormalizedVehicleType | null;
  driverLocation: NormalizedDriverLocation | null;
  customTripDetails: NormalizedCustomTripDetails;
  fareBreakdown: NormalizedFareBreakdown | null;

  confirmedFare: string | null;
  displayPrice: string;

  airportId: any;
  packageId: any;
  packageEnquiryId: any;
  packageItineraryDetails: any;
  adminNotes: Record<string, any> | null;
  touristId: any;
}

export function resolveRider(raw: any): {
  rider: NormalizedRider;
  passengerDetails: AdminTripViewModel["passengerDetails"];
} {
  const p = raw.passengerDetails;
  const tourist = raw.touristId && typeof raw.touristId === "object" ? raw.touristId : null;
  const enquiryRider =
    raw.packageEnquiryId?.riderId && typeof raw.packageEnquiryId.riderId === "object"
      ? raw.packageEnquiryId.riderId
      : null;

  // Resolve Full Name: passengerDetails -> touristId -> enquiry.riderId -> Fallback
  const rawName =
    (typeof p?.fullName === "string" ? p.fullName.trim() : "") ||
    (typeof tourist?.name === "string" ? tourist.name.trim() : "") ||
    (typeof enquiryRider?.name === "string" ? enquiryRider.name.trim() : "");

  const fullName = rawName.length > 0 ? rawName : "Rider name unavailable";

  // Resolve Email
  const rawEmail =
    (typeof p?.email === "string" ? p.email.trim() : "") ||
    (typeof tourist?.email === "string" ? tourist.email.trim() : "") ||
    (typeof enquiryRider?.email === "string" ? enquiryRider.email.trim() : "");
  const email = rawEmail.length > 0 ? rawEmail : null;

  // Resolve WhatsApp / Phone Number
  const rawPhone =
    (typeof p?.whatsappNumber === "string" ? p.whatsappNumber.trim() : "") ||
    (typeof p?.alternativePhoneNumber === "string" ? p.alternativePhoneNumber.trim() : "") ||
    (typeof tourist?.phoneNumber === "string" ? tourist.phoneNumber.trim() : "") ||
    (typeof enquiryRider?.phoneNumber === "string" ? enquiryRider.phoneNumber.trim() : "");
  const phoneNumber = rawPhone.length > 0 ? rawPhone : null;

  // Resolve Nationality / Country
  const rawNat =
    (typeof p?.nationality === "string" ? p.nationality.trim() : "") ||
    (typeof tourist?.nationality === "string" ? tourist.nationality.trim() : "") ||
    (typeof enquiryRider?.nationality === "string" ? enquiryRider.nationality.trim() : "");
  const nationality = rawNat.length > 0 ? rawNat : null;

  const rawCountry = typeof p?.country === "string" ? p.country.trim() : nationality;
  const country = rawCountry && rawCountry.length > 0 ? rawCountry : null;

  // Resolve party counts
  let adults = 1;
  if (typeof p?.adults === "number" && p.adults > 0) {
    adults = p.adults;
  } else if (typeof raw.packageEnquiryId?.requestedPassengers === "number" && raw.packageEnquiryId.requestedPassengers > 0) {
    adults = raw.packageEnquiryId.requestedPassengers;
  }

  const children = typeof p?.children === "number" && p.children >= 0 ? p.children : 0;
  const luggage = typeof p?.luggage === "number" && p.luggage >= 0 ? p.luggage : 0;

  const childSeatRequired = Boolean(p?.childSeatRequired);
  const meetAndGreetRequired = Boolean(p?.meetAndGreetRequired);
  const specialRequests = typeof p?.specialRequests === "string" && p.specialRequests.trim().length > 0
    ? p.specialRequests.trim()
    : null;

  const isRegisteredUser = Boolean(tourist?._id || enquiryRider?._id);
  const userId = tourist?._id
    ? tourist._id.toString()
    : enquiryRider?._id
    ? enquiryRider._id.toString()
    : null;

  const rider: NormalizedRider = {
    fullName,
    email,
    phoneNumber,
    whatsappNumber: phoneNumber,
    nationality,
    country,
    adults,
    children,
    luggage,
    childSeatRequired,
    meetAndGreetRequired,
    specialRequests,
    isRegisteredUser,
    userId,
  };

  const passengerDetails = {
    fullName,
    email: email || "No email provided",
    whatsappNumber: phoneNumber || undefined,
    nationality: nationality || "Not specified",
    country: country || "Not specified",
    adults,
    children,
    luggage,
    childSeatRequired,
    meetAndGreetRequired,
    specialRequests: specialRequests || "",
  };

  return { rider, passengerDetails };
}

export function normalizeAdminTrip(raw: any): AdminTripViewModel {
  if (!raw) {
    throw new Error("normalizeAdminTrip received empty booking");
  }

  const id = raw._id ? raw._id.toString() : "";
  const bookingReference = raw.bookingReference || "REF-UNKNOWN";

  const customDetails = raw.customTripDetails;
  const isCustomTrip = Boolean(customDetails?.isCustomTrip || bookingReference.startsWith("CT-"));
  const isPackageBooking = Boolean(raw.isPackageBooking || raw.packageId || raw.packageEnquiryId);

  const tripType: "STANDARD" | "CUSTOM" | "PACKAGE" = isCustomTrip
    ? "CUSTOM"
    : isPackageBooking
    ? "PACKAGE"
    : "STANDARD";

  // Resolve Rider
  const { rider, passengerDetails } = resolveRider(raw);

  // Resolve Driver
  let driver: NormalizedDriver | null = null;
  if (raw.driverId && typeof raw.driverId === "object" && raw.driverId._id) {
    const d = raw.driverId;
    const dId = d._id.toString();
    const regNum = d.vehicleDetails?.registrationNumber || d.vehicleRegistration || null;
    const model = d.vehicleDetails?.model || null;

    driver = {
      _id: dId,
      id: dId,
      name: d.name || "Assigned Driver",
      phoneNumber: d.phoneNumber || null,
      email: d.email || null,
      licenseNumber: d.licenseNumber || null,
      vehicleRegistration: regNum,
      vehicleModel: model,
      vehicleDetails: {
        model: model || undefined,
        registrationNumber: regNum || undefined,
      },
    };
  }

  // Resolve Vehicle Type
  let vehicleType: NormalizedVehicleType | null = null;
  if (raw.vehicleTypeId && typeof raw.vehicleTypeId === "object" && raw.vehicleTypeId._id) {
    const v = raw.vehicleTypeId;
    const vId = v._id.toString();
    vehicleType = {
      _id: vId,
      id: vId,
      name: v.name || "Standard Vehicle",
      capacity: v.capacity,
      luggageCapacity: v.luggageCapacity,
    };
  }

  // Resolve Driver Location
  let driverLocation: NormalizedDriverLocation | null = null;
  if (raw.driverLocation && typeof raw.driverLocation.lat === "number" && typeof raw.driverLocation.lng === "number") {
    driverLocation = {
      lat: raw.driverLocation.lat,
      lng: raw.driverLocation.lng,
      accuracy: typeof raw.driverLocation.accuracy === "number" ? raw.driverLocation.accuracy : null,
      updatedAt: raw.driverLocation.updatedAt ? new Date(raw.driverLocation.updatedAt).toISOString() : null,
    };
  }

  // Resolve Route
  const pickupAddress =
    raw.pickupAddress ||
    (raw.airportId && typeof raw.airportId === "object" ? raw.airportId.name : null) ||
    "Pickup location not specified";

  const pickupLat = typeof raw.pickupLat === "number"
    ? raw.pickupLat
    : typeof raw.pickupCoordinates?.lat === "number"
    ? raw.pickupCoordinates.lat
    : typeof raw.airportId?.location?.lat === "number"
    ? raw.airportId.location.lat
    : 0;

  const pickupLng = typeof raw.pickupLng === "number"
    ? raw.pickupLng
    : typeof raw.pickupCoordinates?.lng === "number"
    ? raw.pickupCoordinates.lng
    : typeof raw.airportId?.location?.lng === "number"
    ? raw.airportId.location.lng
    : 0;

  const destinationAddress =
    raw.destinationAddress ||
    (isCustomTrip ? "Custom Tour Itinerary (Multiple Stops)" : "Destination not specified");

  const destinationLat = typeof raw.destinationLat === "number"
    ? raw.destinationLat
    : typeof raw.destinationCoordinates?.lat === "number"
    ? raw.destinationCoordinates.lat
    : 0;

  const destinationLng = typeof raw.destinationLng === "number"
    ? raw.destinationLng
    : typeof raw.destinationCoordinates?.lng === "number"
    ? raw.destinationCoordinates.lng
    : 0;

  // Resolve Custom Trip Details
  const normalizedCustomTripDetails: NormalizedCustomTripDetails = {
    isCustomTrip,
    startDate: customDetails?.startDate ? new Date(customDetails.startDate).toISOString() : null,
    endDate: customDetails?.endDate ? new Date(customDetails.endDate).toISOString() : null,
    budget: typeof customDetails?.budget === "number" ? customDetails.budget : null,
    budgetCurrency: customDetails?.budgetCurrency === "LKR" ? "LKR" : "USD",
    budgetCovers: customDetails?.budgetCovers === "Entire trip" ? "Entire trip" : "Transport only",
    budgetFlexibility: customDetails?.budgetFlexibility === "Fixed maximum" ? "Fixed maximum" : "Negotiable",
    budgetNotes: customDetails?.budgetNotes || "",
    pickupFlightNumber: customDetails?.pickupFlightNumber || raw.flightNumber || null,
    dropoffFlightNumber: customDetails?.dropoffFlightNumber || null,
    dropoffLocation: customDetails?.dropoffLocation
      ? {
          address: customDetails.dropoffLocation.address || "",
          lat: typeof customDetails.dropoffLocation.lat === "number" ? customDetails.dropoffLocation.lat : 0,
          lng: typeof customDetails.dropoffLocation.lng === "number" ? customDetails.dropoffLocation.lng : 0,
          visited: Boolean(customDetails.dropoffLocation.visited),
          visitedAt: customDetails.dropoffLocation.visitedAt
            ? new Date(customDetails.dropoffLocation.visitedAt).toISOString()
            : null,
        }
      : null,
    dropoffTime: customDetails?.dropoffTime || null,
    confirmedAmount: typeof customDetails?.confirmedAmount === "number" ? customDetails.confirmedAmount : null,
    confirmedCurrency: customDetails?.confirmedCurrency || "USD",
    itinerary: (customDetails?.itinerary || []).map((day: any, idx: number) => ({
      dayNumber: typeof day.dayNumber === "number" ? day.dayNumber : idx + 1,
      date: day.date ? new Date(day.date).toISOString() : null,
      startingLocation: day.startingLocation
        ? {
            name: day.startingLocation.name || day.startingLocation.address || "Start Point",
            address: day.startingLocation.address || day.startingLocation.name || "Start Point",
            lat: typeof day.startingLocation.lat === "number" ? day.startingLocation.lat : 0,
            lng: typeof day.startingLocation.lng === "number" ? day.startingLocation.lng : 0,
          }
        : null,
      placesToVisit: (day.placesToVisit || []).map((place: any) => ({
        name: place.name || place.address || place.location?.address || "Attraction",
        lat: typeof place.lat === "number" ? place.lat : (place.location?.lat || 0),
        lng: typeof place.lng === "number" ? place.lng : (place.location?.lng || 0),
        activityTime: place.activityTime || null,
        visited: Boolean(place.visited),
        visitedAt: place.visitedAt ? new Date(place.visitedAt).toISOString() : null,
      })),
      overnightLocation: day.overnightLocation
        ? {
            city: day.overnightLocation.city || "",
            hotel: day.overnightLocation.hotel || day.overnightLocation.name || day.overnightLocation.address || "Overnight Stay",
            name: day.overnightLocation.name || day.overnightLocation.hotel || "Overnight Stay",
            address: day.overnightLocation.address || day.overnightLocation.hotel || "Overnight Stay",
            lat: typeof day.overnightLocation.lat === "number" ? day.overnightLocation.lat : 0,
            lng: typeof day.overnightLocation.lng === "number" ? day.overnightLocation.lng : 0,
            visited: Boolean(day.overnightLocation.visited),
            visitedAt: day.overnightLocation.visitedAt ? new Date(day.overnightLocation.visitedAt).toISOString() : null,
          }
        : null,
      notes: day.notes || "",
      distanceKm: typeof day.distanceKm === "number" ? day.distanceKm : 0,
      drivingTimeMins: typeof day.drivingTimeMins === "number" ? day.drivingTimeMins : 0,
    })),
  };

  // Resolve Fare Breakdown
  let fareBreakdown: NormalizedFareBreakdown | null = null;
  if (raw.fareBreakdown && typeof raw.fareBreakdown === "object") {
    const fb = raw.fareBreakdown;
    fareBreakdown = {
      baseCharge: typeof fb.baseCharge === "number" ? fb.baseCharge : 0,
      distanceCharge: typeof fb.distanceCharge === "number" ? fb.distanceCharge : 0,
      airportPickupCharge: typeof fb.airportPickupCharge === "number" ? fb.airportPickupCharge : 0,
      trafficCharge: typeof fb.trafficCharge === "number" ? fb.trafficCharge : 0,
      nightCharge: typeof fb.nightCharge === "number" ? fb.nightCharge : 0,
      highwayToll: typeof fb.highwayToll === "number" ? fb.highwayToll : 0,
      additionalCharges: typeof fb.additionalCharges === "number" ? fb.additionalCharges : 0,
      discount: typeof fb.discount === "number" ? fb.discount : 0,
      totalEstimatedFare: typeof fb.totalEstimatedFare === "number" ? fb.totalEstimatedFare : null,
    };
  }

  // Resolve Price Displays
  let confirmedFare: string | null = null;
  if (typeof normalizedCustomTripDetails.confirmedAmount === "number") {
    confirmedFare = `${normalizedCustomTripDetails.confirmedCurrency} ${normalizedCustomTripDetails.confirmedAmount.toLocaleString()}`;
  } else if (fareBreakdown && typeof fareBreakdown.totalEstimatedFare === "number" && fareBreakdown.totalEstimatedFare > 0) {
    confirmedFare = `LKR ${fareBreakdown.totalEstimatedFare.toLocaleString()}`;
  }

  let displayPrice = "N/A";
  if (confirmedFare) {
    displayPrice = confirmedFare;
  } else if (typeof normalizedCustomTripDetails.budget === "number") {
    displayPrice = `${normalizedCustomTripDetails.budgetCurrency} ${normalizedCustomTripDetails.budget.toLocaleString()}`;
  }

  const result: AdminTripViewModel = {
    _id: id,
    bookingReference,
    status: raw.status || "PENDING",
    paymentStatus: raw.paymentStatus || "PENDING",
    paymentMethod: raw.paymentMethod || null,
    tripType,
    isPackageBooking,
    isCustomTrip,

    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
    arrivalDate: raw.arrivalDate ? new Date(raw.arrivalDate).toISOString() : null,
    arrivalTime: raw.arrivalTime || null,
    completedAt: raw.completedAt ? new Date(raw.completedAt).toISOString() : null,
    arrivedAt: raw.arrivedAt ? new Date(raw.arrivedAt).toISOString() : null,
    arrivalSource: raw.arrivalSource || null,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt).toISOString() : null,
    approvedBy: raw.approvedBy ? raw.approvedBy.toString() : null,
    flightNumber: raw.flightNumber || null,

    pickupAddress,
    pickupLat,
    pickupLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    distanceKm: typeof raw.distanceKm === "number" ? raw.distanceKm : 0,
    durationMins: typeof raw.durationMins === "number" ? raw.durationMins : 0,

    rider,
    passengerDetails,

    driverId: driver,
    vehicleTypeId: vehicleType,
    driverLocation,
    customTripDetails: normalizedCustomTripDetails,
    fareBreakdown,

    confirmedFare,
    displayPrice,

    airportId: raw.airportId ? (raw.airportId._id ? { ...raw.airportId, _id: raw.airportId._id.toString() } : raw.airportId.toString()) : null,
    packageId: raw.packageId
      ? typeof raw.packageId === "object"
        ? {
            ...raw.packageId,
            _id: raw.packageId._id ? raw.packageId._id.toString() : undefined,
            driverId: raw.packageId.driverId ? raw.packageId.driverId.toString() : undefined,
            vehicleTypeId: raw.packageId.vehicleTypeId ? raw.packageId.vehicleTypeId.toString() : undefined,
          }
        : raw.packageId.toString()
      : null,
    packageEnquiryId: raw.packageEnquiryId ? (raw.packageEnquiryId._id ? { ...raw.packageEnquiryId, _id: raw.packageEnquiryId._id.toString() } : raw.packageEnquiryId.toString()) : null,
    packageItineraryDetails: raw.packageItineraryDetails || null,
    adminNotes: raw.adminNotes || null,
    touristId: raw.touristId ? (raw.touristId._id ? { ...raw.touristId, _id: raw.touristId._id.toString() } : raw.touristId.toString()) : null,
  };

  return JSON.parse(JSON.stringify(result));
}
