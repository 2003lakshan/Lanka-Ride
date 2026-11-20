import mongoose, { Schema, Document } from "mongoose";

export interface IDriverDetails {
  shortBio?: string;
  yearsOfExperience?: number;
  homeCity?: string;
  areasServed?: string;
  specialities?: string[] | string;
  languagesSpoken?: string[] | string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleCategory?: string;
  vehiclePhotos?: string[];
  hasAc?: boolean;
  passengerCapacity?: number;
  luggageCapacity?: number;
  nicOrPassportNumber?: string;
  licenseExpiryDate?: string;
  insurancePolicyNumber?: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: "TOURIST" | "DRIVER" | "ADMIN";
  phoneNumber?: string;
  nationality?: string;
  profilePhoto?: string;
  preferredLanguage?: string;
  isEmailVerified?: boolean;
  emailVerifiedAt?: Date;
  isPhoneVerified?: boolean;
  phoneVerifiedAt?: Date;
  identityStatus?: "NOT_SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  identityDocumentId?: mongoose.Types.ObjectId;
  // Driver specific fields
  licenseNumber?: string;
  vehicleRegistration?: string;
  vehicleCategory?: "Bike" | "Three-wheeler" | "Car" | "Mini Van" | "Van" | "Lorry" | string;
  driverDetails?: IDriverDetails;
  isApproved?: boolean;
  rating?: number;
  reviewCount?: number;
  completedTripsCount?: number;
  isOnline?: boolean;
  locationUpdatedAt?: Date;
  currentLat?: number;
  currentLng?: number;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  resetPasswordOtpHash?: string;
  resetPasswordOtpExpires?: Date;
  resetPasswordOtpAttempts?: number;
  resetPasswordOtpLastSent?: Date;
  resetPasswordAuthTokenHash?: string;
  resetPasswordAuthTokenExpires?: Date;
  resetPasswordAuthTokenConsumed?: boolean;
  sessionVersion: number;
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
    profilePhoto: { type: String },
    preferredLanguage: { type: String, default: "English" },
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    isPhoneVerified: { type: Boolean, default: false },
    phoneVerifiedAt: { type: Date },
    identityStatus: {
      type: String,
      enum: ["NOT_SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED"],
      default: "NOT_SUBMITTED",
    },
    identityDocumentId: { type: Schema.Types.ObjectId, ref: "RiderIdentity" },
    // Driver specific fields
    licenseNumber: { type: String },
    vehicleRegistration: { type: String },
    vehicleCategory: { type: String, enum: ["Bike", "Three-wheeler", "Car", "Mini Van", "Van", "Lorry"] },
    driverDetails: { type: Schema.Types.Mixed },
    isApproved: { type: Boolean, default: false },
    rating: { type: Number, default: 5.0 },
    reviewCount: { type: Number, default: 0 },
    completedTripsCount: { type: Number, default: 0 },
    isOnline: { type: Boolean, default: false },
    locationUpdatedAt: { type: Date },
    currentLat: { type: Number },
    currentLng: { type: Number },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    resetPasswordOtpHash: { type: String },
    resetPasswordOtpExpires: { type: Date },
    resetPasswordOtpAttempts: { type: Number, default: 0 },
    resetPasswordOtpLastSent: { type: Date },
    resetPasswordAuthTokenHash: { type: String },
    resetPasswordAuthTokenExpires: { type: Date },
    resetPasswordAuthTokenConsumed: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
