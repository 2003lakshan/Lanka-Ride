import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  resourceId?: string;
  link?: string;
  isRead: boolean;
  deduplicationKey?: string;
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    resourceId: { type: String },
    link: { type: String },
    isRead: { type: Boolean, default: false },
    deduplicationKey: { type: String, sparse: true, unique: true },
    readAt: { type: Date }
  },
  { timestamps: true }
);

// We should be able to cleanly delete the model if it exists to avoid "OverwriteModelError" in dev
if (mongoose.models.Notification) {
  delete mongoose.models.Notification;
}

export default mongoose.model<INotification>("Notification", NotificationSchema);
