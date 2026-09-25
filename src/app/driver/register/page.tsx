"use client";

import { useState } from "react";
import Link from "next/link";
import { Plane, Mail, Lock, User, Car, FileText, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function DriverRegistrationPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phoneNumber: "",
    licenseNumber: "",
    vehicleRegistration: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          role: "DRIVER",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to register as driver");
      }

      // Automatically sign in
      const signInResult = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        role: "DRIVER",
        redirect: false,
      });

      if (signInResult?.error) {
        throw new Error(signInResult.error);
      }

      router.push("/driver");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-3xl"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[30%] h-[30%] rounded-full bg-indigo-600/10 blur-3xl"></div>
      </div>

      <div className="max-w-2xl mx-auto space-y-8 bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 z-10 relative">
        <div className="text-center">
          <div className="mx-auto bg-slate-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-slate-900/30">
            <Car size={28} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Become a Driver</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium max-w-md mx-auto">
            Join our fleet and start earning by providing premium airport transfers to tourists in Sri Lanka.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
            <p className="text-sm text-blue-800 font-medium flex gap-2">
              <span className="shrink-0 text-xl">ℹ️</span> 
              <span>New driver accounts require admin approval before you can start accepting rides. Please provide accurate details.</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Details */}
            <div className="space-y-5 md:col-span-2">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Personal Information</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full pl-10 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800" placeholder="John Doe" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-slate-400 text-sm font-bold">+94</span>
                <input type="text" name="phoneNumber" required value={formData.phoneNumber} onChange={handleChange} className="w-full pl-11 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800" placeholder="77 123 4567" />
              </div>
            </div>

            {/* Account Details */}
            <div className="space-y-5 md:col-span-2 mt-4">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Account Setup</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full pl-10 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800" placeholder="driver@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input type="password" name="password" required value={formData.password} onChange={handleChange} className="w-full pl-10 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800" placeholder="••••••••" />
              </div>
            </div>

            {/* Vehicle & License Details */}
            <div className="space-y-5 md:col-span-2 mt-4">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Vehicle & License</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Driving License Number</label>
              <div className="relative">
                <FileText size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input type="text" name="licenseNumber" required value={formData.licenseNumber} onChange={handleChange} className="w-full pl-10 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800" placeholder="e.g. B1234567" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Vehicle Registration Number</label>
              <div className="relative">
                <Car size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input type="text" name="vehicleRegistration" required value={formData.vehicleRegistration} onChange={handleChange} className="w-full pl-10 p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white transition-all text-slate-800" placeholder="e.g. CAA-1234 or WP CBA-5678" />
              </div>
            </div>
          </div>

          {error && <div className="text-red-500 text-sm font-semibold text-center bg-red-50 py-3 rounded-lg border border-red-100">{error}</div>}

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent text-lg font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? (
                "Submitting Application..."
              ) : (
                <>
                  Submit Application
                  <ArrowRight size={20} className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
                </>
              )}
            </button>
          </div>
          
          <div className="text-center mt-6">
            <p className="text-sm text-slate-600">
              Already have a driver account?{" "}
              <Link href="/login" className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                Log in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
