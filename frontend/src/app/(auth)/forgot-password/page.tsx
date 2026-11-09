// frontend/src/app/(auth)/forgot-password/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Mail,
  ChevronLeft,
} from "lucide-react";

const PURPLE = "#432DD7";

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
                Reset password
              </h1>
              <p className="text-[13.5px] text-black/50 mt-2">
                Enter your email and we&apos;ll send you a reset code
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

            {resetToken ? (
              <div className="space-y-5">
                <div
                  className="px-4 py-3.5 rounded-xl border space-y-1.5"
                  style={{
                    borderColor: `${PURPLE}40`,
                    backgroundColor: `${PURPLE}06`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="w-4 h-4"
                      style={{ color: PURPLE }}
                    />
                    <p className="text-[12.5px] font-medium text-black">
                      Reset code sent
                    </p>
                  </div>
                  <p className="text-[11.5px] text-black/60 leading-relaxed">
                    Check your inbox for the reset code. You can also continue
                    below to enter your code manually.
                  </p>
                </div>

                <button
                  onClick={() =>
                    router.push(
                      `/reset-password${
                        resetToken !== "token-generated"
                          ? `?token=${encodeURIComponent(resetToken)}`
                          : ""
                      }`
                    )
                  }
                  className="w-full h-11 text-white text-[13px] font-semibold rounded-xl transition hover:opacity-90 group inline-flex items-center justify-center"
                  style={{ backgroundColor: PURPLE }}
                >
                  <span className="inline-flex items-center gap-2">
                    Continue
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[12px] font-medium text-black mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-[15px] h-[15px] absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(0,0,0,0.3)" }}
                    />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-3.5 text-[13px] text-black bg-white border border-black/10 rounded-xl focus:outline-none focus:border-[#432DD7] focus:ring-[3px] focus:ring-[#432DD7]/10 transition placeholder:text-black/30"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 text-white text-[13px] font-semibold rounded-xl transition hover:opacity-90 disabled:opacity-40 group inline-flex items-center justify-center"
                  style={{ backgroundColor: PURPLE }}
                >
                  {loading ? (
                    "Sending…"
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Send reset code
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-[13px] text-black/50">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: PURPLE }}
              >
                Sign in
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