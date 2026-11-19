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

    const existingDoc = await RiderIdentity.findById(identityId);
    if (!existingDoc) {
      return NextResponse.json({ error: "Rider identity record not found." }, { status: 404 });
    }

    // Normalize DB version (legacy records without version default to 1)
    const currentVersion = Number(existingDoc.version) || 1;

    // Normalize expectedVersion (handles missing legacy values, string numbers, nulls)
    const hasExpectedVersion =
      expectedVersion !== undefined &&
      expectedVersion !== null &&
      expectedVersion !== "" &&
      !isNaN(Number(expectedVersion));
    const targetExpectedVersion = hasExpectedVersion ? Number(expectedVersion) : undefined;

    // Preserve genuine stale-document protection:
    // If expectedVersion was provided and doesn't match current document version, return conflict
    if (targetExpectedVersion !== undefined && currentVersion !== targetExpectedVersion) {
      return NextResponse.json(
        {
          error: "The rider updated or replaced their document while you were reviewing. Please refresh to inspect the updated document.",
          conflict: true,
          expectedVersion: targetExpectedVersion,
          currentVersion,
        },
        { status: 409 }
      );
    }

    // Atomic conditional update filter
    const filter: any = { _id: identityId };
    if (targetExpectedVersion !== undefined) {
      if (targetExpectedVersion === 1) {
        filter.$or = [
          { version: 1 },
          { version: { $exists: false } },
          { version: null },
        ];
      } else {
        filter.version = targetExpectedVersion;
      }
    }

    const now = new Date();
    const updateDoc: any = {
      $set: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedVersion: currentVersion,
        reviewedBy: adminId,
        reviewedAt: now,
        version: currentVersion,
      },
    };

    if (action === "APPROVE") {
      updateDoc.$unset = { rejectionReason: 1 };
    } else {
      updateDoc.$set.rejectionReason = rejectionReason.trim();
    }

    // Execute atomic conditional update
    const updatedIdentity = await RiderIdentity.findOneAndUpdate(filter, updateDoc, { new: true });

    if (!updatedIdentity) {
      // Record was concurrently altered by the rider during review
      const latest = await RiderIdentity.findById(identityId);
      return NextResponse.json(
        {
          error: "The rider updated or replaced their document while you were reviewing. Please refresh to inspect the updated document.",
          conflict: true,
          expectedVersion: targetExpectedVersion,
          currentVersion: latest ? Number(latest.version) || 1 : undefined,
        },
        { status: 409 }
      );
    }

    // Synchronize User profile status
    await User.findByIdAndUpdate(updatedIdentity.userId, {
      identityStatus: updatedIdentity.status,
      identityDocumentId: updatedIdentity._id,
    });

    // Synchronize relevant booking references
    const bookingUpdate: any = {
      $set: {
        "customTripDetails.identityVerification.status": updatedIdentity.status,
        "customTripDetails.identityVerification.version": updatedIdentity.version,
        "customTripDetails.identityVerification.reviewedVersion": updatedIdentity.reviewedVersion,
        "customTripDetails.identityVerification.reviewedBy": adminId,
        "customTripDetails.identityVerification.reviewedAt": now,
      },
    };

    if (action === "APPROVE") {
      bookingUpdate.$unset = { "customTripDetails.identityVerification.rejectionReason": 1 };
    } else {
      bookingUpdate.$set["customTripDetails.identityVerification.rejectionReason"] = updatedIdentity.rejectionReason;
    }

    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, bookingUpdate);
    }

    await Booking.updateMany(
      { touristId: updatedIdentity.userId, "customTripDetails.isCustomTrip": true },
      bookingUpdate
    );

    // Broadcast realtime identity status update to rider
    try {
      const { broadcastIdentityStatusUpdated } = await import("@/lib/realtime");
      await broadcastIdentityStatusUpdated(updatedIdentity.userId.toString(), {
        identityId: updatedIdentity._id.toString(),
        status: updatedIdentity.status,
        version: updatedIdentity.version,
        rejectionReason: updatedIdentity.rejectionReason,
        reviewedAt: updatedIdentity.reviewedAt,
      });
    } catch (rtErr) {
      console.error("[Identity Review Realtime Error]:", rtErr);
    }

    // Send in-app notification to the rider
    try {
      await sendNotification({
        recipientId: updatedIdentity.userId.toString(),
        type: action === "APPROVE" ? "IDENTITY_APPROVED" : "IDENTITY_REJECTED",
        title: action === "APPROVE" ? "Identity Document Approved" : "Identity Document Requires Re-upload",
        message:
          action === "APPROVE"
            ? "Your identity document verification has been approved. Your verified status is now active!"
            : `Your uploaded identity document was rejected: "${rejectionReason.trim()}". Please visit your trip builder or profile to re-upload.`,
        link: "/trip-builder",
        deduplicationKey: `identity_review_${updatedIdentity._id.toString()}_${now.getTime()}`,
      });
    } catch (notifErr) {
      console.error("[Identity Review Notification Error]:", notifErr);
    }

    return NextResponse.json({
      success: true,
      status: updatedIdentity.status,
      version: updatedIdentity.version,
      reviewedVersion: updatedIdentity.reviewedVersion,
      reviewedAt: updatedIdentity.reviewedAt,
      rejectionReason: updatedIdentity.rejectionReason,
      message: `Document successfully ${updatedIdentity.status.toLowerCase()}.`,
    });
  } catch (error: any) {
    console.error("[Admin Identity Review Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to process identity review." }, { status: 500 });
  }
}
