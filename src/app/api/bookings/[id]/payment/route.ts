import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "TOURIST") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const { id } = await params;
    
    const booking = await Booking.findOne({ _id: id, touristId: (session.user as any).id });
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "Invalid booking status" }, { status: 400 });
    }

    booking.paymentStatus = "PAID";
    booking.status = "PENDING_ADMIN_CONFIRMATION";
    await booking.save();

    // Broadcast payment confirmation to admin dashboard (remains hidden from drivers)
    import("@/lib/realtime").then(({ broadcastPaymentVerified }) => {
      broadcastPaymentVerified(booking);
    }).catch(console.error);

    import("@/lib/notifications").then(async ({ notifyAdmins }) => {
      await notifyAdmins({
        type: "PAYMENT_RECEIVED",
        title: "Payment Received",
        message: `Payment received for booking ${booking.bookingReference} — ${booking.customTripDetails?.confirmedAmount || 'Amount'} ${booking.customTripDetails?.confirmedCurrency || ''}. Awaiting final confirmation.`,
        link: `/admin/trips`,
        deduplicationKey: `payment_received_${booking._id.toString()}`
      });
    }).catch(console.error);

    return NextResponse.json({ success: true, booking });

  } catch (error: any) {
    console.error("Payment confirmation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
