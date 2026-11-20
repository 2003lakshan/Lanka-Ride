import mongoose, { Schema, Document } from "mongoose";
import "./User";
import "./VehicleType";

export interface IMealPlan {
  status: 'INCLUDED' | 'OPTIONAL' | 'NOT_INCLUDED';
  cost?: number;
  description?: string;
}

export interface IPackageItinerary {
  dayNumber: number;
  title?: string;
  destinations?: string[];
  placesToVisit: string[];
  activities?: string[];
  travelTime?: string;
  activityDuration?: string;
  stopDuration?: string;
  accommodationDetails?: string;
  overnightLocation?: string;
  notes?: string;
}

export interface IPackageMeals {
  dayNumber: number;
  breakfast: IMealPlan;
  lunch: IMealPlan;
  dinner: IMealPlan;
}

export interface IPackageAmenity {
  id?: string;
  name: string;
  category?: "WATER" | "SNACKS" | "BEVERAGES" | "WIFI" | "CUSTOM";
  isIncluded: boolean;
  quantity?: number;
  unit?: string;
  coverage: "PER_PERSON_PER_DAY" | "PER_PERSON_PER_TRIP" | "PER_VEHICLE";
  description?: string;
  price?: number;
  currency?: "LKR" | "USD";
  chargingBasis?: "PER_PERSON" | "PER_VEHICLE" | "PER_ITEM";
}

export interface IPackageCosts {
  basePrice: number;
  currency?: "LKR" | "USD";
  pricingBasis?: 'PER_PERSON' | 'PER_VEHICLE' | 'ENTIRE_PACKAGE';
  accommodationCost?: number;
  totalStartingPrice: number;
  priceType: 'PER_PERSON' | 'PER_VEHICLE';
  passengerCountCovered: number;
  extraPersonRate?: number;
  extraNightRate?: number;
  depositRequired?: number;
  inclusions: string[];
  exclusions: string[];
  cancellationTerms: string;
  conditions: string;
}

export interface IPackageReviewLog {
  action: "SUBMIT" | "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "RESUBMIT" | "ARCHIVE" | "RESTORE";
  feedback?: string;
  actorId?: mongoose.Types.ObjectId | string;
  actorRole?: "ADMIN" | "DRIVER";
  actorName?: string;
  timestamp: Date;
  revision?: number;
}

export interface IPackage extends Document {
  driverId: mongoose.Types.ObjectId;
  title: string;
  category: string;
  shortDescription: string;
  fullDescription?: string;
  destinations?: string[];
  coverPhoto: string;
  gallery: string[];
  startingCity: string;
  pickupOptions: string;
  pickupTime?: string;
  dropoffLocation?: string;
  days: number;
  nights: number;
  minPassengers: number;
  maxPassengers: number;
  vehicleTypeId: mongoose.Types.ObjectId;
  vehicleDetails?: {
    model?: string;
    registration?: string;
    category?: string;
    hasAc?: boolean;
    passengerCapacity?: number;
    luggageCapacity?: number;
  };
  availableDates: string;
  availableDateRanges?: Array<{ startDate: Date; endDate: Date }>;
  advanceNoticeDays?: number;
  
  itinerary: IPackageItinerary[];
  meals: IPackageMeals[];
  costs: IPackageCosts;

  // Inclusions & Traveller Info
  inclusionsList?: string[];
  exclusionsList?: string[];
  includedServicesDetails?: {
    accommodation?: string;
    meals?: string;
    tickets?: string;
    guide?: string;
  };
  languages?: string[];
  activityLevel?: "Easy" | "Moderate" | "Challenging";
  accessibility?: string;
  childSeatAvailable?: boolean;
  thingsToBring?: string[];
  amenities?: IPackageAmenity[];

  // Terms & Policies
  cancellationPolicy?: string;
  weatherPolicy?: string;
  extraChargeConditions?: string;

  // Review & Revisions
  revision: number;
  approvedRevision?: number;
  changeRequest?: {
    feedback: string;
    affectedFields?: string[];
    requestedAt: Date;
    requestedBy?: mongoose.Types.ObjectId | string;
    requestedByName?: string;
    revision?: number;
  };
  rejectionReason?: string;
  reviewHistory?: IPackageReviewLog[];
  stagedRevision?: any;

  status: 'DRAFT' | 'PENDING_REVIEW' | 'CHANGES_REQUESTED' | 'PUBLISHED' | 'PAUSED' | 'REJECTED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

const MealPlanSchema = new Schema<IMealPlan>({
  status: { type: String, enum: ['INCLUDED', 'OPTIONAL', 'NOT_INCLUDED'], default: 'NOT_INCLUDED', required: true },
  cost: { type: Number, default: 0 },
  description: { type: String, default: "" }
}, { _id: false });

const PackageAmenitySchema = new Schema({
  id: { type: String },
  name: { type: String, required: true },
  category: { type: String, enum: ["WATER", "SNACKS", "BEVERAGES", "WIFI", "CUSTOM"], default: "CUSTOM" },
  isIncluded: { type: Boolean, default: true },
  quantity: { type: Number, default: 1 },
  unit: { type: String, default: "" },
  coverage: {
    type: String,
    enum: ["PER_PERSON_PER_DAY", "PER_PERSON_PER_TRIP", "PER_VEHICLE"],
    default: "PER_PERSON_PER_DAY"
  },
  description: { type: String, default: "" },
  price: { type: Number, default: 0 },
  currency: { type: String, enum: ["LKR", "USD"], default: "LKR" },
  chargingBasis: { type: String, enum: ["PER_PERSON", "PER_VEHICLE", "PER_ITEM"], default: "PER_PERSON" }
}, { _id: false });

const PackageSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    shortDescription: { type: String, required: true },
    fullDescription: { type: String, default: "" },
    destinations: [{ type: String }],
    coverPhoto: { type: String, required: true },
    gallery: [{ type: String }],
    startingCity: { type: String, required: true },
    pickupOptions: { type: String, required: true },
    pickupTime: { type: String, default: "08:00 AM" },
    dropoffLocation: { type: String, default: "Hotel / Airport drop-off" },
    days: { type: Number, required: true },
    nights: { type: Number, required: true },
    minPassengers: { type: Number, required: true },
    maxPassengers: { type: Number, required: true },
    vehicleTypeId: { type: Schema.Types.ObjectId, ref: "VehicleType", required: true },
    vehicleDetails: {
      model: { type: String },
      registration: { type: String },
      category: { type: String },
      hasAc: { type: Boolean, default: true },
      passengerCapacity: { type: Number },
      luggageCapacity: { type: Number },
    },
    availableDates: { type: String, required: true, default: "Year-round availability" },
    availableDateRanges: [{
      startDate: { type: Date },
      endDate: { type: Date }
    }],
    advanceNoticeDays: { type: Number, default: 2 },
    
