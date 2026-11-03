import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
    const userId = (session.user as any).id;

    // Verify user exists in DB and fetch current sessionVersion and approval status
    await dbConnect();
    const dbUser = await User.findById(userId).select("sessionVersion isApproved role name email").lean();
    if (!dbUser) {
      return NextResponse.json({ error: "User no longer exists" }, { status: 401 });
    }

    // Always encode a freshly signed JWT token using the current db sessionVersion
    // This prevents mismatch where cookie has old sessionVersion and socket server rejects with UNAUTHORIZED
    const freshToken = await encode({
      token: {
        id: dbUser._id.toString(),
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        isApproved: Boolean(dbUser.isApproved),
        sessionVersion: dbUser.sessionVersion || 0,
      },
      secret,
    });

    return NextResponse.json({
      token: freshToken,
      user: {
        id: dbUser._id.toString(),
        name: dbUser.name,
        role: dbUser.role,
        isApproved: Boolean(dbUser.isApproved),
      },
    });
  } catch (error: any) {
    console.error("Socket token generation error:", error);
    return NextResponse.json({ error: "Failed to generate socket token" }, { status: 500 });
  }
}
