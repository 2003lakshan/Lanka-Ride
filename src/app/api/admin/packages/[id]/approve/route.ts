import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
    }

    const { id } = await params;
    const adminId = (session.user as any).id;
    const adminName = (session.user as any).name || "Administrator";

    const body = await request.json();
    const { action, status, feedback, reason, expectedRevision, affectedSections, affectedFields } = body;

    // Support both direct status strings and action verbs
    let targetStatus: string;
    let reviewAction: "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "ARCHIVE" | "RESTORE";

    if (action === "APPROVE" || status === "PUBLISHED") {
      targetStatus = "PUBLISHED";
      reviewAction = "APPROVE";
    } else if (action === "REQUEST_CHANGES" || status === "CHANGES_REQUESTED") {
      targetStatus = "CHANGES_REQUESTED";
      reviewAction = "REQUEST_CHANGES";
    } else if (action === "REJECT" || status === "REJECTED") {
      targetStatus = "REJECTED";
      reviewAction = "REJECT";
    } else if (action === "ARCHIVE" || status === "ARCHIVED") {
      targetStatus = "ARCHIVED";
      reviewAction = "ARCHIVE";
    } else if (action === "RESTORE") {
      targetStatus = "RESTORE";
      reviewAction = "RESTORE";
    } else {
      return NextResponse.json(
        { error: "Invalid action. Expected APPROVE, REQUEST_CHANGES, REJECT, ARCHIVE, or RESTORE." },
        { status: 400 }
      );
    }

    // Validate mandatory feedback/reasons
    if (reviewAction === "REQUEST_CHANGES" && (!feedback || !feedback.trim())) {
      return NextResponse.json(
        { error: "Mandatory change request feedback is required." },
        { status: 400 }
      );
    }

    if (reviewAction === "REJECT" && (!reason || !reason.trim())) {
      return NextResponse.json(
        { error: "A mandatory rejection reason is required." },
        { status: 400 }
      );
    }

    await dbConnect();
    const pkg = await Package.findById(id);

    if (!pkg) {
      return NextResponse.json({ error: "Package not found." }, { status: 404 });
    }

    // Stale revision concurrency check
    if (typeof expectedRevision === "number" && pkg.revision !== expectedRevision) {
      return NextResponse.json(
        {
          error: "The driver updated or resubmitted this package while you were reviewing. Please refresh to inspect the updated revision.",
          currentRevision: pkg.revision,
          conflict: true
        },
        { status: 409 }
      );
    }

    const currentRevision = pkg.revision || 1;
    const note = reviewAction === "REQUEST_CHANGES" ? feedback.trim() : reviewAction === "REJECT" ? reason.trim() : "";

    const reviewLog = {
      action: reviewAction,
      feedback: note,
      actorId: adminId,
      actorRole: "ADMIN",
      actorName: adminName,
      timestamp: new Date(),
      revision: currentRevision
    };

    if (reviewAction === "RESTORE") {
      targetStatus = (pkg.approvedRevision && pkg.approvedRevision === currentRevision) ? "PUBLISHED" : "DRAFT";
    }

    pkg.status = targetStatus;
    pkg.reviewHistory = pkg.reviewHistory || [];
    pkg.reviewHistory.push(reviewLog as any);

    if (reviewAction === "APPROVE") {
      pkg.approvedRevision = currentRevision;
      pkg.changeRequest = undefined;
      pkg.rejectionReason = "";
    } else if (reviewAction === "REQUEST_CHANGES") {
      const affected = Array.isArray(affectedSections)
        ? affectedSections
        : Array.isArray(affectedFields)
        ? affectedFields
        : [];
      pkg.changeRequest = {
        feedback: note,
        affectedFields: affected,
        requestedAt: new Date(),
        requestedBy: adminId,
        requestedByName: adminName,
        revision: currentRevision
      };
    } else if (reviewAction === "REJECT") {
      pkg.rejectionReason = note;
    }

    await pkg.save();

    // Notify driver of decision
    const driverId = pkg.driverId.toString();
    const packageTitle = pkg.title;

    import("@/lib/notifications").then(async ({ sendNotification }) => {
      let notifTitle = "";
      let notifMessage = "";

      if (reviewAction === "APPROVE") {
        notifTitle = "Package Approved & Published! 🎉";
        notifMessage = `Your travel package "${packageTitle}" has been approved by admin and is now live for travellers to book.`;
      } else if (reviewAction === "REQUEST_CHANGES") {
        notifTitle = "Changes Requested on Package";
        const sectionsNote = pkg.changeRequest?.affectedFields && pkg.changeRequest.affectedFields.length > 0
          ? ` [Sections: ${pkg.changeRequest.affectedFields.join(", ")}]`
          : "";
        notifMessage = `Admin requested adjustments on your package "${packageTitle}"${sectionsNote}: ${note}`;
      } else if (reviewAction === "ARCHIVE") {
        notifTitle = "Package Archived";
        notifMessage = `Your travel package "${packageTitle}" has been archived by administrator.`;
      } else if (reviewAction === "RESTORE") {
        notifTitle = "Package Restored";
        notifMessage = `Your travel package "${packageTitle}" has been restored to ${targetStatus} by administrator.`;
      } else {
        notifTitle = "Package Review Rejected";
        notifMessage = `Your travel package "${packageTitle}" was rejected: ${note}`;
      }

      await sendNotification({
        recipientId: driverId,
        type: reviewAction === "APPROVE" ? "PACKAGE_APPROVED" : "PACKAGE_CHANGES_REQUESTED",
        title: notifTitle,
        message: notifMessage,
        link: `/driver/packages/${pkg._id.toString()}/edit`,
        resourceId: pkg._id.toString(),
        deduplicationKey: `pkg_decision_${pkg._id.toString()}_r${currentRevision}_${reviewAction}`
      });
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: reviewAction === "APPROVE" 
        ? "Package approved and published successfully." 
        : reviewAction === "REQUEST_CHANGES" 
        ? "Change request sent to the driver." 
        : "Package rejected.",
      data: {
        id: pkg._id,
        status: pkg.status,
        revision: pkg.revision,
        approvedRevision: pkg.approvedRevision
      }
    });
  } catch (error: any) {
    console.error("Package review decision error:", error);
    return NextResponse.json({ error: error.message || "Failed to process review decision." }, { status: 500 });
  }
}
