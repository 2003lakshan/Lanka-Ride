import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride");
  const db = mongoose.connection.db!;
  const user = await db.collection("users").findOne({ email: "browser_rider@example.com" });
  if (user) {
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { isEmailVerified: true, emailVerifiedAt: new Date() } }
    );
    await db.collection("contactverifications").updateOne(
      { userId: user._id, type: "EMAIL", target: "browser_rider@example.com" },
      { $set: { userId: user._id, type: "EMAIL", target: "browser_rider@example.com", verifiedAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
    console.log("✅ User and ContactVerification updated for browser_rider@example.com");
  }
  await mongoose.disconnect();
}

main().catch(console.error);

