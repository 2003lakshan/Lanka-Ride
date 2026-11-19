import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import User from "@/models/User";
import { generateSignedDocumentUrl } from "@/lib/identityStorage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    await dbConnect();

    const [rawIdentity, user] = await Promise.all([
      RiderIdentity.findOne({ userId }).lean(),
      User.findById(userId).select("identityStatus isEmailVerified").lean(),
    ]);

    if (!rawIdentity) {
      return NextResponse.json({
        hasIdentity: false,
        status: user?.identityStatus || "NOT_SUBMITTED",
        version: 1,
        documentType: "PASSPORT",
        acknowledgedPurpose: false,
        isComplete: false,
        files: {},
      });
    }

    const identity = JSON.parse(JSON.stringify(rawIdentity));
    const isDocExpired = Boolean(
      identity.isArchived ||
      (identity.retentionUntil && new Date(identity.retentionUntil) <= new Date())
    );

    const filesOutput: Record<string, any> = {};
    if (identity.files && !isDocExpired) {
      for (const key of ["front", "back", "photoPage"]) {
        const f = identity.files[key];
        if (f?.fileId && f.storagePath && f.storagePath !== "[DELETED_BY_RETENTION_POLICY]") {
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
    }

    const isComplete = !isDocExpired && (
      identity.documentType === "NATIONAL_ID"
        ? Boolean(filesOutput.front && filesOutput.back)
        : Boolean(filesOutput.photoPage)
    );

    const effectiveStatus = isDocExpired ? "NOT_SUBMITTED" : identity.status;

    return NextResponse.json({
      hasIdentity: true,
      identityId: identity._id,
      status: effectiveStatus,
      version: Number(identity.version) || 1,
      documentType: identity.documentType,
      acknowledgedPurpose: Boolean(identity.acknowledgedPurpose),
      rejectionReason: identity.rejectionReason || "",
      isComplete,
      isExpired: isDocExpired,
      files: filesOutput,
      reviewedAt: identity.reviewedAt,
      updatedAt: identity.updatedAt,
    });
  } catch (error: any) {
    console.error("[Identity Status Route Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve identity status." },
      { status: 500 }
    );
  }
}
