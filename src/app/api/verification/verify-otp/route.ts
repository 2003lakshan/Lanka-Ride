import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import ContactVerification from "@/models/ContactVerification";
import User from "@/models/User";

const MAX_VERIFY_ATTEMPTS = 5;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Authentication required to verify." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { type, target, code } = body;

    if (!type || type !== "EMAIL") {
      return NextResponse.json({ error: "Only email verification is supported." }, { status: 400 });
    }

    if (!target || typeof target !== "string") {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
    }

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json({ error: "Verification code must be exactly 6 digits." }, { status: 400 });
    }

    const cleanTarget = target.toLowerCase().trim();

    await dbConnect();

    const record = await ContactVerification.findOne({
      userId,
      type: "EMAIL",
      target: cleanTarget,
    });

    if (!record || !record.otpHash) {
      return NextResponse.json(
        { error: "No pending verification found for this email. Please request a new code." },
        { status: 400 }
      );
    }

    const now = Date.now();

    // Check expiry
    if (new Date(record.expiresAt).getTime() < now) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    // Check max attempts
    const currentAttempts = record.attempts || 0;
    if (currentAttempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { error: "Maximum attempts exceeded. Please request a new verification code." },
        { status: 400 }
      );
    }

    // Reconstruct expected hash
    const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
    const expectedHash = crypto
      .createHmac("sha256", secret)
      .update(`${userId}:EMAIL:${cleanTarget}:${cleanCode}`)
      .digest("hex");

    const isMatch =
      record.otpHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(record.otpHash), Buffer.from(expectedHash));

    if (!isMatch) {
      const nextAttempts = currentAttempts + 1;
      record.attempts = nextAttempts;
      await record.save();

      const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - nextAttempts);
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
              : "Maximum attempts reached. Please request a new code.",
          attemptsRemaining: remaining,
        },
        { status: 400 }
      );
    }

    // Code matches! Generate cryptographic verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    record.verifiedAt = new Date(now);
    record.verificationToken = verificationToken;
    record.attempts = 0;
    record.consumed = false;
    await record.save();

    // Update user profile if the verified email matches their account email
    const user = await User.findById(userId);
    if (user && user.email && user.email.toLowerCase().trim() === cleanTarget) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date(now);
      await user.save();
    }

    return NextResponse.json({
      success: true,
      verified: true,
      verificationToken,
      type: "EMAIL",
      target: cleanTarget,
      message: "Email verified successfully!",
    });
  } catch (error: any) {
    console.error("[Verify OTP Error]:", error);
    return NextResponse.json({ error: error.message || "Internal server error while verifying OTP." }, { status: 500 });
  }
}
