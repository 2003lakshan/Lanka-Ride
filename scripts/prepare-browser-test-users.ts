import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  const riderEmail = "browser_rider@example.com";
  const driverEmail = "browser_driver@example.com";
  const adminEmail = "admin@lankaairportride.com";

  const riderHash = await bcrypt.hash("rider123", 10);
  const driverHash = await bcrypt.hash("driver123", 10);
  const adminHash = await bcrypt.hash("admin123", 10);

  // Upsert Rider
  await db.collection("users").updateOne(
    { email: riderEmail },
    {
      $set: {
        name: "Browser Test Rider",
        email: riderEmail,
        password: riderHash,
        role: "TOURIST",
        isEmailVerified: true,
        phoneNumber: "+94771234567",
        nationality: "Sri Lanka",
        identityStatus: "APPROVED",
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  const riderUser = await db.collection("users").findOne({ email: riderEmail });

  // Ensure RiderIdentity approved record exists so Step 1 in TripBuilder can proceed without needing file upload
  await db.collection("rideridentities").updateOne(
    { userId: riderUser!._id },
    {
      $set: {
        userId: riderUser!._id,
        documentType: "NATIONAL_ID",
        status: "APPROVED",
        version: 1,
        files: {
          front: {
            fileId: "browser_test_front_file_id",
            originalName: "nic_front.jpg",
            mimeType: "image/jpeg",
            size: 204800,
            storagePath: "private/documents/browser_test_front.jpg",
          },
          back: {
            fileId: "browser_test_back_file_id",
            originalName: "nic_back.jpg",
            mimeType: "image/jpeg",
            size: 204800,
            storagePath: "private/documents/browser_test_back.jpg",
          },
        },
        uploadedAt: new Date(),
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // Upsert Driver
  await db.collection("users").updateOne(
    { email: driverEmail },
    {
      $set: {
        name: "Browser Test Driver",
        email: driverEmail,
        password: driverHash,
        role: "DRIVER",
        isApproved: true,
        isEmailVerified: true,
        isOnline: true,
        vehicleCategory: "Car",
        currentLat: 6.9271,
        currentLng: 79.8612,
        locationUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // Upsert Admin
  await db.collection("users").updateOne(
    { email: adminEmail },
    {
      $set: {
        name: "Admin Reviewer",
        email: adminEmail,
        password: adminHash,
        role: "ADMIN",
        isEmailVerified: true,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // Clean old test bookings for this rider
  await db.collection("bookings").deleteMany({ touristId: riderUser!._id });

  console.log("✅ Browser test accounts prepared successfully:");
  console.log(`- Rider:  ${riderEmail} / rider123 (APPROVED identity)`);
  console.log(`- Driver: ${driverEmail} / driver123 (Approved, Online)`);
  console.log(`- Admin:  ${adminEmail} / admin123 (ADMIN)`);

  await mongoose.disconnect();
}

main().catch(console.error);

