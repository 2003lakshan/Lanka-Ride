import mongoose, { Schema, Document } from "mongoose";

export interface IAirport extends Document {
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  pickupCharge: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AirportSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    pickupCharge: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Airport ||
  mongoose.model<IAirport>("Airport", AirportSchema);
