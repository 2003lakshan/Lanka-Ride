import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function verifyWhatsAppWorkflow() {
  console.log("==================================================================");
  console.log("💬 VERIFYING WHATSAPP CLICK-TO-CHAT WORKFLOW & MESSAGE PREPARATION");
  console.log("==================================================================");

  const { normalizeWhatsAppPhone, buildWhatsAppLink } = await import("../src/lib/whatsapp");
  const { default: dbConnect } = await import("../src/lib/mongodb");
  const { default: Booking } = await import("../src/models/Booking");
  const { default: Package } = await import("../src/models/Package");
  const { default: User } = await import("../src/models/User");
  const { encode } = await import("next-auth/jwt");

  await dbConnect();
  console.log("✓ Connected to MongoDB");

  // --------------------------------------------------------------------------
  // 1. Phone Normalization Tests
  // --------------------------------------------------------------------------
  console.log("\n[Test 1: Phone Normalization]");

  const testCases = [
    { input: "077 123 4567", country: "Sri Lanka", expectedDigits: "94771234567" },
    { input: "+94 77 222 3344", country: "LK", expectedDigits: "94772223344" },
    { input: "0772223344", country: null, expectedDigits: "94772223344" },
    { input: "+44 7700 900123", country: "United Kingdom", expectedDigits: "447700900123" },
    { input: "07700 900123", country: "United Kingdom", expectedDigits: "447700900123" },
    { input: "+1 (202) 555-0123", country: "US", expectedDigits: "12025550123" },
    { input: "invalid text", country: null, shouldBeValid: false }
  ];

  for (const tc of testCases) {
    const res = normalizeWhatsAppPhone(tc.input, tc.country);
    if (tc.expectedDigits) {
      if (res.digits !== tc.expectedDigits || !res.isValid) {
        throw new Error(`Normalization failed for "${tc.input}" (hint: ${tc.country}): expected ${tc.expectedDigits}, got ${res.digits}`);
      }
      console.log(`✓ "${tc.input}" (${tc.country || "none"}) -> digits: ${res.digits}, formatted: ${res.formatted}`);
    } else if (tc.shouldBeValid === false) {
      if (res.isValid) {
        throw new Error(`Expected invalid phone for "${tc.input}", but got valid.`);
      }
      console.log(`✓ "${tc.input}" correctly identified as invalid (requiresCorrection: true)`);
    }
  }

  // --------------------------------------------------------------------------
  // 2. Click-to-chat URL Generation
  // --------------------------------------------------------------------------
  console.log("\n[Test 2: Click-to-Chat URL Generation]");
  const sampleLink = buildWhatsAppLink("94771234567", "Hello At Your Service!");
  console.log("Sample wa.me Link:", sampleLink);
  if (!sampleLink.startsWith("https://wa.me/94771234567?text=") || !sampleLink.includes("Hello%20At%20Your%20Service!")) {
    throw new Error("Invalid wa.me link generated!");
  }
  console.log("✓ Official click-to-chat link format verified.");

  // --------------------------------------------------------------------------
  // 3. Server-side API Authorization & Message Preparation
  // --------------------------------------------------------------------------
  console.log("\n[Test 3: Server API & Security Enforcement]");
  const secret = process.env.NEXTAUTH_SECRET || "default_local_dev_secret_replace_in_prod";
  const baseUrl = "http://localhost:3000";

  // A. Non-admin unauthorized attempt
  const touristUser = await User.findOne({ role: "TOURIST" });
  if (touristUser) {
    const touristToken = {
      name: touristUser.name,
      email: touristUser.email,
      role: "TOURIST",
      sub: touristUser._id.toString(),
      id: touristUser._id.toString(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    };
    const touristCookie = `next-auth.session-token=${await encode({ token: touristToken, secret })}`;

    const unauthorizedRes = await fetch(`${baseUrl}/api/whatsapp/prepare`, {
      method: "POST",
      headers: {
        Cookie: touristCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "BOOKING_ACKNOWLEDGEMENT",
        bookingId: "6ab4a54ed60d93fd3bd6c312"
      })
    });

    console.log(`Non-admin attempting admin action -> HTTP Status: ${unauthorizedRes.status}`);
    if (unauthorizedRes.status !== 401) {
      throw new Error(`Expected HTTP 401 for non-admin user on admin action, got ${unauthorizedRes.status}`);
    }
    console.log("✓ Server correctly rejected non-admin with HTTP 401 Unauthorized.");
  }

  // B. Admin authorization
  const adminUser = await User.findOne({ role: "ADMIN" });
  if (!adminUser) throw new Error("No admin user found");
  const adminToken = {
    name: adminUser.name || "Administrator",
    email: adminUser.email,
    role: "ADMIN",
    sub: adminUser._id.toString(),
    id: adminUser._id.toString(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400
  };
  const adminCookie = `next-auth.session-token=${await encode({ token: adminToken, secret })}`;

  // Find sample bookings
  const sampleBookingWithDriver = await Booking.findOne({ driverId: { $exists: true, $ne: null } });
  const sampleBooking = sampleBookingWithDriver || await Booking.findOne({});
  if (!sampleBooking) throw new Error("No sample booking found in MongoDB");
  const bookingId = sampleBooking._id.toString();

  // Test 3B-1: Booking Acknowledgement
  const ackRes = await fetch(`${baseUrl}/api/whatsapp/prepare`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "BOOKING_ACKNOWLEDGEMENT",
      bookingId
    })
  });
  const ackData = await ackRes.json();
  console.log(`\n[Test 3B-1: Booking Acknowledgement] Status: ${ackRes.status}`);
  console.log("Recipient:", ackData.recipientName, `(${ackData.phone?.formatted})`);
  console.log("Message Preview:\n", ackData.message);

  if (ackRes.status !== 200 || !ackData.message.includes("At Your Service – Powered by Pexora")) {
    throw new Error("Failed to prepare Booking Acknowledgement message");
  }
  console.log("✓ Booking Acknowledgement prepared successfully with branding and actual data.");

  // Test 3B-2: Booking Confirmation
  const confRes = await fetch(`${baseUrl}/api/whatsapp/prepare`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "BOOKING_CONFIRMATION",
      bookingId
    })
  });
  const confData = await confRes.json();
  console.log(`\n[Test 3B-2: Booking Confirmation] Status: ${confRes.status}`);
  console.log("Message Preview:\n", confData.message);
  if (confRes.status !== 200 || !confData.message.includes("CONFIRMED")) {
    throw new Error("Failed to prepare Booking Confirmation message");
  }
  console.log("✓ Booking Confirmation prepared successfully.");

  // Test 3B-3: Notify Assigned Driver (if sample booking has driver)
  if (sampleBookingWithDriver) {
    const driverRes = await fetch(`${baseUrl}/api/whatsapp/prepare`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "NOTIFY_ASSIGNED_DRIVER",
        bookingId: sampleBookingWithDriver._id.toString()
      })
    });
    const driverData = await driverRes.json();
    console.log(`\n[Test 3B-3: Notify Assigned Driver] Status: ${driverRes.status}`);
    console.log("Driver Recipient:", driverData.recipientName, `(${driverData.phone?.formatted})`);
    console.log("Message Preview:\n", driverData.message);
    if (driverRes.status !== 200 || !driverData.message.includes("assigned to an upcoming trip")) {
      throw new Error("Failed to prepare Notify Assigned Driver message");
    }
    console.log("✓ Notify Assigned Driver message prepared successfully.");

    // Test 3B-4: Notify Traveller About Driver Assignment
    const travRes = await fetch(`${baseUrl}/api/whatsapp/prepare`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "NOTIFY_TRAVELLER_ASSIGNMENT",
        bookingId: sampleBookingWithDriver._id.toString()
      })
    });
    const travData = await travRes.json();
    console.log(`\n[Test 3B-4: Notify Traveller of Driver Assignment] Status: ${travRes.status}`);
    console.log("Traveller Recipient:", travData.recipientName, `(${travData.phone?.formatted})`);
    console.log("Message Preview:\n", travData.message);
    if (travRes.status !== 200 || !travData.message.includes("driver has been assigned")) {
      throw new Error("Failed to prepare Notify Traveller message");
    }
    console.log("✓ Notify Traveller of Driver message prepared successfully.");
  }

  // Test 3B-5: Package Approval & Changes Requested
  const samplePkg = await Package.findOne({});
  if (samplePkg) {
    const pkgApprovalRes = await fetch(`${baseUrl}/api/whatsapp/prepare`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "PACKAGE_APPROVAL",
        packageId: samplePkg._id.toString()
      })
    });
    const pkgApprovalData = await pkgApprovalRes.json();
    console.log(`\n[Test 3B-5: Package Approval Notification] Status: ${pkgApprovalRes.status}`);
    console.log("Message Preview:\n", pkgApprovalData.message);
    if (pkgApprovalRes.status !== 200 || !pkgApprovalData.message.includes("APPROVED & PUBLISHED")) {
      throw new Error("Failed to prepare Package Approval message");
    }
    console.log("✓ Package Approval notification prepared successfully.");
  }

  // Test 3B-6: Customer Support Chat
  const supportRes = await fetch(`${baseUrl}/api/whatsapp/prepare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "CUSTOMER_SUPPORT",
      bookingId
    })
  });
  const supportData = await supportRes.json();
  console.log(`\n[Test 3B-6: Customer Support Message] Status: ${supportRes.status}`);
  console.log("Support Recipient:", supportData.recipientName, `(${supportData.phone?.formatted})`);
  console.log("Message Preview:\n", supportData.message);
  if (supportRes.status !== 200 || !supportData.message.includes("At Your Service Support")) {
    throw new Error("Failed to prepare Customer Support message");
  }
  console.log("✓ Customer Support message prepared successfully.");

  // Test 3B-7: Audit Log Endpoint
  const logRes = await fetch(`${baseUrl}/api/whatsapp/log`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      actionType: "BOOKING_ACKNOWLEDGEMENT",
      recipientName: "Test Traveller",
      recipientPhone: "94771234567",
      bookingRef: sampleBooking.bookingReference
    })
  });
  const logData = await logRes.json();
  console.log(`\n[Test 3B-7: Audit Log Action] Status: ${logRes.status}`);
  console.log("Response:", logData);
  if (logRes.status !== 200 || logData.observedAction !== "WhatsApp link opened") {
    throw new Error("Failed to log observed WhatsApp action");
  }
  console.log("✓ Audit log recorded observed action cleanly without marking delivered/read.");

  console.log("\n=======================================================");
  console.log("🎉 ALL WHATSAPP WORKFLOW VERIFICATIONS PASSED 100%!");
  console.log("=======================================================");

  const mongoose = await import("mongoose");
  await mongoose.disconnect();
}

verifyWhatsAppWorkflow().catch(async (e) => {
  console.error("Verification failed:", e);
  const mongoose = await import("mongoose");
  await mongoose.disconnect();
  process.exit(1);
});

