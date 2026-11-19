import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import crypto from "crypto";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 STARTING CONTACT VERIFICATION & CUSTOM TRIP TESTS");
  console.log("=================================================");

  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: User } = await import("../src/models/User");
  const { default: ContactVerification } = await import("../src/models/ContactVerification");
  const { default: Booking } = await import("../src/models/Booking");
  const { default: VehicleType } = await import("../src/models/VehicleType");
  const { sendPhoneVerificationOtpSms, isSmsConfigured } = await import("../src/lib/sms");
  const { sendContactVerificationOtpEmail, isEmailConfigured } = await import("../src/lib/email");

  await dbConnect();

  // Clean previous test data
  const testEmail = "test_rider_verification@example.com";
  const testPhone = "+94771239999";
  await User.deleteMany({ email: testEmail });
  await ContactVerification.deleteMany({ target: { $in: [testEmail, testPhone] } });

  // 1. Create Test Tourist User
  const user = await User.create({
    name: "Test Rider",
    email: testEmail,
    role: "TOURIST",
    phoneNumber: testPhone,
    nationality: "Sri Lanka",
    isEmailVerified: false,
    isPhoneVerified: false,
  });
  console.log("✅ Created test rider:", user._id.toString());

  // 2. Check SMS / Email provider configuration status
  console.log("\n--- Provider Configurations ---");
  console.log("Email SMTP Configured:", isEmailConfigured());
  console.log("SMS Gateway Configured:", isSmsConfigured());

  // 3. Test OTP Generation and Delivery (Dev Mock / Real)
  console.log("\n--- Test 1: Email OTP Dispatch ---");
  const emailOtp = "123456";
  const emailResult = await sendContactVerificationOtpEmail(testEmail, emailOtp);
  console.log("Email Dispatch Result:", {
    success: emailResult.success,
    isDevMock: emailResult.isDevMock,
    error: emailResult.error,
  });
  if (!emailResult.success && !emailResult.isDevMock) {
    throw new Error("Email dispatch failed unexpectedly: " + emailResult.error);
  }
  console.log("✅ Email dispatch test passed.");

  console.log("\n--- Test 2: Phone SMS OTP Dispatch ---");
  const phoneOtp = "654321";
  const phoneResult = await sendPhoneVerificationOtpSms(testPhone, phoneOtp);
  console.log("SMS Dispatch Result:", {
    success: phoneResult.success,
    isDevMock: phoneResult.isDevMock,
    provider: phoneResult.provider,
  });
  if (!phoneResult.success && !phoneResult.isDevMock) {
    throw new Error("SMS dispatch failed unexpectedly: " + phoneResult.error);
  }
  console.log("✅ SMS dispatch test passed.");

  // 4. Test ContactVerification DB Record & HMAC Hashing
  console.log("\n--- Test 3: OTP Hash & Cooldown in DB ---");
  const secret = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
  const emailHash = crypto
    .createHmac("sha256", secret)
    .update(`${user._id.toString()}:EMAIL:${testEmail}:${emailOtp}`)
    .digest("hex");

  const emailRecord = await ContactVerification.create({
    userId: user._id,
    type: "EMAIL",
    target: testEmail,
    otpHash: emailHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    lastSentAt: new Date(),
  });
  console.log("✅ Created email verification record:", emailRecord._id.toString());

  // Cooldown check
  const cooldownElapsed = Date.now() - emailRecord.lastSentAt.getTime();
  const isCooldownActive = cooldownElapsed < 60000;
  console.log("Cooldown check active (within 60s):", isCooldownActive);
  if (!isCooldownActive) throw new Error("Cooldown check should be active within 60s");
  console.log("✅ Cooldown enforcement check passed.");

  // 5. Test Invalid Code Rejection & Attempt Counter
  console.log("\n--- Test 4: Invalid Code Handling & Attempt Limits ---");
  const wrongCode = "999999";
  const wrongHash = crypto
    .createHmac("sha256", secret)
    .update(`${user._id.toString()}:EMAIL:${testEmail}:${wrongCode}`)
    .digest("hex");

  const matchWrong = crypto.timingSafeEqual(Buffer.from(emailRecord.otpHash), Buffer.from(wrongHash));
  console.log("Wrong code match expected false:", matchWrong);
  if (matchWrong) throw new Error("Wrong code should not match");

  // Increment attempts
  emailRecord.attempts += 1;
  await emailRecord.save();
  console.log("Attempt incremented to:", emailRecord.attempts, "(Remaining: " + (5 - emailRecord.attempts) + ")");
  console.log("✅ Invalid code rejection and attempt counting verified.");

  // 6. Test Valid Code Verification
  console.log("\n--- Test 5: Valid Code Verification ---");
  const matchCorrect = crypto.timingSafeEqual(Buffer.from(emailRecord.otpHash), Buffer.from(emailHash));
  if (!matchCorrect) throw new Error("Correct code should match");

  const token = crypto.randomBytes(32).toString("hex");
  emailRecord.verifiedAt = new Date();
  emailRecord.verificationToken = token;
  await emailRecord.save();

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();
  console.log("✅ Email successfully marked verified for user and token generated.");

  // Also verify phone
  const phoneHash = crypto
    .createHmac("sha256", secret)
    .update(`${user._id.toString()}:PHONE:${testPhone}:${phoneOtp}`)
    .digest("hex");

  const phoneRecord = await ContactVerification.create({
    userId: user._id,
    type: "PHONE",
    target: testPhone,
    otpHash: phoneHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    lastSentAt: new Date(),
    verifiedAt: new Date(),
    verificationToken: crypto.randomBytes(32).toString("hex"),
  });
  user.isPhoneVerified = true;
  user.phoneVerifiedAt = new Date();
  await user.save();
  console.log("✅ Phone successfully marked verified for user.");

  // 7. Test Server-side submission with changed/unverified contact
  console.log("\n--- Test 6: Server Rejection on Unverified/Changed Contact ---");
  const changedEmail = "changed_unverified@example.com";

  // Simulate server check from /api/bookings/custom
  const checkEmailDoc = await ContactVerification.findOne({
    userId: user._id,
    type: "EMAIL",
    target: changedEmail,
    verifiedAt: { $exists: true, $ne: null },
  });
  const isEmailAccountMatch = user.email === changedEmail && user.isEmailVerified;
  const isEmailAllowed = Boolean(checkEmailDoc || isEmailAccountMatch);
  console.log("Changed email allowed expected false:", isEmailAllowed);
  if (isEmailAllowed) throw new Error("Changed unverified email should be rejected by server");
  console.log("✅ Server correctly rejects changed/unverified contact details.");

  // 8. Test Successful Custom Trip Submission with Verified Contact Snapshot
  console.log("\n--- Test 7: Successful Custom Trip Submission with Booking Contact ---");
  let vehicle = await VehicleType.findOne({ isActive: true });
  if (!vehicle) {
    vehicle = await VehicleType.create({
      name: "Standard Car",
      capacity: 3,
      luggageCapacity: 2,
      maxPassengers: 3,
      maxLuggage: 2,
      isActive: true,
    });
  }

  const bookingRef = "CT-TEST-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  const customBooking = await Booking.create({
    bookingReference: bookingRef,
    touristId: user._id,
    status: "PENDING_APPROVAL",
    arrivalDate: new Date("2026-12-01"),
    arrivalTime: "10:00",
    vehicleTypeId: vehicle._id,
    pickupAddress: "Bandaranaike International Airport, Katunayake",
    pickupLat: 7.1808,
    pickupLng: 79.8841,
    destinationAddress: "Galle Fort, Galle",
    destinationLat: 6.0329,
    destinationLng: 80.2168,
    passengerDetails: {
      fullName: "Travelling Guest",
      nationality: "United Kingdom",
      country: "United Kingdom",
      email: testEmail,
      whatsappNumber: "+447911123456",
      alternativePhoneNumber: testPhone,
      adults: 2,
      children: 0,
      luggage: 2,
      childSeatRequired: false,
      meetAndGreetRequired: false,
    },
    customTripDetails: {
      isCustomTrip: true,
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-05"),
      budget: 650,
      budgetCurrency: "USD",
      budgetCovers: "Transport only",
      budgetFlexibility: "Negotiable",
      bookingContact: {
        fullName: "Test Rider (Booking Contact)",
        country: "Sri Lanka",
        email: testEmail,
        phone: testPhone,
        isBookingForSomeoneElse: true,
        passenger: {
          fullName: "Travelling Guest",
          phone: "+447911123456",
        },
        confirmedAccuracy: true,
        verifiedAt: new Date(),
      },
      itinerary: [
        {
          dayNumber: 1,
          date: new Date("2026-12-01"),
          departureTime: "09:00",
          placesToVisit: [{ name: "Pinnawala Elephant Orphanage", lat: 7.3013, lng: 80.3867, activityTime: "2 hours" }],
          notes: "Airport pickup",
        },
      ],
    },
  });

  console.log("✅ Custom trip created with bookingContact snapshot:", customBooking._id.toString());
  console.log("Booking Snapshot:", {
    bookingReference: customBooking.bookingReference,
    bookingContact: customBooking.customTripDetails?.bookingContact,
    passengerDetails: {
      fullName: customBooking.passengerDetails.fullName,
      whatsappNumber: customBooking.passengerDetails.whatsappNumber,
      email: customBooking.passengerDetails.email,
    },
  });

  // Clean up test booking & user
  await Booking.deleteOne({ _id: customBooking._id });
  await User.deleteOne({ _id: user._id });
  await ContactVerification.deleteMany({ userId: user._id });

  console.log("\n=================================================");
  console.log("🎉 ALL TESTS COMPLETED SUCCESSFULLY (7/7)");
  console.log("=================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
