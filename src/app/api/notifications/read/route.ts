import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { notificationId, markAll } = await request.json();

    await dbConnect();

    if (markAll) {
      await Notification.updateMany(
        { recipientId: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );

      import("@/lib/realtime").then(({ broadcastNotificationRead }) => {
        broadcastNotificationRead(userId, { markAll: true, unreadCount: 0 });
      }).catch(() => {});

      return NextResponse.json({ message: "All marked as read" });
    }

    if (notificationId) {
      // Validate access to this notification
      const notif = await Notification.findOneAndUpdate(
        { _id: notificationId, recipientId: userId },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true }
      );

      if (!notif) {
        return NextResponse.json({ error: "Notification not found or unauthorized" }, { status: 404 });
      }

      const unreadCount = await Notification.countDocuments({
        recipientId: userId,
        isRead: false,
      });

      import("@/lib/realtime").then(({ broadcastNotificationRead }) => {
        broadcastNotificationRead(userId, { readId: notificationId, unreadCount });
      }).catch(() => {});

      return NextResponse.json({ message: "Marked as read" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err: any) {
    console.error("Mark notification read error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
