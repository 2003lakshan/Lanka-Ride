import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { sendPasswordChangedConfirmationEmail } from "@/lib/email";
import { revokeUserSession } from "@/lib/realtime";

// Rate limit reset attempts by IP
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { email, resetAuthToken, token, password, confirmPassword } = await req.json();

    const authToken = resetAuthToken || token;
    if (!email || !authToken || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    // Apply existing password policy (at least 8 characters)
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0].trim() : null) || req.headers.get("x-real-ip") || "unknown";
    const now = Date.now();
    const rate = rateLimit.get(ip);
    if (rate && now < rate.resetAt) {
      if (rate.count >= MAX_ATTEMPTS) {
        return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
      }
      rate.count++;
    } else {
      rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    }

    await dbConnect();
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired password reset authorization." }, { status: 400 });
    }

    const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
    let isAuthorized = false;

    // 1. Verify single-use reset authorization token (Requirement 7)
    if (user.resetPasswordAuthTokenHash && user.resetPasswordAuthTokenExpires) {
      if (user.resetPasswordAuthTokenConsumed) {
        return NextResponse.json(
          { error: "This password reset authorization has already been used. Please request a new code." },
          { status: 400 }
        );
      }

      if (new Date(user.resetPasswordAuthTokenExpires).getTime() < now) {
        return NextResponse.json(
          { error: "Password reset authorization has expired. Please request a new code." },
          { status: 400 }
        );
      }

      const expectedAuthHash = crypto
        .createHmac("sha256", secret)
        .update(`${user._id.toString()}:RESET_AUTH:${authToken}`)
        .digest("hex");

      if (
        user.resetPasswordAuthTokenHash.length === expectedAuthHash.length &&
        crypto.timingSafeEqual(Buffer.from(user.resetPasswordAuthTokenHash), Buffer.from(expectedAuthHash))
      ) {
        isAuthorized = true;
      }
    }

    // 2. Fallback check for legacy reset token if applicable
    if (!isAuthorized && user.resetPasswordToken && user.resetPasswordExpires) {
      if (new Date(user.resetPasswordExpires).getTime() >= now) {
        const hashedLegacyToken = crypto.createHash("sha256").update(authToken).digest("hex");
        if (user.resetPasswordToken === hashedLegacyToken) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Invalid or expired password reset authorization. Please request a new code." },
        { status: 400 }
      );
    }

    // 3. Hash new password with bcrypt (Requirement 8)
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    // 4. Invalidate all outstanding reset codes & single-use authorizations (Requirement 9)
    user.resetPasswordAuthTokenConsumed = true;
    user.resetPasswordAuthTokenHash = undefined;
    user.resetPasswordAuthTokenExpires = undefined;
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // 5. Invalidate all existing login sessions across devices (Requirement 9)
    user.sessionVersion = (user.sessionVersion || 0) + 1;

    await user.save();

    // 6. Terminate active realtime WebSocket sessions
    revokeUserSession(user._id.toString()).catch(() => {});

    // 7. Dispatch Confirmation Email (Requirement 10)
    sendPasswordChangedConfirmationEmail(user.email, user.name).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: "Password has been successfully reset. Please log in again.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Reset password error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
