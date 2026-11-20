import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import PackageEnquiry from "@/models/PackageEnquiry";
import Package from "@/models/Package";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { packageId } = await req.json();

    if (!packageId) {
      return NextResponse.json({ error: "Package ID is required" }, { status: 400 });
    }

    await dbConnect();

    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    if (pkg.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Enquiries are only permitted on active, published packages." }, { status: 400 });
    }

    // Check if an active enquiry already exists
    const existingEnquiry = await PackageEnquiry.findOne({
      riderId: (session.user as any).id,
      packageId: packageId,
      status: { $in: ['ENQUIRY', 'DISCUSSING', 'QUOTE_SENT', 'CHANGES_REQUESTED'] }
    });

    if (existingEnquiry) {
      return NextResponse.json({ success: true, enquiryId: existingEnquiry._id });
    }

    const newEnquiry = await PackageEnquiry.create({
      riderId: (session.user as any).id,
      driverId: pkg.driverId,
      packageId: packageId,
      status: 'ENQUIRY',
      messages: [{
        sender: 'RIDER',
        text: 'I am interested in this package and would like to know more details.',
        createdAt: new Date()
      }]
    });

    // Realtime notification to package driver owner
    const riderName = (session.user as any).name || "A rider";
    const packageTitle = pkg.title || "Tour Package";

    import("@/lib/realtime").then(({ broadcastPackageEnquirySubmitted }) => {
      broadcastPackageEnquirySubmitted(newEnquiry, pkg.driverId.toString(), {
        packageTitle,
        riderName,
      });
    }).catch(console.error);

    import("@/lib/notifications").then(async ({ sendNotification }) => {
      await sendNotification({
        recipientId: pkg.driverId.toString(),
        type: "PACKAGE_ENQUIRY_SUBMITTED",
        title: "New Package Request",
        message: `${riderName} submitted a request for your package "${packageTitle}".`,
        link: `/driver/enquiries/${newEnquiry._id}`,
        resourceId: newEnquiry._id.toString(),
        deduplicationKey: `pkg_enquiry_${newEnquiry._id.toString()}`
      });
    }).catch(console.error);

    return NextResponse.json({ success: true, enquiryId: newEnquiry._id });

  } catch (error: any) {
    console.error("Error creating package enquiry:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
