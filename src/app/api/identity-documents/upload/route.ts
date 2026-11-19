import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import User from "@/models/User";
import {
  getMaxFileSizeBytes,
  getMaxFileSizeMb,
  validateMagicBytes,
  saveDocumentFile,
  deleteDocumentFile,
  generateSignedDocumentUrl,
  getRetentionDays,
} from "@/lib/identityStorage";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required to upload identity documents." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data submission." }, { status: 400 });
    }

    const documentType = formData.get("documentType") as string;
    const fileKey = formData.get("fileKey") as string;
    const acknowledgedPurpose = formData.get("acknowledgedPurpose") as string;
    const file = formData.get("file") as File | null;

    if (!documentType || (documentType !== "NATIONAL_ID" && documentType !== "PASSPORT")) {
      return NextResponse.json({ error: "Document type must be 'NATIONAL_ID' or 'PASSPORT'." }, { status: 400 });
    }

    const validKeys = documentType === "NATIONAL_ID" ? ["front", "back"] : ["photoPage"];
    if (!fileKey || !validKeys.includes(fileKey)) {
      return NextResponse.json(
        { error: `Invalid file key '${fileKey}' for document type ${documentType}. Expected: ${validKeys.join(", ")}.` },
        { status: 400 }
      );
    }

    if (acknowledgedPurpose !== "true") {
      return NextResponse.json(
        { error: "You must acknowledge the identity verification purpose before uploading documents." },
        { status: 400 }
      );
    }

    if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
      return NextResponse.json({ error: "Please select a valid file to upload." }, { status: 400 });
    }

    const maxBytes = getMaxFileSizeBytes();
    const maxMb = getMaxFileSizeMb();
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds the ${maxMb} MB limit. Please upload a smaller file.` },
        { status: 400 }
      );
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Server-side magic bytes validation
    const magicCheck = validateMagicBytes(rawBuffer, file.type);
    if (!magicCheck.valid) {
      return NextResponse.json({ error: magicCheck.error || "File format rejected by security validation." }, { status: 400 });
    }

    await dbConnect();

    // Find or initialize RiderIdentity record
    let identity = await RiderIdentity.findOne({ userId });
    if (!identity) {
      identity = new RiderIdentity({
        userId,
        documentType,
        acknowledgedPurpose: true,
        files: {},
      });
    }

    // If switching document type, safely clean up previous files from disk
    if (identity.documentType !== documentType) {
      if (identity.files?.front?.storagePath) await deleteDocumentFile(identity.files.front.storagePath);
      if (identity.files?.back?.storagePath) await deleteDocumentFile(identity.files.back.storagePath);
      if (identity.files?.photoPage?.storagePath) await deleteDocumentFile(identity.files.photoPage.storagePath);
      identity.files = {};
      identity.documentType = documentType;
    }

    // If replacing an existing file on this key, delete the old file from disk
    const existingFile = (identity.files as any)?.[fileKey];
    if (existingFile?.storagePath) {
      await deleteDocumentFile(existingFile.storagePath);
    }

    // Save the new file to private storage
    const storedFile = await saveDocumentFile(
      rawBuffer,
      file.name,
      magicCheck.detectedType || file.type,
      userId,
      fileKey
    );

    if (!identity.files) identity.files = {};
    (identity.files as any)[fileKey] = storedFile;
    identity.acknowledgedPurpose = true;

    // Check if required files are complete
    const isComplete =
      documentType === "NATIONAL_ID"
        ? Boolean(identity.files.front?.fileId && identity.files.back?.fileId)
        : Boolean(identity.files.photoPage?.fileId);

    if (isComplete) {
      // Re-uploading or completing sets status to PENDING_REVIEW
      identity.status = "PENDING_REVIEW";
      identity.rejectionReason = undefined;
      const retentionDays = getRetentionDays();
      identity.retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    }

    await identity.save();

    // Update user profile status
    await User.findByIdAndUpdate(userId, {
      identityStatus: identity.status,
      identityDocumentId: identity._id,
    });

    // Generate signed URLs for client preview
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
          viewUrl: generateSignedDocumentUrl(f.fileId, 3600), // 1 hour token for preview
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: `${fileKey} uploaded successfully.`,
      status: identity.status,
      documentType: identity.documentType,
      isComplete,
      files: filesOutput,
    });
  } catch (error: any) {
    console.error("[Identity Document Upload Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to upload identity document." }, { status: 500 });
  }
}
