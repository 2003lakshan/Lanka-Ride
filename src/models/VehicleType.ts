import mongoose, { Schema, Document } from "mongoose";

export interface IVehicleType extends Document {
  name: string;
  image?: string;
  description: string;
  maxPassengers: number;
  maxLuggage: number;
  fuelType: string;
  averageFuelConsumption: number;
  baseCharge: number;
  pricePerKm: number;
  minFare: number;
  waitingChargePerMin: number;
  nightSurcharge: number;
  airportSurcharge: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleTypeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    image: { type: String },
    description: { type: String },
    maxPassengers: { type: Number, required: true },
    maxLuggage: { type: Number, required: true },
    fuelType: { type: String, required: true },
    averageFuelConsumption: { type: Number, required: true },
    baseCharge: { type: Number, required: true },
    pricePerKm: { type: Number, required: true },
    minFare: { type: Number, required: true },
    waitingChargePerMin: { type: Number, default: 0 },
    nightSurcharge: { type: Number, default: 0 },
    airportSurcharge: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.VehicleType ||
  mongoose.model<IVehicleType>("VehicleType", VehicleTypeSchema);
