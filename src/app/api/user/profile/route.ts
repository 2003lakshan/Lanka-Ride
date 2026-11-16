import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById((session.user as any).id).select("-password").lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { 
      name, email, phoneNumber, nationality, profilePhoto, preferredLanguage, 
      licenseNumber, vehicleRegistration, driverDetails, currentPassword
    } = data;

    await dbConnect();
    const user = await User.findById((session.user as any).id);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only require current password if changing an EXISTING registered email or phone number
    const isChangingExistingEmail = email && user.email && email.toLowerCase().trim() !== user.email.toLowerCase().trim();
    const isChangingExistingPhone = phoneNumber && user.phoneNumber && phoneNumber.trim() !== user.phoneNumber.trim();

    if (isChangingExistingEmail || isChangingExistingPhone) {
      if (!currentPassword) {
        return NextResponse.json({ 
          error: "Current password is required to change existing email or phone number",
          requiresPassword: true 
        }, { status: 400 });
      }
      
      if (!user.password) {
        // OAuth user trying to change email/phone
        return NextResponse.json({ error: "Cannot change existing email/phone for OAuth accounts" }, { status: 400 });
      }

      const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordMatch) {
        return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
      }
    }

    // Update basic fields
    if (name) user.name = name;
    if (email) user.email = email.toLowerCase().trim();
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (nationality !== undefined) user.nationality = nationality;
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;

    // Driver specific fields
    if (user.role === "DRIVER") {
      let sensitiveDocsChanged = false;

      if (licenseNumber !== undefined && licenseNumber !== user.licenseNumber) {
        user.licenseNumber = licenseNumber;
        sensitiveDocsChanged = true;
      }
      
      if (vehicleRegistration !== undefined && vehicleRegistration !== user.vehicleRegistration) {
        user.vehicleRegistration = vehicleRegistration;
        sensitiveDocsChanged = true;
      }

      if (data.vehicleCategory !== undefined) {
        user.vehicleCategory = data.vehicleCategory;
        if (!user.driverDetails) user.driverDetails = {};
        user.driverDetails.vehicleCategory = data.vehicleCategory;
      }
      
      if (driverDetails) {
        // Check if sensitive driver details changed
        const oldDetails = user.driverDetails || {};
        if (
          driverDetails.nicOrPassportNumber !== oldDetails.nicOrPassportNumber ||
          driverDetails.licenseExpiryDate !== oldDetails.licenseExpiryDate ||
          driverDetails.insurancePolicyNumber !== oldDetails.insurancePolicyNumber
        ) {
          sensitiveDocsChanged = true;
        }
        
        user.driverDetails = { ...oldDetails, ...driverDetails };
      }

      // If sensitive docs changed and user is approved, revoke approval for admin review
      if (sensitiveDocsChanged && user.isApproved) {
        user.isApproved = false;
      }
    }

    await user.save();

    const approvalRevoked = user.role === "DRIVER" && !user.isApproved && (session.user as any).isApproved;

    if (approvalRevoked) {
      import("@/lib/notifications").then(async ({ sendNotification, notifyAdmins }) => {
        await notifyAdmins({
          type: "DRIVER_DOCS_UPDATED",
          title: "Driver Documents Updated",
          message: `Driver ${user.name} has updated sensitive documents and requires re-approval.`,
          link: `/admin/users/${user._id.toString()}`,
          deduplicationKey: `driver_reapproval_${user._id.toString()}_${Date.now()}`
        });
      }).catch(console.error);
    }

    const updatedUser = user.toObject();
    delete updatedUser.password;

    return NextResponse.json({ 
      message: "Profile updated successfully", 
      user: updatedUser,
      approvalRevoked
    }, { status: 200 });

  } catch (error: any) {
    console.error("Update profile error:", error);
    
    if (error.code === 11000) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
