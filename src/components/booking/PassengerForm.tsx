"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Lock, Mail, User as UserIcon } from "lucide-react";

const passengerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  nationality: z.string().min(2, "Nationality is required"),
  country: z.string().min(2, "Country of residence is required"),
  email: z.string().email("Invalid email address"),
  whatsappNumber: z.string().min(8, "WhatsApp number is required"),
  alternativePhoneNumber: z.string().optional(),
  arrivalDate: z.string().min(1, "Arrival date is required"),
  arrivalTime: z.string().min(1, "Arrival time is required"),
  flightNumber: z.string().min(2, "Flight number is required"),
  adults: z.number().min(1, "At least 1 adult is required").max(15),
  children: z.number().min(0).max(15),
  luggage: z.number().min(0).max(30),
  childSeatRequired: z.boolean().default(false),
  meetAndGreetRequired: z.boolean().default(false),
  specialRequests: z.string().optional(),
});

type PassengerFormValues = z.infer<typeof passengerSchema>;

import { LocationState } from "./PlacesAutocompleteInput";

interface PassengerFormProps {
  onBack: () => void;
  onSubmitSuccess: (bookingRef: string) => void;
  routeInfo: any;
  vehicle: any;
  origin: LocationState;
  destination: LocationState;
  airportId: string | null;
  fareBreakdown: any;
}

