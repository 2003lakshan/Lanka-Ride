import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function verifyEndpoints() {
  console.log("=== Testing Tour Package Admin APIs & UI Routes ===");

  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: Package } = await import("../src/models/Package");
  const { default: User } = await import("../src/models/User");
  const { default: Booking } = await import("../src/models/Booking");
  const { encode } = await import("next-auth/jwt");

  await dbConnect();
  console.log("✓ Connected to MongoDB");

  const secret = process.env.NEXTAUTH_SECRET || "default_local_dev_secret_replace_in_prod";
  const adminUser = await User.findOne({ role: "ADMIN" });
  if (!adminUser) throw new Error("No admin user found");

  const token = {
    name: adminUser.name || "Administrator",
    email: adminUser.email,
    role: "ADMIN",
    sub: adminUser._id.toString(),
    id: adminUser._id.toString(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  };

  const sessionToken = await encode({ token, secret });
  const adminCookie = `next-auth.session-token=${sessionToken}`;
  const baseUrl = "http://localhost:3000";

  // 1. Test Admin Packages List Page
  console.log("\n[Test 1: Admin Packages Page HTTP Render]");
  const pageRes = await fetch(`${baseUrl}/admin/packages`, {
    headers: { Cookie: adminCookie }
  });
  console.log(`GET /admin/packages -> Status: ${pageRes.status}`);
  if (pageRes.status !== 200) throw new Error("Failed to load /admin/packages");
  const pageHtml = await pageRes.text();
  if (!pageHtml.includes("Tour Packages") || !pageHtml.includes("Archived (")) {
    throw new Error("Page does not contain expected Tour Packages or Archived filter tab");
  }
  console.log("✓ /admin/packages renders cleanly with 'Archived' filter tab");

  // 2. Test Admin Packages Archived Filter Page
  console.log("\n[Test 2: Admin Packages Archived Filter Tab]");
  const archivedFilterRes = await fetch(`${baseUrl}/admin/packages?status=ARCHIVED`, {
    headers: { Cookie: adminCookie }
  });
  console.log(`GET /admin/packages?status=ARCHIVED -> Status: ${archivedFilterRes.status}`);
  if (archivedFilterRes.status !== 200) throw new Error("Failed to load /admin/packages?status=ARCHIVED");
  console.log("✓ Archived filter view renders successfully");

  // 3. Test GET /api/admin/packages/[id] on package with linked booking
  console.log("\n[Test 3: Protection on package with bookings]");
  const sampleBooking = await Booking.findOne({ packageId: { $exists: true, $ne: null } });
  if (!sampleBooking || !sampleBooking.packageId) throw new Error("No sample booking with packageId found");
  const linkedPkgId = sampleBooking.packageId.toString();

  const getDetailsRes = await fetch(`${baseUrl}/api/admin/packages/${linkedPkgId}`, {
    headers: { Cookie: adminCookie }
  });
  console.log(`GET /api/admin/packages/${linkedPkgId} -> Status: ${getDetailsRes.status}`);
  const detailsData = await getDetailsRes.json();
  console.log("Response:", detailsData);
  if (!detailsData.success || detailsData.canDelete !== false || detailsData.linkedBookings < 1) {
    throw new Error("API failed to report linked bookings or false canDelete");
  }
  console.log("✓ Server correctly flagged package as non-deletable (canDelete: false)");

  // 4. Test DELETE /api/admin/packages/[id] on package with linked booking
  console.log("\n[Test 4: Rejection of DELETE on protected package]");
  const deleteBlockedRes = await fetch(`${baseUrl}/api/admin/packages/${linkedPkgId}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie }
  });
  console.log(`DELETE /api/admin/packages/${linkedPkgId} -> Status: ${deleteBlockedRes.status}`);
  const deleteBlockedData = await deleteBlockedRes.json();
  console.log("Response:", deleteBlockedData);
  if (deleteBlockedRes.status !== 400 || !deleteBlockedData.error.includes("Cannot delete package")) {
    throw new Error("Server failed to reject deletion with HTTP 400");
  }
  console.log("✓ Server properly rejected permanent deletion with HTTP 400 and clear explanation");

  // 5. Test POST /api/admin/packages/[id] (ARCHIVE)
  console.log("\n[Test 5: Archive Package Action]");
  const archiveRes = await fetch(`${baseUrl}/api/admin/packages/${linkedPkgId}`, {
    method: "POST",
    headers: { 
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "ARCHIVE", reason: "Automated test archive" })
  });
  console.log(`POST /api/admin/packages/${linkedPkgId} (ARCHIVE) -> Status: ${archiveRes.status}`);
  const archiveData = await archiveRes.json();
  console.log("Response:", archiveData);
  if (archiveRes.status !== 200 || archiveData.status !== "ARCHIVED") {
    throw new Error("Failed to archive package via API");
  }

  // Check traveller view: package must NOT appear in /packages
  const travellerRes = await fetch(`${baseUrl}/packages`);
  const travellerHtml = await travellerRes.text();
  if (travellerHtml.includes(detailsData.package.title)) {
    throw new Error("Archived package is still visible on public /packages page!");
  }
  console.log("✓ Package archived and successfully hidden from traveller discovery page /packages");

  // 6. Test POST /api/admin/packages/[id] (RESTORE)
  console.log("\n[Test 6: Restore Package Action]");
  const restoreRes = await fetch(`${baseUrl}/api/admin/packages/${linkedPkgId}`, {
    method: "POST",
    headers: { 
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "RESTORE", reason: "Automated test restore" })
  });
  console.log(`POST /api/admin/packages/${linkedPkgId} (RESTORE) -> Status: ${restoreRes.status}`);
  const restoreData = await restoreRes.json();
  console.log("Response:", restoreData);
  if (restoreRes.status !== 200 || restoreData.status !== "PUBLISHED") {
    throw new Error("Failed to restore package via API");
  }
  console.log("✓ Package successfully restored to PUBLISHED");

  // 7. Test Permanent Deletion on 0-linked package with image cleanup
  console.log("\n[Test 7: Permanent Deletion on 0-linked package via DELETE endpoint]");
  const testImgFilename = `pkg_api_test_${Date.now()}.png`;
  const uploadDir = path.resolve(process.cwd(), "public", "uploads", "packages");
  const testImgPath = path.resolve(uploadDir, testImgFilename);
  await fs.writeFile(testImgPath, Buffer.from("image file to be cleaned"));
  const testImgUrl = `/uploads/packages/${testImgFilename}`;

  const disposablePkg = await Package.create({
    driverId: adminUser._id,
    title: "API Deletion Candidate Package",
    category: "Beach Tour",
    shortDescription: "Will be permanently deleted by API",
    startingCity: "Galle",
    pickupOptions: "Anywhere",
    days: 1,
    nights: 0,
    minPassengers: 1,
    maxPassengers: 2,
    vehicleTypeId: new (await import("mongoose")).Types.ObjectId(),
    availableDates: "All",
    itinerary: [],
    meals: [],
    costs: {
      basePrice: 4000,
      totalStartingPrice: 4000,
      priceType: "PER_VEHICLE",
      passengerCountCovered: 2,
      inclusions: [],
      exclusions: [],
      cancellationTerms: "Standard",
      conditions: "Standard"
    },
    coverPhoto: testImgUrl,
    status: "DRAFT"
  });

  const dispId = disposablePkg._id.toString();
  console.log(`Created disposable package ${dispId} with image ${testImgUrl}`);

  // Call DELETE endpoint
  const deleteSuccessRes = await fetch(`${baseUrl}/api/admin/packages/${dispId}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie }
  });
  console.log(`DELETE /api/admin/packages/${dispId} -> Status: ${deleteSuccessRes.status}`);
  const deleteSuccessData = await deleteSuccessRes.json();
  console.log("Response:", deleteSuccessData);
  if (deleteSuccessRes.status !== 200 || !deleteSuccessData.success) {
    throw new Error("DELETE endpoint failed to delete 0-linked package");
  }

  // Verify DB record is gone
  const dbCheck = await Package.findById(dispId);
  if (dbCheck) throw new Error("Package still exists in DB after deletion!");
  console.log("✓ Database record confirmed removed.");

  // Verify file is cleaned from disk
  let fileStillExists = true;
  try {
    await fs.access(testImgPath);
  } catch {
    fileStillExists = false;
  }
  if (fileStillExists) throw new Error("Unreferenced image was NOT cleaned from disk!");
  console.log("✓ Unreferenced image file confirmed removed from disk.");

  console.log("\n=======================================================");
  console.log("🎉 ALL API & UI ENDPOINT VERIFICATIONS PASSED 100%!");
  console.log("=======================================================");

  const mongoose = await import("mongoose");
  await mongoose.disconnect();
}

verifyEndpoints().catch(async (e) => {
  console.error("Endpoint verification failed:", e);
  const mongoose = await import("mongoose");
  await mongoose.disconnect();
  process.exit(1);
});
