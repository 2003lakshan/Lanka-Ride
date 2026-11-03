import mongoose, { Schema, Document } from "mongoose";

export type PickMeCategoryType =
  | "Bike"
  | "Three-wheeler"
  | "Car"
  | "Mini Van"
  | "Van"
  | "Lorry";

export interface IPickMeCategory extends Document {
  category: PickMeCategoryType;
  displayName: string;
  description: string;
  maxPassengers: number;
  maxLuggage: number;
  loadCapacityKg?: number;
  isGoodsTransport: boolean;
  baseFare: number;
  ratePerKm: number;
  minimumFare: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PickMeCategorySchema: Schema = new Schema(
  {
    category: {
      type: String,
      required: true,
      unique: true,
      enum: ["Bike", "Three-wheeler", "Car", "Mini Van", "Van", "Lorry"],
    },
    displayName: { type: String, required: true },
    description: { type: String, required: true },
    maxPassengers: { type: Number, required: true, default: 1 },
    maxLuggage: { type: Number, required: true, default: 0 },
    loadCapacityKg: { type: Number, default: 0 },
    isGoodsTransport: { type: Boolean, default: false },
    baseFare: { type: Number, required: true, min: 0, default: 150 },
    ratePerKm: { type: Number, required: true, min: 0, default: 90 },
    minimumFare: { type: Number, required: true, min: 0, default: 200 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const DEFAULT_PICKME_CATEGORIES = [
  {
    category: "Bike",
    displayName: "Bike",
    description: "Fast, single-passenger city commute with minimal baggage.",
    maxPassengers: 1,
    maxLuggage: 1,
    loadCapacityKg: 0,
    isGoodsTransport: false,
    baseFare: 100,
    ratePerKm: 65,
    minimumFare: 150,
    isActive: true,
    sortOrder: 1,
  },
  {
    category: "Three-wheeler",
    displayName: "Three-wheeler (Tuk-Tuk)",
    description: "Affordable and nimble for up to 3 passengers across town.",
    maxPassengers: 3,
    maxLuggage: 2,
    loadCapacityKg: 0,
    isGoodsTransport: false,
    baseFare: 150,
    ratePerKm: 95,
    minimumFare: 220,
    isActive: true,
    sortOrder: 2,
  },
  {
    category: "Car",
    displayName: "Car (Sedan / Hatchback)",
    description: "Air-conditioned comfortable ride for up to 4 passengers.",
    maxPassengers: 4,
    maxLuggage: 3,
    loadCapacityKg: 0,
    isGoodsTransport: false,
    baseFare: 300,
    ratePerKm: 135,
    minimumFare: 450,
    isActive: true,
    sortOrder: 3,
  },
  {
    category: "Mini Van",
    displayName: "Mini Van",
    description: "Spacious seating for up to 6 passengers or extra luggage.",
    maxPassengers: 6,
    maxLuggage: 4,
    loadCapacityKg: 0,
    isGoodsTransport: false,
    baseFare: 450,
    ratePerKm: 165,
    minimumFare: 650,
    isActive: true,
    sortOrder: 4,
  },
  {
    category: "Van",
    displayName: "Van (Passenger)",
    description: "Large groups up to 10-14 passengers with ample luggage space.",
    maxPassengers: 10,
    maxLuggage: 8,
    loadCapacityKg: 0,
    isGoodsTransport: false,
    baseFare: 650,
    ratePerKm: 195,
    minimumFare: 900,
    isActive: true,
    sortOrder: 5,
  },
  {
    category: "Lorry",
    displayName: "Lorry (Goods Transport)",
    description: "Cargo and goods transport. Heavy loads, moving, and freight delivery.",
    maxPassengers: 2,
    maxLuggage: 0,
    loadCapacityKg: 1500,
    isGoodsTransport: true,
    baseFare: 1200,
    ratePerKm: 230,
    minimumFare: 1800,
    isActive: true,
    sortOrder: 6,
  },
];

export default mongoose.models.PickMeCategory ||
  mongoose.model<IPickMeCategory>("PickMeCategory", PickMeCategorySchema);
