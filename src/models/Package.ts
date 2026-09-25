import mongoose, { Schema, Document } from "mongoose";

export interface IMealPlan {
  status: 'INCLUDED' | 'OPTIONAL' | 'NOT_INCLUDED';
  cost?: number;
  description?: string;
}

export interface IPackageItinerary {
  dayNumber: number;
  overnightLocation?: string;
  placesToVisit: string[];
  travelTime?: string;
  activityDuration?: string;
  accommodationDetails?: string;
  notes?: string;
}

export interface IPackageMeals {
  dayNumber: number;
  breakfast: IMealPlan;
  lunch: IMealPlan;
  dinner: IMealPlan;
}

export interface IPackageCosts {
  basePrice: number;
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

export interface IPackage extends Document {
  driverId: mongoose.Types.ObjectId;
  title: string;
  category: string;
  shortDescription: string;
  coverPhoto: string;
  gallery: string[];
  startingCity: string;
  pickupOptions: string;
  days: number;
  nights: number;
  minPassengers: number;
  maxPassengers: number;
  vehicleTypeId: mongoose.Types.ObjectId;
  availableDates: string;
  
  itinerary: IPackageItinerary[];
  meals: IPackageMeals[];
  costs: IPackageCosts;

  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'REJECTED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

const MealPlanSchema = new Schema({
  status: { type: String, enum: ['INCLUDED', 'OPTIONAL', 'NOT_INCLUDED'], required: true },
  cost: { type: Number },
  description: { type: String }
}, { _id: false });

const PackageSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    shortDescription: { type: String, required: true },
    coverPhoto: { type: String, required: true },
    gallery: [{ type: String }],
    startingCity: { type: String, required: true },
    pickupOptions: { type: String, required: true },
    days: { type: Number, required: true },
    nights: { type: Number, required: true },
    minPassengers: { type: Number, required: true },
    maxPassengers: { type: Number, required: true },
    vehicleTypeId: { type: Schema.Types.ObjectId, ref: "VehicleType", required: true },
    availableDates: { type: String, required: true },
    
    itinerary: [{
      dayNumber: { type: Number, required: true },
      overnightLocation: { type: String },
      placesToVisit: [{ type: String }],
      travelTime: { type: String },
      activityDuration: { type: String },
      accommodationDetails: { type: String },
      notes: { type: String }
    }],
    
    meals: [{
      dayNumber: { type: Number, required: true },
      breakfast: { type: MealPlanSchema, required: true },
      lunch: { type: MealPlanSchema, required: true },
      dinner: { type: MealPlanSchema, required: true }
    }],
    
    costs: {
      basePrice: { type: Number, required: true },
      accommodationCost: { type: Number },
      totalStartingPrice: { type: Number, required: true },
      priceType: { type: String, enum: ['PER_PERSON', 'PER_VEHICLE'], required: true },
      passengerCountCovered: { type: Number, required: true },
      extraPersonRate: { type: Number },
      extraNightRate: { type: Number },
      depositRequired: { type: Number },
      inclusions: [{ type: String }],
      exclusions: [{ type: String }],
      cancellationTerms: { type: String },
      conditions: { type: String }
    },
    
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'REJECTED', 'ARCHIVED'],
      default: 'DRAFT',
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.models.Package || mongoose.model<IPackage>("Package", PackageSchema);
