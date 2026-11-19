import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import User from "@/models/User";
import { deleteDocumentFile, generateSignedDocumentUrl } from "@/lib/identityStorage";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required to remove documents." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    const { fileKey } = await req.json().catch(() => ({}));
    if (!fileKey || !["front", "back", "photoPage"].includes(fileKey)) {
      return NextResponse.json({ error: "Invalid file key provided." }, { status: 400 });
    }

    await dbConnect();

    const identity = await RiderIdentity.findOne({ userId });
    if (!identity) {
      return NextResponse.json({ error: "No identity record found." }, { status: 404 });
    }

    const targetFile = (identity.files as any)?.[fileKey];
    if (targetFile?.storagePath) {
      await deleteDocumentFile(targetFile.storagePath);
      (identity.files as any)[fileKey] = undefined;
    }

    // Check completeness
    const isComplete =
      identity.documentType === "NATIONAL_ID"
        ? Boolean(identity.files?.front?.fileId && identity.files?.back?.fileId)
        : Boolean(identity.files?.photoPage?.fileId);

    // Increment version and reset approval upon file removal
    identity.version = (identity.version || 0) + 1;
    identity.filesUpdatedAt = new Date();
    identity.status = "PENDING_REVIEW";
    identity.reviewedBy = undefined;
    identity.reviewedAt = undefined;
    identity.reviewedVersion = undefined;

    await identity.save();

    await User.findByIdAndUpdate(userId, {
      identityStatus: isComplete ? identity.status : "NOT_SUBMITTED",
    });

    try {
      const Booking = (await import("@/models/Booking")).default;
      await Booking.updateMany(
        { touristId: userId, status: { $in: ["DRAFT", "PENDING_APPROVAL"] }, "customTripDetails.isCustomTrip": true },
        {
          "customTripDetails.identityVerification.status": identity.status,
          "customTripDetails.identityVerification.version": identity.version,
          $unset: {
            [`customTripDetails.identityVerification.files.${fileKey}`]: 1,
            "customTripDetails.identityVerification.reviewedBy": 1,
            "customTripDetails.identityVerification.reviewedAt": 1,
            "customTripDetails.identityVerification.reviewedVersion": 1,
          },
        }
      );
    } catch (bookingSyncErr) {
      console.error("[Identity Remove] Failed to sync booking identity snapshot:", bookingSyncErr);
    }

    const filesOutput: Record<string, any> = {};
    for (const key of ["front", "back", "photoPage"]) {
      const f = (identity.files as any)?.[key];
      if (f) {
        filesOutput[key] = {
          fileId: f.fileId,
          originalName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
          uploadedAt: f.uploadedAt,
          viewUrl: generateSignedDocumentUrl(f.fileId, 3600),
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: `File ${fileKey} removed successfully.`,
      status: identity.status,
      documentType: identity.documentType,
      version: identity.version,
      isComplete,
      files: filesOutput,
    });
  } catch (error: any) {
    console.error("[Identity Document Remove Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to remove identity document." }, { status: 500 });
  }
}

