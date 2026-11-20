import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PackageFormStepManager from "@/components/driver/PackageFormStepManager";

export const dynamic = "force-dynamic";

export default async function CreatePackagePage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "DRIVER") {
    redirect("/login");
  }

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
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Travel Package</h1>
          <p className="text-slate-600 text-sm mt-1">
            Design an exclusive custom itinerary to showcase to tourists across Sri Lanka.
          </p>
        </div>

        <PackageFormStepManager isEdit={false} />
      </div>
    </div>
  );
}
