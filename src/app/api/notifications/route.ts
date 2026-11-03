import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const userId = (session.user as any).id;

    await dbConnect();
    
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipientId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ recipientId: userId }),
      Notification.countDocuments({ recipientId: userId, isRead: false })
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (err: any) {
    console.error("Fetch notifications error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    await dbConnect();

    const url = new URL(request.url);
    const clearAllParam = url.searchParams.get("clearAll");
    const idParam = url.searchParams.get("id");

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional if query params are provided
    }

    const clearAll = clearAllParam === "true" || body.clearAll === true;
    const notificationId = idParam || body.notificationId;

    if (clearAll) {
      await Notification.deleteMany({ recipientId: userId });

      import("@/lib/realtime").then(({ emitRealtimeEvent }) => {
        emitRealtimeEvent({
          target: { toUser: userId.toString() },
          event: "notification:updated",
          data: { clearAll: true, unreadCount: 0 },
        });
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "All notifications cleared successfully.",
        unreadCount: 0,
      });
    }

    if (notificationId) {
      const deleted = await Notification.findOneAndDelete({
        _id: notificationId,
        recipientId: userId,
      });

      if (!deleted) {
        return NextResponse.json(
          { error: "Notification not found or unauthorized." },
          { status: 404 }
        );
      }

      const unreadCount = await Notification.countDocuments({
        recipientId: userId,
        isRead: false,
      });

      import("@/lib/realtime").then(({ emitRealtimeEvent }) => {
        emitRealtimeEvent({
          target: { toUser: userId.toString() },
          event: "notification:updated",
          data: { deletedId: notificationId, unreadCount },
        });
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Notification removed.",
        deletedId: notificationId,
        unreadCount,
      });
    }

    return NextResponse.json(
      { error: "Provide notificationId or set clearAll to true." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Delete notification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
