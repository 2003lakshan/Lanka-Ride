import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: "TOURIST" | "DRIVER" | "ADMIN";
  phoneNumber?: string;
  nationality?: string;
  // Driver specific fields
  licenseNumber?: string;
  vehicleRegistration?: string;
  isApproved?: boolean;
  currentLat?: number;
  currentLng?: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for OAuth
    role: {
      type: String,
      enum: ["TOURIST", "DRIVER", "ADMIN"],
      default: "TOURIST",
    },
    phoneNumber: { type: String },
    nationality: { type: String },
    // Driver specific fields
    licenseNumber: { type: String },
    vehicleRegistration: { type: String },
    isApproved: { type: Boolean, default: false },
    currentLat: { type: Number },
    currentLng: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
