import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import PackageEnquiry from "@/models/PackageEnquiry";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await req.json();
    if (!text || text.trim() === "") {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    await dbConnect();
    const { id } = await params;
    
    const enquiry = await PackageEnquiry.findById(id);
    if (!enquiry) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const role = (session.user as any).role;
    
    // Determine if the user is the rider or driver of this enquiry
    let sender: "RIDER" | "DRIVER" | null = null;
    
    if (enquiry.riderId.toString() === userId) {
      sender = "RIDER";
    } else if (enquiry.driverId.toString() === userId) {
      sender = "DRIVER";
    }

    if (!sender) {
      return NextResponse.json({ error: "Unauthorized access to this enquiry" }, { status: 403 });
    }

    const newMsg = {
      sender,
      text: text.trim(),
      createdAt: new Date(),
    };

    // Add message
    enquiry.messages.push(newMsg);

    // Update unread status and overall status if needed
    if (sender === "RIDER") {
      enquiry.driverUnread = true;
      if (enquiry.status === "ENQUIRY" || enquiry.status === "QUOTE_SENT") {
        enquiry.status = "DISCUSSING";
      }
    } else {
      enquiry.riderUnread = true;
      if (enquiry.status === "ENQUIRY") {
        enquiry.status = "DISCUSSING";
      }
    }

    enquiry.updatedAt = new Date();
    await enquiry.save();

    const recipientId = sender === "RIDER" ? enquiry.driverId.toString() : enquiry.riderId.toString();

    // Broadcast chat message in realtime
    import("@/lib/realtime").then(({ broadcastChatMessage }) => {
      broadcastChatMessage(enquiry._id.toString(), newMsg, recipientId, {
        riderUnread: enquiry.riderUnread,
        driverUnread: enquiry.driverUnread,
        status: enquiry.status,
      });
    }).catch(console.error);

    // Notification logic
    import("@/lib/notifications").then(async ({ sendNotification }) => {
      const link = sender === "RIDER" ? `/driver/enquiries/${enquiry._id}` : `/my-bookings/enquiries/${enquiry._id}`;
      await sendNotification({
        recipientId,
        type: "NEW_MESSAGE",
        title: "New Message",
        message: `You have a new message regarding a package enquiry.`,
        link,
        resourceId: enquiry._id.toString(),
        deduplicationKey: `chat_msg_${enquiry._id.toString()}_${Date.now()}`
      });
    }).catch(console.error);

    return NextResponse.json({ success: true, message: "Message sent", data: newMsg });

  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
