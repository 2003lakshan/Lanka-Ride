import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { name, email, password, role, phoneNumber, nationality, licenseNumber, vehicleRegistration, driverDetails } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    email = email.toLowerCase().trim();

    await dbConnect();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData: any = {
      name,
      email,
      password: hashedPassword,
      role,
      phoneNumber,
      nationality,
    };

    if (role === "DRIVER") {
      if (!licenseNumber || !vehicleRegistration) {
         return NextResponse.json({ error: "License number and vehicle registration are required for drivers" }, { status: 400 });
      }
      userData.licenseNumber = licenseNumber;
      userData.vehicleRegistration = vehicleRegistration;
      userData.driverDetails = driverDetails;
      userData.isApproved = false;
    }

    const newUser = await User.create(userData);

    if (role === "DRIVER") {
      import("@/lib/notifications").then(async ({ sendNotification, notifyAdmins }) => {
        await sendNotification({
          recipientId: newUser._id.toString(),
          type: "REGISTRATION_RECEIVED",
          title: "Registration Received",
          message: `Your driver application has been received and is pending admin review.`,
          link: `/profile`,
          deduplicationKey: `driver_reg_${newUser._id.toString()}`
        });
        await notifyAdmins({
          type: "NEW_DRIVER_APPLICATION",
          title: "New Driver Application",
          message: `Driver ${newUser.name} has registered and requires approval.`,
          link: `/admin/approvals`,
          deduplicationKey: `admin_driver_reg_${newUser._id.toString()}`
        });
      }).catch(console.error);
    }

    return NextResponse.json(
      { message: "User registered successfully", user: { id: newUser._id, email: newUser.email, role: newUser.role } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: error.message || "Failed to register" }, { status: 500 });
  }
}
