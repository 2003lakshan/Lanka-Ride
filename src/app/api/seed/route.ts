import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Airport from "@/models/Airport";
import VehicleType from "@/models/VehicleType";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  try {
    await dbConnect();

    // WARNING: This clears the existing data!
    await Airport.deleteMany({});
    await VehicleType.deleteMany({});
    await User.deleteMany({});

    // Seed Admin User
    const adminPassword = await bcrypt.hash("admin123", 10);
    await User.create({
      name: "Super Admin",
      email: "admin@lankaairportride.com",
      password: adminPassword,
      role: "ADMIN",
    });

    // Seed Airports
    const airports = await Airport.insertMany([
      {
        name: "Bandaranaike International Airport",
        code: "CMB",
        address: "Katunayake, Sri Lanka",
        latitude: 7.180479,
        longitude: 79.88331,
        pickupCharge: 500,
        isActive: true,
      },
      {
        name: "Mattala Rajapaksa International Airport",
        code: "HRI",
        address: "Mattala, Sri Lanka",
        latitude: 6.2847,
        longitude: 81.1219,
        pickupCharge: 400,
        isActive: true,
      },
    ]);

    // Seed Vehicle Types
    const vehicleTypes = await VehicleType.insertMany([
      {
        name: "Mini Car",
        description: "Compact car suitable for small groups and light luggage.",
        maxPassengers: 3,
        maxLuggage: 2,
        fuelType: "Petrol",
        averageFuelConsumption: 15,
        baseCharge: 500,
        pricePerKm: 120,
        minFare: 1000,
        waitingChargePerMin: 20,
        nightSurcharge: 300,
        airportSurcharge: 500,
        isActive: true,
      },
      {
        name: "Standard Car",
        description: "Comfortable sedan for couples or small families.",
        maxPassengers: 4,
        maxLuggage: 3,
        fuelType: "Petrol",
        averageFuelConsumption: 12,
        baseCharge: 500,
        pricePerKm: 150,
        minFare: 1500,
        waitingChargePerMin: 25,
        nightSurcharge: 400,
        airportSurcharge: 500,
        isActive: true,
      },
      {
        name: "Van",
        description: "Spacious van for families and groups.",
        maxPassengers: 8,
        maxLuggage: 6,
        fuelType: "Diesel",
        averageFuelConsumption: 9,
        baseCharge: 800,
        pricePerKm: 190,
        minFare: 2500,
        waitingChargePerMin: 30,
        nightSurcharge: 500,
        airportSurcharge: 800,
        isActive: true,
      },
    ]);

    return NextResponse.json(
      {
        message: "Database seeded successfully",
        data: {
          airports,
          vehicleTypes,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Seeding error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
