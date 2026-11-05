"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Mail,
  KeyRound,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const tok = await forgotPassword(email.trim());
      setResetToken(tok || "token-generated");
    } catch (err: any) {
      setError(err.message || "Failed to initiate password reset.");
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
                  <KeyRound className="w-5 h-5" />
                </div>
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
                  Reset password
                </h1>
                <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
                  Enter your email and we&apos;ll send you a reset code
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

              {resetToken ? (
                <div className="space-y-5">
                  <div className="px-4 py-3.5 bg-emerald-50 border border-emerald-100 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-[12.5px] font-medium text-emerald-900">
                        Reset code sent
                      </p>
                    </div>
                    <p className="text-[11.5px] text-emerald-800 leading-relaxed">
                      Check your inbox for the reset code. You can also continue
                      below to enter your code manually.
                    </p>
                  </div>

                  <Button
                    onClick={() =>
                      router.push(
                        `/reset-password${
                          resetToken !== "token-generated"
                            ? `?token=${encodeURIComponent(resetToken)}`
                            : ""
                        }`
                      )
                    }
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg"
                  >
                    <span className="inline-flex items-center gap-2">
                      Continue <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="w-[15px] h-[15px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-11 pl-10 pr-3.5 text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg disabled:opacity-50"
                  >
                    {loading ? (
                      "Sending…"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Send reset code <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 pt-5 border-t border-slate-100 text-center text-[12.5px] text-slate-500">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Your data is encrypted in transit and at rest</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}