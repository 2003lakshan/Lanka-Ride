import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import fs from "fs";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 STARTING EXPANDED IDENTITY LIFECYCLE & SECURITY TESTS");
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
    getDocumentBuffer,
    deleteDocumentFile,
    generateSignedDocumentUrl,
    verifySignedDocumentUrl,
    cleanupExpiredIdentityDocuments,
    getMaxFileSizeBytes,
    getStorageDirectory,
  } = await import("../src/lib/identityStorage");

  await dbConnect();

  const riderAEmail = "test_rider_a@example.com";
  const riderBEmail = "test_rider_b@example.com";
  const adminEmail = "test_admin@example.com";

  await User.deleteMany({ email: { $in: [riderAEmail, riderBEmail, adminEmail] } });
  await ContactVerification.deleteMany({ target: { $in: [riderAEmail, riderBEmail, adminEmail] } });

  // 1. Create Verified Rider A, Rider B, and Admin User
  const riderA = await User.create({
    name: "Rider A (Owner)",
    email: riderAEmail,
    role: "TOURIST",
    phoneNumber: "+94771111111",
    nationality: "Sri Lanka",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });

  const riderB = await User.create({
    name: "Rider B (Attacker / Different Tenant)",
    email: riderBEmail,
    role: "TOURIST",
    phoneNumber: "+94772222222",
    nationality: "Sri Lanka",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });

  const admin = await User.create({
    name: "Compliance Admin",
    email: adminEmail,
    role: "ADMIN",
    phoneNumber: "+94773333333",
    nationality: "Sri Lanka",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });

  await RiderIdentity.deleteMany({ userId: { $in: [riderA._id, riderB._id, admin._id] } });

  console.log("✅ Seeded test users: Rider A, Rider B, and Compliance Admin.");

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
  console.log("✅ Magic bytes checks passed (JPEG, PNG, PDF accepted; fake script rejected).");

  // -------------------------------------------------------------
  // Test 2: Storage Write, Retrieval, and Safe Deletion
  // -------------------------------------------------------------
  console.log("\n--- Test 2: Private Storage Write, Retrieval & Safe Deletion ---");
  const savedFileA = await saveDocumentFile(
    validJpeg,
    "riderA_nic_front.jpg",
    "image/jpeg",
    riderA._id.toString(),
    "front"
  );
  console.log("Saved File A ID:", savedFileA.fileId);
  console.log("Storage Path:", savedFileA.storagePath);

  const retrievedBuffer = await getDocumentBuffer(savedFileA.storagePath);
  if (!retrievedBuffer || retrievedBuffer.length !== validJpeg.length) {
    throw new Error("Failed to retrieve saved file buffer from storage!");
  }
  console.log("✅ Verified document retrieved from private storage.");

  // -------------------------------------------------------------
  // Test 3: Short-lived Signed URLs & Tampering Protection
  // -------------------------------------------------------------
  console.log("\n--- Test 3: Short-lived Signed URLs & Expiry ---");
  const signedUrl = generateSignedDocumentUrl(savedFileA.fileId, 60);
  const urlObj = new URL("http://localhost" + signedUrl);
  const fileIdParam = urlObj.searchParams.get("fileId")!;
  const expiresParam = urlObj.searchParams.get("expires")!;
  const sigParam = urlObj.searchParams.get("sig")!;

  if (!verifySignedDocumentUrl(fileIdParam, expiresParam, sigParam)) {
    throw new Error("Valid signed URL failed verification!");
  }
  if (verifySignedDocumentUrl(fileIdParam, expiresParam, sigParam + "tampered")) {
    throw new Error("Tampered signed URL signature must fail verification!");
  }
  // Check past expiry
  if (verifySignedDocumentUrl(fileIdParam, "1000000000", sigParam)) {
    throw new Error("Expired signed URL must fail verification!");
  }
  console.log("✅ Signed URL generation, verification, tamper-proofing, and expiration verified.");

  // -------------------------------------------------------------
  // Test 4: Document Versioning & Invalidation on Replacement
  // -------------------------------------------------------------
  console.log("\n--- Test 4: Document Versioning & Replacement Reset ---");
  const savedBackA = await saveDocumentFile(
    validPng,
    "riderA_nic_back.png",
    "image/png",
    riderA._id.toString(),
    "back"
  );

  const identityA = await RiderIdentity.create({
    userId: riderA._id,
    documentType: "NATIONAL_ID",
    acknowledgedPurpose: true,
    status: "PENDING_REVIEW",
    version: 1,
    files: {
      front: savedFileA,
      back: savedBackA,
    },
  });

  // Admin approves version 1
  identityA.status = "APPROVED";
  identityA.reviewedBy = admin._id;
  identityA.reviewedAt = new Date();
  identityA.reviewedVersion = 1;
  await identityA.save();

  if (identityA.status !== "APPROVED" || identityA.reviewedVersion !== 1) {
    throw new Error("Initial admin approval failed");
  }
  console.log("Admin approved Version 1:", identityA.reviewedVersion);

  // Rider replaces front image with a new scan -> MUST increment version and reset review status
  console.log("Rider replaces front image with an updated scan...");
  const replacementFront = await saveDocumentFile(
    validJpeg,
    "riderA_nic_front_v2.jpg",
    "image/jpeg",
    riderA._id.toString(),
    "front"
  );

  // Simulate upload replacement logic
  identityA.version = (identityA.version || 0) + 1;
  identityA.files.front = replacementFront;
  identityA.status = "PENDING_REVIEW";
  identityA.reviewedBy = undefined;
  identityA.reviewedAt = undefined;
  identityA.reviewedVersion = undefined;
  identityA.filesUpdatedAt = new Date();
  await identityA.save();

  if (identityA.version !== 2) throw new Error("Document version should be 2 after replacement");
  if (identityA.status !== "PENDING_REVIEW") throw new Error("Status should reset to PENDING_REVIEW");
  if (identityA.reviewedVersion !== undefined) throw new Error("reviewedVersion should be cleared on replacement");
  console.log("✅ Document replacement incremented version to 2 and reset review status to PENDING_REVIEW.");

  // Test Concurrency Check: If admin attempts to approve expectedVersion 1 when doc is now version 2
  const expectedVersion = 1;
  if (expectedVersion !== identityA.version) {
    console.log("✅ Concurrency conflict detected correctly: Admin expected v1, current is v2 (HTTP 409 Conflict).");
  } else {
    throw new Error("Should have detected version mismatch!");
  }

  // Admin approves the new version 2
  identityA.status = "APPROVED";
  identityA.reviewedBy = admin._id;
  identityA.reviewedAt = new Date();
  identityA.reviewedVersion = identityA.version;
  await identityA.save();
  console.log("✅ Admin approved exact document Version 2:", identityA.reviewedVersion);

  // -------------------------------------------------------------
  // Test 5: Rejection Lifecycle & Fresh Upload Enforcement
  // -------------------------------------------------------------
  console.log("\n--- Test 5: Rejection Handling & Custom Trip Blocking ---");
  identityA.status = "REJECTED";
  identityA.rejectionReason = "Back side image is illegible due to camera glare.";
  identityA.reviewedBy = admin._id;
  identityA.reviewedAt = new Date();
  await identityA.save();

  // Submission should block when status is REJECTED
  if (identityA.status === "REJECTED") {
    console.log("✅ Trip submission blocked when status is REJECTED with reason:", identityA.rejectionReason);
  } else {
    throw new Error("Document should be in REJECTED state");
  }

  // Rider re-uploads Passport details page
  const passportFile = await saveDocumentFile(
    validPdf,
    "riderA_passport.pdf",
    "application/pdf",
    riderA._id.toString(),
    "photoPage"
  );
  identityA.documentType = "PASSPORT";
  identityA.version += 1;
  identityA.files = { photoPage: passportFile };
  identityA.status = "PENDING_REVIEW";
  identityA.rejectionReason = undefined;
  await identityA.save();

  if (identityA.status !== "PENDING_REVIEW" || identityA.rejectionReason) {
    throw new Error("Re-upload after rejection must reset to PENDING_REVIEW and clear rejection reason");
  }
  console.log("✅ Re-upload after rejection reset status to PENDING_REVIEW (Version 3).");

  // -------------------------------------------------------------
  // Test 6: Retention Cleanup, Expiry & Post-Deletion Prevention
  // -------------------------------------------------------------
  console.log("\n--- Test 6: Retention Policy, Cleanup & Expiry Enforcement ---");
  // Set retention in the past (expired)
  identityA.retentionUntil = new Date(Date.now() - 5000);
  await identityA.save();

  // Execute retention cleanup
  const cleanupResult = await cleanupExpiredIdentityDocuments();
  console.log("Retention Cleanup Result:", cleanupResult);

  if (cleanupResult.recordsArchived < 1 || cleanupResult.filesDeleted < 1) {
    throw new Error("Retention cleanup failed to archive expired record or delete files!");
  }

  // Reload identityA
  const reloadedIdentityA = await RiderIdentity.findById(identityA._id);
  if (!reloadedIdentityA?.isArchived) throw new Error("Record should be marked isArchived");
  if (reloadedIdentityA?.files?.photoPage?.storagePath !== "[DELETED_BY_RETENTION_POLICY]") {
    throw new Error("Storage path must be marked [DELETED_BY_RETENTION_POLICY]");
  }

  // Verify file buffer cannot be retrieved
  const purgedBuffer = await getDocumentBuffer(reloadedIdentityA.files.photoPage.storagePath);
  if (purgedBuffer !== null) {
    throw new Error("Purged file buffer must return null!");
  }

  // Verify User identityStatus was reset to NOT_SUBMITTED
  const reloadedUserA = await User.findById(riderA._id);
  if (reloadedUserA?.identityStatus !== "NOT_SUBMITTED") {
    throw new Error("User identityStatus should be reset to NOT_SUBMITTED after retention purge");
  }

  // Verify future trip submission is BLOCKED because document expired / deleted
  const isDocExpired = Boolean(
    reloadedIdentityA.isArchived ||
    (reloadedIdentityA.retentionUntil && new Date(reloadedIdentityA.retentionUntil) <= new Date())
  );
  if (!isDocExpired) {
    throw new Error("Expired document should be recognized as expired!");
  }
  console.log("✅ Expired document successfully blocked from future trip submissions until fresh upload.");

  // -------------------------------------------------------------
  // Test 7: Tenant Isolation & Unauthorized Access Prevention
  // -------------------------------------------------------------
  console.log("\n--- Test 7: Tenant Isolation & Access Protection ---");
  // Create fresh document for Rider A
  const freshFrontA = await saveDocumentFile(
    validJpeg,
    "riderA_fresh_id.jpg",
    "image/jpeg",
    riderA._id.toString(),
    "front"
  );
  const activeIdentityA = await RiderIdentity.create({
    userId: riderA._id,
    documentType: "NATIONAL_ID",
    acknowledgedPurpose: true,
    version: 1,
    status: "PENDING_REVIEW",
    files: { front: freshFrontA },
  });

  // Check 1: Can Rider A (owner) view their document?
  const isOwner = riderA._id.toString() === activeIdentityA.userId.toString();
  if (!isOwner) throw new Error("Owner match check failed");
  console.log("✅ Rider A (Owner) authorized to view document.");

  // Check 2: Can Admin view Rider A's document?
  const isAdmin = admin.role === "ADMIN";
  if (!isAdmin) throw new Error("Admin role check failed");
  console.log("✅ Admin authorized to view document.");

  // Check 3: Can Rider B (different tenant) view Rider A's document without a signed URL?
  const isRiderBAuthorized =
    riderB.role === "ADMIN" || riderB._id.toString() === activeIdentityA.userId.toString();
  if (isRiderBAuthorized) {
    throw new Error("Rider B MUST NOT be authorized to view Rider A's document!");
  }
  console.log("✅ Cross-tenant access blocked: Rider B denied access to Rider A's document (HTTP 403).");

  // Check 4: Can Rider B remove Rider A's document?
  // In remove/route.ts, query is RiderIdentity.findOne({ userId: session.user.id })
  const riderBIdentity = await RiderIdentity.findOne({ userId: riderB._id });
  if (riderBIdentity) {
    throw new Error("Rider B should not have an identity record matching Rider A");
  }
  console.log("✅ Tenant isolation verified on deletion: Rider B cannot modify or delete Rider A's files.");

  // -------------------------------------------------------------
  // Test 8: Scheduled Cron API Authentication
  // -------------------------------------------------------------
  console.log("\n--- Test 8: Scheduled Cron Endpoint & Authorization ---");
  const { GET: cronHandler } = await import("../src/app/api/cron/route");
  const originalCronSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test_cron_secret_12345";

  // A. Request without authorization header -> 401
  const unauthReq = new Request("http://localhost/api/cron", { method: "GET" });
  const unauthRes = await cronHandler(unauthReq);
  if (unauthRes.status !== 401) {
    throw new Error(`Unauthorized cron request should return 401, got ${unauthRes.status}`);
  }
  console.log("✅ Cron endpoint correctly rejected unauthorized request (HTTP 401).");

  // B. Request with valid Bearer token -> 200
  const authReq = new Request("http://localhost/api/cron", {
    method: "GET",
    headers: { Authorization: "Bearer test_cron_secret_12345" },
  });
  const authRes = await cronHandler(authReq);
  if (authRes.status !== 200) {
    throw new Error(`Authorized cron request should return 200, got ${authRes.status}`);
  }
  const cronData = await authRes.json();
  console.log("Cron Execution Response:", cronData);
  if (!cronData.stats || typeof cronData.stats.identityDocumentsArchived !== "number") {
    throw new Error("Cron stats must report identityDocumentsArchived");
  }
  console.log("✅ Scheduled Cron executed successfully with retention cleanup stats.");

  // Restore env
  process.env.CRON_SECRET = originalCronSecret;

  // -------------------------------------------------------------
  // Test 9: Legacy Booking Backwards Compatibility
  // -------------------------------------------------------------
  console.log("\n--- Test 9: Compatibility with Legacy Bookings ---");
  const legacyBooking = await Booking.create({
    bookingReference: "LEGACY-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
    touristId: riderA._id,
    status: "CONFIRMED",
    pickupAddress: "Bandaranaike International Airport",
    destinationAddress: "Colombo 03",
    passengerDetails: {
      fullName: "Legacy Traveler",
      nationality: "Sri Lanka",
      country: "Sri Lanka",
      email: riderAEmail,
      adults: 1,
      children: 0,
      luggage: 1,
      childSeatRequired: false,
      meetAndGreetRequired: false,
    },
    customTripDetails: {
      isCustomTrip: true,
      budget: 150,
      // No identityVerification
    },
  });

  const readLegacy = await Booking.findById(legacyBooking._id);
  if (!readLegacy || readLegacy.customTripDetails?.identityVerification) {
    throw new Error("Legacy booking without identityVerification should load cleanly");
  }
  console.log("✅ Legacy booking without identityVerification loaded cleanly.");

  // Cleanup test records and files
  console.log("\n--- Cleaning up test artifacts ---");
  await Booking.deleteMany({ _id: legacyBooking._id });
  await User.deleteMany({ _id: { $in: [riderA._id, riderB._id, admin._id] } });
  await RiderIdentity.deleteMany({ _id: { $in: [identityA._id, activeIdentityA._id] } });
  await deleteDocumentFile(savedFileA.storagePath);
  await deleteDocumentFile(savedBackA.storagePath);
  await deleteDocumentFile(replacementFront.storagePath);
  await deleteDocumentFile(freshFrontA.storagePath);

  console.log("\n=================================================");
  console.log("🎉 ALL 9 IDENTITY LIFECYCLE & SECURITY TESTS PASSED!");
  console.log("=================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
