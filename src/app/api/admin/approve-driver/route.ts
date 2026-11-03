import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { driverId, isApproved } = await request.json();

    if (!driverId) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 });
    }

    await dbConnect();
    const updatedDriver = await User.findByIdAndUpdate(
      driverId, 
      { isApproved }, 
      { new: true }
    );

    if (!updatedDriver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    import("@/lib/notifications").then(async ({ sendNotification }) => {
      await sendNotification({
        recipientId: updatedDriver._id.toString(),
        type: isApproved ? "DRIVER_APPROVED" : "DRIVER_REJECTED",
        title: isApproved ? "Application Approved" : "Application Needs Attention",
        message: isApproved 
          ? "Congratulations! Your driver application has been approved." 
          : "Your driver application was reviewed but requires corrections.",
        link: `/profile`,
        deduplicationKey: `driver_approval_${updatedDriver._id.toString()}_${Date.now()}`
      });
    }).catch(console.error);

    import("@/lib/realtime").then(async ({ updateDriverApproval }) => {
      await updateDriverApproval(updatedDriver._id.toString(), isApproved);
    }).catch(console.error);

    return NextResponse.json({ message: "Driver approval status updated" }, { status: 200 });
  } catch (error: any) {
    console.error("Admin approval error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
