import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ensurePickMeCategories } from "@/lib/pickMeSeeder";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const categories = await ensurePickMeCategories();
    return NextResponse.json({ success: true, categories }, { status: 200 });
  } catch (err: any) {
    console.error("Fetch PickMe categories error:", err);
    return NextResponse.json({ error: "Failed to load vehicle categories." }, { status: 500 });
  }
}
