import mongoose, { Schema, Document } from "mongoose";
import { IPackageItinerary, IPackageMeals, IPackageCosts } from "./Package";

export interface IEnquiryMessage {
  sender: 'RIDER' | 'DRIVER';
  text: string;
  createdAt: Date;
}

export interface IEnquiryQuote {
  itinerary: IPackageItinerary[];
  meals: IPackageMeals[];
  costs: IPackageCosts;
  validityDate: Date;
  proposedDates?: string;
  proposedPassengers?: number;
}

export interface IPackageEnquiry extends Document {
  riderId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  packageId: mongoose.Types.ObjectId;
  status: 'ENQUIRY' | 'DISCUSSING' | 'QUOTE_SENT' | 'CHANGES_REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'BOOKED';
  messages: IEnquiryMessage[];
  
  requestedDates?: string;
  requestedPassengers?: number;
  
  activeQuote?: IEnquiryQuote;
  historyQuotes: IEnquiryQuote[];
  
  riderUnread: boolean;
  driverUnread: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const EnquiryMessageSchema = new Schema({
  sender: { type: String, enum: ['RIDER', 'DRIVER'], required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Using Schema.Types.Mixed for quote details to avoid deep nested strict schemas, 
// but in a production app we'd reuse the SubSchemas from Package.ts
const EnquiryQuoteSchema = new Schema({
  itinerary: { type: Schema.Types.Mixed, required: true },
  meals: { type: Schema.Types.Mixed, required: true },
  costs: { type: Schema.Types.Mixed, required: true },
  validityDate: { type: Date, required: true },
  proposedDates: { type: String },
  proposedPassengers: { type: Number }
}, { _id: false });

const PackageEnquirySchema = new Schema(
  {
    riderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    packageId: { type: Schema.Types.ObjectId, ref: "Package", required: true },
    
    status: {
      type: String,
      enum: ['ENQUIRY', 'DISCUSSING', 'QUOTE_SENT', 'CHANGES_REQUESTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'BOOKED'],
      default: 'ENQUIRY',
      required: true
    },
    
    messages: [EnquiryMessageSchema],
    
    requestedDates: { type: String },
    requestedPassengers: { type: Number },
    
    activeQuote: { type: EnquiryQuoteSchema },
    historyQuotes: [EnquiryQuoteSchema],
    
    riderUnread: { type: Boolean, default: false },
    driverUnread: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.PackageEnquiry || mongoose.model<IPackageEnquiry>("PackageEnquiry", PackageEnquirySchema);
