import mongoose, { Schema, Document } from "mongoose";

export interface IFareBreakdown {
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

export interface IPassengerDetails {
  fullName: string;
  nationality: string;
  country: string;
  email: string;
  whatsappNumber?: string;
  alternativePhoneNumber?: string;
  adults: number;
  children: number;
  luggage: number;
  childSeatRequired: boolean;
  meetAndGreetRequired: boolean;
  specialRequests?: string;
  hasWhatsApp?: boolean;
}


export interface IArrivalCandidate {
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  sampleCount: number;
  lastDistanceMetres: number;
  lastAccuracyMetres?: number;
}

export interface IDriverLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt?: Date;
  receivedAt?: Date;
  updatedAt: Date;
}

export interface ICustomTripPlace {
  name?: string;
  lat?: number;
  lng?: number;
  activityTime?: string;
  visited?: boolean;
  visitedAt?: Date;
}

export interface ICustomTripOvernight {
  city?: string;
  hotel?: string;
  lat?: number;
  lng?: number;
  visited?: boolean;
  visitedAt?: Date;
}

export interface ICustomTripDay {
  dayNumber: number;
  date: Date;
  startingLocation?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  departureTime?: string;
  placesToVisit: ICustomTripPlace[];
  overnightLocation?: ICustomTripOvernight;
  notes?: string;
  distanceKm?: number;
  drivingTimeMins?: number;
}


export interface IPickMePricingSnapshot {
  baseFare: number;
  ratePerKm: number;
  minimumFare: number;
  distanceKm: number;
  durationMins: number;
  estimatedFare: number;
  calculatedAt: Date;
}

export interface IPickMeStop {
  _id?: mongoose.Types.ObjectId | string;
  name?: string;
  address: string;
  lat: number;
  lng: number;
  stopOrder: number;
  visited?: boolean;
  visitedAt?: Date;
  notes?: string;
}

export interface IPickMeDetails {
  pickupInstructions?: string;
  intermediateStops?: IPickMeStop[];
  isPickMe: boolean;
  vehicleCategory: "Bike" | "Three-wheeler" | "Car" | "Mini Van" | "Van" | "Lorry" | string;
  goodsDescription?: string;
  baseFare: number;
  ratePerKm: number;
  minimumFare: number;
  estimatedFare: number;
  pricingSnapshot: IPickMePricingSnapshot;
  rideNow: boolean;
}

export interface ICustomTripDetails {
  isCustomTrip?: boolean;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  budgetCurrency?: "LKR" | "USD";
  budgetCovers?: "Transport only" | "Entire trip";
  budgetFlexibility?: "Fixed maximum" | "Negotiable";
  budgetNotes?: string;
  pickupFlightNumber?: string;
  dropoffFlightNumber?: string;
  dropoffLocation?: {
    address?: string;
    lat?: number;
    lng?: number;
    visited?: boolean;
    visitedAt?: Date;
  };
  dropoffTime?: string;
  itinerary?: ICustomTripDay[];
  confirmedAmount?: number;
  confirmedCurrency?: "LKR" | "USD" | "EUR" | "GBP";
  bookingContact?: {
    fullName: string;
    country: string;
    email: string;
    phone: string;
    isBookingForSomeoneElse: boolean;
    passenger?: {
      fullName: string;
      phone: string;
    };
    confirmedAccuracy: boolean;
    verifiedAt?: Date;
  };
  identityVerification?: {
    identityId?: mongoose.Types.ObjectId | string;
    documentType?: "NATIONAL_ID" | "PASSPORT";
    status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    version?: number;
    reviewedVersion?: number;
    rejectionReason?: string;
    reviewedBy?: mongoose.Types.ObjectId | string;
    reviewedAt?: Date;
    files?: {
      front?: {
        fileId: string;
        originalName: string;
        mimeType: string;
        size: number;
      };
      back?: {
        fileId: string;
        originalName: string;
        mimeType: string;
        size: number;
      };
      photoPage?: {
        fileId: string;
        originalName: string;
        mimeType: string;
        size: number;
      };
    };
    uploadedAt?: Date;
  };
}

