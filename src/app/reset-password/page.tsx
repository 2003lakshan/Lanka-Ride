"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { Lock, Plane, Loader2, CheckCircle, EyeOff, Eye } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("resetAuthToken");
  const email = searchParams.get("email");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!token || !email) {
      setError("Missing reset authorization. Please request a verification code.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetAuthToken: token,
          token,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-xl border border-slate-100 z-10 relative">
        <div className="text-center">
          <div className="mx-auto bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
            <Plane size={28} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Reset Password</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Enter a new password for your account.
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 text-green-800 p-6 rounded-2xl border border-green-200 text-center animate-in zoom-in-95 duration-300">
            <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
            <h3 className="text-lg font-bold mb-2">Password Reset Successful</h3>
            <p className="text-sm mb-6">
              Your password has been reset. All existing sessions have been signed out for security.
            </p>
            <Link 
              href="/login" 
              className="inline-block w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
            >
              Please sign in
            </Link>
          </div>
        ) : !token || !email ? (
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center space-y-4">
            <p className="text-sm text-slate-600">
              To reset your password, please request a 6-digit verification code.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all text-sm shadow-md"
            >
              Request Verification Code
            </Link>
            <div>
              <Link href="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    className="block w-full pl-10 pr-12 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="block w-full pl-10 pr-12 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm font-semibold text-center bg-red-50 py-3 px-4 rounded-xl border border-red-100 flex flex-col gap-2">
                <span>{error}</span>
                {error.includes("Invalid or expired") && (
                  <Link href="/forgot-password" className="text-red-700 underline text-xs">
                    Request a new link
                  </Link>
                )}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !token || !email}
                className="group w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  "Reset Password"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
