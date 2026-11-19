import mongoose, { Schema, Document } from "mongoose";

export interface IContactVerification extends Document {
  userId: mongoose.Types.ObjectId;
  type: "EMAIL" | "PHONE";
  target: string; // Lowercase email or E.164 phone
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  verifiedAt?: Date;
  verificationToken?: string;
  consumed: boolean;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactVerificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["EMAIL", "PHONE"], required: true },
    target: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: "1d" } }, // Auto-clean after 1 day
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    verificationToken: { type: String, index: true },
    consumed: { type: Boolean, default: false },
    ip: { type: String },
  },
  { timestamps: true }
);

ContactVerificationSchema.index({ userId: 1, type: 1, target: 1 });

export default mongoose.models.ContactVerification ||
  mongoose.model<IContactVerification>("ContactVerification", ContactVerificationSchema);

