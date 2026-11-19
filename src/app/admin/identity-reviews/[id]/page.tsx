import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import Booking from "@/models/Booking";
import Link from "next/link";
import { ArrowLeft, IdCard } from "lucide-react";
import { generateSignedDocumentUrl } from "@/lib/identityStorage";
import AdminIdentityReviewDetailClient from "./AdminIdentityReviewDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminIdentityReviewDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  const { id } = await props.params;

  const rawIdentity = await RiderIdentity.findById(id)
    .populate("userId", "name email phoneNumber nationality isEmailVerified createdAt")
    .populate("reviewedBy", "name email")
    .lean();

  if (!rawIdentity) {
    return (
      <div className="bg-slate-50 min-h-screen py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <IdCard size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Identity Record Not Found</h1>
          <p className="text-sm text-slate-500 mb-6">
            The requested identity verification record does not exist or may have been removed.
          </p>
          <Link
            href="/admin/identity-reviews"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Identity Reviews
          </Link>
        </div>
      </div>
    );
  }

  const identity = JSON.parse(JSON.stringify(rawIdentity));

  // Generate short-lived signed URLs for document previews
  if (identity.files) {
    for (const key of ["front", "back", "photoPage"]) {
      const file = identity.files[key];
      if (file?.fileId && file.storagePath !== "[DELETED_BY_RETENTION_POLICY]") {
        identity.files[key].viewUrl = generateSignedDocumentUrl(file.fileId, 3600);
      }
    }
  }

  // Fetch any linked custom trips or bookings for this rider
  const rawBookings = await Booking.find({ touristId: identity.userId?._id || identity.userId })
    .select("bookingReference status customTripDetails createdAt")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const bookings = JSON.parse(JSON.stringify(rawBookings));
  const rider = identity.userId || null;

  return (
    <AdminIdentityReviewDetailClient
      identity={identity}
      rider={rider}
      bookings={bookings}
    />
  );
}

