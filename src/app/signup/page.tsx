"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import BrandLogo from "@/components/brand/BrandLogo";

function getSafeRelativeUrl(url: string | null): string | null {
  if (!url) return null;
  // Prevent open redirects: must start with / and not // or /\\
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) {
    return url;
  }
  return null;
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        const cb = sp.get("callbackUrl");
        if (cb) {
          setCallbackUrl(cb);
        }
      } catch {
        // Ignore URL parsing errors
      }
    }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: "TOURIST", // Default sign up is for tourists / riders
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account.");
      }

      // Automatically sign in after sign up
      const signInResult = await signIn("credentials", {
        email: email.trim(),
        password,
        role: "RIDER",
        redirect: false,
      });

      if (signInResult?.error) {
        throw new Error(signInResult.error);
      }

      const safeTarget = getSafeRelativeUrl(callbackUrl) || "/my-bookings";
      window.location.href = safeTarget;
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during signup.");
      setLoading(false);
    }
  };

  const loginLink = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-xl border border-slate-100 z-10 relative">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <BrandLogo variant="icon" size="lg" linkToHome={true} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Create an account</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Join At Your Service – Powered by Pexora to book and track your local rides, tours, and airport transfers.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

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
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
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

          {error && (
            <div
              role="alert"
              className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 py-3 px-4 rounded-xl flex items-center gap-2"
            >
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none min-h-[48px]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight
                    size={16}
                    className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0"
                  />
                </>
              )}
            </button>
          </div>

          <div className="text-center mt-6">
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link href={loginLink} className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                Log in
              </Link>
            </p>
          </div>
          <div className="text-center mt-2">
            <p className="text-sm text-slate-600">
              Want to drive for us?{" "}
              <Link
                href="/driver/register"
                className="font-semibold text-blue-600 hover:text-blue-500 transition-colors"
              >
                Apply as a Driver
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
