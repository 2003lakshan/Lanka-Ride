import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import VehicleType from "@/models/VehicleType";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DRIVER") {
      return NextResponse.json({ error: "Unauthorized. Driver access required." }, { status: 401 });
    }

    const driverId = (session.user as any).id;
    await dbConnect();

    const [driver, vehicleTypes] = await Promise.all([
      User.findById(driverId).select("name email phoneNumber nationality preferredLanguage vehicleRegistration vehicleCategory driverDetails isApproved").lean(),
      VehicleType.find({ isActive: true }).sort({ maxPassengers: 1 }).lean()
    ]);

    if (!driver) {
      return NextResponse.json({ error: "Driver profile not found." }, { status: 404 });
    }

    // Build the registered vehicles list
    // Each driver has their primary registered vehicle, plus active system vehicle types
    const primaryVehicle = {
      id: "primary",
      registration: driver.vehicleRegistration || "Not Assigned",
      category: driver.vehicleCategory || "Car",
      model: driver.driverDetails?.vehicleModel || `${driver.vehicleCategory || "Car"} (Registered)`,
      hasAc: driver.driverDetails?.hasAc !== false,
      isApproved: Boolean(driver.isApproved),
    };

    return NextResponse.json({
      success: true,
      driver: {
        id: driver._id.toString(),
        name: driver.name,
        email: driver.email,
        phone: driver.phoneNumber || "",
        preferredLanguage: driver.preferredLanguage || "English",
        nationality: driver.nationality || "Sri Lanka",
        isApproved: driver.isApproved || false,
      },
      registeredVehicle: primaryVehicle,
      vehicleTypes: vehicleTypes.map((v: any) => ({
        id: v._id.toString(),
        name: v.name,
        maxPassengers: v.maxPassengers,
        maxLuggage: v.maxLuggage,
        fuelType: v.fuelType,
        description: v.description || "",
      }))
    });
  } catch (error: any) {
    console.error("Vehicle options error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch vehicle options." }, { status: 500 });
  }
}