export default function PassengerForm({ 
  onBack, 
  onSubmitSuccess,
  routeInfo,
  vehicle,
  origin,
  destination,
  airportId,
  fareBreakdown
}: PassengerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<PassengerFormValues>({
    resolver: zodResolver(passengerSchema) as any,
    defaultValues: {
      adults: 1,
      children: 0,
      luggage: 1,
    }
  });

  const { data: session } = useSession();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingBookingData, setPendingBookingData] = useState<PassengerFormValues | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      if (authMode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword, role: "TOURIST" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      const result = await signIn("credentials", {
        email: authEmail,
        password: authPassword,
        redirect: false,
      });

      if (result?.error) throw new Error(result.error);
      
      // Successfully authenticated, now process the pending booking
      if (pendingBookingData) {
        setShowAuthGate(false);
        submitBookingToApi(pendingBookingData);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const submitBookingToApi = async (data: PassengerFormValues) => {
    setIsSubmitting(true);
    setError("");

    try {
      const payload: any = {
        pickupAddress: origin.address,
        pickupLat: origin.lat,
        pickupLng: origin.lng,
        destinationAddress: destination.address,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        arrivalDate: data.arrivalDate,
        arrivalTime: data.arrivalTime,
        flightNumber: data.flightNumber,
        vehicleTypeId: vehicle._id,
        distanceKm: routeInfo.distanceKm,
        durationMins: routeInfo.durationMins,
        passengerDetails: data,
        fareBreakdown,
        paymentMethod: "CASH_ON_ARRIVAL"
      };

      if (airportId) {
        payload.airportId = airportId;
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        onSubmitSuccess(result.data.bookingReference);
      } else {
        setError(result.error || "Failed to create booking");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: PassengerFormValues) => {
    if (!session) {
      setPendingBookingData(data);
      setShowAuthGate(true);
      return;
    }
    submitBookingToApi(data);
  };


  if (showAuthGate) {
    return (
      <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 max-w-xl mx-auto transform transition-all mt-6">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Almost there!</h2>
          <p className="text-slate-500 font-medium">Please {authMode === "login" ? "log in" : "sign up"} to confirm your booking.</p>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-6">
          {authMode === "signup" && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
              <div className="relative">
                <UserIcon size={20} className="absolute left-4 top-4 text-slate-400" />
                <input type="text" required value={authName} onChange={(e) => setAuthName(e.target.value)} className="w-full pl-12 p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-bold text-slate-800" placeholder="John Doe" />
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email</label>
            <div className="relative">
              <Mail size={20} className="absolute left-4 top-4 text-slate-400" />
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full pl-12 p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-bold text-slate-800" placeholder="john@example.com" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Password</label>
            <div className="relative">
              <Lock size={20} className="absolute left-4 top-4 text-slate-400" />
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full pl-12 p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-bold text-slate-800" placeholder="••••••••" />
            </div>
          </div>

          {authError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-sm font-medium border border-red-200 flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              {authError}
            </div>
          )}

          <div className="pt-4">
            <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/30 transition-all disabled:opacity-70 flex justify-center items-center">
              {authLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </span>
              ) : (authMode === "login" ? "Log in & Confirm Booking" : "Sign up & Confirm Booking")}
            </button>
          </div>

          <div className="text-center mt-6 flex flex-col gap-3">
            <button type="button" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
              {authMode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
            <button type="button" onClick={() => setShowAuthGate(false)} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
              Cancel & return to form
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Passenger Details</h2>
          <p className="text-slate-500 mt-1">Please provide accurate information for a smooth pickup.</p>
        </div>
        <button onClick={onBack} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Change Vehicle
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl mb-8 text-sm font-medium border border-red-200 flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
        
        {/* Contact Info */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
              <input {...register("fullName")} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
              {errors.fullName && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
              <input type="email" {...register("email")} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
              {errors.email && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp Number</label>
              <input {...register("whatsappNumber")} placeholder="+xx xxxxxxxxxx" className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
              {errors.whatsappNumber && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.whatsappNumber.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nationality</label>
                <input {...register("nationality")} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
                {errors.nationality && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.nationality.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Residence</label>
                <input {...register("country")} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
                {errors.country && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.country.message}</p>}
              </div>
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Flight Info */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
            Arrival Flight Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Flight Number</label>
              <input {...register("flightNumber")} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" placeholder="e.g. UL 504" />
              {errors.flightNumber && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.flightNumber.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Arrival Date</label>
              <input type="date" {...register("arrivalDate")} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
              {errors.arrivalDate && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.arrivalDate.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Arrival Time</label>
              <input type="time" {...register("arrivalTime")} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
              {errors.arrivalTime && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.arrivalTime.message}</p>}
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Requirements */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">3</span>
            Passenger & Luggage
          </h3>
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Adults</label>
              <input type="number" min="1" {...register("adults", { valueAsNumber: true })} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
              {errors.adults && <p className="text-red-500 text-xs font-bold mt-1.5">{errors.adults.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Children</label>
              <input type="number" min="0" {...register("children", { valueAsNumber: true })} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Luggage</label>
              <input type="number" min="0" {...register("luggage", { valueAsNumber: true })} className="w-full p-3.5 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800" />
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <label className="flex items-center gap-3 text-slate-700 cursor-pointer p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
              <input type="checkbox" {...register("childSeatRequired")} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <div className="flex-1">
                <div className="font-bold">Child Seat Required</div>
                <div className="text-sm text-slate-500 mt-0.5">Add LKR 1,000 to total fare</div>
              </div>
            </label>
            <label className="flex items-center gap-3 text-slate-700 cursor-pointer p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
              <input type="checkbox" {...register("meetAndGreetRequired")} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <div className="flex-1">
                <div className="font-bold">Airport Meet & Greet</div>
                <div className="text-sm text-slate-500 mt-0.5">Driver waits with a name board (Add LKR 500)</div>
              </div>
            </label>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Special Requests (Optional)</label>
            <textarea {...register("specialRequests")} rows={3} className="w-full p-4 border-2 border-slate-200 rounded-2xl bg-slate-50 hover:bg-white focus:bg-white focus:ring-0 focus:border-blue-500 transition-all font-medium text-slate-800 resize-none"></textarea>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-slate-50 p-6 md:p-8 rounded-3xl border border-blue-100/50 shadow-inner">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-sm text-slate-600 max-w-md">
              <p className="font-medium text-slate-500 mb-2 uppercase tracking-wider text-xs">Payment Method</p>
              <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                Cash on Arrival
              </div>
              <p className="mt-2 text-slate-500 text-xs">By clicking confirm, you agree to pay the driver upon arrival.</p>
            </div>
            
            <div className="text-right w-full md:w-auto bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Estimated Fare</div>
              <div className="text-4xl font-black text-blue-700">LKR {fareBreakdown.totalEstimatedFare.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-12 py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/30 transition-all w-full md:w-auto disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-1"
          >
            {isSubmitting ? "Processing Booking..." : "Confirm Booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