export interface IBooking extends Document {
  bookingReference: string;
  touristId?: mongoose.Types.ObjectId;
  driverLocation?: IDriverLocation;
  airportId?: mongoose.Types.ObjectId;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupInstructions?: string;
  intermediateStops?: IPickMeStop[];
  isPackageBooking?: boolean;
  packageId?: mongoose.Types.ObjectId;
  packageEnquiryId?: mongoose.Types.ObjectId;
  packageItineraryDetails?: any;
  destinationAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
  arrivalDate?: Date;
  arrivalTime?: string;
  flightNumber?: string;
  vehicleTypeId?: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  distanceKm?: number;
  durationMins?: number;
  passengerDetails: IPassengerDetails;
  fareBreakdown: IFareBreakdown;
  paymentMethod: string;
  paymentStatus: "PENDING" | "VERIFYING_PAYMENT" | "PAID" | "FAILED" | "REFUNDED";
  bookingType?: "AIRPORT_TRANSFER" | "CUSTOM_TRIP" | "LOCAL_RIDE";
  pickMeDetails?: IPickMeDetails;
  customTripDetails?: ICustomTripDetails;
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "NEEDS_REVISION"
    | "PENDING"
    | "AWAITING_PAYMENT"
    | "PENDING_ADMIN_CONFIRMATION"
    | "CONFIRMED"
    | "DRIVER_ASSIGNED"
    | "DRIVER_EN_ROUTE"
    | "DRIVER_ARRIVED"
    | "PASSENGER_PICKED_UP"
    | "TRIP_IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED";
  arrivedAt?: Date;
  arrivalSource?: "GPS" | "MANUAL";
  arrivalCandidate?: IArrivalCandidate;
  completedAt?: Date;
  assignedAt?: Date;
  offeredDriverIds?: mongoose.Types.ObjectId[];
  rejectedDriverIds?: mongoose.Types.ObjectId[];
  dispatchStatus?: "SEARCHING" | "OFFERED" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  dispatchExpiresAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: {
    userId?: mongoose.Types.ObjectId;
    role: "TOURIST" | "DRIVER" | "ADMIN";
    name?: string;
  };
  cancellationReasonCode?: string;
  cancellationReasonText?: string;
  cancellationComments?: string;
  statusBeforeCancellation?: string;
  refundReviewStatus?: "NOT_APPLICABLE" | "PENDING_REVIEW" | "REFUNDED" | "RESOLVED";
  adminNotes?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const FareBreakdownSchema = new Schema<IFareBreakdown>(
  {
    baseCharge: { type: Number, required: true },
    distanceCharge: { type: Number, required: true },
    airportPickupCharge: { type: Number, required: true },
    trafficCharge: { type: Number, required: true },
    nightCharge: { type: Number, required: true },
    highwayToll: { type: Number, required: true },
    additionalCharges: { type: Number, required: true },
    discount: { type: Number, required: true },
    totalEstimatedFare: { type: Number, required: true },
  },
  { _id: false }
);

const PassengerDetailsSchema = new Schema<IPassengerDetails>(
  {
    fullName: { type: String, required: true },
    nationality: { type: String, required: true },
    country: { type: String, required: true },
    email: { type: String, required: true },
    whatsappNumber: { type: String, required: false },
    alternativePhoneNumber: { type: String },
    adults: { type: Number, required: true },
    children: { type: Number, required: true },
    luggage: { type: Number, required: true },
    childSeatRequired: { type: Boolean, default: false },
    meetAndGreetRequired: { type: Boolean, default: false },
    specialRequests: { type: String },
    hasWhatsApp: { type: Boolean, default: false },
  },
  { _id: false }
);


const ArrivalCandidateSchema = new Schema<IArrivalCandidate>(
  {
    firstDetectedAt: { type: Date, required: true },
    lastDetectedAt: { type: Date, required: true },
    sampleCount: { type: Number, required: true, default: 1 },
    lastDistanceMetres: { type: Number, required: true },
    lastAccuracyMetres: { type: Number },
  },
  { _id: false }
);

const DriverLocationSchema = new Schema<IDriverLocation>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number },
  capturedAt: { type: Date },
  receivedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const CustomTripDaySchema = new Schema({
  dayNumber: { type: Number, required: true },
  date: { type: Date, required: true },
  startingLocation: {
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number }
  },
  departureTime: { type: String },
  placesToVisit: [{
    name: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    activityTime: { type: String },
    visited: { type: Boolean, default: false },
    visitedAt: { type: Date }
  }],
  overnightLocation: {
    city: { type: String },
    hotel: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    visited: { type: Boolean, default: false },
    visitedAt: { type: Date }
  },
  notes: { type: String },
  distanceKm: { type: Number },
  drivingTimeMins: { type: Number }
}, { _id: false });

