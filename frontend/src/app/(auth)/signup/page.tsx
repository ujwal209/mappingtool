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
  Lock,
  Mail,
  User,
  Building,
  Briefcase,
  ShieldCheck,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TechIcon } from "@/components/tech-icons";
import { CustomDropdown, DropdownOption } from "@/components/ui/custom-dropdown";

// ============================================================
// Role options — grouped by category, with descriptions
// ============================================================
const ROLE_OPTIONS: DropdownOption[] = [
  // Engineering & Data
  {
    value: "DATA_ENGINEER",
    label: "Data Engineer",
    description: "Builds pipelines, mappings, and transformation rules",
    group: "Engineering",
  },
  {
    value: "SENIOR_DATA_ENGINEER",
    label: "Senior Data Engineer",
    description: "Leads pipeline design and mentors the engineering team",
    group: "Engineering",
  },
  {
    value: "DATA_ARCHITECT",
    label: "Data Architect",
    description: "Designs schemas and canonical data models",
    group: "Engineering",
  },
  {
    value: "ANALYTICS_ENGINEER",
    label: "Analytics Engineer",
    description: "Models data for downstream analytics & BI",
    group: "Engineering",
  },
  {
    value: "PLATFORM_ENGINEER",
    label: "Platform Engineer",
    description: "Maintains connectors, runtime, and infra",
    group: "Engineering",
  },

  // Architecture & Strategy
  {
    value: "ENTERPRISE_ARCHITECT",
    label: "Enterprise Architect",
    description: "Owns the enterprise-wide data architecture vision",
    group: "Architecture",
  },
  {
    value: "SOLUTION_ARCHITECT",
    label: "Solution Architect",
    description: "Designs end-to-end solutions for specific domains",
    group: "Architecture",
  },

  // Governance & Compliance
  {
    value: "GOVERNANCE_LEAD",
    label: "Governance Lead",
    description: "Defines and enforces data governance policies",
    group: "Governance",
  },
  {
    value: "DATA_STEWARD",
    label: "Data Steward",
    description: "Curates and maintains business data quality",
    group: "Governance",
  },
  {
    value: "COMPLIANCE_OFFICER",
    label: "Compliance Officer",
    description: "Ensures regulatory and audit requirements are met",
    group: "Governance",
  },

  // Operations & Admin
  {
    value: "ADMIN",
    label: "System Administrator",
    description: "Full platform access, user and tenant management",
    group: "Administration",
  },
  {
    value: "DEVOPS_ENGINEER",
    label: "DevOps Engineer",
    description: "Manages deployment, monitoring, and releases",
    group: "Administration",
  },
  {
    value: "QA_ENGINEER",
    label: "QA Engineer",
    description: "Validates pipelines, mappings, and quality gates",
    group: "Administration",
  },
];

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("DATA_ENGINEER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    try {
      await signup({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        organization: organization.trim() || undefined,
        role,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex font-sans antialiased">
      {/* ============ LEFT: FORM ============ */}
      <div className="w-full lg:w-[46%] xl:w-[44%] h-full flex flex-col bg-white">
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

        <div className="flex-1 overflow-y-auto px-8 sm:px-14">
          <div className="w-full max-w-[440px] mx-auto py-8">
            <div className="mb-6">
              <h1 className="text-[26px] font-semibold tracking-tight text-slate-900 leading-tight">
                Create your workspace
              </h1>
              <p className="text-[13px] text-slate-500 mt-1.5">
                Register to start managing schema migrations
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

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <Field label="Full name" icon={User}>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Work email" icon={Mail}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Organization" icon={Building}>
                  <input
                    type="text"
                    placeholder="Acme Inc."
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                    Role
                  </label>
                  <CustomDropdown
                    value={role}
                    onChange={setRole}
                    options={ROLE_OPTIONS}
                    placeholder="Select a role"
                    searchable
                    ariaLabel="Select your role"
                  />
                </div>
              </div>

              <Field label="Password" icon={Lock}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls + " pr-11"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-[15px] h-[15px]" />
                  ) : (
                    <Eye className="w-[15px] h-[15px]" />
                  )}
                </button>
              </Field>

              <Field label="Confirm password" icon={Lock}>
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputCls + " pr-11"}
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
              </Field>

              <Button
                type="submit"
                disabled={
                  loading ||
                  !fullName.trim() ||
                  !email.trim() ||
                  !password ||
                  !confirmPassword
                }
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded-lg shadow-sm disabled:opacity-50 mt-2"
              >
                {loading ? (
                  "Creating account…"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Create account <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-5 text-center text-[12.5px] text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-slate-900 hover:underline"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Encrypted workspace · SOC 2 · ISO 27001</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT: VISUAL ============ */}
      <div className="hidden lg:flex flex-1 h-full relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent_70%)]" />
        <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-indigo-500/[0.08] rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-32 w-[600px] h-[600px] bg-emerald-500/[0.06] rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-14 xl:p-16 w-full">
         

          <div className="space-y-9 max-w-lg">
            <div className="space-y-4">
              <h2 className="text-[32px] xl:text-[36px] font-semibold tracking-tight leading-[1.15] text-white">
                Deterministic, audited replication for modern enterprises.
              </h2>
              <p className="text-[14px] text-slate-400 leading-relaxed">
                Standardize business concepts in canonical ontologies, evaluate
                mapping proposals with confidence scoring, and persist
                transformation catalogs directly in target endpoints.
              </p>
            </div>

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

            <div className="space-y-2.5">
              {[
                "Idempotent target loads ensure zero duplicate records on retries",
                "Immutable domain events track every mapping change, approval, and run",
                "Quarantine queues capture non-conforming records without halting execution",
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

          <div className="pt-6 border-t border-white/[0.06]">
            <p className="text-[12px] italic text-slate-400 leading-relaxed max-w-md">
              &ldquo;Zero secret leakage into audit manifests, complete
              reverse record-level lineage, and automated schema drift
              gating.&rdquo;
            </p>
            <p className="text-[10.5px] text-slate-500 font-mono mt-2 tracking-wide">
              ENTERPRISE QUALITY ASSURANCE GUARANTEE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-11 pl-10 pr-3.5 text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition placeholder:text-slate-400";

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon className="w-[15px] h-[15px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}