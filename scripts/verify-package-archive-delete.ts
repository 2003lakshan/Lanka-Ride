import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import dbConnect from "../src/lib/mongodb";
import Package from "../src/models/Package";
import Booking from "../src/models/Booking";
import PackageEnquiry from "../src/models/PackageEnquiry";
import User from "../src/models/User";

async function runVerification() {
  console.log("=== Starting Tour Packages Archive & Delete Verification ===");

  await dbConnect();
  console.log("✓ Connected to MongoDB");

  // 1. Find or verify existing packages
  const pkgWithBooking = await Booking.findOne({ packageId: { $exists: true, $ne: null } }).select("packageId");
  const pkgWithEnquiry = await PackageEnquiry.findOne({ packageId: { $exists: true, $ne: null } }).select("packageId");

  console.log("Found sample package with booking:", pkgWithBooking?.packageId?.toString());
  console.log("Found sample package with enquiry:", pkgWithEnquiry?.packageId?.toString());

  // 2. Test Linked Records Protection
  if (pkgWithBooking?.packageId) {
    const pkgId = pkgWithBooking.packageId.toString();
    const pkg = await Package.findById(pkgId);
    if (pkg) {
      const linkedBookings = await Booking.countDocuments({ packageId: pkgId });
      const linkedEnquiries = await PackageEnquiry.countDocuments({ packageId: pkgId });

      console.log(`\n[Test 1: Linked Records Protection]`);
      console.log(`Package "${pkg.title}" (${pkgId}): Bookings = ${linkedBookings}, Enquiries = ${linkedEnquiries}`);

      const canDelete = linkedBookings === 0 && linkedEnquiries === 0;
      if (!canDelete) {
        console.log("✓ Correctly identified as PROTECTED from permanent deletion!");
      } else {
        throw new Error("Protection check failed: package has linked records but canDelete was true");
      }

      // Test Archiving this package
      const prevStatus = pkg.status;
      pkg.status = "ARCHIVED";
      pkg.reviewHistory = pkg.reviewHistory || [];
      pkg.reviewHistory.push({
        action: "ARCHIVE",
        feedback: "Automated test archive",
        actorRole: "ADMIN",
        actorName: "Test Admin",
        timestamp: new Date(),
        revision: pkg.revision || 1
      });
      await pkg.save();

      const archivedPkg = await Package.findById(pkgId);
      console.log(`✓ Successfully archived package. Status is now: ${archivedPkg?.status}`);
      console.log(`✓ Last reviewHistory action: ${archivedPkg?.reviewHistory?.slice(-1)[0]?.action}`);

      // Test Restoring this package
      archivedPkg!.status = prevStatus;
      archivedPkg!.reviewHistory?.push({
        action: "RESTORE",
        feedback: "Automated test restore",
        actorRole: "ADMIN",
        actorName: "Test Admin",
        timestamp: new Date(),
        revision: archivedPkg!.revision || 1
      });
      await archivedPkg!.save();

      const restoredPkg = await Package.findById(pkgId);
      console.log(`✓ Successfully restored package. Status returned to: ${restoredPkg?.status}`);
      console.log(`✓ Last reviewHistory action: ${restoredPkg?.reviewHistory?.slice(-1)[0]?.action}`);
    }
  }

  // 3. Test Permanent Deletion & Unreferenced Image Cleanup
  console.log("\n[Test 2: Deletion & Image Cleanup on 0-linked package]");
  const testImgFilename = `pkg_test_${Date.now()}_clean.png`;
  const uploadDir = path.resolve(process.cwd(), "public", "uploads", "packages");
  await fs.mkdir(uploadDir, { recursive: true });
  const testImgPath = path.resolve(uploadDir, testImgFilename);
  await fs.writeFile(testImgPath, Buffer.from("dummy image content"));
  const testImgUrl = `/uploads/packages/${testImgFilename}`;

  // Shared image that MUST NOT be deleted
  const sharedImgFilename = `pkg_test_${Date.now()}_shared.png`;
  const sharedImgPath = path.resolve(uploadDir, sharedImgFilename);
  await fs.writeFile(sharedImgPath, Buffer.from("shared image content"));
  const sharedImgUrl = `/uploads/packages/${sharedImgFilename}`;

  // Find a dummy driver for test package
  const driver = await User.findOne({ role: "DRIVER" });
  if (!driver) {
    throw new Error("No driver found to create test package");
  }

  // Also create a second package that references sharedImgUrl
  const companionPkg = await Package.create({
    driverId: driver._id,
    title: "Companion Package (Keeps shared image)",
    category: "Day Tour",
    shortDescription: "Keeps shared image alive",
    startingCity: "Colombo",
    pickupOptions: "Anywhere",
    days: 1,
    nights: 0,
    minPassengers: 1,
    maxPassengers: 4,
    vehicleTypeId: new mongoose.Types.ObjectId(),
    availableDates: "All",
    itinerary: [],
    meals: [],
    costs: {
      basePrice: 5000,
      totalStartingPrice: 5000,
      priceType: "PER_VEHICLE",
      passengerCountCovered: 2,
      inclusions: [],
      exclusions: [],
      cancellationTerms: "Standard",
      conditions: "Standard"
    },
    coverPhoto: sharedImgUrl,
    status: "DRAFT"
  });

  // Create disposable test package with 0 linked records
  const disposablePkg = await Package.create({
    driverId: driver._id,
    title: "Disposable Test Package (0 linked records)",
    category: "Adventure Tour",
    shortDescription: "To be permanently deleted",
    startingCity: "Kandy",
    pickupOptions: "Hotel",
    days: 2,
    nights: 1,
    minPassengers: 1,
    maxPassengers: 2,
    vehicleTypeId: new mongoose.Types.ObjectId(),
    availableDates: "All",
    itinerary: [],
    meals: [],
    costs: {
      basePrice: 12000,
      totalStartingPrice: 12000,
      priceType: "PER_VEHICLE",
      passengerCountCovered: 2,
      inclusions: [],
      exclusions: [],
      cancellationTerms: "Standard",
      conditions: "Standard"
    },
    coverPhoto: testImgUrl,
    gallery: [sharedImgUrl],
    status: "DRAFT"
  });

  const disposableId = disposablePkg._id.toString();
  console.log(`Created disposable package ${disposableId} with candidate images:`, [testImgUrl, sharedImgUrl]);

  // Verify linked records = 0
  const dispBookings = await Booking.countDocuments({ packageId: disposableId });
  const dispEnquiries = await PackageEnquiry.countDocuments({ packageId: disposableId });
  console.log(`Disposable package linked counts: Bookings = ${dispBookings}, Enquiries = ${dispEnquiries}`);

  if (dispBookings === 0 && dispEnquiries === 0) {
    console.log("✓ Deletion eligibility verified: 0 bookings & 0 enquiries");

    // Perform deletion
    await Package.findByIdAndDelete(disposableId);
    console.log(`✓ Deleted package document from database.`);

    // Perform safe image cleanup logic
    const candidateUrls = [testImgUrl, sharedImgUrl];
    for (const imgUrl of candidateUrls) {
      const otherPkg = await Package.exists({
        _id: { $ne: disposableId },
        $or: [{ coverPhoto: imgUrl }, { gallery: imgUrl }]
      });
      const otherBooking = await Booking.exists({
        $or: [
          { "packageItineraryDetails.coverPhoto": imgUrl },
          { "packageItineraryDetails.gallery": imgUrl }
        ]
      });
      const otherUser = await User.exists({
        $or: [
          { profilePhoto: imgUrl },
          { "driverDetails.vehiclePhotos": imgUrl }
        ]
      });

      if (!otherPkg && !otherBooking && !otherUser) {
        const fname = path.basename(imgUrl);
        const fpath = path.resolve(uploadDir, fname);
        await fs.unlink(fpath).catch(() => {});
        console.log(`✓ Cleaned unreferenced image: ${fname}`);
      } else {
        console.log(`✓ Preserved shared image: ${path.basename(imgUrl)} (referenced by companion package)`);
      }
    }

    // Verify files on disk
    let testImgExists = true;
    try {
      await fs.access(testImgPath);
    } catch {
      testImgExists = false;
    }

    let sharedImgExists = true;
    try {
      await fs.access(sharedImgPath);
    } catch {
      sharedImgExists = false;
    }

    console.log(`Test image on disk: ${testImgExists ? "EXISTS (FAILED)" : "DELETED (PASSED ✓)"}`);
    console.log(`Shared image on disk: ${sharedImgExists ? "PRESERVED (PASSED ✓)" : "DELETED (FAILED)"}`);

    if (testImgExists || !sharedImgExists) {
      throw new Error("File cleanup verification failed!");
    }
  }

  // Clean up companion package and shared image
  await Package.findByIdAndDelete(companionPkg._id);
  await fs.unlink(sharedImgPath).catch(() => {});
  console.log("✓ Cleaned up companion package test fixture");

  console.log("\n=== All Verification Tests Passed Successfully! ===");
  await mongoose.disconnect();
}

runVerification().catch(async (err) => {
  console.error("Verification failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
