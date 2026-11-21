import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import nodemailer from "nodemailer";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
const APP_URL = "http://localhost:3000";

import User from "../src/models/User";
import { 
  isEmailConfigured, 
  getSenderAddress, 
  getTransporter, 
  sendPasswordResetOtpEmail, 
  sendPasswordChangedConfirmationEmail 
} from "../src/lib/email";

interface TestReport {
  scenario: string;
  category: "MOCKED_TEST_ACCOUNTS" | "ACTUAL_INBOX_DELIVERY" | "SECURITY_ENFORCEMENT";
  status: "PASSED" | "FAILED" | "UNVERIFIED";
  details: string;
}

const auditReports: TestReport[] = [];

function recordResult(
  scenario: string,
  category: "MOCKED_TEST_ACCOUNTS" | "ACTUAL_INBOX_DELIVERY" | "SECURITY_ENFORCEMENT",
  status: "PASSED" | "FAILED" | "UNVERIFIED",
  details: string
) {
  auditReports.push({ scenario, category, status, details });
  const icon = status === "PASSED" ? "✅" : status === "FAILED" ? "❌" : "⚠️";
  console.log(`${icon} [${category}] ${scenario}: ${details}`);
}

async function runAudit() {
  console.log("========================================================================");
  console.log("        AUDITING & VERIFYING PASSWORD RECOVERY WORKFLOW         ");
  console.log("========================================================================\n");

  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB\n");

  const testRiderEmail = "audit_rider_test@example.com";
  const testDriverEmail = "audit_driver_test@example.com";
  const testAdminEmail = "audit_admin_test@example.com";
  const initialPassword = "InitialPassword123!";
  const newPassword = "NewSecuredPassword456!";

  // Cleanup any old audit test accounts
  await User.deleteMany({
    email: { $in: [testRiderEmail, testDriverEmail, testAdminEmail] },
  });

  const initialHash = await bcrypt.hash(initialPassword, 10);

  // 1. Create Dedicated Test Accounts (Rider, Driver, Admin)
  const riderUser = await User.create({
    name: "Audit Test Rider",
    email: testRiderEmail,
    password: initialHash,
    role: "TOURIST",
    sessionVersion: 1,
    isEmailVerified: true,
  });

  const driverUser = await User.create({
    name: "Audit Test Driver",
    email: testDriverEmail,
    password: initialHash,
    role: "DRIVER",
    sessionVersion: 1,
    isApproved: true,
    isEmailVerified: true,
    vehicleRegistration: "WP-AUDIT-9999",
  });

  const adminUser = await User.create({
    name: "Audit Test Admin",
    email: testAdminEmail,
    password: initialHash,
    role: "ADMIN",
    sessionVersion: 1,
    isEmailVerified: true,
  });

  console.log("✓ Test Accounts Created:");
  console.log(`  - Rider:  ${riderUser.email} (Role: ${riderUser.role})`);
  console.log(`  - Driver: ${driverUser.email} (Role: ${driverUser.role})`);
  console.log(`  - Admin:  ${adminUser.email} (Role: ${adminUser.role})\n`);

  // ==========================================================================
  // SCENARIO 1: Email Lookup & Case Normalization
  // ==========================================================================
  console.log("--- SCENARIO 1: Email Lookup, Casing, and Whitespace Normalization ---");
  const mixedCaseEmail = "  AuDiT_RiDeR_TeSt@ExAmPlE.CoM  ";
  const resNorm = await fetch(`${APP_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.1" },
    body: JSON.stringify({ email: mixedCaseEmail }),
  });
  const dataNorm = await resNorm.json();

  const riderAfterNorm = await User.findById(riderUser._id).lean();
  if (
    resNorm.status === 200 &&
    dataNorm.message &&
    riderAfterNorm?.resetPasswordOtpHash &&
    riderAfterNorm?.resetPasswordOtpExpires
  ) {
    recordResult(
      "Email Lookup & Normalization",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      "Case-insensitive and whitespace-trimmed lookup succeeded. OTP hash generated in DB for rider account."
    );
  } else {
    recordResult(
      "Email Lookup & Normalization",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Failed to lookup normalized email: ${JSON.stringify(dataNorm)}`
    );
  }

  // ==========================================================================
  // SCENARIO 2: Anti-Enumeration for Unregistered Emails
  // ==========================================================================
  console.log("\n--- SCENARIO 2: Anti-Enumeration Protection for Unregistered Emails ---");
  const unregRes = await fetch(`${APP_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.2" },
    body: JSON.stringify({ email: "unregistered_random_user_9999@example.com" }),
  });
  const unregData = await unregRes.json();

  if (
    unregRes.status === 200 &&
    unregData.message === "If an account exists for this email, a verification code will be sent."
  ) {
    recordResult(
      "Anti-Enumeration Protection",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      "Unregistered email received identical 200 OK message without revealing account absence."
    );
  } else {
    recordResult(
      "Anti-Enumeration Protection",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Expected uniform message, got ${JSON.stringify(unregData)}`
    );
  }

  // ==========================================================================
  // SCENARIO 3: 60-Second Resend Cooldown Enforcement
  // ==========================================================================
  console.log("\n--- SCENARIO 3: Resend Cooldown Enforcement ---");
  const resCooldown = await fetch(`${APP_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.1" },
    body: JSON.stringify({ email: testRiderEmail }),
  });
  const dataCooldown = await resCooldown.json();

  if (resCooldown.status === 429 && dataCooldown.error?.includes("Please wait") && dataCooldown.retryAfter) {
    recordResult(
      "Resend Cooldown Enforcement",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      `Immediate resend blocked with HTTP 429 (${dataCooldown.retryAfter}s remaining).`
    );
  } else {
    recordResult(
      "Resend Cooldown Enforcement",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Expected HTTP 429 cooldown, got: ${resCooldown.status} - ${JSON.stringify(dataCooldown)}`
    );
  }

  // ==========================================================================
  // SCENARIO 4: Cryptographic Binding & Cross-Account Reset Protection
  // ==========================================================================
  console.log("\n--- SCENARIO 4: Cross-Account Reset Protection (Account A vs Account B) ---");
  // Set known OTP on Rider Account (Account A)
  const riderKnownOtp = "619284";
  const riderOtpHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${riderUser._id.toString()}:PASSWORD_RESET:${riderKnownOtp}`)
    .digest("hex");

  await User.updateOne(
    { _id: riderUser._id },
    {
      $set: {
        resetPasswordOtpHash: riderOtpHash,
        resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
        resetPasswordOtpAttempts: 0,
        resetPasswordOtpLastSent: new Date(Date.now() - 70 * 1000),
      },
    }
  );

  // Attempt to verify Rider A's OTP using Driver B's email
  const crossAccountRes = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.3" },
    body: JSON.stringify({ email: testDriverEmail, code: riderKnownOtp }),
  });
  const crossAccountData = await crossAccountRes.json();

  if (crossAccountRes.status === 400 && crossAccountData.error?.includes("Invalid or expired")) {
    recordResult(
      "Cross-Account OTP Protection",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      "Code issued for Account A (Rider) was strictly rejected when submitted for Account B (Driver)."
    );
  } else {
    recordResult(
      "Cross-Account OTP Protection",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Cross-account OTP was not blocked: ${JSON.stringify(crossAccountData)}`
    );
  }

  // ==========================================================================
  // SCENARIO 5: Attempt Limits & Automatic Invalidation (Max 5 Attempts)
  // ==========================================================================
  console.log("\n--- SCENARIO 5: Maximum 5 Attempts & Auto-Invalidation ---");
  // Submit 4 incorrect codes
  for (let i = 1; i <= 4; i++) {
    await fetch(`${APP_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.4" },
      body: JSON.stringify({ email: testRiderEmail, code: "000000" }),
    });
  }

  // 5th incorrect code
  const resAttempt5 = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.4" },
    body: JSON.stringify({ email: testRiderEmail, code: "000000" }),
  });
  const dataAttempt5 = await resAttempt5.json();

  const riderAfter5Attempts = await User.findById(riderUser._id).lean();
  if (
    resAttempt5.status === 400 &&
    dataAttempt5.error?.includes("exceeded maximum attempts") &&
    !riderAfter5Attempts?.resetPasswordOtpHash
  ) {
    recordResult(
      "Verification Attempt Limiting",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      "5 failed attempts automatically invalidated and purged OTP hash from database."
    );
  } else {
    recordResult(
      "Verification Attempt Limiting",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Expected code invalidation after 5 attempts, got: ${JSON.stringify(dataAttempt5)}`
    );
  }

  // ==========================================================================
  // SCENARIO 6: Expiration Enforcement
  // ==========================================================================
  console.log("\n--- SCENARIO 6: Expiration Enforcement ---");
  const expiredOtp = "847291";
  const expiredHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${riderUser._id.toString()}:PASSWORD_RESET:${expiredOtp}`)
    .digest("hex");

  await User.updateOne(
    { _id: riderUser._id },
    {
      $set: {
        resetPasswordOtpHash: expiredHash,
        resetPasswordOtpExpires: new Date(Date.now() - 10000), // Expired 10s ago
        resetPasswordOtpAttempts: 0,
      },
    }
  );

  const resExpired = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.5" },
    body: JSON.stringify({ email: testRiderEmail, code: expiredOtp }),
  });
  const dataExpired = await resExpired.json();

  if (resExpired.status === 400 && dataExpired.error?.includes("expired")) {
    recordResult(
      "Code Expiration Enforcement",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      "Expired code properly rejected with HTTP 400."
    );
  } else {
    recordResult(
      "Code Expiration Enforcement",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Expired code was not rejected properly: ${JSON.stringify(dataExpired)}`
    );
  }

  // ==========================================================================
  // SCENARIO 7: Full Recovery Cycle for Rider Account
  // ==========================================================================
  console.log("\n--- SCENARIO 7: Full Recovery Cycle for Rider Account ---");
  const validRiderOtp = "582910";
  const validRiderHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${riderUser._id.toString()}:PASSWORD_RESET:${validRiderOtp}`)
    .digest("hex");

  await User.updateOne(
    { _id: riderUser._id },
    {
      $set: {
        resetPasswordOtpHash: validRiderHash,
        resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
        resetPasswordOtpAttempts: 0,
      },
    }
  );

  const resVerifyRider = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.6" },
    body: JSON.stringify({ email: testRiderEmail, code: validRiderOtp }),
  });
  const dataVerifyRider = await resVerifyRider.json();

  if (!resVerifyRider.ok || !dataVerifyRider.resetAuthToken) {
    recordResult("Rider OTP Verification", "MOCKED_TEST_ACCOUNTS", "FAILED", JSON.stringify(dataVerifyRider));
  } else {
    // Reset password
    const resResetRider = await fetch(`${APP_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.6" },
      body: JSON.stringify({
        email: testRiderEmail,
        resetAuthToken: dataVerifyRider.resetAuthToken,
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });
    const dataResetRider = await resResetRider.json();

    const updatedRider = await User.findById(riderUser._id).lean();
    const newPassMatch = await bcrypt.compare(newPassword, updatedRider?.password || "");
    const oldPassDead = !(await bcrypt.compare(initialPassword, updatedRider?.password || ""));

    if (resResetRider.ok && dataResetRider.success && newPassMatch && oldPassDead) {
      recordResult(
        "Rider Password Recovery Lifecycle",
        "MOCKED_TEST_ACCOUNTS",
        "PASSED",
        "Rider password reset succeeded. Bcrypt hash updated, new password matches, old password fails."
      );
    } else {
      recordResult(
        "Rider Password Recovery Lifecycle",
        "MOCKED_TEST_ACCOUNTS",
        "FAILED",
        `Rider reset failed: ${JSON.stringify(dataResetRider)}`
      );
    }
  }

  // ==========================================================================
  // SCENARIO 8: Full Recovery Cycle for Driver Account
  // ==========================================================================
  console.log("\n--- SCENARIO 8: Full Recovery Cycle for Driver Account ---");
  const validDriverOtp = "729401";
  const validDriverHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${driverUser._id.toString()}:PASSWORD_RESET:${validDriverOtp}`)
    .digest("hex");

  await User.updateOne(
    { _id: driverUser._id },
    {
      $set: {
        resetPasswordOtpHash: validDriverHash,
        resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
        resetPasswordOtpAttempts: 0,
      },
    }
  );

  const resVerifyDriver = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.7" },
    body: JSON.stringify({ email: testDriverEmail, code: validDriverOtp }),
  });
  const dataVerifyDriver = await resVerifyDriver.json();

  if (!resVerifyDriver.ok || !dataVerifyDriver.resetAuthToken) {
    recordResult("Driver OTP Verification", "MOCKED_TEST_ACCOUNTS", "FAILED", JSON.stringify(dataVerifyDriver));
  } else {
    const resResetDriver = await fetch(`${APP_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.7" },
      body: JSON.stringify({
        email: testDriverEmail,
        resetAuthToken: dataVerifyDriver.resetAuthToken,
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });
    const dataResetDriver = await resResetDriver.json();

    const updatedDriver = await User.findById(driverUser._id).lean();
    const newPassMatch = await bcrypt.compare(newPassword, updatedDriver?.password || "");
    const oldPassDead = !(await bcrypt.compare(initialPassword, updatedDriver?.password || ""));

    if (resResetDriver.ok && dataResetDriver.success && newPassMatch && oldPassDead) {
      recordResult(
        "Driver Password Recovery Lifecycle",
        "MOCKED_TEST_ACCOUNTS",
        "PASSED",
        "Driver password reset succeeded. Bcrypt hash updated, new password matches, old password fails."
      );
    } else {
      recordResult(
        "Driver Password Recovery Lifecycle",
        "MOCKED_TEST_ACCOUNTS",
        "FAILED",
        `Driver reset failed: ${JSON.stringify(dataResetDriver)}`
      );
    }
  }

  // ==========================================================================
  // SCENARIO 9: Full Recovery Cycle for Admin Account
  // ==========================================================================
  console.log("\n--- SCENARIO 9: Full Recovery Cycle for Admin Account ---");
  const validAdminOtp = "938172";
  const validAdminHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${adminUser._id.toString()}:PASSWORD_RESET:${validAdminOtp}`)
    .digest("hex");

  await User.updateOne(
    { _id: adminUser._id },
    {
      $set: {
        resetPasswordOtpHash: validAdminHash,
        resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
        resetPasswordOtpAttempts: 0,
      },
    }
  );

  const resVerifyAdmin = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.8" },
    body: JSON.stringify({ email: testAdminEmail, code: validAdminOtp }),
  });
  const dataVerifyAdmin = await resVerifyAdmin.json();

  if (!resVerifyAdmin.ok || !dataVerifyAdmin.resetAuthToken) {
    recordResult("Admin OTP Verification", "MOCKED_TEST_ACCOUNTS", "FAILED", JSON.stringify(dataVerifyAdmin));
  } else {
    const resResetAdmin = await fetch(`${APP_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.8" },
      body: JSON.stringify({
        email: testAdminEmail,
        resetAuthToken: dataVerifyAdmin.resetAuthToken,
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });
    const dataResetAdmin = await resResetAdmin.json();

    const updatedAdmin = await User.findById(adminUser._id).lean();
    const newPassMatch = await bcrypt.compare(newPassword, updatedAdmin?.password || "");
    const oldPassDead = !(await bcrypt.compare(initialPassword, updatedAdmin?.password || ""));

    if (resResetAdmin.ok && dataResetAdmin.success && newPassMatch && oldPassDead) {
      recordResult(
        "Admin Password Recovery Lifecycle",
        "MOCKED_TEST_ACCOUNTS",
        "PASSED",
        "Admin password reset succeeded. Bcrypt hash updated, new password matches, old password fails."
      );
    } else {
      recordResult(
        "Admin Password Recovery Lifecycle",
        "MOCKED_TEST_ACCOUNTS",
        "FAILED",
        `Admin reset failed: ${JSON.stringify(dataResetAdmin)}`
      );
    }
  }

  // ==========================================================================
  // SCENARIO 10: Single-Use Authorization Token Reuse Blocked
  // ==========================================================================
  console.log("\n--- SCENARIO 10: Single-Use Authorization Token Reuse Protection ---");
  const resReuse = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.9" },
    body: JSON.stringify({
      email: testAdminEmail,
      resetAuthToken: dataVerifyAdmin.resetAuthToken,
      password: "AnotherPassword789!",
      confirmPassword: "AnotherPassword789!",
    }),
  });
  const dataReuse = await resReuse.json();

  if (resReuse.status === 400 && (dataReuse.error?.includes("already been used") || dataReuse.error?.includes("Invalid or expired password reset authorization"))) {
    recordResult(
      "Authorization Token Single-Use Enforcement",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      `Consumed authorization token reuse rejected with HTTP 400: "${dataReuse.error}"`
    );
  } else {
    recordResult(
      "Authorization Token Single-Use Enforcement",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Expected reuse rejection, got ${resReuse.status}: ${JSON.stringify(dataReuse)}`
    );
  }

  // ==========================================================================
  // SCENARIO 11: Realtime Session Invalidation (sessionVersion increment)
  // ==========================================================================
  console.log("\n--- SCENARIO 11: Session Invalidation Across Devices ---");
  const adminDoc = await User.findById(adminUser._id).lean();
  if ((adminDoc?.sessionVersion || 0) > 1) {
    recordResult(
      "Session Invalidation",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      `Session version incremented to ${adminDoc?.sessionVersion}. Prior active JWT cookies/sessions are revoked.`
    );
  } else {
    recordResult(
      "Session Invalidation",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      "sessionVersion was not incremented upon password reset."
    );
  }

  // ==========================================================================
  // SCENARIO 12: Actual Live SMTP Dispatch to Controlled Inbox
  // ==========================================================================
  console.log("\n--- SCENARIO 12: Live SMTP Provider Dispatch to Controlled Inbox ---");
  const controlledInbox = process.env.SMTP_USER?.trim();

  if (controlledInbox && isEmailConfigured()) {
    try {
      console.log(`[SMTP Live Test] Dispatching live test OTP to controlled inbox: ${controlledInbox}`);
      const liveOtp = "123456";
      const liveSendResult = await sendPasswordResetOtpEmail(controlledInbox, liveOtp);

      if (liveSendResult.success && liveSendResult.accepted?.includes(controlledInbox)) {
        recordResult(
          "Controlled Inbox SMTP Handshake & Dispatch",
          "ACTUAL_INBOX_DELIVERY",
          "PASSED",
          `Nodemailer dispatched via SMTP to ${controlledInbox}. Message ID: ${liveSendResult.messageId}. Provider accepted: [${liveSendResult.accepted.join(", ")}]. Note: SMTP acceptance indicates provider queued message; inbox delivery depends on recipient mailbox routing.`
        );
      } else {
        recordResult(
          "Controlled Inbox SMTP Handshake & Dispatch",
          "ACTUAL_INBOX_DELIVERY",
          "FAILED",
          `SMTP dispatch failed: ${liveSendResult.error}`
        );
      }
    } catch (err: any) {
      recordResult(
        "Controlled Inbox SMTP Handshake & Dispatch",
        "ACTUAL_INBOX_DELIVERY",
        "FAILED",
        `SMTP exception: ${err.message}`
      );
    }
  } else {
    recordResult(
      "Controlled Inbox SMTP Handshake & Dispatch",
      "ACTUAL_INBOX_DELIVERY",
      "UNVERIFIED",
      "SMTP_USER or credentials not found in environment."
    );
  }

  // ==========================================================================
  // SCENARIO 13: Clean Recipient Email Sanitization in Nodemailer
  // ==========================================================================
  console.log("\n--- SCENARIO 13: Recipient Email Sanitization in Nodemailer Helper ---");
  // Test that helper rejects invalid email without crashing or sending
  const invalidEmailResult = await sendPasswordResetOtpEmail("invalid-email-address", "123456");
  if (!invalidEmailResult.success && invalidEmailResult.error?.includes("Invalid recipient")) {
    recordResult(
      "Nodemailer Recipient Address Validation",
      "SECURITY_ENFORCEMENT",
      "PASSED",
      "Malformed recipient email address safely rejected before SMTP dispatch."
    );
  } else {
    recordResult(
      "Nodemailer Recipient Address Validation",
      "SECURITY_ENFORCEMENT",
      "FAILED",
      `Expected validation error, got: ${JSON.stringify(invalidEmailResult)}`
    );
  }

  // Cleanup dedicated test accounts
  await User.deleteMany({
    email: { $in: [testRiderEmail, testDriverEmail, testAdminEmail] },
  });
  console.log("\n✓ Cleaned up test accounts.");
  await mongoose.disconnect();

  // Summary Table
  console.log("\n========================================================================");
  console.log("                           AUDIT SUMMARY TABLE                          ");
  console.log("========================================================================");
  console.table(
    auditReports.map((r) => ({
      Scenario: r.scenario,
      Category: r.category,
      Status: r.status,
      Details: r.details.slice(0, 75) + (r.details.length > 75 ? "..." : ""),
    }))
  );

  const total = auditReports.length;
  const passed = auditReports.filter((r) => r.status === "PASSED").length;
  const failed = auditReports.filter((r) => r.status === "FAILED").length;
  const unverified = auditReports.filter((r) => r.status === "UNVERIFIED").length;

  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Unverified: ${unverified}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("\n❌ Fatal Audit Script Error:", err);
  process.exit(1);
});
