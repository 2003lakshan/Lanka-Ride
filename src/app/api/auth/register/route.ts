import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { name, email, password, role, phoneNumber, nationality, licenseNumber, vehicleRegistration } = body;

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
      userData.isApproved = false;
    }

    const newUser = await User.create(userData);

    return NextResponse.json(
      { message: "User registered successfully", user: { id: newUser._id, email: newUser.email, role: newUser.role } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: error.message || "Failed to register" }, { status: 500 });
  }
}
