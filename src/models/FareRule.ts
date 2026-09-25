import mongoose, { Schema, Document } from "mongoose";

export interface IFareRule extends Document {
  type: "TRAFFIC" | "FUEL" | "NIGHT" | "GLOBAL_DISCOUNT";
  name: string;
  description?: string;
  value: number; // e.g. amount in LKR or percentage
  isPercentage: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FareRuleSchema: Schema = new Schema(
  {
    type: {
      type: String,
      enum: ["TRAFFIC", "FUEL", "NIGHT", "GLOBAL_DISCOUNT"],
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    value: { type: Number, required: true },
    isPercentage: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.FareRule ||
  mongoose.model<IFareRule>("FareRule", FareRuleSchema);
