"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
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
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex font-sans antialiased">
      <div className="w-full h-full flex flex-col">
        <div className="h-16 px-8 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={130}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 overflow-y-auto">
          <div className="w-full max-w-[420px] py-10">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.06)] p-8">
              <div className="text-center mb-7">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
                  Set new password
                </h1>
                <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
                  Choose a strong password to secure your account
                </p>
              </div>

              {error && (
                <div className="mb-5 px-3.5 py-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-800 leading-relaxed flex-1">
                    {error}
                  </p>
                </div>
              )}

              {success ? (
                <div className="space-y-5">
                  <div className="px-4 py-3.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[12.5px] font-medium text-emerald-900">
                        Password updated
                      </p>
                      <p className="text-[11.5px] text-emerald-800 mt-0.5 leading-relaxed">
                        Sign in with your new password.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push("/login")}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg"
                  >
                    <span className="inline-flex items-center gap-2">
                      Sign in <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      Reset code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-[15px] h-[15px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Paste your reset code"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="w-full h-11 pl-10 pr-3.5 text-[13px] text-slate-900 font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      New password
                    </label>
                    <div className="relative">
                      <Lock className="w-[15px] h-[15px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNew ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-11 pl-10 pr-11 text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="w-[15px] h-[15px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-11 pl-10 pr-11 text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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

                  <Button
                    type="submit"
                    disabled={
                      loading || !token.trim() || newPassword.length < 8
                    }
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg disabled:opacity-50 mt-2"
                  >
                    {loading ? (
                      "Updating…"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Update password <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 pt-5 border-t border-slate-100 text-center text-[12.5px] text-slate-500">
                <Link
                  href="/login"
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Cancel and return to sign in
                </Link>
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Your password is hashed with bcrypt</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-xs text-slate-500 font-mono">
          Loading…
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}