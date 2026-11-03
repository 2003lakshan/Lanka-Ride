import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import PackageEnquiry from "@/models/PackageEnquiry";
import EnquiryChat from "@/components/packages/EnquiryChat";
import Link from "next/link";
import PackageSidebar from "@/components/packages/PackageSidebar";
import { ArrowLeft, Package as PackageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RiderEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  await dbConnect();

  const enquiry = await PackageEnquiry.findById(id)
    .populate("packageId")
    .populate("driverId", "name")
    .lean();

  if (!enquiry || enquiry.riderId.toString() !== (session.user as any).id) {
    return (
      <div className="bg-slate-50 min-h-screen py-20 flex justify-center text-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Enquiry Not Found</h1>
          <Link href="/my-bookings" className="text-blue-600 hover:underline">&larr; Back to Bookings</Link>
        </div>
      </div>
    );
  }

  // Mark rider messages as read
  if (enquiry.riderUnread) {
    await PackageEnquiry.findByIdAndUpdate(id, { riderUnread: false });
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-80px)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        <Link href="/my-bookings" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-semibold mb-2 transition-colors">
          <ArrowLeft size={16} /> Back to My Bookings
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <PackageIcon className="text-blue-600" /> Package Request
            </h1>
            <p className="text-slate-600 font-medium">Discussing changes for: {enquiry.packageId?.title}</p>
          </div>
          <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            {enquiry.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[600px]">
          
          <div className="lg:col-span-4 h-full">
            <PackageSidebar pkg={JSON.parse(JSON.stringify(enquiry.packageId))} isDriver={false} />
          </div>

          <div className="lg:col-span-8 h-full">
            <EnquiryChat 
              enquiryId={enquiry._id.toString()}
              initialMessages={enquiry.messages.map((m: any) => ({
                sender: m.sender,
                text: m.text,
                createdAt: m.createdAt.toISOString()
              }))}
              currentUserRole="RIDER"
              otherPartyName={enquiry.driverId?.name || "Driver"}
            />
          </div>
          
        </div>

      </div>
    </div>
  );
}
