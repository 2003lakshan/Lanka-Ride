import dbConnect from "@/lib/mongodb";
import Airport from "@/models/Airport";
import VehicleType from "@/models/VehicleType";
import BookingClient from "@/components/booking/BookingClient";

export default async function BookingPage() {
  await dbConnect();

  // Fetch initial data for the booking form
  const airports = await Airport.find({ isActive: true }).lean();
  const vehicles = await VehicleType.find({ isActive: true }).lean();

  // Serialize MongoDB ObjectId to string for client component
  const serializedAirports = airports.map((a: any) => ({
    ...a,
    _id: a._id.toString(),
  }));

  const serializedVehicles = vehicles.map((v: any) => ({
    ...v,
    _id: v._id.toString(),
  }));

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Book Your Airport Transfer</h1>
        <BookingClient 
          initialAirports={serializedAirports} 
          initialVehicles={serializedVehicles} 
        />
      </div>
    </div>
  );
}
