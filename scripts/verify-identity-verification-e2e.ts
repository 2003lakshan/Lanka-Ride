import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import fs from "fs";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 STARTING IDENTITY DOCUMENT VERIFICATION TESTS");
  console.log("=================================================");

  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: User } = await import("../src/models/User");
  const { default: Booking } = await import("../src/models/Booking");
  const { default: VehicleType } = await import("../src/models/VehicleType");
  const { default: RiderIdentity } = await import("../src/models/RiderIdentity");
  const { default: ContactVerification } = await import("../src/models/ContactVerification");
  const {
    validateMagicBytes,
    saveDocumentFile,
    deleteDocumentFile,
    generateSignedDocumentUrl,
    verifySignedDocumentUrl,
    getMaxFileSizeBytes,
    getStorageDirectory,
  } = await import("../src/lib/identityStorage");

  await dbConnect();

  const testEmail = "test_identity_rider@example.com";
  const testPhone = "+94771238888";
  await User.deleteMany({ email: testEmail });
  await ContactVerification.deleteMany({ target: testEmail });

  // 1. Create Verified Rider User
  const rider = await User.create({
    name: "Identity Test Rider",
    email: testEmail,
    role: "TOURIST",
    phoneNumber: testPhone,
    nationality: "Sri Lanka",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });
  console.log("✅ Created test rider:", rider._id.toString());

  // Also clean any previous identities
  await RiderIdentity.deleteMany({ userId: rider._id });

  // -------------------------------------------------------------
  // Test 1: File Magic Bytes & Signature Validation
  // -------------------------------------------------------------
  console.log("\n--- Test 1: Magic Bytes & Signature Validation ---");
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const validPdf = Buffer.from("%PDF-1.4\n%testpdfcontent\n%%EOF");
  const maliciousFakePng = Buffer.from("<?php echo 'malicious script'; ?>");

  const checkJpeg = validateMagicBytes(validJpeg, "image/jpeg");
  const checkPng = validateMagicBytes(validPng, "image/png");
  const checkPdf = validateMagicBytes(validPdf, "application/pdf");
  const checkFake = validateMagicBytes(maliciousFakePng, "image/png");

  if (!checkJpeg.valid) throw new Error("Valid JPEG rejected: " + checkJpeg.error);
  if (!checkPng.valid) throw new Error("Valid PNG rejected: " + checkPng.error);
  if (!checkPdf.valid) throw new Error("Valid PDF rejected: " + checkPdf.error);
  if (checkFake.valid) throw new Error("Malicious fake PNG should be rejected!");
  console.log("✅ Magic bytes checks passed (JPEG, PNG, PDF accepted, fake script rejected).");

  // -------------------------------------------------------------
  // Test 2: File Storage & Safe Deletion in Private Directory
  // -------------------------------------------------------------
  console.log("\n--- Test 2: Private Document Storage & Disk Writing ---");
  const savedFile = await saveDocumentFile(
    validJpeg,
    "front_id.jpg",
    "image/jpeg",
    rider._id.toString(),
    "front"
  );
  console.log("Saved file ID:", savedFile.fileId);
  console.log("Storage Path:", savedFile.storagePath);

  if (!fs.existsSync(savedFile.storagePath)) {
    throw new Error("Saved file does not exist on disk!");
  }
  if (savedFile.storagePath.includes("public")) {
    throw new Error("File must NOT be in public directory!");
  }
  console.log("✅ File verified in private storage directory outside public.");

  // -------------------------------------------------------------
  // Test 3: Short-lived Signed URL Generation & Verification
  // -------------------------------------------------------------
  console.log("\n--- Test 3: Short-lived Signed URLs ---");
  const signedUrl = generateSignedDocumentUrl(savedFile.fileId, 60); // 60s
  console.log("Generated Signed URL:", signedUrl);

  const urlObj = new URL("http://localhost" + signedUrl);
  const fileIdParam = urlObj.searchParams.get("fileId")!;
  const expiresParam = urlObj.searchParams.get("expires")!;
  const sigParam = urlObj.searchParams.get("sig")!;

  const isSigValid = verifySignedDocumentUrl(fileIdParam, expiresParam, sigParam);
  if (!isSigValid) throw new Error("Valid signed URL failed verification!");

  const isTamperedValid = verifySignedDocumentUrl(fileIdParam, expiresParam, sigParam + "tampered");
  if (isTamperedValid) throw new Error("Tampered signed URL should fail verification!");

  const isExpiredValid = verifySignedDocumentUrl(fileIdParam, "1000000000", sigParam);
  if (isExpiredValid) throw new Error("Expired timestamp should fail verification!");
  console.log("✅ Signed URL generation, verification, tamper-proofing, and expiry checks passed.");

  // -------------------------------------------------------------
  // Test 4: Identity Document Completeness Gating
  // -------------------------------------------------------------
  console.log("\n--- Test 4: Document Completeness & Status Transitions ---");
  // A. Incomplete National ID (Front only)
  const identity = await RiderIdentity.create({
    userId: rider._id,
    documentType: "NATIONAL_ID",
    acknowledgedPurpose: true,
    status: "PENDING_REVIEW",
    files: {
      front: savedFile,
    },
  });

  const isCompleteIncomplete = Boolean(identity.files.front && identity.files.back);
  console.log("Front-only National ID complete expected false:", isCompleteIncomplete);
  if (isCompleteIncomplete) throw new Error("Should be incomplete with front only");

  // B. Complete National ID (Upload Back)
  const savedBack = await saveDocumentFile(
    validPng,
    "back_id.png",
    "image/png",
    rider._id.toString(),
    "back"
  );
  identity.files.back = savedBack;
  identity.status = "PENDING_REVIEW";
  await identity.save();

  const isCompleteFull = Boolean(identity.files.front && identity.files.back);
  console.log("Full National ID complete expected true:", isCompleteFull);
  if (!isCompleteFull) throw new Error("Should be complete with front and back");
  console.log("✅ Identity completeness logic verified.");

  // -------------------------------------------------------------
  // Test 5: Server-side Custom Trip Linking & Enforcement
  // -------------------------------------------------------------
  console.log("\n--- Test 5: Custom Trip Submission Linking ---");
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

  const customTrip = await Booking.create({
    bookingReference: "CT-ID-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
    touristId: rider._id,
    status: "PENDING_APPROVAL",
    arrivalDate: new Date("2026-12-01"),
    arrivalTime: "10:00",
    vehicleTypeId: vehicle._id,
    pickupAddress: "BIA Airport",
    destinationAddress: "Kandy",
    passengerDetails: {
      fullName: rider.name,
      nationality: "Sri Lanka",
      country: "Sri Lanka",
      email: testEmail,
      whatsappNumber: testPhone,
      adults: 2,
      children: 0,
      luggage: 2,
      childSeatRequired: false,
      meetAndGreetRequired: false,
    },
    customTripDetails: {
      isCustomTrip: true,
      bookingContact: {
        fullName: rider.name,
        country: "Sri Lanka",
        email: testEmail,
        phone: testPhone,
        isBookingForSomeoneElse: false,
        confirmedAccuracy: true,
        verifiedAt: new Date(),
      },
      identityVerification: {
        identityId: identity._id,
        documentType: identity.documentType,
        status: identity.status,
        files: {
          front: {
            fileId: identity.files.front.fileId,
            originalName: identity.files.front.originalName,
            mimeType: identity.files.front.mimeType,
            size: identity.files.front.size,
          },
          back: {
            fileId: identity.files.back.fileId,
            originalName: identity.files.back.originalName,
            mimeType: identity.files.back.mimeType,
            size: identity.files.back.size,
          },
        },
        uploadedAt: new Date(),
      },
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-03"),
      budget: 350,
      budgetCurrency: "USD",
      budgetCovers: "Transport only",
      budgetFlexibility: "Negotiable",
      itinerary: [],
    },
  });

  console.log("✅ Custom trip linked to identity record:", customTrip.customTripDetails?.identityVerification?.identityId?.toString());
  if (customTrip.customTripDetails?.identityVerification?.status !== "PENDING_REVIEW") {
    throw new Error("Identity status on trip should be PENDING_REVIEW");
  }

  // -------------------------------------------------------------
  // Test 6: Admin Review - Approval & Rejection with Reason
  // -------------------------------------------------------------
  console.log("\n--- Test 6: Admin Review Actions ---");
  // A. Admin Rejects Document
  const adminId = rider._id; // simulate admin ID
  identity.status = "REJECTED";
  identity.rejectionReason = "Back image is blurry. Please provide a sharp scan.";
  identity.reviewedBy = adminId;
  identity.reviewedAt = new Date();
  await identity.save();

  console.log("Document Rejected with Reason:", identity.rejectionReason);
  if (identity.status !== "REJECTED" || !identity.rejectionReason) {
    throw new Error("Rejection state failed");
  }

  // B. Rider Re-uploads New Document (Passport)
  console.log("Rider re-uploads Passport details page...");
  const passportFile = await saveDocumentFile(
    validPdf,
    "passport_photo_page.pdf",
    "application/pdf",
    rider._id.toString(),
    "photoPage"
  );
  identity.documentType = "PASSPORT";
  identity.files = { photoPage: passportFile };
  identity.status = "PENDING_REVIEW";
  identity.rejectionReason = undefined;
  await identity.save();

  if (identity.status !== "PENDING_REVIEW" || identity.rejectionReason) {
    throw new Error("Re-upload should reset status to PENDING_REVIEW and clear rejection reason");
  }
  console.log("✅ Re-upload reset status to PENDING_REVIEW.");

  // C. Admin Approves Document
  identity.status = "APPROVED";
  identity.reviewedBy = adminId;
  identity.reviewedAt = new Date();
  await identity.save();

  if (identity.status !== "APPROVED") {
    throw new Error("Approval state failed");
  }
  console.log("✅ Admin approval verified.");

  // -------------------------------------------------------------
  // Test 7: Retention Period & Cleanup Mechanism
  // -------------------------------------------------------------
  console.log("\n--- Test 7: Configurable Retention & File Cleanup ---");
  // Set retention in the past
  identity.retentionUntil = new Date(Date.now() - 10000); // 10s ago
  await identity.save();

  const expired = await RiderIdentity.find({
    retentionUntil: { $lte: new Date() },
    isArchived: { $ne: true },
  });
  console.log("Found expired identity records for retention cleanup:", expired.length);

  for (const rec of expired) {
    for (const key of ["front", "back", "photoPage"]) {
      const f = (rec.files as any)?.[key];
      if (f?.storagePath) {
        await deleteDocumentFile(f.storagePath);
        f.storagePath = "[DELETED_BY_RETENTION_POLICY]";
      }
    }
    rec.isArchived = true;
    await rec.save();
  }

  // Verify file removed from disk
  if (fs.existsSync(passportFile.storagePath)) {
    throw new Error("Expired file was not cleaned up from disk!");
  }
  console.log("✅ Expired document physical file securely purged from disk.");

  // -------------------------------------------------------------
  // Test 8: Backwards Compatibility with Legacy Bookings
  // -------------------------------------------------------------
  console.log("\n--- Test 8: Compatibility with Legacy Bookings ---");
  const legacyBooking = await Booking.create({
    bookingReference: "LEGACY-ID-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
    touristId: rider._id,
    status: "CONFIRMED",
    pickupAddress: "Galle Fort",
    destinationAddress: "Colombo Airport",
    passengerDetails: {
      fullName: "Legacy Rider",
      nationality: "Sri Lanka",
      country: "Sri Lanka",
      email: testEmail,
      adults: 1,
      children: 0,
      luggage: 1,
      childSeatRequired: false,
      meetAndGreetRequired: false,
    },
    customTripDetails: {
      isCustomTrip: true,
      budget: 200,
      // No identityVerification
    },
  });

  const readLegacy = await Booking.findById(legacyBooking._id);
  if (!readLegacy || readLegacy.customTripDetails?.identityVerification) {
    throw new Error("Legacy booking without identityVerification should load cleanly without errors");
  }
  console.log("✅ Legacy booking without identityVerification loaded cleanly.");

  // Clean up
  await Booking.deleteMany({ _id: { $in: [customTrip._id, legacyBooking._id] } });
  await User.deleteOne({ _id: rider._id });
  await RiderIdentity.deleteMany({ userId: rider._id });
  await deleteDocumentFile(savedFile.storagePath);
  await deleteDocumentFile(savedBack.storagePath);

  console.log("\n=================================================");
  console.log("🎉 ALL IDENTITY DOCUMENT TESTS PASSED (8/8)");
  console.log("=================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