const CustomTripDetailsSchema = new Schema({
  isCustomTrip: { type: Boolean, default: false },
  startDate: { type: Date },
  endDate: { type: Date },
  budget: { type: Number },
  budgetCurrency: { type: String, enum: ["LKR", "USD"], default: "USD" },
  budgetCovers: { type: String, enum: ["Transport only", "Entire trip"], default: "Transport only" },
  budgetFlexibility: { type: String, enum: ["Fixed maximum", "Negotiable"], default: "Negotiable" },
  budgetNotes: { type: String },
  pickupFlightNumber: { type: String },
  dropoffFlightNumber: { type: String },
  dropoffLocation: {
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    visited: { type: Boolean, default: false },
    visitedAt: { type: Date }
  },
  dropoffTime: { type: String },
  itinerary: [CustomTripDaySchema],
  confirmedAmount: { type: Number },
  confirmedCurrency: { type: String, enum: ["LKR", "USD", "EUR", "GBP"], default: "USD" },
  bookingContact: {
    fullName: { type: String },
    country: { type: String },
    email: { type: String },
    phone: { type: String },
    isBookingForSomeoneElse: { type: Boolean, default: false },
    passenger: {
      fullName: { type: String },
      phone: { type: String },
    },
    confirmedAccuracy: { type: Boolean, default: false },
    verifiedAt: { type: Date },
  },
  identityVerification: {
    type: new Schema({
      identityId: { type: Schema.Types.ObjectId, ref: "RiderIdentity" },
      documentType: { type: String, enum: ["NATIONAL_ID", "PASSPORT"] },
      status: {
        type: String,
        enum: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
        default: "PENDING_REVIEW",
      },
      version: { type: Number },
      reviewedVersion: { type: Number },
      rejectionReason: { type: String },
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: { type: Date },
      files: {
        front: {
          fileId: { type: String },
          originalName: { type: String },
          mimeType: { type: String },
          size: { type: Number },
        },
        back: {
          fileId: { type: String },
          originalName: { type: String },
          mimeType: { type: String },
          size: { type: Number },
        },
        photoPage: {
          fileId: { type: String },
          originalName: { type: String },
          mimeType: { type: String },
          size: { type: Number },
        },
      },
      uploadedAt: { type: Date },
    }, { _id: false }),
    required: false,
    default: undefined,
  },
}, { _id: false });

