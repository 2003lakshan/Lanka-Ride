import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { 
  generateShareToken, 
  hashShareToken, 
  calculateShareTokenExpiry 
} from "@/lib/shareToken";
import { getPublicAppUrl } from "@/lib/whatsapp";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * Helper to authenticate and verify access permissions for managing a booking's share link.
 * Only the booking rider/owner or ADMIN is permitted.
 */
async function getAuthorizedBooking(id: string, session: any) {
  if (!session || !session.user) {
    return { error: "Unauthorized: Please log in to manage trip sharing", status: 401 };
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  const userEmail = (session.user?.email || "").toLowerCase();

  const filter = id.startsWith("LAR-") || id.startsWith("TEST-")
    ? { bookingReference: id }
    : { _id: id };

  const booking = await Booking.findOne(filter);
  if (!booking) {
    return { error: "Booking not found", status: 404 };
  }

  const isOwner =
    (booking.touristId && booking.touristId.toString() === userId) ||
    (userEmail && booking.passengerDetails?.email && userEmail === booking.passengerDetails.email.toLowerCase());
  const isAdmin = userRole === "ADMIN";

  if (!isOwner && !isAdmin) {
    return {
      error: "Forbidden: Only the booking owner or an administrator can manage public sharing links.",
      status: 403,
    };
  }

  return { booking, userId, userRole };
}

/**
 * GET: Retrieve status of the share link for this booking.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Booking ID required" }, { status: 400 });
    }

    await dbConnect();
    const result = await getAuthorizedBooking(id, session);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { booking } = result;
    const hasToken = Boolean(booking.shareTokenHash);
    const isRevoked = Boolean(booking.shareTokenRevoked);
    const isExpired = Boolean(
      booking.shareTokenExpiresAt && new Date(booking.shareTokenExpiresAt).getTime() < Date.now()
    );

    return NextResponse.json({
      success: true,
      hasActiveLink: hasToken && !isRevoked && !isExpired,
      hasEverGenerated: hasToken,
      isRevoked,
      isExpired,
      expiresAt: booking.shareTokenExpiresAt || null,
      createdAt: booking.shareTokenCreatedAt || null,
      revokedAt: booking.shareTokenRevokedAt || null,
    });
  } catch (err: any) {
    console.error("[Booking Share GET Error]", err.message);
    return NextResponse.json({ error: err.message || "Failed to retrieve share status" }, { status: 500 });
  }
}

/**
 * POST: Create, regenerate, or revoke a share link.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Booking ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || "CREATE"; // "CREATE" | "REGENERATE" | "REVOKE"

    await dbConnect();
    const result = await getAuthorizedBooking(id, session);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { booking, userId } = result;

    if (action === "REVOKE") {
      booking.shareTokenRevoked = true;
      booking.shareTokenRevokedAt = new Date();
      await booking.save();

      return NextResponse.json({
        success: true,
        message: "Trip sharing link has been revoked. Public access is now disabled.",
        isRevoked: true,
        revokedAt: booking.shareTokenRevokedAt,
      });
    }

    if (action === "CREATE" || action === "REGENERATE") {
      const rawToken = generateShareToken();
      const tokenHash = hashShareToken(rawToken);
      const expiresAt = calculateShareTokenExpiry(booking);

      booking.shareTokenHash = tokenHash;
      booking.shareTokenCreatedAt = new Date();
      booking.shareTokenExpiresAt = expiresAt;
      booking.shareTokenRevoked = false;
      booking.shareTokenRevokedAt = undefined;
      booking.shareTokenCreatedBy = mongoose.isValidObjectId(userId)
        ? new mongoose.Types.ObjectId(userId)
        : undefined;

      await booking.save();

      const appUrl = getPublicAppUrl();
      const shareUrl = `${appUrl}/track/shared/${rawToken}`;

      return NextResponse.json({
        success: true,
        shareUrl,
        token: rawToken,
        expiresAt,
        message: action === "REGENERATE" ? "New share link generated. Previous link is now invalid." : "Share link created successfully.",
      });
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: any) {
    console.error("[Booking Share POST Error]", err.message);
    return NextResponse.json({ error: err.message || "Failed to process share link action" }, { status: 500 });
  }
}

