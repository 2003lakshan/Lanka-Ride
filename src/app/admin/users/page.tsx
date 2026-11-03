import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Link from "next/link";
import { UserCircle, Car, Trash2, Search, ArrowRight } from "lucide-react";
import AdminDeleteUser from "@/components/admin/AdminDeleteUser";
import AdminDriverActions from "@/components/admin/AdminDriverActions";

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
  const icon = filterRole === "TOURIST" ? <UserCircle className="text-blue-600" size={28} /> : <Car className="text-blue-600" size={28} />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            {icon} {title}
          </h1>
          <p className="text-slate-600">Manage registered {title.toLowerCase()} on the platform.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">User Details</th>
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                {!filterRole || filterRole === "DRIVER" ? (
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Vehicle / License</th>
                ) : null}
                <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider">Status & Date</th>
                <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No {title.toLowerCase()} found.
                  </td>
                </tr>
              ) : users.map((user: any) => (
                <tr key={user._id.toString()} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{user.name}</div>
                    {!filterRole && (
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        user.role === 'DRIVER' ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-900">{user.email}</div>
                    <div className="text-xs text-slate-500">{user.phoneNumber || "No phone"}</div>
                  </td>
                  {!filterRole || filterRole === "DRIVER" ? (
                    <td className="px-6 py-4">
                      {user.role === "DRIVER" ? (
                        <>
                          <div className="font-medium text-slate-900">{user.vehicleRegistration || "N/A"}</div>
                          <div className="text-xs text-slate-500">{user.licenseNumber || "N/A"}</div>
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-6 py-4">
                    {user.role === "DRIVER" && (
                      <div className="mb-1">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded uppercase ${user.isApproved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {user.isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-slate-500">Joined: {new Date(user.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
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
