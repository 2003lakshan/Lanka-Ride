import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Airport from "@/models/Airport";
import VehicleType from "@/models/VehicleType";
import { Users, Car, UserCircle } from "lucide-react";
import AdminDriverActions from "@/components/admin/AdminDriverActions";
import AdminDeleteUser from "@/components/admin/AdminDeleteUser";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  await dbConnect();
  
  // Ensure models are registered to prevent "MissingSchemaError"
  if (Airport && VehicleType) {
    // Just a no-op to prevent tree-shaking
  }
  
  const drivers = await User.find({ role: "DRIVER" }).sort({ createdAt: -1 }).lean();
  const riders = await User.find({ role: "TOURIST" }).sort({ createdAt: -1 }).lean();
  const bookings = await Booking.find().populate('airportId').populate('vehicleTypeId').sort({ createdAt: -1 }).lean();

  const pendingDrivers = drivers.filter(d => !d.isApproved);
  const approvedDrivers = drivers.filter(d => d.isApproved);

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-slate-600">Manage drivers and oversee all platform bookings.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-center">
              <div className="text-sm text-slate-500 font-bold uppercase">Pending Drivers</div>
              <div className="text-xl font-bold text-yellow-600">{pendingDrivers.length}</div>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-center">
              <div className="text-sm text-slate-500 font-bold uppercase">Total Bookings</div>
              <div className="text-xl font-bold text-blue-600">{bookings.length}</div>
            </div>
          </div>
        </div>

        {/* Drivers Section */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users className="text-blue-600" /> Driver Management
          </h2>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Driver Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle / License</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {drivers.map((driver: any) => (
                  <tr key={driver._id.toString()}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{driver.name}</div>
                      <div className="text-sm text-slate-500">Joined {new Date(driver.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{driver.email}</div>
                      <div className="text-sm text-slate-500">{driver.phoneNumber || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{driver.vehicleRegistration}</div>
                      <div className="text-sm text-slate-500">{driver.licenseNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${driver.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {driver.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <AdminDriverActions driverId={driver._id.toString()} isApproved={driver.isApproved} />
                    </td>
                  </tr>
                ))}
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No drivers registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Riders Section */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <UserCircle className="text-blue-600" /> Rider Management
          </h2>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rider Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {riders.map((rider: any) => (
                  <tr key={rider._id.toString()}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{rider.name}</div>
                      <div className="text-sm text-slate-500">Joined {new Date(rider.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{rider.email}</div>
                      {rider.phoneNumber && <div className="text-sm text-slate-500">{rider.phoneNumber}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <AdminDeleteUser userId={rider._id.toString()} />
                    </td>
                  </tr>
                ))}
                {riders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No riders registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bookings Section */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Car className="text-blue-600" /> All Platform Bookings
          </h2>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ref / Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Route</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Passenger</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fare</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bookings.map((booking: any) => (
                  <tr key={booking._id.toString()} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-900">{booking.bookingReference}</div>
                      <div className="text-sm text-slate-500">{new Date(booking.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 line-clamp-1">{booking.airportId?.name || "Airport"} &rarr;</div>
                      <div className="text-sm text-slate-500 line-clamp-1">{booking.destinationAddress}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{booking.passengerDetails.fullName}</div>
                      <div className="text-sm text-slate-500">{booking.passengerDetails.whatsappNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">LKR {booking.fareBreakdown.totalEstimatedFare.toLocaleString()}</div>
                      <div className="text-xs text-slate-500">{booking.paymentMethod.replace("_", " ")}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                        booking.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                        booking.status.includes('DRIVER') ? 'bg-indigo-100 text-indigo-800' :
                        booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {booking.status.replace(/_/g, " ")}
                      </span>
                      {booking.driverId && <div className="text-xs text-slate-400 mt-1">Assigned</div>}
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No bookings yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
