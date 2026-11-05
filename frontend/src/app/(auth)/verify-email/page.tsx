"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2,
  AlertCircle,
  Mail,
  ArrowRight,
  ChevronLeft,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

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
                  <Mail className="w-5 h-5" />
                </div>
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
                  Verify your email
                </h1>
                <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
                  Enter the 6-digit code we sent to
                </p>
                {email && (
                  <span className="inline-block mt-2 text-[12.5px] font-medium text-slate-900 bg-slate-100 px-3 py-1 rounded-full">
                    {email}
                  </span>
                )}
              </div>

              {error && (
                <div className="mb-5 px-3.5 py-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-800 leading-relaxed flex-1">
                    {error}
                  </p>
                </div>
              )}

              {notice && (
                <div className="mb-5 px-3.5 py-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-emerald-800 leading-relaxed flex-1">
                    {notice}
                  </p>
                </div>
              )}

              {success ? (
                <div className="space-y-4">
                  <Button
                    onClick={() =>
                      router.push(isAuthenticated ? "/dashboard" : "/login")
                    }
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg"
                  >
                    <span className="inline-flex items-center gap-2">
                      {isAuthenticated ? "Go to dashboard" : "Sign in"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleManual} className="space-y-5">
                  {!email && (
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                        Email address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-11 px-3.5 text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-2 text-center">
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
                              className="w-11 h-12 text-base font-semibold border border-slate-200 rounded-lg text-slate-900 bg-white data-[active=true]:border-slate-900"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || token.trim().length !== 6}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying…
                      </span>
                    ) : (
                      "Verify code"
                    )}
                  </Button>

                  <div className="flex items-center justify-between pt-1 text-[12px]">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || !email.trim()}
                      className="text-slate-500 hover:text-slate-900 disabled:opacity-50 transition-colors"
                    >
                      {resending ? "Sending…" : "Resend code"}
                    </button>
                    <Link
                      href="/login"
                      className="text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      Back to sign in
                    </Link>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Secured · Encrypted · Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-xs text-slate-500 font-mono">
          Loading…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}