import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import VehicleType from "@/models/VehicleType";
import User from "@/models/User";
import TripBuilderClient from "./TripBuilderClient";

export const dynamic = "force-dynamic";

export default async function TripBuilderPage(props: { searchParams: Promise<{ edit?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/trip-builder");
  }

  if ((session.user as any).role !== "TOURIST") {
    redirect("/");
  }

  await dbConnect();
  
  const vehicleTypes = await VehicleType.find({ isActive: true }).sort({ sortOrder: 1 }).lean();

  // Fetch current user profile to prefill rider details and verification status
  const user = await User.findById((session.user as any).id)
    .select("name email phoneNumber nationality isEmailVerified isPhoneVerified")
    .lean();
  const currentUserProfile = user ? JSON.parse(JSON.stringify(user)) : null;
  
  let initialData = null;
  if (searchParams.edit) {
    const booking = await Booking.findOne({ _id: searchParams.edit, touristId: (session.user as any).id }).lean();
    if (booking && booking.customTripDetails) {
      initialData = JSON.parse(JSON.stringify(booking));
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Build Your Custom Trip</h1>
          <p className="text-slate-600">Design your perfect Sri Lankan day-by-day itinerary. Suitable drivers will review your request and accept it.</p>
        </div>
        
        <TripBuilderClient 
          vehicleTypes={JSON.parse(JSON.stringify(vehicleTypes))} 
          initialData={initialData} 
          currentUserProfile={currentUserProfile}
        />
      </div>
    </div>
  );
}
