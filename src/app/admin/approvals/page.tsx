import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Link from "next/link";
import { Users, FileText, AlertTriangle, ShieldCheck, FileQuestion } from "lucide-react";
import AdminDriverActions from "@/components/admin/AdminDriverActions";

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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Driver Approvals</h1>
        <p className="text-slate-600">Review and verify new driver applications and documents.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-amber-500" /> Pending Applications ({pendingDrivers.length})
          </h2>
        </div>
        
        {pendingDrivers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} className="text-slate-300" />
            </div>
            <p className="font-medium text-slate-900 text-lg">All caught up!</p>
            <p className="mt-1">There are no pending driver approvals.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Applicant</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Vehicle Details</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Documents</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Date Applied</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingDrivers.map((driver: any) => {
                  const hasDetails = !!driver.driverDetails;
                  const missingDocs = !hasDetails || !driver.driverDetails.nicOrPassportNumber || !driver.driverDetails.licenseExpiryDate;
                  
                  return (
                    <tr key={driver._id.toString()} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{driver.name}</div>
                        <div className="text-slate-500">{driver.email}</div>
                        <div className="text-xs text-slate-400 mt-1">{driver.phoneNumber || "No phone"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {driver.driverDetails?.vehicleMake} {driver.driverDetails?.vehicleModel} 
                          {driver.driverDetails?.vehicleYear && ` (${driver.driverDetails?.vehicleYear})`}
                        </div>
                        <div className="text-slate-500 font-mono text-xs mt-1 bg-slate-100 inline-block px-1.5 py-0.5 rounded">
                          {driver.vehicleRegistration || driver.driverDetails?.vehicleRegistration || "No Reg"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {missingDocs ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-600">
                            <AlertTriangle size={12} /> Incomplete
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-600">
                            <FileText size={12} /> Needs Review
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900">{new Date(driver.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500">{new Date(driver.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/admin/users/${driver._id.toString()}`}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors text-xs"
                        >
                          Review Application
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
