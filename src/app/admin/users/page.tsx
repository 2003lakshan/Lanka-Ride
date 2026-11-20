import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Link from "next/link";
import { UserCircle, Car, Trash2, Search, ArrowRight, ShieldCheck, Phone, Mail, Star, ExternalLink } from "lucide-react";
import AdminDeleteUser from "@/components/admin/AdminDeleteUser";
import AdminDriverActions from "@/components/admin/AdminDriverActions";
import { formatSriLankanDate } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  const { role } = await searchParams;
  const filterRole = role === "TOURIST" || role === "DRIVER" ? role : undefined;
  
  const query = filterRole ? { role: filterRole } : { role: { $in: ["TOURIST", "DRIVER"] } };
  
  const users = await User.find(query).sort({ createdAt: -1 }).lean();

  const title = filterRole === "TOURIST" ? "Riders" : filterRole === "DRIVER" ? "Drivers" : "All Users";
  const icon = filterRole === "TOURIST" ? <UserCircle className="text-blue-600" size={26} /> : <Car className="text-blue-600" size={26} />;

  const onlineDriversCount = filterRole === "DRIVER" ? users.filter((u: any) => u.isOnline).length : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            {icon}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {title} Management
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {filterRole === "DRIVER" 
              ? `Fleet roster, live availability, vehicle compliance, and verification status.` 
              : `Registered accounts, contact records, and identity statuses on the platform.`
            }
          </p>
        </div>

        {filterRole === "DRIVER" && (
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{onlineDriversCount} of {users.length} Drivers Online</span>
          </div>
        )}
      </div>

      {/* Users Container: Responsive Desktop Table + Mobile Cards */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        
        {/* Mobile Card List (< md screens) */}
        <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
          {users.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">No {title.toLowerCase()} found.</p>
          ) : (
            users.map((user: any) => (
              <div key={user._id.toString()} className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/70 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{user.name}</span>
                    {user.role === "DRIVER" && (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        user.isOnline ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {user.isOnline ? "Online" : "Offline"}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    user.role === 'DRIVER' 
                      ? (user.isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.role === 'DRIVER' ? (user.isApproved ? 'Approved' : 'Pending') : user.role}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <span>{user.phoneNumber || "No phone provided"}</span>
                  </div>
                  {user.role === "DRIVER" && user.vehicleRegistration && (
                    <div className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 inline-block text-slate-800">
                      Reg: {user.vehicleRegistration}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-400">
                    Joined {formatSriLankanDate(user.createdAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/users/${user._id.toString()}`}
                      className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold"
                    >
                      Details
                    </Link>
                    <AdminDeleteUser userId={user._id.toString()} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= md screens) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80 text-[11px] text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4 text-left">User Details</th>
                <th className="px-6 py-4 text-left">Contact</th>
                {!filterRole || filterRole === "DRIVER" ? (
                  <th className="px-6 py-4 text-left">Vehicle &amp; License</th>
                ) : null}
                <th className="px-6 py-4 text-left">Status &amp; Availability</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No {title.toLowerCase()} found.
                  </td>
                </tr>
              ) : users.map((user: any) => (
                <tr key={user._id.toString()} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                    {!filterRole && (
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        user.role === 'DRIVER' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-800 font-medium">{user.email}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{user.phoneNumber || "No phone"}</div>
                  </td>
                  {!filterRole || filterRole === "DRIVER" ? (
                    <td className="px-6 py-4">
                      {user.role === "DRIVER" ? (
                        <>
                          <div className="font-mono font-bold text-slate-900">{user.vehicleRegistration || "N/A"}</div>
                          <div className="text-[11px] text-slate-400">License: {user.licenseNumber || "N/A"}</div>
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-6 py-4">
                    {user.role === "DRIVER" && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                          user.isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {user.isApproved ? 'Approved' : 'Pending'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          user.isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {user.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    )}
                    {user.role === "TOURIST" && user.identityStatus && user.identityStatus !== "NOT_SUBMITTED" && (
                      <div className="mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                          user.identityStatus === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : user.identityStatus === "REJECTED"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          ID: {user.identityStatus === "PENDING_REVIEW" ? "Pending Review" : user.identityStatus}
                        </span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400">
                      Joined: {formatSriLankanDate(user.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Link 
                        href={`/admin/users/${user._id.toString()}`}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Details
                      </Link>
                      <AdminDeleteUser userId={user._id.toString()} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
