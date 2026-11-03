import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import PickMeCategory from "@/models/PickMeCategory";
import { ensurePickMeCategories } from "@/lib/pickMeSeeder";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 401 });
    }

    await dbConnect();
    const categories = await ensurePickMeCategories();
    return NextResponse.json({ success: true, categories }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch PickMe pricing error:", error);
    return NextResponse.json({ error: error.message || "Failed to load vehicle pricing." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 401 });
    }

    const body = await request.json();
    const { category, baseFare, ratePerKm, minimumFare, isActive } = body;

    if (!category) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }

    // Validate numeric values
    const numBase = Number(baseFare);
    const numRate = Number(ratePerKm);
    const numMin = Number(minimumFare);

    if (isNaN(numBase) || numBase < 0) {
      return NextResponse.json({ error: "Base fare must be a positive number." }, { status: 400 });
    }

    if (isNaN(numRate) || numRate < 0) {
      return NextResponse.json({ error: "Rate per km must be a positive number." }, { status: 400 });
    }

    if (isNaN(numMin) || numMin < 0) {
      return NextResponse.json({ error: "Minimum fare must be a positive number." }, { status: 400 });
    }

    await dbConnect();
    await ensurePickMeCategories();

    const updated = await PickMeCategory.findOneAndUpdate(
      { category },
      {
        $set: {
          baseFare: numBase,
          ratePerKm: numRate,
          minimumFare: numMin,
          isActive: Boolean(isActive),
        },
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: `Category "${category}" not found.` }, { status: 404 });
    }

    const allCategories = await PickMeCategory.find().sort({ sortOrder: 1 }).lean();

    return NextResponse.json({
      success: true,
      message: `Updated pricing for ${updated.displayName} successfully.`,
      updatedCategory: updated,
      categories: allCategories,
    });
  } catch (error: any) {
    console.error("Update PickMe pricing error:", error);
    return NextResponse.json({ error: error.message || "Failed to save pricing changes." }, { status: 500 });
  }
}
