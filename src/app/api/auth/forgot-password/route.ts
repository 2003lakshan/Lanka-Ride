import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { isEmailConfigured, sendPasswordResetOtpEmail } from "@/lib/email";

// In-memory rate limiting by IP and by account
interface RateRecord {
  count: number;
  resetAt: number;
}
const ipRateLimit = new Map<string, RateRecord>();
const accountRateLimit = new Map<string, RateRecord>();

const MAX_IP_ATTEMPTS = 10;
const MAX_ACCOUNT_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function checkRateLimit(store: Map<string, RateRecord>, key: string, max: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = store.get(key);

  if (record && now < record.resetAt) {
    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }
    record.count++;
  } else {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }

  return { allowed: true };
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. IP Rate Limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0].trim() : null) || req.headers.get("x-real-ip") || "unknown";
    const ipCheck = checkRateLimit(ipRateLimit, ip, MAX_IP_ATTEMPTS);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: `Too many requests from this IP. Please try again in ${ipCheck.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    // 2. Account-level Rate Limiting
    const accountCheck = checkRateLimit(accountRateLimit, normalizedEmail, MAX_ACCOUNT_ATTEMPTS);
    if (!accountCheck.allowed) {
      return NextResponse.json(
        { error: `Too many requests for this account. Please try again in ${accountCheck.retryAfter} seconds.` },
        { status: 429 }
      );
    }

    // 3. Verify Email Service Configuration (Requirement 13)
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error: "Email delivery service is currently not configured on this server. Please configure SMTP settings.",
          emailConfigured: false,
        },
        { status: 503 }
      );
    }

    await dbConnect();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const now = Date.now();

      // 4. 60-Second Resend Cooldown Check (Requirement 6)
      if (user.resetPasswordOtpLastSent) {
        const lastSentTime = new Date(user.resetPasswordOtpLastSent).getTime();
        const elapsed = now - lastSentTime;
        if (elapsed < RESEND_COOLDOWN_MS) {
          const cooldownRemaining = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json(
            {
              error: `Please wait ${cooldownRemaining} seconds before requesting a new code.`,
              retryAfter: cooldownRemaining,
            },
            { status: 429 }
          );
        }
      }

      // 5. Generate Cryptographic 6-Digit OTP (Requirement 4)
      const otpCode = crypto.randomInt(100000, 1000000).toString();

      // 6. Secure HMAC Hash Linked to User & Password-Reset Purpose (Requirement 5)
      const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
      const codeHash = crypto
        .createHmac("sha256", secret)
        .update(`${user._id.toString()}:PASSWORD_RESET:${otpCode}`)
        .digest("hex");

      // Invalidate previous codes, reset attempts, set 10-minute expiry (Requirement 5 & 6)
      user.resetPasswordOtpHash = codeHash;
      user.resetPasswordOtpExpires = new Date(now + 10 * 60 * 1000); // 10 minutes
      user.resetPasswordOtpAttempts = 0;
      user.resetPasswordOtpLastSent = new Date(now);

      // Invalidate any outstanding reset authorizations
      user.resetPasswordAuthTokenHash = undefined;
      user.resetPasswordAuthTokenExpires = undefined;
      user.resetPasswordAuthTokenConsumed = true;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();

      // 7. Dispatch Email through configured provider (Requirement 4, 6, & 12: Never log code)
      const sendResult = await sendPasswordResetOtpEmail(user.email, otpCode);
      if (!sendResult.success) {
        // Requirement 8: Log sanitized delivery failure server-side without breaking anti-enumeration response
        console.error(`[Forgot Password] SMTP dispatch failed for account (${user.email}): ${sendResult.error}`);
      }
    }

    // 8. Always respond with uniform anti-enumeration message (Requirements 3 & 8)
    return NextResponse.json(
      {
        message: "If an account exists for this email, a verification code will be sent.",
        emailConfigured: true,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Forgot password error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
