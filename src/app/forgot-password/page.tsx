"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Mail,
  ArrowLeft,
  Loader2,
  CheckCircle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

type RecoveryStep = "REQUEST_EMAIL" | "VERIFY_OTP" | "NEW_PASSWORD" | "SUCCESS";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roleParam = searchParams.get("role")?.toLowerCase();

  const [step, setStep] = useState<RecoveryStep>("REQUEST_EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetAuthToken, setResetAuthToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [emailNotConfigured, setEmailNotConfigured] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // 60-second cooldown timer countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first OTP box when entering VERIFY_OTP step
  useEffect(() => {
    if (step === "VERIFY_OTP") {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Step 1: Request Code
  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    setEmailNotConfigured(false);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.status === 503 || data.emailConfigured === false) {
        setEmailNotConfigured(true);
        setError(data.error || "Email delivery service is currently not configured on this server.");
        setLoading(false);
        return;
      }

      if (res.status === 429) {
        setError(data.error || "Too many requests. Please wait before trying again.");
        if (data.retryAfter) setCooldown(data.retryAfter);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "An unexpected error occurred. Please try again.");
        setLoading(false);
        return;
      }

      // Always show uniform anti-enumeration message (Requirement 3)
      setInfoMessage(data.message || "If an account exists for this email, a verification code will be sent.");
      setCooldown(60); // 60s cooldown (Requirement 6)
      setOtp(["", "", "", "", "", ""]);
      setStep("VERIFY_OTP");
    } catch {
      setError("Unable to connect to the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Resend code handler with cooldown check
  const handleResendCode = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError(data.error || "Please wait before requesting a new code.");
        if (data.retryAfter) setCooldown(data.retryAfter);
      } else if (!res.ok) {
        setError(data.error || "Failed to resend code.");
      } else {
        setInfoMessage(data.message || "If an account exists for this email, a verification code will be sent.");
        setCooldown(60);
        setOtp(["", "", "", "", "", ""]);
        otpInputsRef.current[0]?.focus();
      }
    } catch {
      setError("Failed to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  // OTP box input handling (auto-advance, backspace, paste)
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "");
    const newOtp = [...otp];

    if (digit.length > 1) {
      // Pasted multiple digits
      const digits = digit.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || "";
      }
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    pasted.split("").forEach((char, idx) => {
      if (idx < 6) newOtp[idx] = char;
    });
    setOtp(newOtp);
    const targetIdx = Math.min(pasted.length, 5);
    otpInputsRef.current[targetIdx]?.focus();
  };

  // Step 2: Verify Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid or expired verification code.");
        setLoading(false);
        return;
      }

      // Valid: server consumed code and issued short-lived single-use resetAuthToken (Requirement 7)
      setResetAuthToken(data.resetAuthToken);
      setError("");
      setStep("NEW_PASSWORD");
    } catch {
      setError("Failed to verify code. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          resetAuthToken,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password. Please start over.");
        setLoading(false);
        return;
      }

      setStep("SUCCESS");
    } catch {
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loginUrl = roleParam ? `/login?role=${roleParam}` : "/login";

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[45%] h-[45%] rounded-full bg-blue-400/10 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[35%] h-[35%] rounded-full bg-blue-600/10 blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-6 bg-white/85 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100 z-10 relative transition-all">
        {/* Header Icon & Title */}
        <div className="text-center">
          {step === "REQUEST_EMAIL" ? (
            <div className="flex justify-center mb-5">
              <BrandLogo variant="icon" size="md" linkToHome={true} />
            </div>
          ) : (
            <div className="mx-auto bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30">
              {step === "VERIFY_OTP" ? (
                <KeyRound size={26} />
              ) : step === "NEW_PASSWORD" ? (
                <Lock size={26} />
              ) : (
                <ShieldCheck size={28} />
              )}
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {step === "REQUEST_EMAIL" && "Password Recovery"}
            {step === "VERIFY_OTP" && "Enter Verification Code"}
            {step === "NEW_PASSWORD" && "Set New Password"}
            {step === "SUCCESS" && "Password Reset Successful"}
          </h1>

          <p className="mt-2 text-sm text-slate-500 font-medium max-w-sm mx-auto">
            {step === "REQUEST_EMAIL" && (
              <>
                Enter your registered email to receive a 6-digit verification code.
                {roleParam && (
                  <span className="block mt-1 font-semibold text-blue-600 capitalize">
                    {roleParam} Account
                  </span>
                )}
              </>
            )}
            {step === "VERIFY_OTP" && (
              <>
                A 6-digit code was sent to <strong className="text-slate-800">{email}</strong>. It expires in 10 minutes.
              </>
            )}
            {step === "NEW_PASSWORD" && "Create a secure password with at least 8 characters."}
            {step === "SUCCESS" && "Your password has been updated. You can now log in securely."}
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div
            role="alert"
            className="bg-red-50 text-red-700 text-sm font-semibold p-3.5 rounded-xl border border-red-200 flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <span>{error}</span>
              {emailNotConfigured && (
                <div className="mt-2 text-xs font-normal text-red-600 bg-red-100/60 p-2 rounded-lg">
                  <strong>Administrator Setup:</strong> Please configure <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{" "}
                  <code>SMTP_USER</code>, and <code>SMTP_PASS</code> in your environment variables.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === "REQUEST_EMAIL" && (
          <form className="space-y-5" onSubmit={handleRequestCode}>
            <div>
              <label htmlFor="recovery-email" className="block text-sm font-semibold text-slate-700 mb-2">
                Registered Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-slate-400" />
                </div>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800 text-sm font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sending Code...
                </>
              ) : (
                "Send Verification Code"
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href={loginUrl}
                className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: Enter 6-Digit OTP */}
        {step === "VERIFY_OTP" && (
          <form className="space-y-6" onSubmit={handleVerifyOtp}>
            {infoMessage && (
              <div className="bg-blue-50/80 border border-blue-200 text-blue-900 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle size={16} className="text-blue-600 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-700">6-Digit Code</label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("REQUEST_EMAIL");
                    setError("");
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Change Email
                </button>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-between gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputsRef.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    aria-label={`Digit ${idx + 1}`}
                    className="w-12 h-13 sm:w-13 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold border-2 border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verifying Code...
                </>
              ) : (
                "Verify Code"
              )}
            </button>

            {/* 60s Resend Cooldown Section (Requirement 6) */}
            <div className="text-center pt-1">
              {cooldown > 0 ? (
                <p className="text-xs font-medium text-slate-500">
                  Resend code in <strong className="text-slate-700 font-bold">{cooldown}s</strong>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
                  {resending ? "Resending..." : "Didn't receive code? Resend Code"}
                </button>
              )}
            </div>
          </form>
        )}

        {/* STEP 3: Enter New Password */}
        {step === "NEW_PASSWORD" && (
          <form className="space-y-5" onSubmit={handleResetPassword}>
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="block w-full pl-10 pr-12 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800 text-sm font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="block text-sm font-semibold text-slate-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Re-enter new password"
                  className="block w-full pl-10 pr-12 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all text-slate-800 text-sm font-medium"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className={password.length >= 8 ? "text-green-600 font-semibold" : "text-slate-500"}>
                ✓ Minimum 8 characters
              </p>
              <p className={password && password === confirmPassword ? "text-green-600 font-semibold" : "text-slate-500"}>
                ✓ Passwords match
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || password.length < 8 || password !== confirmPassword}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Save New Password"
              )}
            </button>
          </form>
        )}

        {/* STEP 4: Success State (Requirement 9 & 10) */}
        {step === "SUCCESS" && (
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="bg-green-50 border border-green-200 p-5 rounded-2xl text-green-900 text-sm space-y-2">
              <p className="font-bold text-base">Your password has been changed</p>
              <p className="text-xs text-green-700 leading-relaxed">
                All existing sessions on other devices and browsers have been invalidated for your safety. A
                confirmation email has also been sent to your address.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push(loginUrl)}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 text-sm"
            >
              Sign In with New Password
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-80px)] bg-slate-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
