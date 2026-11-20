import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import Booking from "@/models/Booking";
import PackageEnquiry from "@/models/PackageEnquiry";
import User from "@/models/User";
import { sendNotification, notifyAdmins } from "@/lib/notifications";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/packages/[id]
 * Checks linked bookings/enquiries and deletion eligibility
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const pkg = await Package.findById(id).populate("driverId", "name email phoneNumber");
    if (!pkg) {
      return NextResponse.json({ error: "Package not found." }, { status: 404 });
    }

    const linkedBookings = await Booking.countDocuments({ packageId: id });
    const linkedEnquiries = await PackageEnquiry.countDocuments({ packageId: id });

    return NextResponse.json({
      success: true,
      package: {
        _id: pkg._id.toString(),
        title: pkg.title,
        status: pkg.status,
        category: pkg.category,
        coverPhoto: pkg.coverPhoto,
        revision: pkg.revision || 1,
        driver: pkg.driverId
      },
      linkedBookings,
      linkedEnquiries,
      canDelete: linkedBookings === 0 && linkedEnquiries === 0,
      isArchived: pkg.status === "ARCHIVED"
    });
  } catch (error: any) {
    console.error("GET admin package error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch package details." }, { status: 500 });
  }
}

/**
 * POST or PATCH /api/admin/packages/[id]
 * Performs ARCHIVE or RESTORE actions
 */
