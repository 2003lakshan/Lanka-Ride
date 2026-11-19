import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import RiderIdentity from "@/models/RiderIdentity";
import Link from "next/link";
import { 
  ArrowLeft, 
  UserCircle, 
  Car, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  IdCard, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight 
} from "lucide-react";
import AdminDriverActions from "@/components/admin/AdminDriverActions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  const { id } = await params;
  
  const user = await User.findById(id).lean();

  if (!user) {
    return (
      <div className="bg-slate-50 min-h-screen py-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">User Not Found</h1>
          <Link href="/admin" className="text-blue-600 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const riderIdentity = await RiderIdentity.findOne({ userId: id })
    .populate("reviewedBy", "name email")
    .lean();

  const isDriver = user.role === "DRIVER";

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div>
          <Link href="/admin" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-semibold mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              {isDriver ? <Car className="text-blue-600" size={32} /> : <UserCircle className="text-blue-600" size={32} />}
              User Details
            </h1>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase ${isDriver ? 'bg-indigo-100 text-indigo-800' : 'bg-green-100 text-green-800'}`}>
              {user.role}
            </span>
          </div>
          
          {isDriver && (
            <div className="mt-6 flex justify-end">
              <AdminDriverActions driverId={user._id.toString()} isApproved={user.isApproved} showViewDetails={false} />
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Basic Info */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">Basic Information</h2>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-bold text-slate-500 mb-1">Full Name</div>
                  <div className="text-lg font-semibold text-slate-900">{user.name}</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"><Mail size={14} /> Email Address</div>
                  <div className="text-slate-900">{user.email}</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"><Phone size={14} /> Phone Number</div>
                  <div className="text-slate-900">{user.phoneNumber || "Not provided"}</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"><MapPin size={14} /> Nationality</div>
                  <div className="text-slate-900">{user.nationality || "Not provided"}</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={14} /> Joined Date</div>
                  <div className="text-slate-900">{new Date(user.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Driver Specific Info */}
            {isDriver ? (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">Driver Details</h2>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-1"><ShieldCheck size={14} /> Approval Status</div>
                    <div>
                      <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${user.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {user.isApproved ? 'Approved' : 'Pending Approval'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-500 mb-1">Vehicle Registration</div>
                    <div className="text-slate-900 font-mono font-bold bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      {user.vehicleRegistration || "Not provided"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-500 mb-1">License Number</div>
                    <div className="text-slate-900 font-mono font-bold bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      {user.licenseNumber || "Not provided"}
                    </div>
                  </div>
                </div>
                
                {isDriver && (
                  <div className="mt-8 space-y-6 pt-6 border-t border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Comprehensive Driver Details</h3>
                    
                    {!user.driverDetails ? (
                      <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 text-center text-amber-800">
                        <p className="font-bold">No Comprehensive Details Found</p>
                        <p className="text-sm mt-1">This driver registered before the comprehensive details form was implemented. They only have basic information.</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="font-bold text-slate-700 mb-3">Driver Identity</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500 block text-xs">NIC/Passport:</span> <span className="font-semibold">{user.driverDetails.nicOrPassportNumber || 'N/A'}</span></div>
                            <div><span className="text-slate-500 block text-xs">DOB:</span> <span className="font-semibold">{user.driverDetails.dateOfBirth || 'N/A'}</span></div>
                            <div><span className="text-slate-500 block text-xs">Home District:</span> <span className="font-semibold">{user.driverDetails.homeDistrict || 'N/A'}</span></div>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="font-bold text-slate-700 mb-3">Driving Licence</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500 block text-xs">Classes:</span> <span className="font-semibold">{user.driverDetails.licenseClasses || 'N/A'}</span></div>
                            <div><span className="text-slate-500 block text-xs">Expiry Date:</span> <span className="font-semibold">{user.driverDetails.licenseExpiryDate || 'N/A'}</span></div>
                          </div>
                        </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-700 mb-3">Vehicle Info</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div><span className="text-slate-500 block text-xs">Make:</span> <span className="font-semibold">{user.driverDetails.vehicleMake || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Model:</span> <span className="font-semibold">{user.driverDetails.vehicleModel || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Year:</span> <span className="font-semibold">{user.driverDetails.vehicleYear || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Seats:</span> <span className="font-semibold">{user.driverDetails.passengerSeats || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Luggage:</span> <span className="font-semibold">{user.driverDetails.luggageCapacity || 'N/A'}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-700 mb-3">Vehicle Documents</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-slate-500 block text-xs">Insurance Policy:</span> <span className="font-semibold">{user.driverDetails.insurancePolicyNumber || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Insurance Expiry:</span> <span className="font-semibold">{user.driverDetails.insuranceExpiryDate || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Revenue Expiry:</span> <span className="font-semibold">{user.driverDetails.revenueLicenseExpiryDate || 'N/A'}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-700 mb-3">Tour Services</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="col-span-2"><span className="text-slate-500 block text-xs">Languages:</span> <span className="font-semibold">{user.driverDetails.languagesSpoken || 'N/A'}</span></div>
                        <div className="col-span-2"><span className="text-slate-500 block text-xs">Areas Served:</span> <span className="font-semibold">{user.driverDetails.areasServed || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Airport Pickup:</span> <span className="font-semibold">{user.driverDetails.airportPickupAvailable ? 'Yes' : 'No'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Multi-day Trips:</span> <span className="font-semibold">{user.driverDetails.multiDayTripAvailable ? 'Yes' : 'No'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Guided Tours:</span> <span className="font-semibold">{user.driverDetails.guidedToursAvailable ? 'Yes' : 'No'}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-700 mb-3">Safety & Operations</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-slate-500 block text-xs">Emergency Contact:</span> <span className="font-semibold">{user.driverDetails.emergencyContactName || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Emergency Num:</span> <span className="font-semibold">{user.driverDetails.emergencyContactNumber || 'N/A'}</span></div>
                        <div><span className="text-slate-500 block text-xs">Child Seat:</span> <span className="font-semibold">{user.driverDetails.childSeatAvailable ? 'Yes' : 'No'}</span></div>
                        <div><span className="text-slate-500 block text-xs">A/C:</span> <span className="font-semibold">{user.driverDetails.airConditioning ? 'Yes' : 'No'}</span></div>
                        <div className="col-span-2"><span className="text-slate-500 block text-xs">Schedule:</span> <span className="font-semibold">{user.driverDetails.availabilitySchedule || 'N/A'}</span></div>
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                      <h4 className="font-bold text-emerald-900 mb-3">Bank Details for Payouts</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm text-emerald-800">
                        <div><span className="text-emerald-600 block text-xs">Bank Name:</span> <span className="font-semibold">{user.driverDetails.bankName || 'N/A'}</span></div>
                        <div><span className="text-emerald-600 block text-xs">Branch:</span> <span className="font-semibold">{user.driverDetails.bankBranchName || 'N/A'}</span></div>
                        <div><span className="text-emerald-600 block text-xs">Account Name:</span> <span className="font-semibold">{user.driverDetails.bankAccountName || 'N/A'}</span></div>
                        <div><span className="text-emerald-600 block text-xs">Account Num:</span> <span className="font-semibold">{user.driverDetails.bankAccountNumber || 'N/A'}</span></div>
                      </div>
                    </div>
                  </>
                )}
              </div>
                )}
              </div>
            ) : (
              /* Rider Identity Verification Section */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <IdCard className="text-blue-600" size={22} />
                    Identity Verification
                  </h2>
                  <div>
                    {riderIdentity?.status === "APPROVED" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={13} className="text-emerald-600" /> Approved
                      </span>
                    ) : riderIdentity?.status === "REJECTED" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200">
                        <XCircle size={13} className="text-red-600" /> Rejected
                      </span>
                    ) : riderIdentity?.status === "PENDING_REVIEW" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock size={13} className="text-amber-600 animate-pulse" /> Pending Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Not Submitted
                      </span>
                    )}
                  </div>
                </div>

                {riderIdentity ? (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block font-semibold">Document Type</span>
                        <span className="text-sm font-bold text-slate-900">
                          {riderIdentity.documentType === "NATIONAL_ID" ? "National ID Card" : "Passport"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Document Version</span>
                        <span className="text-sm font-bold text-slate-900">v{riderIdentity.version || 1}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Last Updated</span>
                        <span className="font-medium text-slate-800">
                          {new Date(riderIdentity.updatedAt || riderIdentity.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Uploaded Files</span>
                        <span className="font-medium text-slate-800">
                          {riderIdentity.documentType === "NATIONAL_ID"
                            ? `${[riderIdentity.files?.front, riderIdentity.files?.back].filter(Boolean).length}/2 files`
                            : `${[riderIdentity.files?.photoPage].filter(Boolean).length}/1 file`}
                        </span>
                      </div>
                    </div>

                    {riderIdentity.status === "REJECTED" && riderIdentity.rejectionReason && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                        <span className="font-bold block mb-0.5">Rejection Reason:</span>
                        <span>{riderIdentity.rejectionReason}</span>
                      </div>
                    )}

                    {riderIdentity.reviewedBy && (
                      <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                        Reviewed by <strong className="text-slate-700">{(riderIdentity.reviewedBy as any).name || "Admin"}</strong> on {riderIdentity.reviewedAt ? new Date(riderIdentity.reviewedAt).toLocaleDateString() : ""}
                      </div>
                    )}

                    <div className="pt-2">
                      <Link
                        href={`/admin/identity-reviews/${riderIdentity._id.toString()}`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      >
                        <ShieldCheck size={15} />
                        <span>Review Identity Documents</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
                    <IdCard size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-800 text-sm">No Documents Uploaded</p>
                    <p className="text-xs text-slate-500 mt-1">
                      This rider has not submitted an identity document yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
