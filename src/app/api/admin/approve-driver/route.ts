import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { driverId, isApproved } = await request.json();

    if (!driverId) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 });
    }

    await dbConnect();
    const updatedDriver = await User.findByIdAndUpdate(
      driverId, 
      { isApproved }, 
      { new: true }
    );

    if (!updatedDriver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Driver approval status updated" }, { status: 200 });
  } catch (error: any) {
    console.error("Admin approval error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
