import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import User from "@/models/User";
import Booking from "@/models/Booking";
import { sendNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 });
    }

    const adminId = (session.user as any).id;
    const body = await req.json().catch(() => ({}));
    const { identityId, action, rejectionReason, bookingId, expectedVersion } = body;

    if (!identityId) {
      return NextResponse.json({ error: "Identity ID is required." }, { status: 400 });
    }

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json({ error: "Review action must be 'APPROVE' or 'REJECT'." }, { status: 400 });
    }

    if (action === "REJECT" && (!rejectionReason || !rejectionReason.trim())) {
      return NextResponse.json({ error: "A clear rejection reason must be provided when rejecting identity documents." }, { status: 400 });
    }

    await dbConnect();

    const identity = await RiderIdentity.findById(identityId);
    if (!identity) {
      return NextResponse.json({ error: "Rider identity record not found." }, { status: 404 });
    }

    // Exact Version Gating: Ensure approval applies to the exact document version reviewed
    if (expectedVersion !== undefined && identity.version !== expectedVersion) {
      return NextResponse.json(
        {
          error: "The rider updated or replaced their document while you were reviewing. Please refresh to inspect the updated document.",
          conflict: true,
          expectedVersion,
          currentVersion: identity.version,
        },
        { status: 409 }
      );
    }

    const now = new Date();
    identity.reviewedVersion = identity.version;
    identity.reviewedBy = adminId;
    identity.reviewedAt = now;

    if (action === "APPROVE") {
      identity.status = "APPROVED";
      identity.rejectionReason = undefined;
    } else {
      identity.status = "REJECTED";
      identity.rejectionReason = rejectionReason.trim();
    }

    await identity.save();

    // Update user profile status
    await User.findByIdAndUpdate(identity.userId, {
      identityStatus: identity.status,
    });

    // Update linked bookings
    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, {
        "customTripDetails.identityVerification.status": identity.status,
        "customTripDetails.identityVerification.version": identity.version,
        "customTripDetails.identityVerification.reviewedVersion": identity.reviewedVersion,
        "customTripDetails.identityVerification.rejectionReason": identity.rejectionReason,
        "customTripDetails.identityVerification.reviewedBy": adminId,
        "customTripDetails.identityVerification.reviewedAt": now,
      });
    } else {
      await Booking.updateMany(
        { touristId: identity.userId, "customTripDetails.isCustomTrip": true },
        {
          "customTripDetails.identityVerification.status": identity.status,
          "customTripDetails.identityVerification.version": identity.version,
          "customTripDetails.identityVerification.reviewedVersion": identity.reviewedVersion,
          "customTripDetails.identityVerification.rejectionReason": identity.rejectionReason,
          "customTripDetails.identityVerification.reviewedBy": adminId,
          "customTripDetails.identityVerification.reviewedAt": now,
        }
      );
    }

    // Send in-app notification to the rider
    try {
      await sendNotification({
        recipientId: identity.userId.toString(),
        type: action === "APPROVE" ? "IDENTITY_APPROVED" : "IDENTITY_REJECTED",
        title: action === "APPROVE" ? "Identity Document Approved" : "Identity Document Requires Re-upload",
        message:
          action === "APPROVE"
            ? "Your identity document verification has been approved. Your custom trip request is progressing smoothly!"
            : `Your uploaded identity document was rejected: "${rejectionReason.trim()}". Please visit your trip details or profile to re-upload.`,
        link: "/trip-builder",
        deduplicationKey: `identity_review_${identity._id.toString()}_${now.getTime()}`,
      });
    } catch (notifErr) {
      console.error("[Identity Review Notification Error]:", notifErr);
    }

    return NextResponse.json({
      success: true,
      status: identity.status,
      version: identity.version,
      reviewedVersion: identity.reviewedVersion,
      reviewedAt: identity.reviewedAt,
      rejectionReason: identity.rejectionReason,
      message: `Document successfully ${identity.status.toLowerCase()}.`,
    });
  } catch (error: any) {
    console.error("[Admin Identity Review Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to process identity review." }, { status: 500 });
  }
}

