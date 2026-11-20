import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import VehicleType from "@/models/VehicleType";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const packages = await Package.find({ driverId: (session.user as any).id })
      .populate("vehicleTypeId", "name maxPassengers maxLuggage")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ data: packages }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching driver packages:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const data = await req.json();

    const driverId = (session.user as any).id;
    const requestedStatus = data.status === "PENDING_REVIEW" ? "PENDING_REVIEW" : "DRAFT";

    // Validate vehicle type if provided
    let vehicleTypeId = data.vehicleTypeId;
    if (vehicleTypeId) {
      const validVehicle = await VehicleType.findById(vehicleTypeId);
      if (validVehicle && data.maxPassengers > validVehicle.maxPassengers) {
        return NextResponse.json(
          { error: `Maximum passengers (${data.maxPassengers}) exceeds the selected vehicle capacity (${validVehicle.maxPassengers}).` },
          { status: 400 }
        );
      }
      if (!validVehicle) {
        // Fallback to first available active vehicle type
        const fallback = await VehicleType.findOne({ isActive: true });
        if (fallback) vehicleTypeId = fallback._id;
      }
    } else {
      const fallback = await VehicleType.findOne({ isActive: true });
      if (fallback) vehicleTypeId = fallback._id;
    }

    // Server-side validation when submitting for review
    if (requestedStatus === "PENDING_REVIEW") {
      if (!data.title?.trim()) {
        return NextResponse.json({ error: "Package title is required." }, { status: 400 });
      }
      if (!data.coverPhoto?.trim()) {
        return NextResponse.json({ error: "A cover photo is required before submitting for review." }, { status: 400 });
      }
      if (!data.startingCity?.trim()) {
        return NextResponse.json({ error: "Starting city is required." }, { status: 400 });
      }
      if (!data.days || data.days < 1) {
        return NextResponse.json({ error: "Tour duration must be at least 1 day." }, { status: 400 });
      }
      if (!data.costs?.basePrice || data.costs.basePrice <= 0) {
        return NextResponse.json({ error: "Please specify a valid base price." }, { status: 400 });
      }
    }

    const newPackage = await Package.create({
      ...data,
      driverId,
      vehicleTypeId,
      status: requestedStatus,
      revision: 1,
      reviewHistory: requestedStatus === "PENDING_REVIEW" ? [{
        action: "SUBMIT",
        actorId: driverId,
        actorRole: "DRIVER",
        actorName: (session.user as any).name || "Driver",
        timestamp: new Date(),
        revision: 1
      }] : []
    });

    // Notify admins on submission
    if (requestedStatus === "PENDING_REVIEW") {
      const driverName = (session.user as any).name || "A driver";
      import("@/lib/notifications").then(async ({ notifyAdmins }) => {
        await notifyAdmins({
          type: "PACKAGE_SUBMITTED",
          title: "New Travel Package Submitted",
          message: `${driverName} submitted a new package "${newPackage.title}" for review.`,
          link: `/admin/packages/${newPackage._id.toString()}`,
          deduplicationKey: `pkg_submit_${newPackage._id.toString()}_r1`
        });
      }).catch(console.error);

      import("@/lib/realtime").then((rt: any) => {
        if (typeof rt.broadcastPackageSubmitted === "function") {
          rt.broadcastPackageSubmitted(newPackage);
        }
      }).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      data: newPackage,
      message: requestedStatus === "PENDING_REVIEW" 
        ? "Package submitted for admin review successfully." 
        : "Package draft saved successfully."
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating package:", error);
    return NextResponse.json({ error: error.message || "Failed to create package." }, { status: 500 });
  }
}
