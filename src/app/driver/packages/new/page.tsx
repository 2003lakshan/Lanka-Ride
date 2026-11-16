"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Package, MapPin, Calendar, Users, DollarSign, Image as ImageIcon } from "lucide-react";
import Link from "next/link";

export default function CreatePackagePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    category: "Cultural Tour",
    shortDescription: "",
    coverPhoto: "",
    startingCity: "",
    pickupOptions: "Any hotel in starting city",
    days: 1,
    nights: 0,
    minPassengers: 1,
    maxPassengers: 4,
    vehicleTypeId: "669911990000000000000000", // Will need real dynamic selection
    availableDates: "Dates arranged with rider",
    
    // Simplistic default itinerary/costs for MVP creation
    itinerary: [{ dayNumber: 1, placesToVisit: [], notes: "" }],
    meals: [{ dayNumber: 1, breakfast: { status: 'NOT_INCLUDED' }, lunch: { status: 'NOT_INCLUDED' }, dinner: { status: 'NOT_INCLUDED' } }],
    costs: { 
      basePrice: 10000, 
      totalStartingPrice: 10000,
      priceType: 'PER_VEHICLE',
      passengerCountCovered: 4,
      inclusions: [],
      exclusions: [],
      cancellationTerms: "Flexible",
      conditions: "Standard terms apply"
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "days" || name === "nights" || name === "minPassengers" || name === "maxPassengers" ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/driver/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create package");

      router.push("/driver/packages");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <Link href="/driver/packages" className="text-blue-600 hover:underline text-sm font-medium mb-4 inline-block">&larr; Back to Packages</Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Travel Package</h1>
          <p className="text-slate-600">Design a custom itinerary to offer to tourists.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 p-6 text-white flex items-center gap-4">
            <Package size={28} />
            <h2 className="text-xl font-bold">Package Details (Draft)</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-medium">
                {error}
              </div>
            )}

            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Package Title</label>
                  <input type="text" name="title" required value={formData.title} onChange={handleChange} placeholder="e.g. 3-Day Cultural Triangle Tour" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50">
                    <option value="Safari">Safari</option>
                    <option value="Cultural Tour">Cultural Tour</option>
                    <option value="Beach Tour">Beach Tour</option>
                    <option value="Hill Country">Hill Country</option>
                    <option value="Island Tour">Island Tour</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Short Description</label>
                  <textarea name="shortDescription" required value={formData.shortDescription} onChange={handleChange} rows={3} placeholder="Briefly describe what makes this tour special..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Cover Photo URL</label>
                  <input type="url" name="coverPhoto" required value={formData.coverPhoto} onChange={handleChange} placeholder="https://example.com/image.jpg" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Logistics & Duration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Starting City</label>
                  <input type="text" name="startingCity" required value={formData.startingCity} onChange={handleChange} placeholder="e.g. Colombo or Kandy" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Pickup Options</label>
                  <input type="text" name="pickupOptions" required value={formData.pickupOptions} onChange={handleChange} placeholder="e.g. Any hotel in starting city" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Days</label>
                    <input type="number" name="days" min="1" required value={formData.days} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nights</label>
                    <input type="number" name="nights" min="0" required value={formData.nights} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Min Passengers</label>
                    <input type="number" name="minPassengers" min="1" required value={formData.minPassengers} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Max Passengers</label>
                    <input type="number" name="maxPassengers" min="1" required value={formData.maxPassengers} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 flex justify-end">
              <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-colors disabled:opacity-70 flex items-center gap-2"
              >
                {loading ? "Saving Draft..." : "Save Draft & Continue"}
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}
