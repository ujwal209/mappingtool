// frontend/src/app/(auth)/reset-password/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2,
  AlertCircle,
  Lock,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronLeft,
} from "lucide-react";

const PURPLE = "#432DD7";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword } = useAuth();

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !newPassword) return;
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token.trim(), newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex font-sans antialiased">
      <div className="w-full h-full flex flex-col">
        {/* Top bar */}
        <div className="h-16 px-6 sm:px-8 flex items-center justify-between shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-black/60 hover:text-black transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Link>

          {/* Designed wordmark */}
          <Link href="/" className="flex items-baseline gap-1 select-none">
            <span className="text-[15px] font-bold tracking-[-0.045em] text-black leading-none">
              Migration
            </span>
            <span
              className="text-[15px] font-light tracking-[-0.02em] leading-none"
              style={{ color: `${PURPLE}99` }}
            >
              Studio
            </span>
            <span
              className="w-1 h-1 rounded-full mb-[2px] ml-[1px]"
              style={{ backgroundColor: PURPLE }}
            />
          </Link>
        </div>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-4 overflow-y-auto">
          <div className="w-full max-w-[400px] py-10">
            <div className="mb-8 text-center">
              <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-black leading-tight">
                Set new password
              </h1>
              <p className="text-[13.5px] text-black/50 mt-2">
                Choose a strong password to secure your account
              </p>
            </div>

            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-xl flex items-start gap-2.5 border"
                style={{
                  borderColor: `${PURPLE}40`,
                  backgroundColor: `${PURPLE}06`,
                }}
              >
                <AlertCircle
                  className="w-4 h-4 shrink-0 mt-0.5"
                  style={{ color: PURPLE }}
                />
                <p className="text-[12.5px] leading-relaxed flex-1 text-black/80">
                  {error}
                </p>
              </div>
            )}

            {success ? (
              <div className="space-y-5">
                <div
                  className="px-4 py-3.5 rounded-xl flex items-start gap-2.5 border"
                  style={{
                    borderColor: `${PURPLE}40`,
                    backgroundColor: `${PURPLE}06`,
                  }}
                >
                  <CheckCircle2
                    className="w-4 h-4 shrink-0 mt-0.5"
                    style={{ color: PURPLE }}
                  />
                  <div className="flex-1">
                    <p className="text-[12.5px] font-medium text-black">
                      Password updated
                    </p>
                    <p className="text-[11.5px] text-black/60 mt-0.5 leading-relaxed">
                      Sign in with your new password.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full h-11 text-white text-[13px] font-semibold rounded-xl transition hover:opacity-90 group inline-flex items-center justify-center"
                  style={{ backgroundColor: PURPLE }}
                >
                  <span className="inline-flex items-center gap-2">
                    Sign in
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-black mb-1.5">
                    Reset code
                  </label>
                  <div className="relative">
                    <KeyRound
                      className="w-[15px] h-[15px] absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(0,0,0,0.3)" }}
                    />
                    <input
                      type="text"
                      required
                      placeholder="Paste your reset code"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full h-11 pl-10 pr-3.5 text-[13px] text-black font-mono bg-white border border-black/10 rounded-xl focus:outline-none focus:border-[#432DD7] focus:ring-[3px] focus:ring-[#432DD7]/10 transition placeholder:text-black/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-black mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-[15px] h-[15px] absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(0,0,0,0.3)" }}
                    />
                    <input
                      type={showNew ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-11 pl-10 pr-11 text-[13px] text-black bg-white border border-black/10 rounded-xl focus:outline-none focus:border-[#432DD7] focus:ring-[3px] focus:ring-[#432DD7]/10 transition placeholder:text-black/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showNew ? (
                        <EyeOff className="w-[15px] h-[15px]" />
                      ) : (
                        <Eye className="w-[15px] h-[15px]" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-black mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-[15px] h-[15px] absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(0,0,0,0.3)" }}
                    />
                    <input
                      type={showConfirm ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-11 pl-10 pr-11 text-[13px] text-black bg-white border border-black/10 rounded-xl focus:outline-none focus:border-[#432DD7] focus:ring-[3px] focus:ring-[#432DD7]/10 transition placeholder:text-black/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? (
                        <EyeOff className="w-[15px] h-[15px]" />
                      ) : (
                        <Eye className="w-[15px] h-[15px]" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !token.trim() || newPassword.length < 8}
                  className="w-full h-11 text-white text-[13px] font-semibold rounded-xl transition hover:opacity-90 disabled:opacity-40 group inline-flex items-center justify-center mt-2"
                  style={{ backgroundColor: PURPLE }}
                >
                  {loading ? (
                    "Updating…"
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Update password
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-[13px] text-black/50">
              <Link
                href="/login"
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: PURPLE }}
              >
                Cancel and return to sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-black/5 px-6 sm:px-8 h-12 flex items-center justify-between text-[11px] text-black/40">
          <span>© 2026 Migration Studio</span>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="transition-opacity hover:opacity-70"
              style={{ color: PURPLE }}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-opacity hover:opacity-70"
              style={{ color: PURPLE }}
            >
              Terms
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-xs text-black/50 font-mono bg-white">
          Loading…
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}