// frontend/src/app/(auth)/verify-email/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const PURPLE = "#432DD7";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, resendVerification, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    const tokenParam = searchParams.get("token");
    if (emailParam) setEmail(emailParam);
    if (tokenParam && tokenParam.length === 6) {
      setToken(tokenParam);
      runVerify(tokenParam, emailParam || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const runVerify = async (tok: string, mailOverride?: string) => {
    if (!tok.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const targetEmail = mailOverride || email.trim() || undefined;
      await verifyEmail(tok.trim(), targetEmail);
      setSuccess(true);
      setNotice("Your email has been verified.");
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim().length !== 6) {
      setError("Enter the full 6-digit code.");
      return;
    }
    await runVerify(token);
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError("Enter your email to receive a new code.");
      return;
    }
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await resendVerification(email.trim());
      setNotice(`New code sent to ${email.trim()}.`);
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
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
                Verify your email
              </h1>
              <p className="text-[13.5px] text-black/50 mt-2 leading-relaxed">
                Enter the 6-digit code we sent to
              </p>
              {email && (
                <span
                  className="inline-block mt-3 text-[12.5px] font-medium px-3 py-1 rounded-full"
                  style={{
                    color: PURPLE,
                    backgroundColor: `${PURPLE}10`,
                  }}
                >
                  {email}
                </span>
              )}
            </div>

            {error && (
              <div
                className="mb-5 px-4 py-3 rounded-xl flex items-start gap-2.5 border"
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

            {notice && (
              <div
                className="mb-5 px-4 py-3 rounded-xl flex items-start gap-2.5 border"
                style={{
                  borderColor: `${PURPLE}40`,
                  backgroundColor: `${PURPLE}06`,
                }}
              >
                <CheckCircle2
                  className="w-4 h-4 shrink-0 mt-0.5"
                  style={{ color: PURPLE }}
                />
                <p className="text-[12.5px] leading-relaxed flex-1 text-black/80">
                  {notice}
                </p>
              </div>
            )}

            {success ? (
              <button
                onClick={() =>
                  router.push(isAuthenticated ? "/dashboard" : "/login")
                }
                className="w-full h-11 text-white text-[13px] font-semibold rounded-xl transition hover:opacity-90 group inline-flex items-center justify-center"
                style={{ backgroundColor: PURPLE }}
              >
                <span className="inline-flex items-center gap-2">
                  {isAuthenticated ? "Go to dashboard" : "Sign in"}
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ) : (
              <form onSubmit={handleManual} className="space-y-5">
                {!email && (
                  <div>
                    <label className="block text-[12px] font-medium text-black mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 px-3.5 text-[13px] text-black bg-white border border-black/10 rounded-xl focus:outline-none focus:border-[#432DD7] focus:ring-[3px] focus:ring-[#432DD7]/10 transition placeholder:text-black/30"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-medium text-black mb-2 text-center">
                    Verification code
                  </label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={token}
                      onChange={(val) => {
                        setToken(val);
                        if (val.length === 6) runVerify(val);
                      }}
                    >
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className="w-11 h-12 text-base font-semibold border border-black/10 rounded-xl text-black bg-white data-[active=true]:border-[#432DD7] data-[active=true]:ring-[3px] data-[active=true]:ring-[#432DD7]/10 transition"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || token.trim().length !== 6}
                  className="w-full h-11 text-white text-[13px] font-semibold rounded-xl transition hover:opacity-90 disabled:opacity-40 group inline-flex items-center justify-center"
                  style={{ backgroundColor: PURPLE }}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying…
                    </span>
                  ) : (
                    "Verify code"
                  )}
                </button>

                <div className="flex items-center justify-between pt-1 text-[12px]">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || !email.trim()}
                    className="font-medium text-black/50 hover:text-black disabled:opacity-40 transition-colors"
                  >
                    {resending ? "Sending…" : "Resend code"}
                  </button>
                  <Link
                    href="/login"
                    className="font-medium text-black/50 hover:text-black transition-colors"
                  >
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-xs text-black/50 font-mono bg-white">
          Loading…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}