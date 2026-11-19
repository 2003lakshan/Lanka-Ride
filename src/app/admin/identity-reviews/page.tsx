import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import RiderIdentity from "@/models/RiderIdentity";
import User from "@/models/User";
import Link from "next/link";
import { 
  IdCard, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Search, 
  ArrowRight,
  ShieldCheck,
  FileText,
  User as UserIcon,
  ChevronRight
} from "lucide-react";
import { formatSriLankanDate } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

export default async function AdminIdentityReviewsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();

  const searchParams = await props.searchParams;
  const rawStatus = searchParams?.status;
  const activeStatus = rawStatus && ["PENDING_REVIEW", "APPROVED", "REJECTED", "ALL"].includes(rawStatus)
    ? rawStatus
    : "PENDING_REVIEW";

  // Tab counts
  const [pendingCount, approvedCount, rejectedCount, allCount] = await Promise.all([
    RiderIdentity.countDocuments({ status: "PENDING_REVIEW" }),
    RiderIdentity.countDocuments({ status: "APPROVED" }),
    RiderIdentity.countDocuments({ status: "REJECTED" }),
    RiderIdentity.countDocuments({}),
  ]);

  // Query filter
  const filterQuery: any = {};
  if (activeStatus !== "ALL") {
    filterQuery.status = activeStatus;
  }

  const identities = await RiderIdentity.find(filterQuery)
    .populate("userId", "name email phoneNumber nationality isEmailVerified")
    .populate("reviewedBy", "name email")
    .sort({ updatedAt: -1 })
    .lean();

  const serializedIdentities = JSON.parse(JSON.stringify(identities));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <IdCard className="text-blue-600 shrink-0" size={30} />
            Identity Reviews
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and verify government-issued identity documents submitted by booking contacts and riders.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-1.5">
        <Link
          href="/admin/identity-reviews?status=PENDING_REVIEW"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeStatus === "PENDING_REVIEW"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Clock size={14} />
          <span>Pending Review</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeStatus === "PENDING_REVIEW" ? "bg-amber-700/50 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {pendingCount}
          </span>
        </Link>

        <Link
          href="/admin/identity-reviews?status=APPROVED"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeStatus === "APPROVED"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <CheckCircle2 size={14} />
          <span>Approved</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeStatus === "APPROVED" ? "bg-emerald-800/50 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {approvedCount}
          </span>
        </Link>

        <Link
          href="/admin/identity-reviews?status=REJECTED"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeStatus === "REJECTED"
              ? "bg-red-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <XCircle size={14} />
          <span>Rejected</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeStatus === "REJECTED" ? "bg-red-800/50 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {rejectedCount}
          </span>
        </Link>

        <Link
          href="/admin/identity-reviews?status=ALL"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeStatus === "ALL"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span>All Records</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeStatus === "ALL" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {allCount}
          </span>
        </Link>
      </div>

      {/* Identity Records List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {serializedIdentities.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <IdCard size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No identity records found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeStatus === "PENDING_REVIEW"
                ? "No rider identity documents are currently awaiting review."
                : `No identity documents with status '${activeStatus.toLowerCase()}'.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">
                    Rider Details
                  </th>
                  <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">
                    Document
                  </th>
                  <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">
                    Date Submitted
                  </th>
                  <th className="px-6 py-3.5 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serializedIdentities.map((item: any) => {
                  const rider = item.userId;
                  const isPending = item.status === "PENDING_REVIEW";
                  const isApproved = item.status === "APPROVED";
                  const isRejected = item.status === "REJECTED";

                  const fileCount = item.documentType === "NATIONAL_ID"
                    ? [item.files?.front, item.files?.back].filter(Boolean).length
                    : [item.files?.photoPage].filter(Boolean).length;

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Rider Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                            {rider?.name ? rider.name.charAt(0).toUpperCase() : <UserIcon size={14} />}
                          </div>
                          <div className="min-w-0">
                            <Link 
                              href={`/admin/users/${rider?._id || ""}`}
                              className="font-bold text-slate-900 hover:text-blue-600 transition-colors truncate block text-sm"
                            >
                              {rider?.name || "Unknown Rider"}
                            </Link>
                            <p className="text-xs text-slate-500 truncate">{rider?.email || "No email"}</p>
                            {rider?.phoneNumber && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{rider.phoneNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Document Type & Files */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.documentType === "NATIONAL_ID" ? "National ID Card" : "Passport"}
                          </span>
                          {item.version && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              v{item.version}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>{fileCount} file{fileCount !== 1 ? "s" : ""} uploaded</span>
                          {item.documentType === "NATIONAL_ID" && (
                            <span className="text-slate-400 text-[10px]">
                              ({item.files?.front ? "Front" : "No Front"}, {item.files?.back ? "Back" : "No Back"})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock size={13} className="text-amber-600 shrink-0" />
                            Pending Review
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            Approved
                          </span>
                        )}
                        {isRejected && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              <XCircle size={13} className="text-red-600 shrink-0" />
                              Rejected
                            </span>
                            {item.rejectionReason && (
                              <p className="text-[11px] text-red-600 mt-1 max-w-xs truncate" title={item.rejectionReason}>
                                {item.rejectionReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Date Submitted / Updated */}
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div>{new Date(item.updatedAt || item.createdAt).toLocaleDateString()}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(item.updatedAt || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/identity-reviews/${item._id}`}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isPending
                              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          <span>{isPending ? "Review Identity" : "View Details"}</span>
                          <ChevronRight size={14} />
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

