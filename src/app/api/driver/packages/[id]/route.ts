import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import VehicleType from "@/models/VehicleType";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    await dbConnect();

    const pkg = await Package.findOne({ _id: id, driverId: (session.user as any).id })
      .populate("vehicleTypeId", "name maxPassengers maxLuggage")
      .lean();

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json({ data: pkg }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching package:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const driverId = (session.user as any).id;
    const driverName = (session.user as any).name || "Driver";

    await dbConnect();
    const existing = await Package.findOne({ _id: id, driverId });
    if (!existing) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const data = await req.json();

    // Check if toggling between PUBLISHED and PAUSED
    if (data.status === "PAUSED" && existing.status === "PUBLISHED") {
      existing.status = "PAUSED";
      await existing.save();
      return NextResponse.json({ success: true, data: existing, message: "Package paused." });
    }
    if (data.status === "PUBLISHED" && existing.status === "PAUSED") {
      existing.status = "PUBLISHED";
      await existing.save();
      return NextResponse.json({ success: true, data: existing, message: "Package resumed and published." });
    }

    // Vehicle capacity validation
    if (data.vehicleTypeId && data.maxPassengers) {
      const vType = await VehicleType.findById(data.vehicleTypeId);
      if (vType && data.maxPassengers > vType.maxPassengers) {
        return NextResponse.json(
          { error: `Maximum passengers (${data.maxPassengers}) exceeds selected vehicle capacity (${vType.maxPassengers}).` },
          { status: 400 }
        );
      }
    }

    const isSubmittingForReview = data.status === "PENDING_REVIEW";
    const currentRev = existing.revision || 1;
    const newRev = isSubmittingForReview ? currentRev + 1 : currentRev;

    // Build update object
    const updateData: any = {
      ...data,
      revision: newRev,
    };

    if (isSubmittingForReview) {
      updateData.status = "PENDING_REVIEW";
      const isResubmit = existing.status === "CHANGES_REQUESTED" || existing.status === "REJECTED";
      const actionType = isResubmit ? "RESUBMIT" : "SUBMIT";

      const reviewLog = {
        action: actionType,
        actorId: driverId,
        actorRole: "DRIVER",
        actorName: driverName,
        timestamp: new Date(),
        revision: newRev
      };

      updateData.$push = { reviewHistory: reviewLog };
      // Clear previous change request / rejection when resubmitting
      updateData.changeRequest = null;
      updateData.rejectionReason = "";

      // Notify admin
      import("@/lib/notifications").then(async ({ notifyAdmins }) => {
        await notifyAdmins({
          type: "PACKAGE_SUBMITTED",
          title: isResubmit ? "Package Changes Resubmitted" : "Package Submitted for Review",
          message: `${driverName} ${isResubmit ? "resubmitted revised package" : "submitted package"} "${existing.title}" (revision ${newRev}) for admin review.`,
          link: `/admin/packages/${existing._id.toString()}`,
          deduplicationKey: `pkg_submit_${existing._id.toString()}_r${newRev}`
        });
      }).catch(console.error);
    }

    // Execute update
    const updatedPackage = await Package.findOneAndUpdate(
      { _id: id, driverId },
      updateData,
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      data: updatedPackage,
      message: isSubmittingForReview ? "Package submitted for admin review successfully." : "Package updated successfully."
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating package:", error);
    return NextResponse.json({ error: error.message || "Failed to update package." }, { status: 500 });
  }
}
