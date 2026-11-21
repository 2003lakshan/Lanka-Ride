"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Mail, Lock, LogIn, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { signIn, getSession } from "next-auth/react";
import BrandLogo from "@/components/brand/BrandLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginMode, setLoginMode] = useState<"RIDER" | "DRIVER">("RIDER");
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);

  const isRedirectingRef = useRef(false);

  // Direct client mount & URL param parsing without Suspense deopt
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        const role = sp.get("role");
        if (role && role.toUpperCase() === "DRIVER") {
          setLoginMode("DRIVER");
        }
        const cb = sp.get("callbackUrl");
        if (cb) {
          setCallbackUrl(cb);
        }
      } catch (e) {
        console.warn("Could not parse search params:", e);
      }
    }
  }, []);

  // Safe relative URL resolver to keep users on same LAN IP or localhost
  const getSafeRelativeUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith("/")) {
      return url === "/login" || url.startsWith("/login?") ? null : url;
    }
    try {
      const parsed = new URL(url);
      const relative = parsed.pathname + parsed.search;
      return relative === "/login" || relative.startsWith("/login?") ? null : relative;
    } catch {
      return null;
    }
  };

  // ONE form onSubmit handler with preventDefault()
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof (e as any).stopPropagation === "function") {
      (e as any).stopPropagation();
    }

    if (isRedirectingRef.current) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please enter both email address and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: trimmedEmail,
        password,
        role: loginMode,
        redirect: false,
      });

      if (!result || !result.ok || result.error) {
        let errorMsg = result?.error;
        if (!errorMsg || errorMsg === "CredentialsSignin") {
          errorMsg = "Invalid email or password. Please verify your credentials.";
        }
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Verify active session
      let session = await getSession();
      if (!session?.user) {
        await new Promise((r) => setTimeout(r, 200));
        session = await getSession();
      }

      const verifiedRole = (session?.user as any)?.role;
      const safeCallback = getSafeRelativeUrl(callbackUrl);
      let targetPath = safeCallback;

      if (!targetPath) {
        if (verifiedRole === "ADMIN") {
          targetPath = "/admin";
        } else if (verifiedRole === "DRIVER" || loginMode === "DRIVER") {
          targetPath = "/driver";
        } else {
          targetPath = "/my-bookings";
        }
      }

      isRedirectingRef.current = true;
      window.location.href = targetPath!;
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during login. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 flex flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-6 bg-white/90 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100 z-10 relative">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <BrandLogo variant="icon" size="lg" linkToHome={true} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Sign in to manage your {loginMode === "RIDER" ? "bookings" : "fleet"}
          </p>
        </div>

        {/* Role Toggle Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-4">
          <button 
            type="button"
            onClick={() => {
              setLoginMode("RIDER");
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${loginMode === "RIDER" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            I'm a Rider
          </button>
          <button 
            type="button"
            onClick={() => {
              setLoginMode("DRIVER");
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${loginMode === "DRIVER" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            I'm a Driver
          </button>
        </div>
        
        {/* ONE form onSubmit handler with preventDefault() */}
        <form 
          method="POST" 
          noValidate 
          onSubmit={handleLogin} 
          className="space-y-5"
        >
          <div>
            <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-2">Email address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail size={18} className="text-slate-400" />
              </div>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800 text-base"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-400" />
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800 text-base"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div 
              id="login-error-banner"
              role="alert"
              className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 py-3 px-4 rounded-xl flex items-center gap-2 animate-in fade-in duration-200"
            >
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            {/* Normal submit button without duplicate onClick logic */}
            <button
              type="submit"
              id="login-submit-button"
              disabled={loading}
              className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-400 disabled:shadow-none cursor-pointer touch-manipulation min-h-[48px]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                  <ArrowRight size={16} className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
                </>
              )}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-slate-600">
              Don't have an account?{" "}
              <Link href={loginMode === "RIDER" ? (callbackUrl ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signup") : "/driver/register"} className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                Sign up as a {loginMode === "RIDER" ? "Rider" : "Driver"}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
