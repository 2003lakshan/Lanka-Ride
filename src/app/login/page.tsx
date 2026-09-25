"use client";

import { useState } from "react";
import Link from "next/link";
import { Plane, Mail, Lock, LogIn, ArrowRight } from "lucide-react";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginMode, setLoginMode] = useState<"RIDER" | "DRIVER">("RIDER");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    const result = await signIn("credentials", {
      email,
      password,
      role: loginMode,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Fetch session to determine role and redirect accordingly
      const session = await getSession();
      const role = (session?.user as any)?.role;
      
      if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "DRIVER") {
        router.push("/driver");
      } else {
        router.push("/my-bookings");
      }
      router.refresh();
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-xl border border-slate-100 z-10 relative">
        <div className="text-center">
          <div className="mx-auto bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
            <Plane size={28} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Sign in to manage your {loginMode === "RIDER" ? "bookings" : "fleet"}
          </p>
        </div>

        {/* Role Toggle Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => setLoginMode("RIDER")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${loginMode === "RIDER" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            I'm a Rider
          </button>
          <button 
            type="button"
            onClick={() => setLoginMode("DRIVER")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${loginMode === "DRIVER" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            I'm a Driver
          </button>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800"
                  placeholder="admin@lankaairportride.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <Link href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <div className="text-red-500 text-sm font-semibold text-center bg-red-50 py-2 rounded-lg">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                  <ArrowRight size={16} className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
                </>
              )}
            </button>
          </div>
          
          <div className="text-center mt-6">
            <p className="text-sm text-slate-600">
              Don't have an account?{" "}
              <Link href={loginMode === "RIDER" ? "/signup" : "/driver/register"} className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                Sign up as a {loginMode === "RIDER" ? "Rider" : "Driver"}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
