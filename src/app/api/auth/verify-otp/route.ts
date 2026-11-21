import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const ipRateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_VERIFY_IP_ATTEMPTS = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? 120 : 40;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code || typeof email !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Email and verification code are required" }, { status: 400 });
    }

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json({ error: "Verification code must be exactly 6 digits." }, { status: 400 });
    }

    // Rate limit by IP
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0].trim() : null) || req.headers.get("x-real-ip") || "unknown";
    const now = Date.now();
    const ipRecord = ipRateLimit.get(ip);
    if (ipRecord && now < ipRecord.resetAt) {
      if (ipRecord.count >= MAX_VERIFY_IP_ATTEMPTS) {
        return NextResponse.json(
          { error: "Too many verification attempts from this IP. Please try again later." },
          { status: 429 }
        );
      }
      ipRecord.count++;
    } else {
      ipRateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    }

    await dbConnect();
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
      ],
    });

    // Requirement 11: Show clear invalid/expired-code errors without revealing whether an account exists
    if (!user || !user.resetPasswordOtpHash || !user.resetPasswordOtpExpires) {
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // Check code expiry (10 minutes)
    if (new Date(user.resetPasswordOtpExpires).getTime() < now) {
      user.resetPasswordOtpHash = undefined;
      user.resetPasswordOtpExpires = undefined;
      user.resetPasswordOtpAttempts = 0;
      await user.save();

      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    // Check attempt limit (Requirement 6: Maximum 5 verification attempts per issued code)
    const currentAttempts = user.resetPasswordOtpAttempts || 0;
    if (currentAttempts >= 5) {
      user.resetPasswordOtpHash = undefined;
      user.resetPasswordOtpExpires = undefined;
      user.resetPasswordOtpAttempts = 0;
      await user.save();

      return NextResponse.json(
        { error: "Verification code has exceeded maximum attempts. Please request a new code." },
        { status: 400 }
      );
    }

    // Verify cryptographic HMAC hash
    const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(`${user._id.toString()}:PASSWORD_RESET:${cleanCode}`)
      .digest("hex");

    const isMatch =
      user.resetPasswordOtpHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(user.resetPasswordOtpHash), Buffer.from(expectedHash));

    if (!isMatch) {
      const nextAttempts = currentAttempts + 1;
      user.resetPasswordOtpAttempts = nextAttempts;

      if (nextAttempts >= 5) {
        // Exceeded 5 attempts: invalidate code immediately
        user.resetPasswordOtpHash = undefined;
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtpAttempts = 0;
        await user.save();

        return NextResponse.json(
          { error: "Verification code has exceeded maximum attempts. Please request a new code." },
          { status: 400 }
        );
      }

      await user.save();
      const remaining = 5 - nextAttempts;
      return NextResponse.json(
        {
          error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          attemptsRemaining: remaining,
        },
        { status: 400 }
      );
    }

    // Requirement 7: Code is valid. Consume code immediately and issue short-lived, single-use reset authorization
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpAttempts = 0;

    const resetAuthToken = crypto.randomBytes(32).toString("hex");
    const resetAuthHash = crypto
      .createHmac("sha256", secret)
      .update(`${user._id.toString()}:RESET_AUTH:${resetAuthToken}`)
      .digest("hex");

    user.resetPasswordAuthTokenHash = resetAuthHash;
    user.resetPasswordAuthTokenExpires = new Date(now + 15 * 60 * 1000); // 15-minute validity
    user.resetPasswordAuthTokenConsumed = false;

    await user.save();

    return NextResponse.json(
      {
        success: true,
        resetAuthToken,
        message: "Verification code confirmed successfully.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Verify OTP error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
