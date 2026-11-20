import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/whatsapp/log
 * Records an observed user action (e.g. "WhatsApp link opened").
 * Note: Never marks a message as sent, delivered, or read.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { actionType, recipientName, recipientPhone, bookingRef, timestamp } = body;

    const actor = session?.user?.name || (session?.user as any)?.role || "User";

    console.log(
      `[WhatsApp Action Observed] ${actor} opened click-to-chat link: type=${actionType}, recipient=${recipientName} (${recipientPhone}), bookingRef=${bookingRef || "N/A"} at ${timestamp || new Date().toISOString()}`
    );

    return NextResponse.json({
      success: true,
      logged: true,
      observedAction: "WhatsApp link opened"
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

