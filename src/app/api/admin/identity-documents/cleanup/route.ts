import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import { deleteDocumentFile } from "@/lib/identityStorage";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuthorized && (!session || (session.user as any)?.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Admin or cron authorization required." }, { status: 403 });
    }

    await dbConnect();

    const now = new Date();
    const expiredRecords = await RiderIdentity.find({
      retentionUntil: { $lte: now },
      isArchived: { $ne: true },
    });

    let filesDeleted = 0;
    let recordsArchived = 0;

    for (const record of expiredRecords) {
      for (const key of ["front", "back", "photoPage"]) {
        const file = (record.files as any)?.[key];
        if (file?.storagePath) {
          const ok = await deleteDocumentFile(file.storagePath);
          if (ok) filesDeleted++;
          file.storagePath = "[DELETED_BY_RETENTION_POLICY]";
        }
      }
      record.isArchived = true;
      await record.save();
      recordsArchived++;
    }

    return NextResponse.json({
      success: true,
      message: `Identity document retention cleanup completed.`,
      recordsArchived,
      filesDeleted,
      executedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error("[Identity Retention Cleanup Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to execute retention cleanup." }, { status: 500 });
  }
}
