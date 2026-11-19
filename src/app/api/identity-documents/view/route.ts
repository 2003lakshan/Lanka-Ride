import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import { verifySignedDocumentUrl, getDocumentBuffer } from "@/lib/identityStorage";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const expires = searchParams.get("expires");
    const sig = searchParams.get("sig");

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required." }, { status: 400 });
    }

    await dbConnect();

    // Find the identity record owning this file
    const identity = await RiderIdentity.findOne({
      $or: [
        { "files.front.fileId": fileId },
        { "files.back.fileId": fileId },
        { "files.photoPage.fileId": fileId },
      ],
    });

    if (!identity) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // Determine authorization:
    // 1. Valid, unexpired HMAC signed URL authorization
    let isAuthorized = false;
    if (expires && sig) {
      if (verifySignedDocumentUrl(fileId, expires, sig)) {
        isAuthorized = true;
      }
    }

    // 2. Active Session authorization (Owner or Admin only)
    if (!isAuthorized) {
      const session = await getServerSession(authOptions);
      if (session && session.user) {
        const currentUserId = (session.user as any).id;
        const currentUserRole = (session.user as any).role;
        if (currentUserRole === "ADMIN" || currentUserId === identity.userId.toString()) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Access denied. You do not have permission to view this document." },
        { status: 403 }
      );
    }

    // Verify document has not been purged or archived under retention policy
    if (identity.isArchived) {
      return NextResponse.json(
        { error: "This document has expired and was removed under the data retention policy." },
        { status: 404 }
      );
    }

    // Find the specific file metadata
    let targetFile: any = null;
    for (const key of ["front", "back", "photoPage"]) {
      const f = (identity.files as any)?.[key];
      if (f && f.fileId === fileId) {
        targetFile = f;
        break;
      }
    }

    if (
      !targetFile ||
      !targetFile.storagePath ||
      targetFile.storagePath === "[DELETED_BY_RETENTION_POLICY]"
    ) {
      return NextResponse.json(
        { error: "Document file not found or has been deleted under the retention policy." },
        { status: 404 }
      );
    }

    // Retrieve file buffer from durable storage (S3 or local disk)
    const fileBuffer = await getDocumentBuffer(targetFile.storagePath);
    if (!fileBuffer) {
      return NextResponse.json(
        { error: "Document file not found in storage." },
        { status: 404 }
      );
    }

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": targetFile.mimeType || "application/octet-stream",
        "Content-Length": fileBuffer.length.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(targetFile.originalName)}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("[Identity Document View Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve document." }, { status: 500 });
  }
}
