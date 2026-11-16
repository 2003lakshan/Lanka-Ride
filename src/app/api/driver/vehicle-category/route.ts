import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["Bike", "Three-wheeler", "Car", "Mini Van", "Van", "Lorry"];

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "DRIVER") {
      return NextResponse.json({ error: "Forbidden: Driver access only" }, { status: 403 });
    }

    const driverId = (session.user as any).id;
    const body = await request.json();
    const { vehicleCategory } = body;

    if (!vehicleCategory || !VALID_CATEGORIES.includes(vehicleCategory)) {
      return NextResponse.json(
        { error: `Invalid vehicle category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    await dbConnect();

    const updated = await User.findByIdAndUpdate(
      driverId,
      {
        $set: {
          vehicleCategory,
          "driverDetails.vehicleCategory": vehicleCategory,
        },
      },
      { new: true }
    ).select("name email vehicleCategory driverDetails");

    if (!updated) {
      return NextResponse.json({ error: "Driver account not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Vehicle category updated to ${vehicleCategory}`,
      vehicleCategory: updated.vehicleCategory,
    });
  } catch (error: any) {
    console.error("[Driver Vehicle Category Update Error]", error);
    return NextResponse.json({ error: error.message || "Failed to update category" }, { status: 500 });
  }
}
