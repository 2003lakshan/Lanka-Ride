import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Package from "@/models/Package";
import PackageEnquiry from "@/models/PackageEnquiry";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const role = (session.user as any).role;

    const data = await request.json();
    const { action, currentPassword } = data; // action: "check" or "delete"

    await dbConnect();

    // 1. Check for active bookings
    const activeStatuses = [
      "PENDING_APPROVAL", "NEEDS_REVISION", "PENDING", "AWAITING_PAYMENT", 
      "CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", 
      "PASSENGER_PICKED_UP", "TRIP_IN_PROGRESS"
    ];

    const activeBookings = await Booking.find({
      $or: [
        { touristId: userId },
        { driverId: userId }
      ],
      status: { $in: activeStatuses as any }
    } as any).lean();

    if (activeBookings.length > 0) {
      return NextResponse.json({ 
        error: "Cannot delete account", 
        reason: `You have ${activeBookings.length} active or upcoming booking(s). Please complete or cancel them before deleting your account.`
      }, { status: 400 });
    }

    // 2. Check for unresolved disputes / pending package enquiries
    const activeEnquiries = await PackageEnquiry.find({
      $or: [
        { riderId: userId },
        { driverId: userId }
      ],
      status: { $in: ["PENDING", "ACCEPTED"] } // BOOKED turns into a booking, DECLINED is resolved
    } as any).lean();

    if (activeEnquiries.length > 0) {
      return NextResponse.json({ 
        error: "Cannot delete account", 
        reason: `You have ${activeEnquiries.length} pending package enquiry(s). Please resolve or cancel them before deleting your account.`
      }, { status: 400 });
    }

    if (action === "check") {
      return NextResponse.json({ canDelete: true }, { status: 200 });
    }

    if (action === "delete") {
      const user = await User.findById(userId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Verify password
      if (user.password) {
        if (!currentPassword) {
          return NextResponse.json({ error: "Password is required to confirm deletion" }, { status: 400 });
        }
        const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordMatch) {
          return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
        }
      }

      // Perform deletion
      if (role === "DRIVER") {
        // Delete packages
        await Package.deleteMany({ driverId: userId });
        // Set driverId to null in past bookings to retain historical data but anonymize
        await Booking.updateMany({ driverId: userId }, { $unset: { driverId: 1 } });
      } else if (role === "TOURIST") {
        // Set touristId to null in past bookings and anonymize passenger details slightly
        await Booking.updateMany({ touristId: userId }, { 
          $unset: { touristId: 1 },
          $set: { 
            "passengerDetails.fullName": "Deleted User",
            "passengerDetails.email": "deleted@example.com",
            "passengerDetails.whatsappNumber": "Removed"
          }
        });
      }

      // Delete package enquiries
      await PackageEnquiry.deleteMany({
        $or: [{ riderId: userId }, { driverId: userId }]
      });

      // Finally, delete the user
      await User.findByIdAndDelete(userId);

      import("@/lib/realtime").then(async ({ revokeUserSession }) => {
        await revokeUserSession(userId);
      }).catch(console.error);

      return NextResponse.json({ message: "Account successfully deleted" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