async function handleStatusAction(
  request: Request,
  params: Promise<{ id: string }>
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
    }

    const { id } = await params;
    const adminId = (session.user as any).id;
    const adminName = (session.user as any).name || "Administrator";

    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["ARCHIVE", "RESTORE"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Expected ARCHIVE or RESTORE." }, { status: 400 });
    }

    await dbConnect();
    const pkg = await Package.findById(id);
    if (!pkg) {
      return NextResponse.json({ error: "Package not found." }, { status: 404 });
    }

    const currentRevision = pkg.revision || 1;

    if (action === "ARCHIVE") {
      if (pkg.status === "ARCHIVED") {
        return NextResponse.json({ error: "Package is already archived." }, { status: 400 });
      }

      pkg.status = "ARCHIVED";
      pkg.reviewHistory = pkg.reviewHistory || [];
      pkg.reviewHistory.push({
        action: "ARCHIVE",
        feedback: reason?.trim() || "Archived by Administrator",
        actorId: adminId,
        actorRole: "ADMIN",
        actorName: adminName,
        timestamp: new Date(),
        revision: currentRevision
      } as any);

      await pkg.save();

      // Notify driver
      await sendNotification({
        recipientId: pkg.driverId.toString(),
        type: "PACKAGE_ARCHIVED",
        title: "Travel Package Archived",
        message: `Your package "${pkg.title}" has been archived by admin and hidden from traveller listings.`,
        link: `/driver/packages`,
        resourceId: id,
        deduplicationKey: `pkg_archived_${id}_r${currentRevision}`
      }).catch(console.error);

      // Audit notify admins
      await notifyAdmins({
        type: "PACKAGE_ARCHIVED",
        title: "Package Archived",
        message: `Admin ${adminName} archived package "${pkg.title}" (Ref: ${id}).`,
        resourceId: id,
        deduplicationKey: `admin_pkg_archived_${id}_r${currentRevision}`
      }).catch(console.error);

      return NextResponse.json({
        success: true,
        message: `Package "${pkg.title}" archived successfully.`,
        status: "ARCHIVED"
      });
    }

    if (action === "RESTORE") {
      if (pkg.status !== "ARCHIVED") {
        return NextResponse.json({ error: "Package is not archived." }, { status: 400 });
      }

      // Restore to PUBLISHED if it had been previously approved at this revision, else DRAFT
      const restoredStatus = (pkg.approvedRevision && pkg.approvedRevision === currentRevision)
        ? "PUBLISHED"
        : "DRAFT";

      pkg.status = restoredStatus;
      pkg.reviewHistory = pkg.reviewHistory || [];
      pkg.reviewHistory.push({
        action: "RESTORE",
        feedback: reason?.trim() || `Restored by Administrator to ${restoredStatus}`,
        actorId: adminId,
        actorRole: "ADMIN",
        actorName: adminName,
        timestamp: new Date(),
        revision: currentRevision
      } as any);

      await pkg.save();

      // Notify driver
      await sendNotification({
        recipientId: pkg.driverId.toString(),
        type: "PACKAGE_RESTORED",
        title: "Travel Package Restored",
        message: `Your package "${pkg.title}" has been restored to ${restoredStatus} by administrator.`,
        link: `/driver/packages`,
        resourceId: id,
        deduplicationKey: `pkg_restored_${id}_r${currentRevision}`
      }).catch(console.error);

      // Audit notify admins
      await notifyAdmins({
        type: "PACKAGE_RESTORED",
        title: "Package Restored",
        message: `Admin ${adminName} restored package "${pkg.title}" to ${restoredStatus} (Ref: ${id}).`,
        resourceId: id,
        deduplicationKey: `admin_pkg_restored_${id}_r${currentRevision}`
      }).catch(console.error);

      return NextResponse.json({
        success: true,
        message: `Package "${pkg.title}" restored successfully to ${restoredStatus}.`,
        status: restoredStatus
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error: any) {
    console.error("Package status action error:", error);
    return NextResponse.json({ error: error.message || "Failed to update package." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleStatusAction(request, params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleStatusAction(request, params);
}

/**
 * DELETE /api/admin/packages/[id]
 * Permanently deletes package ONLY if it has 0 linked bookings and 0 enquiries.
 * Also cleans up unreferenced package images from /uploads/packages.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
    }

    const { id } = await params;
    const adminName = (session.user as any).name || "Administrator";

    await dbConnect();
    const pkg = await Package.findById(id);
    if (!pkg) {
      return NextResponse.json({ error: "Package not found." }, { status: 404 });
    }

    // 1. Linked records check: Protect existing bookings and enquiries
    const linkedBookings = await Booking.countDocuments({ packageId: id });
    const linkedEnquiries = await PackageEnquiry.countDocuments({ packageId: id });

    if (linkedBookings > 0 || linkedEnquiries > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete package "${pkg.title}". It has ${linkedBookings} booking(s) and ${linkedEnquiries} enquiry/enquiries. Archiving is recommended to preserve booking history and snapshot integrity.`,
          linkedBookings,
          linkedEnquiries,
          canDelete: false
        },
        { status: 400 }
      );
    }

    // 2. Identify candidate local images owned by this package
    const candidateUrls: string[] = [];
    if (pkg.coverPhoto && typeof pkg.coverPhoto === "string" && pkg.coverPhoto.startsWith("/uploads/packages/")) {
      candidateUrls.push(pkg.coverPhoto);
    }
    if (Array.isArray(pkg.gallery)) {
      for (const item of pkg.gallery) {
        if (typeof item === "string" && item.startsWith("/uploads/packages/")) {
          candidateUrls.push(item);
        }
      }
    }
    const uniqueCandidateUrls = Array.from(new Set(candidateUrls));

    // 3. Delete the package document from MongoDB
    const deletedPkg = await Package.findByIdAndDelete(id);
    if (!deletedPkg) {
      return NextResponse.json({ error: "Package could not be deleted." }, { status: 500 });
    }

    // 4. Safely clean up unreferenced local images
    const uploadDir = path.resolve(process.cwd(), "public", "uploads", "packages");
    const cleanedImages: string[] = [];
    const preservedImages: string[] = [];

    for (const imgUrl of uniqueCandidateUrls) {
      // Check if referenced elsewhere in any other package
      const otherPkgExists = await Package.exists({
        _id: { $ne: id },
        $or: [{ coverPhoto: imgUrl }, { gallery: imgUrl }]
      });

      // Check if referenced in any Booking
      const bookingExists = await Booking.exists({
        $or: [
          { "packageItineraryDetails.coverPhoto": imgUrl },
          { "packageItineraryDetails.gallery": imgUrl }
        ]
      });

      // Check if referenced in any User (profile or vehicle photos)
      const userExists = await User.exists({
        $or: [
          { profilePhoto: imgUrl },
          { "driverDetails.vehiclePhotos": imgUrl }
        ]
      });

      if (!otherPkgExists && !bookingExists && !userExists) {
        try {
          const filename = path.basename(imgUrl);
          const fullPath = path.resolve(uploadDir, filename);

          // Path traversal safeguard: Ensure path stays strictly inside uploadDir
          if (fullPath.startsWith(uploadDir)) {
            await fs.unlink(fullPath).catch(() => {});
            cleanedImages.push(imgUrl);
          }
        } catch (fileErr) {
          console.warn("Failed to delete unreferenced package image file:", imgUrl, fileErr);
        }
      } else {
        preservedImages.push(imgUrl);
      }
    }

    // 5. Audit history notification to all admins
    await notifyAdmins({
      type: "PACKAGE_DELETED",
      title: "Package Permanently Deleted",
      message: `Admin ${adminName} permanently deleted package "${pkg.title}" (Ref: ${id}). Cleaned ${cleanedImages.length} unreferenced image file(s).`,
      resourceId: id,
      deduplicationKey: `pkg_deleted_${id}_${Date.now()}`
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: `Package "${pkg.title}" was permanently deleted.`,
      deletedId: id,
      cleanedImages,
      preservedImages
    });
  } catch (error: any) {
    console.error("DELETE admin package error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete package." }, { status: 500 });
  }
}

