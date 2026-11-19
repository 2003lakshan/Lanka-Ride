import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import ContactVerification from "@/models/ContactVerification";
import { sendContactVerificationOtpEmail } from "@/lib/email";
import { sendPhoneVerificationOtpSms } from "@/lib/sms";

const ipRateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_IP_ATTEMPTS = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required to request verification." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { type, target } = body;

    if (!type || (type !== "EMAIL" && type !== "PHONE")) {
      return NextResponse.json({ error: "Verification type must be EMAIL or PHONE." }, { status: 400 });
    }

    if (!target || typeof target !== "string") {
      return NextResponse.json({ error: "Valid contact destination is required." }, { status: 400 });
    }

    // IP Rate Limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0].trim() : null) || req.headers.get("x-real-ip") || "unknown";
    const now = Date.now();
    const ipRecord = ipRateLimits.get(ip);
    if (ipRecord && now < ipRecord.resetAt) {
      if (ipRecord.count >= MAX_IP_ATTEMPTS) {
        return NextResponse.json(
          { error: "Too many verification requests from this IP. Please try again later." },
          { status: 429 }
        );
      }
      ipRecord.count++;
    } else {
      ipRateLimits.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    }

    // Normalize and validate target
    let cleanTarget = "";
    if (type === "EMAIL") {
      cleanTarget = target.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTarget)) {
        return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
      }
    } else {
      cleanTarget = target.trim().replace(/[^\d+]/g, "");
      const digitsOnly = cleanTarget.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return NextResponse.json({ error: "Please enter a valid mobile number with country code." }, { status: 400 });
      }
    }

    await dbConnect();

    // Check resend cooldown for this user and target
    const existing = await ContactVerification.findOne({
      userId,
      type,
      target: cleanTarget,
    });

    if (existing && existing.lastSentAt) {
      const elapsed = now - new Date(existing.lastSentAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          {
            error: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
            cooldownSeconds: remainingSeconds,
          },
          { status: 429 }
        );
      }
    }

    // Generate cryptographic 6-digit OTP code
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // Cryptographic HMAC SHA256 of code bound to user, type, and exact target
    const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
    const otpHash = crypto
      .createHmac("sha256", secret)
      .update(`${userId}:${type}:${cleanTarget}:${otpCode}`)
      .digest("hex");

    const expiresAt = new Date(now + OTP_EXPIRY_MS);

    // Save verification record
    if (existing) {
      existing.otpHash = otpHash;
      existing.expiresAt = expiresAt;
      existing.attempts = 0;
      existing.lastSentAt = new Date(now);
      existing.verifiedAt = undefined;
      existing.verificationToken = undefined;
      existing.consumed = false;
      existing.ip = ip;
      await existing.save();
    } else {
      await ContactVerification.create({
        userId,
        type,
        target: cleanTarget,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(now),
        consumed: false,
        ip,
      });
    }

    // Dispatch OTP via Email or SMS
    if (type === "EMAIL") {
      const emailResult = await sendContactVerificationOtpEmail(cleanTarget, otpCode);
      if (!emailResult.success) {
        return NextResponse.json(
          { error: emailResult.error || "Failed to dispatch verification email.", isConfigured: false },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Verification code sent to your email.",
        cooldownSeconds: 60,
        type: "EMAIL",
        target: cleanTarget,
        isDevMock: Boolean(emailResult.isDevMock),
        devCode: emailResult.devCode,
      });
    } else {
      const smsResult = await sendPhoneVerificationOtpSms(cleanTarget, otpCode);
      if (!smsResult.success) {
        return NextResponse.json(
          { error: smsResult.error || "Failed to dispatch verification SMS.", isConfigured: smsResult.isConfigured !== false },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Verification code sent to your mobile number.",
        cooldownSeconds: 60,
        type: "PHONE",
        target: cleanTarget,
        isDevMock: Boolean(smsResult.isDevMock),
        devCode: smsResult.devCode,
      });
    }
  } catch (error: any) {
    console.error("[Send OTP Error]:", error);
    return NextResponse.json({ error: error.message || "Internal server error while sending OTP." }, { status: 500 });
  }
}

