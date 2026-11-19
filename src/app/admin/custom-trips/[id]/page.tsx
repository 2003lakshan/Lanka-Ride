import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import VehicleType from "@/models/VehicleType";
import RiderIdentity from "@/models/RiderIdentity";
import AdminTripReviewClient from "./AdminTripReviewClient";

export const dynamic = "force-dynamic";

export default async function AdminTripReviewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  if (VehicleType) {
    // Ensure model is registered
  }

  const booking = await Booking.findById(params.id).populate('vehicleTypeId').lean();

  if (!booking) {
    return <div className="p-12 text-center text-slate-500">Booking not found</div>;
  }

  // Fetch live identity record to guarantee exact live version and review status
  const liveIdentity = await RiderIdentity.findOne({
    $or: [
      { _id: booking.customTripDetails?.identityVerification?.identityId },
      { userId: booking.touristId },
    ],
  }).lean();

  // Serialize to pass to client component
  const serializedBooking = JSON.parse(JSON.stringify(booking));

  if (liveIdentity && serializedBooking.customTripDetails) {
    serializedBooking.customTripDetails.identityVerification = {
      ...serializedBooking.customTripDetails.identityVerification,
      identityId: liveIdentity._id.toString(),
      documentType: liveIdentity.documentType,
      status: liveIdentity.status,
      version: Number(liveIdentity.version) || 1,
      reviewedVersion: liveIdentity.reviewedVersion,
      rejectionReason: liveIdentity.rejectionReason,
      files: liveIdentity.files,
    };
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <AdminTripReviewClient booking={serializedBooking} />
    </div>
  );
}
