import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Link from "next/link";
import { Users, FileText, AlertTriangle, ShieldCheck, FileQuestion, ArrowRight } from "lucide-react";
import AdminDriverActions from "@/components/admin/AdminDriverActions";
import { formatSriLankanDate, formatSriLankanDateTime } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  const pendingDrivers = await User.find({ role: "DRIVER", isApproved: false })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-xs font-bold text-slate-500 hover:text-slate-800">
              &larr; Overview
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="text-[#D97706]" size={28} /> Driver Approvals &amp; Onboarding
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Review submitted credentials, driver licenses, vehicle revenue licenses, and approve or request changes.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-[#D97706] border border-amber-200 text-xs font-extrabold self-start sm:self-center">
          {pendingDrivers.length} Pending Review
        </span>
      </div>

      {/* Approvals Container */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        
        {pendingDrivers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} />
            </div>
            <p className="font-extrabold text-slate-900 text-lg">All caught up!</p>
            <p className="text-xs text-slate-400 mt-1">There are no driver applications awaiting review.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card List (< md screens) */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {pendingDrivers.map((driver: any) => {
                const hasDetails = !!driver.driverDetails;
                const missingDocs = !hasDetails || !driver.driverDetails.nicOrPassportNumber || !driver.driverDetails.licenseExpiryDate;

                return (
                  <div key={driver._id.toString()} className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-sm">{driver.name}</span>
                      {missingDocs ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          <AlertTriangle size={11} /> Incomplete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          <FileText size={11} /> Ready for Review
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <p>{driver.email}</p>
                      <p>{driver.phoneNumber || "No phone number"}</p>
                      <div className="pt-1 flex items-center justify-between text-slate-500">
                        <span>Vehicle: {driver.driverDetails?.vehicleMake || "N/A"} {driver.driverDetails?.vehicleModel || ""}</span>
                        <span className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {driver.vehicleRegistration || driver.driverDetails?.vehicleRegistration || "No Reg"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-400">
                        Applied: {formatSriLankanDate(driver.createdAt)}
                      </span>
                      <Link 
                        href={`/admin/users/${driver._id.toString()}`}
                        className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg text-xs"
                      >
                        Review Application &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/80 text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4 text-left">Applicant</th>
                    <th className="px-6 py-4 text-left">Vehicle Details</th>
                    <th className="px-6 py-4 text-left">Documents</th>
                    <th className="px-6 py-4 text-left">Date Applied</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {pendingDrivers.map((driver: any) => {
                    const hasDetails = !!driver.driverDetails;
                    const missingDocs = !hasDetails || !driver.driverDetails.nicOrPassportNumber || !driver.driverDetails.licenseExpiryDate;
                    
                    return (
                      <tr key={driver._id.toString()} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">{driver.name}</div>
                          <div className="text-slate-600">{driver.email}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{driver.phoneNumber || "No phone"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">
                            {driver.driverDetails?.vehicleMake} {driver.driverDetails?.vehicleModel} 
                            {driver.driverDetails?.vehicleYear && ` (${driver.driverDetails?.vehicleYear})`}
                          </div>
                          <div className="text-slate-700 font-mono text-xs mt-1 bg-slate-100 inline-block px-1.5 py-0.5 rounded font-bold">
                            {driver.vehicleRegistration || driver.driverDetails?.vehicleRegistration || "No Reg"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {missingDocs ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle size={12} /> Incomplete
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <FileText size={12} /> Needs Review
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-900 font-medium">{formatSriLankanDate(driver.createdAt)}</div>
                          <div className="text-[11px] text-slate-400">{new Date(driver.createdAt).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link 
                            href={`/admin/users/${driver._id.toString()}`}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors text-xs shadow-xs"
                          >
                            <span>Review Application</span>
                            <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
