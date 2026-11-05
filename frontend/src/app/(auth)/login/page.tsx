"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  ChevronLeft,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TechIcon } from "@/components/tech-icons";

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
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex font-sans antialiased">
      {/* ============ LEFT: FORM ============ */}
      <div className="w-full lg:w-[46%] xl:w-[44%] h-full flex flex-col bg-white relative">
        {/* Header bar */}
        <div className="h-16 px-8 flex items-center justify-between border-b border-slate-100 shrink-0">
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

        {/* Form area */}
        <div className="flex-1 overflow-y-auto px-8 sm:px-14 flex items-center">
          <div className="w-full max-w-[400px] mx-auto py-10">
            <div className="mb-8">
              <h1 className="text-[26px] font-semibold tracking-tight text-slate-900 leading-tight">
                Welcome back
              </h1>
              <p className="text-[13px] text-slate-500 mt-1.5">
                Sign in to your enterprise workspace
              </p>
            </div>

            {error && (
              <div className="mb-5 px-3.5 py-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-800 leading-relaxed flex-1">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                  Email
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-medium text-slate-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11.5px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-[15px] h-[15px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-11 text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-[15px] h-[15px]" />
                    ) : (
                      <Eye className="w-[15px] h-[15px]" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  "Signing in…"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Sign in <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-[12.5px] text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-semibold text-slate-900 hover:underline"
              >
                Create one
              </Link>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>256-bit TLS · SOC 2 Type II · ISO 27001</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT: VISUAL ============ */}
      <div className="hidden lg:flex flex-1 h-full relative overflow-hidden bg-slate-950">
        {/* Ambient gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent_70%)]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-500/[0.08] rounded-full blur-3xl" />
        <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-emerald-500/[0.06] rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-14 xl:p-16 w-full">
  

          {/* Middle content */}
          <div className="space-y-9 max-w-lg">
            <div className="space-y-4">
              <h2 className="text-[32px] xl:text-[36px] font-semibold tracking-tight leading-[1.15] text-white">
                Standardize every byte with canonical business ontologies.
              </h2>
              <p className="text-[14px] text-slate-400 leading-relaxed">
                Connect to source repositories, automatically profile physical
                attributes, enforce corporate rulebooks, and persist verified
                mappings directly in destination systems.
              </p>
            </div>

            {/* Connector icons */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-slate-500">
                Multi-cloud connectors
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "fabric",
                  "d365",
                  "snowflake",
                  "databricks",
                  "postgresql",
                  "oracle",
                  "mongodb",
                  "bigquery",
                  "salesforce",
                  "s3",
                ].map((id) => (
                  <div
                    key={id}
                    className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center p-2 hover:bg-white/[0.08] hover:border-white/[0.15] transition"
                  >
                    <TechIcon name={id} className="w-5 h-5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Feature list */}
            <div className="space-y-2.5">
              {[
                "Pre-flight gating blocks pipelines before schema drift corrupts target storage",
                "Approved mapping versions are frozen and stored in target catalogs",
                "Reverse row-level provenance traces each record back to source",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-[12.5px] text-slate-300 leading-relaxed">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom quote */}
          <div className="pt-6 border-t border-white/[0.06]">
            <p className="text-[12px] italic text-slate-400 leading-relaxed max-w-md">
              &ldquo;Every transformation rule and mapping snapshot is
              cryptographically hashed and saved into the destination
              catalog.&rdquo;
            </p>
            <p className="text-[10.5px] text-slate-500 font-mono mt-2 tracking-wide">
              DATA MIGRATION STUDIO · AUDIT SPECIFICATION
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-xs text-slate-500 font-mono">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}