    itinerary: [{
      dayNumber: { type: Number, required: true },
      title: { type: String, default: "" },
      destinations: [{ type: String }],
      placesToVisit: [{ type: String }],
      activities: [{ type: String }],
      travelTime: { type: String, default: "" },
      activityDuration: { type: String, default: "" },
      stopDuration: { type: String, default: "" },
      overnightLocation: { type: String, default: "" },
      accommodationDetails: { type: String, default: "" },
      notes: { type: String, default: "" },
      meals: { type: Schema.Types.Mixed }
    }],
    
    meals: [{
      dayNumber: { type: Number, required: true },
      breakfast: { type: MealPlanSchema, default: (): IMealPlan => ({ status: 'NOT_INCLUDED', cost: 0, description: "" }) },
      lunch: { type: MealPlanSchema, default: (): IMealPlan => ({ status: 'NOT_INCLUDED', cost: 0, description: "" }) },
      dinner: { type: MealPlanSchema, default: (): IMealPlan => ({ status: 'NOT_INCLUDED', cost: 0, description: "" }) }
    }],
    
    costs: {
      basePrice: { type: Number, required: true },
      currency: { type: String, enum: ["LKR", "USD"], default: "LKR" },
      pricingBasis: { type: String, enum: ['PER_PERSON', 'PER_VEHICLE', 'ENTIRE_PACKAGE'], default: 'PER_VEHICLE' },
      accommodationCost: { type: Number, default: 0 },
      totalStartingPrice: { type: Number, required: true },
      priceType: { type: String, enum: ['PER_PERSON', 'PER_VEHICLE'], default: 'PER_VEHICLE' },
      passengerCountCovered: { type: Number, required: true, default: 1 },
      extraPersonRate: { type: Number, default: 0 },
      extraNightRate: { type: Number, default: 0 },
      depositRequired: { type: Number, default: 0 },
      inclusions: [{ type: String }],
      exclusions: [{ type: String }],
      cancellationTerms: { type: String, default: "Free cancellation up to 48 hours before pickup." },
      conditions: { type: String, default: "Standard terms and conditions apply." }
    },

    inclusionsList: [{ type: String }],
    exclusionsList: [{ type: String }],
    includedServicesDetails: {
      accommodation: { type: String, default: "" },
      meals: { type: String, default: "" },
      tickets: { type: String, default: "" },
      guide: { type: String, default: "" },
    },
    languages: [{ type: String }],
    activityLevel: { type: String, enum: ["Easy", "Moderate", "Challenging"], default: "Moderate" },
    accessibility: { type: String, default: "Standard vehicle access; please enquire for wheelchair accessibility." },
    childSeatAvailable: { type: Boolean, default: true },
    thingsToBring: [{ type: String }],
    amenities: [PackageAmenitySchema],

    cancellationPolicy: { type: String, default: "Free cancellation up to 48 hours prior to the tour start time. Cancellations within 48 hours may be subject to a 20% administrative fee." },
    weatherPolicy: { type: String, default: "In the event of severe weather or landslides, alternative scenic routes or indoor cultural sites will be arranged in full consultation with passengers." },
    extraChargeConditions: { type: String, default: "Additional detour mileage or unscheduled stops beyond the itinerary will be charged at standard per-kilometer rates." },

    revision: { type: Number, default: 1 },
    approvedRevision: { type: Number },
    changeRequest: {
      feedback: { type: String },
      affectedFields: [{ type: String }],
      requestedAt: { type: Date },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
      requestedByName: { type: String },
      revision: { type: Number }
    },
    rejectionReason: { type: String },
    reviewHistory: [{
      action: { type: String, enum: ["SUBMIT", "APPROVE", "REQUEST_CHANGES", "REJECT", "RESUBMIT", "ARCHIVE", "RESTORE"] },
      feedback: { type: String },
      actorId: { type: Schema.Types.ObjectId, ref: "User" },
      actorRole: { type: String, enum: ["ADMIN", "DRIVER"] },
      actorName: { type: String },
      timestamp: { type: Date, default: Date.now },
      revision: { type: Number }
    }],
    stagedRevision: { type: Schema.Types.Mixed },

    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'PAUSED', 'REJECTED', 'ARCHIVED'],
      default: 'DRAFT',
      required: true
    }
  },
  { timestamps: true }
);

if (mongoose.models.Package) {
  delete mongoose.models.Package;
}

export default mongoose.models.Package || mongoose.model<IPackage>("Package", PackageSchema);
