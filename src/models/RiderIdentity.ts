import mongoose, { Schema, Document } from "mongoose";

export interface IIdentityFile {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedAt: Date;
}

export interface IRiderIdentity extends Document {
  userId: mongoose.Types.ObjectId;
  documentType: "NATIONAL_ID" | "PASSPORT";
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  acknowledgedPurpose: boolean;
  files: {
    front?: IIdentityFile;
    back?: IIdentityFile;
    photoPage?: IIdentityFile;
  };
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  retentionUntil?: Date;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const IdentityFileSchema = new Schema(
  {
    fileId: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RiderIdentitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    documentType: { type: String, enum: ["NATIONAL_ID", "PASSPORT"], required: true },
    status: {
      type: String,
      enum: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
      default: "PENDING_REVIEW",
      index: true,
    },
    acknowledgedPurpose: { type: Boolean, default: false },
    files: {
      front: { type: IdentityFileSchema },
      back: { type: IdentityFileSchema },
      photoPage: { type: IdentityFileSchema },
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    retentionUntil: { type: Date, index: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.RiderIdentity ||
  mongoose.model<IRiderIdentity>("RiderIdentity", RiderIdentitySchema);
