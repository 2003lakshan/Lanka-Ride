import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    if (!body.destinationLat || !body.destinationLng || (body.destinationLat === 0 && body.destinationLng === 0)) {
      return NextResponse.json({ error: "Valid destination coordinates are required" }, { status: 400 });
    }

    // 1. Generate unique booking reference (LAR-YYYY-XXXXX)
    const year = new Date().getFullYear();
    const count = await Booking.countDocuments({
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`),
      },
    });
    const referenceNumber = String(count + 1).padStart(5, "0");
    const bookingReference = `LAR-${year}-${referenceNumber}`;

    const session = await getServerSession(authOptions);
    const touristId = session?.user ? (session.user as any).id : undefined;

    // 2. Create the booking
    const booking = await Booking.create({
      ...body,
      bookingReference,
      status: "PENDING",
      touristId,
    });

    return NextResponse.json(
      {
        message: "Booking created successfully",
        data: {
          bookingReference: booking.bookingReference,
          id: booking._id,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Booking creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create booking" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref");
    const email = searchParams.get("email");

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized. Please log in to track bookings." }, { status: 401 });
    }

    if (ref && email) {
      const query: any = { 
        bookingReference: ref,
        "passengerDetails.email": email
      };
      
      // If user is a tourist, ensure they can only track their own bookings if touristId is set
      // Some bookings might be guest bookings, but the prompt says "only allow logged-in users (tourists) to track their rides"
      // Assuming they must be the owner of the booking
      if ((session.user as any).role === "TOURIST") {
         query.touristId = (session.user as any).id;
      }

      const booking = await Booking.findOne(query)
      .populate('airportId')
      .populate('vehicleTypeId')
      .populate('driverId', 'name phoneNumber vehicleRegistration')
      .lean();
      
      if (!booking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      return NextResponse.json({ data: booking }, { status: 200 });
    } else {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const role = (session.user as any).role;
      let query = {};

      if (role === "TOURIST") {
        query = { touristId: (session.user as any).id };
      } else if (role === "DRIVER") {
         // Drivers can see pending bookings and their own assigned bookings
        query = { 
           $or: [
             { status: "PENDING" },
             { status: "CONFIRMED" },
             { driverId: (session.user as any).id }
           ]
        };
      }
      // ADMIN sees everything (query = {})

      const bookings = await Booking.find(query)
        .populate('airportId')
        .populate('vehicleTypeId')
        .sort({ createdAt: -1 });
      return NextResponse.json({ data: bookings }, { status: 200 });
    }
  } catch (error: any) {
    console.error("Fetch bookings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
