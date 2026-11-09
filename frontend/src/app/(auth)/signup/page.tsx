// frontend/src/app/(auth)/signup/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  AlertCircle,
  Lock,
  Mail,
  User,
  Building,
  ChevronLeft,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { CustomDropdown, DropdownOption } from "@/components/ui/custom-dropdown";

const PURPLE = "#432DD7";

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
    <div className="h-screen w-screen overflow-hidden bg-white font-sans antialiased flex">
      {/* ============================================================
          LEFT — FORM (white bg, black text, purple accents)
      ============================================================ */}
      <div className="w-full lg:w-[46%] xl:w-[44%] h-full flex flex-col bg-white">
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

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-14">
          <div className="w-full max-w-[440px] mx-auto py-8">
            <div className="mb-7">
              <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-black leading-tight">
                Create your workspace
              </h1>
              <p className="text-[13.5px] text-black/50 mt-2">
                Register to start managing schema migrations
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
                  <label className="block text-[12px] font-medium text-black mb-1.5">
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </Field>

              <button
                type="submit"
                disabled={
                  loading ||
                  !fullName.trim() ||
                  !email.trim() ||
                  !password ||
                  !confirmPassword
                }
                className="w-full h-11 text-white text-[13px] font-semibold rounded-xl transition hover:opacity-90 disabled:opacity-40 group inline-flex items-center justify-center mt-2"
                style={{ backgroundColor: PURPLE }}
              >
                {loading ? (
                  "Creating account…"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Create account
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-[13px] text-black/50">
              Already have an account?{" "}
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

      {/* ============================================================
          RIGHT — BRAND PANEL (white bg, black text, purple accents)
      ============================================================ */}
      <div className="relative hidden lg:flex flex-1 h-full overflow-hidden bg-white border-l border-black/[0.06]">
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

        <div className="relative z-10 flex flex-col justify-center p-14 xl:p-16 w-full">
          <div className="space-y-9 max-w-lg">
            <div className="space-y-4">
              <h2 className="text-[32px] xl:text-[38px] font-semibold tracking-[-0.03em] leading-[1.12] text-black">
                Deterministic, audited replication for{" "}
                <span style={{ color: PURPLE }}>modern enterprises.</span>
              </h2>
              <p className="text-[14px] text-black/60 leading-relaxed">
                Standardize business concepts in canonical ontologies, evaluate
                mapping proposals with confidence scoring, and persist
                transformation catalogs directly in target endpoints.
              </p>
            </div>

            <div className="space-y-3">
              {[
                "Idempotent target loads ensure zero duplicate records on retries",
                "Immutable domain events track every mapping change, approval, and run",
                "Quarantine queues capture non-conforming records without halting execution",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 shrink-0 mt-0.5"
                    style={{ color: PURPLE }}
                  />
                  <span className="text-[13px] text-black/70 leading-relaxed">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Shared styles + small components
// ============================================================
const inputCls =
  "w-full h-11 pl-10 pr-3.5 text-[13px] text-black bg-white border border-black/10 rounded-xl focus:outline-none transition placeholder:text-black/30 focus:border-[#432DD7] focus:ring-[3px] focus:ring-[#432DD7]/10";

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
      <label className="block text-[12px] font-medium text-black mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon className="w-[15px] h-[15px] text-black/30 absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}