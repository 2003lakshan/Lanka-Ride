import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  const users = await db.collection("users").find({}).toArray();
  console.log("Users in DB:");
  for (const u of users) {
    console.log(`- ${u.email} (${u.role}, approved: ${u.isApproved})`);
  }

  // Ensure admin password is known
  const adminHash = await bcrypt.hash("admin123", 10);
  await db.collection("users").updateOne(
    { email: "admin@lankaairportride.com" },
    { $set: { password: adminHash, role: "ADMIN" } },
    { upsert: false }
  );
  console.log("Admin password confirmed: admin123");

  // Ensure driver password is known
  const driverHash = await bcrypt.hash("driver123", 10);
  await db.collection("users").updateMany(
    { role: "DRIVER" },
    {
      $set: {
        password: driverHash,
        vehicleCategory: "Car",
        isOnline: true,
        isApproved: true,
        currentLat: 6.9271,
        currentLng: 79.8612,
        locationUpdatedAt: new Date(),
      },
    }
  );
  console.log("All drivers confirmed with password driver123, vehicleCategory: Car, online & fresh location");

  // Ensure tourist password is known
  const touristHash = await bcrypt.hash("tourist123", 10);
  const tourist = await db.collection("users").findOne({ role: "TOURIST" });
  if (tourist) {
    await db.collection("users").updateOne(
      { _id: tourist._id },
      { $set: { password: touristHash } }
    );
    console.log(`Tourist password confirmed for ${tourist.email}: tourist123`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
