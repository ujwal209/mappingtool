// frontend/src/app/(auth)/login/page.tsx
"use client";

import React, { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  AlertCircle,
  Lock,
  Mail,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";

const PURPLE = "#432DD7";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams?.get("redirect") || "/dashboard";

  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      router.push(redirectTarget);
    } catch (err: any) {
      setError(
        err.message || "Failed to sign in. Please verify your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white font-sans antialiased flex">
      {/* ============================================================
          LEFT — BRAND PANEL (white bg, black text, purple accents)
      ============================================================ */}
      <div className="relative hidden lg:flex flex-col justify-between w-[42%] h-full p-12 xl:p-16 overflow-hidden bg-white border-r border-black/[0.06]">
        {/* Decorative geometry — subtle purple accents */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-[160px]"
            style={{ backgroundColor: `${PURPLE}10` }}
          />
          <div
            className="absolute -bottom-40 -left-24 w-[500px] h-[500px] rounded-full blur-[140px]"
            style={{ backgroundColor: `${PURPLE}06` }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(${PURPLE} 1px, transparent 1px), linear-gradient(90deg, ${PURPLE} 1px, transparent 1px)`,
              backgroundSize: "56px 56px",
            }}
          />
          <div
            className="absolute top-1/3 -right-20 w-80 h-80 rounded-full border border-dashed"
            style={{ borderColor: `${PURPLE}18` }}
          />
          <div
            className="absolute bottom-1/4 -left-16 w-56 h-56 rounded-full border"
            style={{ borderColor: `${PURPLE}0a` }}
          />
        </div>

        {/* Top: designed wordmark */}
        <div className="relative z-10 flex items-baseline gap-1 select-none">
          <span className="text-[19px] font-bold tracking-[-0.045em] text-black leading-none">
            Migration
          </span>
          <span
            className="text-[19px] font-light tracking-[-0.02em] leading-none"
            style={{ color: `${PURPLE}99` }}
          >
            Studio
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full ml-[1px] mb-[2px]"
            style={{ backgroundColor: PURPLE }}
          />
        </div>

        {/* Middle: editorial headline */}
        <div className="relative z-10">
          <h1 className="font-semibold tracking-[-0.04em] leading-[0.95] text-[52px] xl:text-[64px] 2xl:text-[76px] text-black">
            Move data
            <br />
            <span style={{ color: PURPLE }}>without</span>
            <br />
            the guesswork.
          </h1>

          <p className="mt-8 text-[15px] leading-relaxed max-w-md text-black/60">
            Deterministic replication with row-level provenance, pre-flight
            drift gating, and a signed evidence bundle for every single run.
          </p>
        </div>

        {/* Bottom spacer (trust markers removed) */}
        <div className="relative z-10" />
      </div>

      {/* ============================================================
          RIGHT — FORM (white bg, black text, purple accents)
      ============================================================ */}
      <div className="flex-1 h-full bg-white flex flex-col">
        {/* Top bar */}
        <div className="h-16 px-6 sm:px-10 flex items-center justify-between shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-black/60 hover:text-black transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Link>

          {/* Mobile wordmark */}
          <span className="lg:hidden flex items-baseline gap-1 select-none">
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
          </span>

          <Link
            href="/signup"
            className="text-[12px] font-medium transition-opacity hover:opacity-70"
            style={{ color: PURPLE }}
          >
            Sign up →
          </Link>
        </div>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 overflow-y-auto">
          <div className="w-full max-w-[400px] py-8">
            <div className="mb-9">
              <h2 className="text-[32px] font-semibold tracking-[-0.03em] text-black leading-tight">
                Welcome back
              </h2>
              <p className="text-[13.5px] text-black/50 mt-2">
                Sign in to continue to your workspace
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-black mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-black/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 pl-10 pr-3.5 text-[13.5px] text-black bg-white border border-black/10 rounded-xl focus:outline-none transition placeholder:text-black/30"
                    style={{
                      borderColor: email ? PURPLE : undefined,
                      boxShadow: email ? `0 0 0 3px ${PURPLE}14` : undefined,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12.5px] font-medium text-black">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11.5px] font-medium transition-opacity hover:opacity-70"
                    style={{ color: PURPLE }}
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-black/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-10 pr-11 text-[13.5px] text-black bg-white border border-black/10 rounded-xl focus:outline-none transition placeholder:text-black/30"
                    style={{
                      borderColor: password ? PURPLE : undefined,
                      boxShadow: password ? `0 0 0 3px ${PURPLE}14` : undefined,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full h-12 text-white text-[13.5px] font-semibold rounded-xl transition hover:opacity-90 disabled:opacity-40 group inline-flex items-center justify-center"
                style={{ backgroundColor: PURPLE }}
              >
                {loading ? (
                  "Signing in…"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Sign in
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-[13px] text-black/50">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: PURPLE }}
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-black/5 px-6 sm:px-10 h-12 flex items-center justify-between text-[11px] text-black/40">
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center text-xs text-black/50 font-mono bg-white">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}