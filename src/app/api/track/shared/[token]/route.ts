import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import "@/models/User";
import "@/models/VehicleType";
import { 
  hashShareToken, 
  sanitizeBookingForShare 
} from "@/lib/shareToken";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const cleanToken = (token || "").trim();

    if (!cleanToken || cleanToken.length < 32 || cleanToken.length > 128) {
      return NextResponse.json(
        { error: "Invalid tracking token format", code: "INVALID_TOKEN" },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
            "Referrer-Policy": "no-referrer",
          },
        }
      );
    }

    await dbConnect();

    // Query database using the SHA-256 hash
    const tokenHash = hashShareToken(cleanToken);

    const booking = await Booking.findOne({ shareTokenHash: tokenHash })
      .populate("driverId", "name fullName rating reviewCount completedTripsCount vehicleRegistration vehicleDetails driverProfile")
      .populate("vehicleTypeId", "name category maxPassengers maxLuggage")
      .lean();

    if (!booking) {
      return NextResponse.json(
        {
          error: "Tracking link not found or has been replaced. Please request a new link from the traveller.",
          code: "NOT_FOUND",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
            "Referrer-Policy": "no-referrer",
          },
        }
      );
    }

    // Check revocation
    if (booking.shareTokenRevoked) {
      return NextResponse.json(
        {
          error: "This shareable tracking link was revoked by the booking owner or operations team.",
          code: "REVOKED",
          revokedAt: booking.shareTokenRevokedAt || null,
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
            "Referrer-Policy": "no-referrer",
          },
        }
      );
    }

    // Check expiry
    if (booking.shareTokenExpiresAt && new Date(booking.shareTokenExpiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        {
          error: "This trip tracking link has expired.",
          code: "EXPIRED",
          expiresAt: booking.shareTokenExpiresAt,
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
            "Referrer-Policy": "no-referrer",
          },
        }
      );
    }

    // Sanitize booking data to remove ALL private passenger & payment PII
    const sanitized = sanitizeBookingForShare(booking);

    return NextResponse.json(
      {
        success: true,
        data: sanitized,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  } catch (err: any) {
    console.error("[Public Share Tracking API Error]", err.message);
    return NextResponse.json(
      { error: "An unexpected error occurred while loading tracking data.", code: "SERVER_ERROR" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  }
}

