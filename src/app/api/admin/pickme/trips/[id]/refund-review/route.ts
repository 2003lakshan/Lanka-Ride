import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 401 });
    }

    const { id } = await params;
    const { action, notes } = await request.json().catch(() => ({}));

    if (!["RESOLVE", "REFUND"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'RESOLVE' or 'REFUND'." },
        { status: 400 }
      );
    }

    await dbConnect();
    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (action === "REFUND") {
      booking.refundReviewStatus = "REFUNDED";
      booking.paymentStatus = "REFUNDED";
    } else {
      booking.refundReviewStatus = "RESOLVED";
    }

    if (notes) {
      booking.adminNotes = {
        ...(booking.adminNotes || {}),
        refundReviewNotes: notes,
        reviewedBy: (session.user as any)?.name || "Admin",
        reviewedAt: new Date().toISOString(),
      };
    }

    await booking.save();

    return NextResponse.json({
      success: true,
      message: `Refund review marked as ${booking.refundReviewStatus}.`,
      booking,
    });
  } catch (error: any) {
    console.error("Refund review resolution error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update refund review status." },
      { status: 500 }
    );
  }
}
