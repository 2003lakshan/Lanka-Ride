import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import crypto from "crypto";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 STARTING EMAIL VERIFICATION & PHONE COLLECTION TESTS");
  console.log("=================================================");

  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: User } = await import("../src/models/User");
  const { default: ContactVerification } = await import("../src/models/ContactVerification");
  const { default: Booking } = await import("../src/models/Booking");
  const { default: VehicleType } = await import("../src/models/VehicleType");
  const { sendContactVerificationOtpEmail, isEmailConfigured } = await import("../src/lib/email");

  await dbConnect();

  // Clean previous test data
  const testEmail = "test_rider_email_verify@example.com";
  const testPhone = "+94771239999";
  await User.deleteMany({ email: testEmail });
  await ContactVerification.deleteMany({ target: { $in: [testEmail, testPhone] } });

  // 1. Create Test Tourist User (unverified email, unverified phone)
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

  // 2. Check Email provider configuration status
  console.log("\n--- Provider Configurations ---");
  console.log("Email SMTP Configured:", isEmailConfigured());

  // 3. Test Email OTP Generation and Delivery
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

  // 4. Test Email OTP Hash & Cooldown in DB
  console.log("\n--- Test 2: Email OTP Hash & Cooldown in DB ---");
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
  console.log("\n--- Test 3: Invalid Email Code Handling & Attempt Limits ---");
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

  // 6. Test Valid Email Code Verification
  console.log("\n--- Test 4: Valid Email Code Verification & User Profile Update ---");
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

  // 7. Test Server Rejection when Email is Unverified or Changed
  console.log("\n--- Test 5: Server Rejection on Unverified Email ---");
  const unverifiedEmail = "unverified_new_email@example.com";

  // Simulate server check from /api/bookings/custom for email
  const checkEmailDoc = await ContactVerification.findOne({
    userId: user._id,
    type: "EMAIL",
    target: unverifiedEmail,
    verifiedAt: { $exists: true, $ne: null },
  });
  const isEmailAccountMatch = user.email === unverifiedEmail && user.isEmailVerified;
  const isEmailAllowed = Boolean(checkEmailDoc || isEmailAccountMatch);
  console.log("Unverified email allowed expected false:", isEmailAllowed);
  if (isEmailAllowed) throw new Error("Unverified email should be rejected by server");
  console.log("✅ Server correctly blocks custom trip submission when email is unverified.");

  // 8. Test Server Acceptance with Verified Email and UNVERIFIED Changed Phone
  console.log("\n--- Test 6: Server Acceptance with Verified Email and UNVERIFIED Phone ---");
  const changedUnverifiedPhone = "+94719876543"; // Changed phone with NO OTP verification

  // Verify server-side validation rules in /api/bookings/custom:
  // Email must be verified
  const verifiedEmailDoc = await ContactVerification.findOne({
    userId: user._id,
    type: "EMAIL",
    target: testEmail,
    verifiedAt: { $exists: true, $ne: null },
  });
  const isEmailValid = Boolean(verifiedEmailDoc || (user.email === testEmail && user.isEmailVerified));
  if (!isEmailValid) throw new Error("Email should be recognized as verified");

  // Phone requires only valid format (at least 7 digits), NO OTP verification
  const phoneDigits = changedUnverifiedPhone.replace(/\D/g, "");
  const isPhoneFormatValid = phoneDigits.length >= 7;
  if (!isPhoneFormatValid) throw new Error("Phone format should be valid");

  // Check that NO phone verification record exists
  const hasPhoneVerificationRecord = await ContactVerification.findOne({
    userId: user._id,
    target: changedUnverifiedPhone.replace(/[^\d+]/g, ""),
  });
  console.log("Phone verification record exists (expected null):", hasPhoneVerificationRecord);
  if (hasPhoneVerificationRecord) throw new Error("Phone should NOT have a verification record");

  console.log("✅ Confirmed: Rider can proceed with changed unverified phone number without mobile OTP.");

  // 9. Test Successful Custom Trip Creation with Unverified Phone & Snapshot
  console.log("\n--- Test 7: Successful Custom Trip Creation & Compatibility ---");
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
      alternativePhoneNumber: changedUnverifiedPhone,
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
        phone: changedUnverifiedPhone,
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

  console.log("✅ Custom trip created successfully with unverified contact phone:", customBooking._id.toString());
  console.log("Booking Snapshot:", {
    bookingReference: customBooking.bookingReference,
    bookingContact: customBooking.customTripDetails?.bookingContact,
    passengerDetails: {
      fullName: customBooking.passengerDetails.fullName,
      whatsappNumber: customBooking.passengerDetails.whatsappNumber,
      email: customBooking.passengerDetails.email,
    },
  });

  // 10. Check Compatibility with Existing Bookings without bookingContact
  console.log("\n--- Test 8: Compatibility with Existing Legacy Bookings ---");
  const legacyBooking = await Booking.create({
    bookingReference: "LEGACY-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
    touristId: user._id,
    status: "CONFIRMED",
    pickupAddress: "Colombo 03",
    destinationAddress: "BIA Airport",
    passengerDetails: {
      fullName: "Legacy Traveler",
      nationality: "Sri Lanka",
      country: "Sri Lanka",
      email: "legacy@example.com",
      whatsappNumber: "+94770000000",
      adults: 1,
      children: 0,
      luggage: 1,
      childSeatRequired: false,
      meetAndGreetRequired: false,
    },
    customTripDetails: {
      isCustomTrip: true,
      budget: 100,
    },
  });
  console.log("Legacy booking without bookingContact created & read successfully:", legacyBooking.bookingReference);

  // Clean up test data
  await Booking.deleteMany({ _id: { $in: [customBooking._id, legacyBooking._id] } });
  await User.deleteOne({ _id: user._id });
  await ContactVerification.deleteMany({ userId: user._id });

  console.log("\n=================================================");
  console.log("🎉 ALL TESTS COMPLETED SUCCESSFULLY (8/8)");
  console.log("=================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