const BookingSchema: Schema = new Schema(
  {
    bookingReference: { type: String, required: true, unique: true },
    touristId: { type: Schema.Types.ObjectId, ref: "User" },
    airportId: { type: Schema.Types.ObjectId, ref: "Airport" },
    pickupAddress: { type: String },
    pickupLat: { type: Number },
    pickupLng: { type: Number },
    isPackageBooking: { type: Boolean, default: false },
    packageId: { type: Schema.Types.ObjectId, ref: "Package" },
    packageEnquiryId: { type: Schema.Types.ObjectId, ref: "PackageEnquiry" },
    packageItineraryDetails: { type: Schema.Types.Mixed }, // Snapshot of the accepted quote

    destinationAddress: { type: String, required: false },
    destinationLat: { type: Number, required: false },
    destinationLng: { type: Number, required: false },
    arrivalDate: { type: Date, required: false },
    arrivalTime: { type: String, required: false },
    flightNumber: { type: String, required: false },
    vehicleTypeId: { type: Schema.Types.ObjectId, ref: "VehicleType", required: false },
    driverId: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },
    offeredDriverIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    rejectedDriverIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    dispatchStatus: {
      type: String,
      enum: ["SEARCHING", "OFFERED", "ACCEPTED", "EXPIRED", "CANCELLED"],
      default: "SEARCHING",
    },
    dispatchExpiresAt: { type: Date },
    driverLocation: { type: DriverLocationSchema },
    distanceKm: { type: Number, required: false },
    durationMins: { type: Number, required: false },
    passengerDetails: { type: PassengerDetailsSchema, required: false }, // Made optional for drafts
    fareBreakdown: { type: FareBreakdownSchema, required: false }, // Made optional for drafts
    paymentMethod: { type: String, required: false }, // Made optional for drafts
    bookingType: {
      type: String,
      enum: ["AIRPORT_TRANSFER", "CUSTOM_TRIP", "LOCAL_RIDE"],
      default: "AIRPORT_TRANSFER",
    },
    pickupInstructions: { type: String },
    intermediateStops: [
      {
        name: { type: String },
        address: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        stopOrder: { type: Number, required: true },
        visited: { type: Boolean, default: false },
        visitedAt: { type: Date },
        notes: { type: String },
      },
    ],
    pickMeDetails: {
      isPickMe: { type: Boolean, default: false },
      vehicleCategory: { type: String },
      goodsDescription: { type: String },
      pickupInstructions: { type: String },
      intermediateStops: [
        {
          name: { type: String },
          address: { type: String, required: true },
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          stopOrder: { type: Number, required: true },
          visited: { type: Boolean, default: false },
          visitedAt: { type: Date },
          notes: { type: String },
        },
      ],
      baseFare: { type: Number },
      ratePerKm: { type: Number },
      minimumFare: { type: Number },
      estimatedFare: { type: Number },
      pricingSnapshot: { type: Schema.Types.Mixed },
      rideNow: { type: Boolean, default: true },
    },
    customTripDetails: { type: CustomTripDetailsSchema },
    arrivedAt: { type: Date },
    arrivalSource: { type: String, enum: ["GPS", "MANUAL"] },
    arrivalCandidate: { type: ArrivalCandidateSchema },
    completedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    adminNotes: { type: Schema.Types.Mixed },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "VERIFYING_PAYMENT", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING_APPROVAL",
        "NEEDS_REVISION",
        "PENDING",
        "AWAITING_PAYMENT",
        "PENDING_ADMIN_CONFIRMATION",
        "CONFIRMED",
        "DRIVER_ASSIGNED",
        "DRIVER_EN_ROUTE",
        "DRIVER_ARRIVED",
        "PASSENGER_PICKED_UP",
        "TRIP_IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
    },
    cancelledAt: { type: Date },
    cancelledBy: {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      role: { type: String, enum: ["TOURIST", "DRIVER", "ADMIN"] },
      name: { type: String },
    },
    cancellationReasonCode: { type: String },
    cancellationReasonText: { type: String },
    cancellationComments: { type: String },
    statusBeforeCancellation: { type: String },
    refundReviewStatus: {
      type: String,
      enum: ["NOT_APPLICABLE", "PENDING_REVIEW", "REFUNDED", "RESOLVED"],
      default: "NOT_APPLICABLE",
    },
  },
  { timestamps: true }
);

if (mongoose.models.Booking) {
  delete mongoose.models.Booking;
}

export default mongoose.model<IBooking>("Booking", BookingSchema);
