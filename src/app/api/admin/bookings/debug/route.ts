import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Booking from "@/models/Booking";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  await dbConnect();
  
  const query: any = { 
    _id: id, 
    status: { $in: ["PENDING", "CONFIRMED"] },
    $or: [
      { driverId: null },
      { driverId: { $exists: false } }
    ]
  };
  
  const booking = await Booking.findOne(query);
  
  return NextResponse.json({ query, found: !!booking, booking });
}
