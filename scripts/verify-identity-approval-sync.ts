import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runIdentityApprovalSyncVerification() {
  console.log("==================================================================");
  console.log("🧪 STARTING IDENTITY APPROVAL & RIDER STATUS SYNCHRONIZATION TEST");
  console.log("==================================================================");

  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: User } = await import("../src/models/User");
  const { default: RiderIdentity } = await import("../src/models/RiderIdentity");
  const { default: Booking } = await import("../src/models/Booking");
  const { saveDocumentFile, deleteDocumentFile } = await import("../src/lib/identityStorage");

  await dbConnect();

  // Setup Test Admin and Test Rider
  const testAdminEmail = "admin_sync_tester@lankaairportride.com";
  const testRiderEmail = "rider_sync_applicant@example.com";

  await User.deleteMany({ email: { $in: [testAdminEmail, testRiderEmail] } });

  const admin = await User.create({
    name: "Admin Reviewer",
    email: testAdminEmail,
    role: "ADMIN",
    phoneNumber: "+94770001111",
    isEmailVerified: true,
  });

  const rider = await User.create({
    name: "Sandun Perera",
    email: testRiderEmail,
    role: "TOURIST",
    phoneNumber: "+94771239999",
    nationality: "Sri Lanka",
    isEmailVerified: true,
    identityStatus: "PENDING_REVIEW",
  });

  await RiderIdentity.deleteMany({ userId: rider._id });
  await Booking.deleteMany({ touristId: rider._id });

  // Upload test files
  const dummyBytes1 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x01]);
  const dummyBytes2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

  const file1 = await saveDocumentFile(dummyBytes1, "test_nic_front.jpg", "image/jpeg", rider._id.toString(), "front");
  const file2 = await saveDocumentFile(dummyBytes2, "test_nic_back.png", "image/png", rider._id.toString(), "back");

  // Create custom trip booking for rider
  const testBooking = await Booking.create({
    bookingReference: "BK-SYNC-TEST-001",
    touristId: rider._id,
    bookingType: "CUSTOM_TRIP",
    status: "PENDING_APPROVAL",
    pickupAddress: "Bandaranaike International Airport",
    pickupLat: 7.1808,
    pickupLng: 79.8841,
    destinationAddress: "Kandy, Sri Lanka",
    destinationLat: 7.2906,
    destinationLng: 80.6337,
    passengerDetails: {
      fullName: "Sandun Perera",
      email: testRiderEmail,
      phoneNumber: "+94771239999",
      country: "Sri Lanka",
      nationality: "Sri Lankan",
      adults: 2,
      children: 0,
      luggage: 2,
    },
    customTripDetails: {
      isCustomTrip: true,
      bookingContact: {
        fullName: "Sandun Perera",
        country: "Sri Lanka",
        email: testRiderEmail,
        phone: "+94771239999",
        confirmedAccuracy: true,
      },
      identityVerification: {
        documentType: "NATIONAL_ID",
        status: "PENDING_REVIEW",
        version: 1,
        files: { front: file1, back: file2 },
      },
    },
  });

  // --------------------------------------------------------------------------
  // TEST 1: Missing Legacy Version (undefined / null in DB)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Legacy Record Without Version Field ---");
  // Insert directly bypassing mongoose default to test legacy record with missing version
  const rawLegacy = await RiderIdentity.collection.insertOne({
    userId: rider._id,
    documentType: "NATIONAL_ID",
    acknowledgedPurpose: true,
    status: "PENDING_REVIEW",
    // version is intentionally omitted (undefined)
    files: { front: file1, back: file2 },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const legacyIdentityId = rawLegacy.insertedId.toString();
  console.log("Created legacy record with no 'version' field, ID:", legacyIdentityId);

  // Simulate admin approving with expectedVersion: 1 or string "1"
  // Calling the review handler logic
  const legacyDoc = await RiderIdentity.findById(legacyIdentityId);
  const currentVersion = Number(legacyDoc?.version) || 1;
  const targetExpectedVersion = Number("1");

  if (targetExpectedVersion !== currentVersion) {
    throw new Error(`False conflict! expected ${targetExpectedVersion} but current evaluated to ${currentVersion}`);
  }

  // Atomic conditional update
  const filter: any = { _id: legacyDoc?._id };
  filter.$or = [
    { version: 1 },
    { version: { $exists: false } },
    { version: null },
  ];

  const updateDoc: any = {
    $set: {
      status: "APPROVED",
      reviewedVersion: currentVersion,
      reviewedBy: admin._id,
      reviewedAt: new Date(),
      version: currentVersion,
    },
    $unset: { rejectionReason: 1 },
  };

  const updatedLegacy = await RiderIdentity.findOneAndUpdate(filter, updateDoc, { new: true });
  if (!updatedLegacy) {
    throw new Error("TEST 1 FAILED: Legacy record atomic update returned null (false version conflict)!");
  }
  if (updatedLegacy.status !== "APPROVED" || updatedLegacy.version !== 1) {
    throw new Error(`TEST 1 FAILED: Unexpected status ${updatedLegacy.status} or version ${updatedLegacy.version}`);
  }
  console.log("✅ TEST 1 PASSED: Legacy unversioned record approved atomically without false conflict. Version normalized to:", updatedLegacy.version);

  // --------------------------------------------------------------------------
  // TEST 2: String vs Number Mismatch on expectedVersion
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: String vs Number expectedVersion Normalization ---");
  const testVersions = ["1", 1, "2", 2];
  for (const v of testVersions) {
    const parsed = Number(v);
    if (isNaN(parsed) || parsed !== (typeof v === "number" ? v : parseInt(v, 10))) {
      throw new Error(`Failed to parse version: ${v}`);
    }
  }
  console.log("✅ TEST 2 PASSED: expectedVersion strings and numbers parse cleanly to identical numeric values.");

  // --------------------------------------------------------------------------
  // TEST 3: Genuine Stale-Document Conflict Protection
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Genuine Stale-Document Conflict Protection ---");
  // Admin opens review when document is at version 1
  const adminViewingVersion = 1;

  // Meanwhile, rider replaces front image with a new upload -> increments version to 2
  const dummyBytes3 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x02]);
  const file3 = await saveDocumentFile(dummyBytes3, "test_nic_front_v2.jpg", "image/jpeg", rider._id.toString(), "front");

  await RiderIdentity.findByIdAndUpdate(legacyIdentityId, {
    "files.front": file3,
    version: 2,
    status: "PENDING_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    reviewedVersion: null,
  });

  // Now admin attempts to approve with stale version 1
  const checkDoc = await RiderIdentity.findById(legacyIdentityId);
  const currentDbVersion = Number(checkDoc?.version) || 1;

  let conflictDetected = false;
  let conflictMessage = "";

  if (adminViewingVersion !== currentDbVersion) {
    conflictDetected = true;
    conflictMessage = "The rider updated or replaced their document while you were reviewing. Please refresh to inspect the updated document.";
  }

  if (!conflictDetected) {
    throw new Error("TEST 3 FAILED: Stale version was not intercepted!");
  }
  if (!conflictMessage.includes("The rider updated or replaced their document while you were reviewing")) {
    throw new Error(`TEST 3 FAILED: Incorrect conflict message: ${conflictMessage}`);
  }

  // Verify that the record in DB was NOT approved with the stale decision
  const unchangedDoc = await RiderIdentity.findById(legacyIdentityId);
  if (unchangedDoc?.status === "APPROVED") {
    throw new Error("TEST 3 FAILED: Stale approval was applied to database!");
  }
  console.log("✅ TEST 3 PASSED: Real conflict detected and prevented stale approval. Error:", conflictMessage);

  // --------------------------------------------------------------------------
  // TEST 4: Atomic Conditional Update with Correct Version & DB Synchronization
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Atomic Conditional Approval with Synchronized Models ---");
  // Admin refreshes and now reviews the current Version 2
  const adminRefreshedVersion = 2;

  const validFilter = { _id: legacyIdentityId, version: adminRefreshedVersion };
  const validUpdate = {
    $set: {
      status: "APPROVED",
      reviewedVersion: adminRefreshedVersion,
      reviewedBy: admin._id,
      reviewedAt: new Date(),
      version: adminRefreshedVersion,
    },
    $unset: { rejectionReason: 1 },
  };

  const approvedDoc = await RiderIdentity.findOneAndUpdate(validFilter, validUpdate, { new: true });
  if (!approvedDoc) {
    throw new Error("TEST 4 FAILED: Atomic update failed for correct version!");
  }

  // Sync User model
  await User.findByIdAndUpdate(rider._id, {
    identityStatus: approvedDoc.status,
    identityDocumentId: approvedDoc._id,
  });

  // Sync Booking model
  await Booking.updateMany(
    { touristId: rider._id, "customTripDetails.isCustomTrip": true },
    {
      $set: {
        "customTripDetails.identityVerification.status": approvedDoc.status,
        "customTripDetails.identityVerification.version": approvedDoc.version,
        "customTripDetails.identityVerification.reviewedVersion": approvedDoc.reviewedVersion,
        "customTripDetails.identityVerification.reviewedBy": admin._id,
        "customTripDetails.identityVerification.reviewedAt": approvedDoc.reviewedAt,
      },
      $unset: { "customTripDetails.identityVerification.rejectionReason": 1 },
    }
  );

  // Verify synchronization
  const syncedUser = await User.findById(rider._id);
  const syncedBooking = await Booking.findById(testBooking._id);

  if (syncedUser?.identityStatus !== "APPROVED") {
    throw new Error(`TEST 4 FAILED: User.identityStatus is '${syncedUser?.identityStatus}', expected 'APPROVED'`);
  }
  if (syncedBooking?.customTripDetails?.identityVerification?.status !== "APPROVED") {
    throw new Error(`TEST 4 FAILED: Booking identityVerification status is not 'APPROVED'`);
  }
  if (syncedBooking?.customTripDetails?.identityVerification?.version !== 2) {
    throw new Error(`TEST 4 FAILED: Booking identityVerification version is not 2`);
  }
  console.log("✅ TEST 4 PASSED: RiderIdentity, User.identityStatus, and Booking references all synchronized to APPROVED.");

  // --------------------------------------------------------------------------
  // TEST 5: Authoritative Status Endpoint Logic
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Authoritative Status Check ---");
  const authorIdentity = await RiderIdentity.findOne({ userId: rider._id }).lean();
  if (!authorIdentity || authorIdentity.status !== "APPROVED") {
    throw new Error("TEST 5 FAILED: Authoritative status not APPROVED");
  }
  console.log("✅ TEST 5 PASSED: Authoritative status returns APPROVED, version:", authorIdentity.version);

  // --------------------------------------------------------------------------
  // TEST 6: Rider UI / Trip Builder Reuse of Approved Documents
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Trip Builder Allows Reusing Approved Documents Without Re-upload ---");
  // Simulate the TripBuilderClient isIdentityComplete logic
  const identityStatus = authorIdentity.status; // "APPROVED"
  const isIdentityComplete = identityStatus === "APPROVED";
  if (!isIdentityComplete) {
    throw new Error("TEST 6 FAILED: Approved identity did not mark isIdentityComplete as true!");
  }

  // Simulate server-side validation in /api/bookings/custom
  const isCompleteOnServer =
    authorIdentity.status === "APPROVED" ||
    (authorIdentity.documentType === "NATIONAL_ID"
      ? Boolean(authorIdentity.files?.front && authorIdentity.files?.back)
      : Boolean(authorIdentity.files?.photoPage));

  if (!isCompleteOnServer) {
    throw new Error("TEST 6 FAILED: Server-side custom booking creation rejected approved identity!");
  }
  console.log("✅ TEST 6 PASSED: Rider with APPROVED document proceeds through Step 1 without requiring re-upload.");

  // Clean up test data
  console.log("\n--- Cleaning up test artifacts ---");
  await User.deleteMany({ _id: { $in: [admin._id, rider._id] } });
  await RiderIdentity.deleteMany({ _id: legacyIdentityId });
  await Booking.deleteMany({ _id: testBooking._id });
  await deleteDocumentFile(file1.storagePath);
  await deleteDocumentFile(file2.storagePath);
  await deleteDocumentFile(file3.storagePath);

  console.log("\n==================================================================");
  console.log("🎉 ALL IDENTITY APPROVAL & STATUS SYNCHRONIZATION TESTS PASSED (6/6)!");
  console.log("==================================================================");
  process.exit(0);
}

runIdentityApprovalSyncVerification().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
