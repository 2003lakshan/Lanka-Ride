import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import Package from "@/models/Package";
import { ChevronLeft } from "lucide-react";
import PackageFormStepManager from "@/components/driver/PackageFormStepManager";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "DRIVER") {
    redirect("/login");
  }

  const { id } = await params;
  await dbConnect();

  const pkg = await Package.findOne({
    _id: id,
    driverId: (session.user as any).id
  }).lean();

  if (!pkg) {
    notFound();
  }

  const serializedData = JSON.parse(JSON.stringify(pkg));

  return (
    <div className="bg-slate-50 min-h-screen py-10 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <Link
            href="/driver/packages"
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-bold mb-3 transition-colors"
          >
            <ChevronLeft size={16} /> Back to My Packages
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Edit Travel Package</h1>
              <p className="text-slate-600 text-sm mt-1">
                Update tour details, itinerary stops, pricing, or resubmit for administrator review.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Status:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                  pkg.status === "PUBLISHED"
                    ? "bg-emerald-100 text-emerald-800"
                    : pkg.status === "PENDING_REVIEW"
                    ? "bg-amber-100 text-amber-800"
                    : pkg.status === "CHANGES_REQUESTED"
                    ? "bg-orange-100 text-orange-800"
                    : pkg.status === "REJECTED"
                    ? "bg-rose-100 text-rose-800"
                    : pkg.status === "PAUSED"
                    ? "bg-slate-200 text-slate-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {pkg.status?.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        <PackageFormStepManager
          initialData={serializedData}
          packageId={id}
          isEdit={true}
        />
      </div>
    </div>
  );
}
