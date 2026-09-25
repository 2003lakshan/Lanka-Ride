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
  whatsappNumber: string;
  alternativePhoneNumber?: string;
  adults: number;
  children: number;
  luggage: number;
  childSeatRequired: boolean;
  meetAndGreetRequired: boolean;
  specialRequests?: string;
}

export interface IDriverLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: Date;
}

export interface IBooking extends Document {
  bookingReference: string;
  touristId?: mongoose.Types.ObjectId;
  driverLocation?: IDriverLocation;
  airportId?: mongoose.Types.ObjectId;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
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
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  status:
    | "PENDING"
    | "AWAITING_PAYMENT"
    | "CONFIRMED"
    | "DRIVER_ASSIGNED"
    | "DRIVER_EN_ROUTE"
    | "DRIVER_ARRIVED"
    | "PASSENGER_PICKED_UP"
    | "TRIP_IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED";
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
    whatsappNumber: { type: String, required: true },
    alternativePhoneNumber: { type: String },
    adults: { type: Number, required: true },
    children: { type: Number, required: true },
    luggage: { type: Number, required: true },
    childSeatRequired: { type: Boolean, default: false },
    meetAndGreetRequired: { type: Boolean, default: false },
    specialRequests: { type: String },
  },
  { _id: false }
);

const DriverLocationSchema = new Schema<IDriverLocation>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number },
  updatedAt: { type: Date, required: true, default: Date.now }
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
    driverLocation: { type: DriverLocationSchema },
    distanceKm: { type: Number, required: false },
    durationMins: { type: Number, required: false },
    passengerDetails: { type: PassengerDetailsSchema, required: true },
    fareBreakdown: { type: FareBreakdownSchema, required: true },
    paymentMethod: { type: String, required: true },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "AWAITING_PAYMENT",
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
  },
  { timestamps: true }
);

if (mongoose.models.Booking) {
  delete mongoose.models.Booking;
}

export default mongoose.model<IBooking>("Booking", BookingSchema);
