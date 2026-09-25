import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const packages = await Package.find({ driverId: (session.user as any).id }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ data: packages }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching driver packages:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const data = await req.json();

    const newPackage = await Package.create({
      ...data,
      driverId: (session.user as any).id,
      status: "DRAFT",
    });

    return NextResponse.json({ data: newPackage, message: "Package draft created" }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating package:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
