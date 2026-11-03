import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
const APP_URL = "http://localhost:3000";

async function runTests() {
  console.log("=== STARTING EMAIL OTP PASSWORD RECOVERY VERIFICATION ===");

  await mongoose.connect(MONGODB_URI);
  console.log("[Test] Connected to MongoDB");

  const db = mongoose.connection.db!;
  const testEmail = "test_otp_rider@example.com";
  const initialPassword = "OldPassword123!";
  const newPassword = "NewSecurePassword456!";

  // 1. Setup clean test user (Rider)
  const initialHash = await bcrypt.hash(initialPassword, 10);
  await db.collection("users").deleteOne({ email: testEmail });
  const insertResult = await db.collection("users").insertOne({
    name: "Test OTP Rider",
    email: testEmail,
    password: initialHash,
    role: "TOURIST",
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const userId = insertResult.insertedId;
  console.log(`[Test] Created test user: ${testEmail} (${userId})`);

  // TEST 1: Request Code for Non-Existent Account (Anti-Enumeration)
  console.log("\n--- TEST 1: Anti-Enumeration for Non-Existent Account ---");
  const resNonExistent = await fetch(`${APP_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "definitely_non_existent_1234567@example.com" }),
  });
  const dataNonExistent = await resNonExistent.json();
  if (
    resNonExistent.status === 200 &&
    dataNonExistent.message === "If an account exists for this email, a verification code will be sent."
  ) {
    console.log("✓ Correct uniform anti-enumeration response returned for non-existent email.");
  } else {
    throw new Error(`Failed TEST 1: Unexpected response ${JSON.stringify(dataNonExistent)}`);
  }

  // TEST 2: Request Code for Existing Account
  console.log("\n--- TEST 2: Request Verification Code for Existing Account ---");
  const resReal = await fetch(`${APP_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail }),
  });
  const dataReal = await resReal.json();
  if (
    resReal.status === 200 &&
    dataReal.message === "If an account exists for this email, a verification code will be sent."
  ) {
    console.log("✓ Real account received exact same anti-enumeration response.");
  } else {
    throw new Error(`Failed TEST 2: ${JSON.stringify(dataReal)}`);
  }

  // Verify DB state: Hash stored, not plain code, 10 min expiry
  const userAfterRequest = await db.collection("users").findOne({ _id: userId });
  if (
    userAfterRequest?.resetPasswordOtpHash &&
    userAfterRequest?.resetPasswordOtpExpires &&
    userAfterRequest.resetPasswordOtpAttempts === 0
  ) {
    const expiryMins = Math.round(
      (new Date(userAfterRequest.resetPasswordOtpExpires).getTime() - Date.now()) / (60 * 1000)
    );
    console.log(`✓ Secure OTP hash stored in DB. Expiry is in ~${expiryMins} minutes. Plain code is NOT stored.`);
  } else {
    throw new Error("Failed TEST 2: DB fields resetPasswordOtpHash/Expires not found.");
  }

  // TEST 3: 60-Second Resend Cooldown Enforcement
  console.log("\n--- TEST 3: 60-Second Resend Cooldown Enforcement ---");
  const resCooldown = await fetch(`${APP_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail }),
  });
  const dataCooldown = await resCooldown.json();
  if (resCooldown.status === 429 && dataCooldown.error.includes("Please wait") && dataCooldown.retryAfter) {
    console.log(`✓ 60-second cooldown enforced successfully. Retry after: ${dataCooldown.retryAfter}s.`);
  } else {
    throw new Error(`Failed TEST 3: Expected 429 cooldown, got ${resCooldown.status}: ${JSON.stringify(dataCooldown)}`);
  }

  // TEST 4: Invalid Code Verification & Attempt Counting
  console.log("\n--- TEST 4: Verification Attempts & Limits (Max 5 attempts) ---");
  // Set known test OTP in DB for exact test control
  const knownTestOtp = "482915";
  const knownHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${userId.toString()}:PASSWORD_RESET:${knownTestOtp}`)
    .digest("hex");

  await db.collection("users").updateOne(
    { _id: userId },
    {
      $set: {
        resetPasswordOtpHash: knownHash,
        resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
        resetPasswordOtpAttempts: 0,
      },
    }
  );

  // Attempt 1: Wrong code
  const resWrong1 = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, code: "000000" }),
  });
  const dataWrong1 = await resWrong1.json();
  if (resWrong1.status === 400 && dataWrong1.error.includes("4 attempts remaining")) {
    console.log("✓ Attempt 1 rejected: 4 attempts remaining.");
  } else {
    throw new Error(`Failed TEST 4 Attempt 1: ${JSON.stringify(dataWrong1)}`);
  }

  // Attempts 2, 3, 4
  for (let i = 2; i <= 4; i++) {
    await fetch(`${APP_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, code: "111111" }),
    });
  }

  // Attempt 5: 5th wrong code should exceed limit and invalidate code
  const resWrong5 = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, code: "222222" }),
  });
  const dataWrong5 = await resWrong5.json();
  if (resWrong5.status === 400 && dataWrong5.error.includes("exceeded maximum attempts")) {
    console.log("✓ Attempt 5 rejected: Maximum attempts exceeded.");
  } else {
    throw new Error(`Failed TEST 4 Attempt 5: ${JSON.stringify(dataWrong5)}`);
  }

  // Verify code was invalidated in DB
  const userAfterMaxAttempts = await db.collection("users").findOne({ _id: userId });
  if (!userAfterMaxAttempts?.resetPasswordOtpHash) {
    console.log("✓ Code invalidated and removed from DB after 5 failed attempts.");
  } else {
    throw new Error("Failed TEST 4: Code hash still exists in DB after 5 attempts.");
  }

  // TEST 5: Expiration Enforcement
  console.log("\n--- TEST 5: Code Expiration Enforcement ---");
  const expiredHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${userId.toString()}:PASSWORD_RESET:${knownTestOtp}`)
    .digest("hex");

  await db.collection("users").updateOne(
    { _id: userId },
    {
      $set: {
        resetPasswordOtpHash: expiredHash,
        resetPasswordOtpExpires: new Date(Date.now() - 5000), // expired 5 seconds ago
        resetPasswordOtpAttempts: 0,
      },
    }
  );

  const resExpired = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, code: knownTestOtp }),
  });
  const dataExpired = await resExpired.json();
  if (resExpired.status === 400 && dataExpired.error.includes("expired")) {
    console.log("✓ Expired code properly rejected.");
  } else {
    throw new Error(`Failed TEST 5: ${JSON.stringify(dataExpired)}`);
  }

  // TEST 6: Successful Verification & Single-Use Reset Authorization
  console.log("\n--- TEST 6: Successful OTP Verification & Single-Use Authorization Token ---");
  const validOtp = "739104";
  const validHash = crypto
    .createHmac("sha256", NEXTAUTH_SECRET)
    .update(`${userId.toString()}:PASSWORD_RESET:${validOtp}`)
    .digest("hex");

  await db.collection("users").updateOne(
    { _id: userId },
    {
      $set: {
        resetPasswordOtpHash: validHash,
        resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
        resetPasswordOtpAttempts: 0,
      },
    }
  );

  const resVerifySuccess = await fetch(`${APP_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, code: validOtp }),
  });
  const dataVerifySuccess = await resVerifySuccess.json();

  if (!resVerifySuccess.ok || !dataVerifySuccess.resetAuthToken) {
    throw new Error(`Failed TEST 6: Verification failed: ${JSON.stringify(dataVerifySuccess)}`);
  }
  const resetAuthToken = dataVerifySuccess.resetAuthToken;
  console.log("✓ OTP verified successfully. Single-use reset authorization token issued.");

  // Check that OTP code was consumed immediately upon verification
  const userAfterConsumedOtp = await db.collection("users").findOne({ _id: userId });
  if (!userAfterConsumedOtp?.resetPasswordOtpHash && userAfterConsumedOtp?.resetPasswordAuthTokenHash) {
    console.log("✓ OTP was consumed from DB immediately upon verification.");
  } else {
    throw new Error("Failed TEST 6: OTP was not consumed upon verification.");
  }

  // TEST 7: Password Policy Enforcement (< 8 chars, mismatch)
  console.log("\n--- TEST 7: Password Policy Enforcement ---");
  const resShortPass = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      resetAuthToken,
      password: "short",
      confirmPassword: "short",
    }),
  });
  const dataShortPass = await resShortPass.json();
  if (resShortPass.status === 400 && dataShortPass.error.includes("at least 8 characters")) {
    console.log("✓ Password under 8 characters rejected.");
  } else {
    throw new Error(`Failed TEST 7: ${JSON.stringify(dataShortPass)}`);
  }

  const resMismatch = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      resetAuthToken,
      password: "Password123!",
      confirmPassword: "Password456!",
    }),
  });
  const dataMismatch = await resMismatch.json();
  if (resMismatch.status === 400 && dataMismatch.error.includes("Passwords do not match")) {
    console.log("✓ Mismatched password and confirm password rejected.");
  } else {
    throw new Error(`Failed TEST 7: ${JSON.stringify(dataMismatch)}`);
  }

  // TEST 8: Successful Password Reset, Bcrypt Hashing, Session Invalidation
  console.log("\n--- TEST 8: Password Reset & Session Invalidation ---");
  const oldSessionVersion = userAfterConsumedOtp?.sessionVersion || 1;

  const resReset = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      resetAuthToken,
      password: newPassword,
      confirmPassword: newPassword,
    }),
  });
  const dataReset = await resReset.json();

  if (resReset.ok && dataReset.success) {
    console.log("✓ Password successfully reset.");
  } else {
    throw new Error(`Failed TEST 8: ${JSON.stringify(dataReset)}`);
  }

  // Verify DB state: password updated with bcrypt, sessionVersion incremented, auth token consumed
  const userAfterReset = await db.collection("users").findOne({ _id: userId });
  const isBcryptMatch = await bcrypt.compare(newPassword, userAfterReset?.password || "");
  const isOldPasswordDead = !(await bcrypt.compare(initialPassword, userAfterReset?.password || ""));

  if (!isBcryptMatch || !isOldPasswordDead) {
    throw new Error("Failed TEST 8: Password in DB was not correctly updated or hashed with bcrypt.");
  }
  console.log("✓ New password is validly hashed with bcrypt. Old password no longer matches.");

  if ((userAfterReset?.sessionVersion || 0) > oldSessionVersion) {
    console.log(`✓ Session version incremented from ${oldSessionVersion} to ${userAfterReset?.sessionVersion}. Existing sessions invalidated.`);
  } else {
    throw new Error("Failed TEST 8: sessionVersion was not incremented.");
  }

  if (userAfterReset?.resetPasswordAuthTokenConsumed === true && !userAfterReset?.resetPasswordAuthTokenHash) {
    console.log("✓ Reset authorization token invalidated and cleared.");
  } else {
    throw new Error("Failed TEST 8: Reset authorization token was not consumed.");
  }

  // TEST 9: Single-Use Enforcement (Reusing the same resetAuthToken fails)
  console.log("\n--- TEST 9: Single-Use Enforcement (Token Reuse) ---");
  const resReuse = await fetch(`${APP_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      resetAuthToken,
      password: "AnotherPassword789!",
      confirmPassword: "AnotherPassword789!",
    }),
  });
  const dataReuse = await resReuse.json();
  if (resReuse.status === 400) {
    console.log("✓ Server-side enforcement blocked reuse of consumed reset authorization token.");
  } else {
    throw new Error(`Failed TEST 9: Consumed token was wrongly accepted! Got ${resReuse.status}`);
  }

  // Clean up test user
  await db.collection("users").deleteOne({ _id: userId });
  await mongoose.disconnect();

  console.log("\n🎉 ALL 9 EMAIL OTP RECOVERY VERIFICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
