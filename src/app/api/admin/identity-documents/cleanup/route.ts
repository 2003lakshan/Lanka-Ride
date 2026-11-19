import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import { cleanupExpiredIdentityDocuments } from "@/lib/identityStorage";

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

    const result = await cleanupExpiredIdentityDocuments();

    return NextResponse.json({
      success: true,
      message: `Identity document retention cleanup completed.`,
      recordsArchived: result.recordsArchived,
      filesDeleted: result.filesDeleted,
      errors: result.errors,
      executedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Identity Retention Cleanup Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to execute retention cleanup." }, { status: 500 });
  }
}
