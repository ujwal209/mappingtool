// frontend/src/app/(marketing)/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Lock,
  RotateCcw,
  Server,
  GitBranch,
  Play,
  BookOpen,
  Minus,
  Plus,
  Search,
  Eye,
  X,
  Clock,
  Sparkles,
  Star,
  Quote,
  Award,
  FileCheck2,
} from "lucide-react";
import { TechIcon } from "@/components/tech-icons";

// ============================================================
// DATA
// ============================================================
const CONNECTORS = [
  { id: "fabric", name: "Microsoft Fabric", category: "Lakehouse", blurb: "Read and write your Fabric tables and files." },
  { id: "d365", name: "Dynamics 365", category: "CRM & ERP", blurb: "Pull accounts, contacts, and orders." },
  { id: "snowflake", name: "Snowflake", category: "Warehouse", blurb: "Copy tables in and out of your warehouse." },
  { id: "databricks", name: "Databricks", category: "Lakehouse", blurb: "Move data to and from your lakehouse." },
  { id: "postgresql", name: "PostgreSQL", category: "RDBMS", blurb: "Copy rows, keep types intact." },
  { id: "sqlserver", name: "SQL Server", category: "RDBMS", blurb: "Read and write your SQL Server databases." },
  { id: "oracle", name: "Oracle Database", category: "RDBMS", blurb: "Pull data out of legacy Oracle systems." },
  { id: "mongodb", name: "MongoDB Atlas", category: "Document DB", blurb: "Read and write your documents." },
  { id: "bigquery", name: "BigQuery", category: "Warehouse", blurb: "Copy tables to and from BigQuery." },
  { id: "salesforce", name: "Salesforce", category: "CRM & ERP", blurb: "Sync your Salesforce records." },
  { id: "s3", name: "Amazon S3", category: "Object Storage", blurb: "Read and write files from any bucket." },
  { id: "adls", name: "Azure Data Lake", category: "Object Storage", blurb: "Read and write files from your storage account." },
];

const CATEGORIES = ["All", "Lakehouse", "Warehouse", "RDBMS", "CRM & ERP", "Document DB", "Object Storage"];

const FEATURES = [
  { icon: Server, title: "Connect in minutes", body: "Add any database, warehouse, or file store. We check the connection and read the schema for you." },
  { icon: BookOpen, title: "One shared vocabulary", body: "Define what \"customer\" or \"order\" means once, and reuse it across every system." },
  { icon: GitBranch, title: "Column matching that helps", body: "We suggest which source columns line up with which target columns. You review and approve." },
  { icon: Lock, title: "Locked, versioned mappings", body: "Approve a mapping once and it never changes. Want a change? Make a new version." },
  { icon: ShieldCheck, title: "Catch problems before they hit", body: "If the source schema changes unexpectedly, we stop the run before anything is written." },
  { icon: Eye, title: "See where every row came from", body: "Click any target row and see the exact source record that produced it." },
];

const METRICS = [
  { value: "240M+", label: "Rows moved" },
  { value: "12+", label: "Systems supported" },
  { value: "99.99%", label: "Rows matched" },
  { value: "<2s", label: "Connection check" },
];

const WORKFLOW_STEPS = [
  { n: "01", icon: Server, title: "Connect", body: "Add your source and destination. We test the connection for you." },
  { n: "02", icon: GitBranch, title: "Match columns", body: "Pick which source column goes to which target column. We suggest matches, you decide." },
  { n: "03", icon: Lock, title: "Approve", body: "Lock the mapping once you're happy. It can't be changed by accident." },
  { n: "04", icon: RotateCcw, title: "Copy & check", body: "We copy the data, compare both sides, and hand you a signed report." },
];

const FAQ = [
  { q: "What happens if the source database changes?", a: "We check the source before every run. If something important changed (a column was removed or the type changed), we stop the run before touching your target. You decide whether to fix the mapping or approve a one-off override." },
  { q: "Can I undo a migration?", a: "Yes. Every load is idempotent — running it again won't create duplicates. If a run needs to be undone, we create a separate rollback record linked back to the original. The original run is never deleted." },
  { q: "How do I know the data actually arrived?", a: "After each run we compare both sides: row counts, sum totals, and a hash of the data. If anything doesn't match, the run lands in a review queue with the exact differences shown." },
  { q: "Can I see where a specific row came from?", a: "Yes. Click any row in the target and you'll see the exact source record, the mapping version, and every transformation that was applied." },
];

const BEFORE_POINTS = [
  "Spreadsheets with 900 columns, no validation",
  "Scripts nobody can explain a year later",
  "Silent failures — you find out from a report",
  "No record of which row came from where",
  "Reruns create duplicates; nobody notices",
];

const AFTER_POINTS = [
  "Column mapping reviewed and approved once",
  "Every run has a permanent, signed report",
  "Run halts if the source schema drifts",
  "Click any target row to see its source",
  "Idempotent loads — retries are safe",
];

const HERO_LOGO_IDS = ["fabric", "d365", "snowflake", "databricks", "postgresql", "oracle", "salesforce", "bigquery"];

const TESTIMONIALS = [
  {
    quote: "We replaced a 900-column spreadsheet with Migration Studio and cut our quarterly migration window from two weeks to three days.",
    name: "Priya Raghunathan",
    role: "Data Platform Lead, Global Retail Bank",
    initials: "PR",
  },
  {
    quote: "The pre-flight drift gate caught a schema change that would have silently corrupted our target warehouse. That alone paid for the platform.",
    name: "Marcus Aldridge",
    role: "Principal Engineer, Logistics SaaS",
    initials: "MA",
  },
  {
    quote: "Reverse lineage was the audit team's biggest ask. Now they can click any target record and see the exact source row that produced it.",
    name: "Hana Okafor",
    role: "Head of Data Governance, Health Insurer",
    initials: "HO",
  },
];

const PRICING_PREVIEW = [
  {
    name: "Starter",
    price: "Free",
    period: "forever",
    description: "For individual engineers exploring the platform.",
    features: ["1 concurrent pipeline", "10K rows per run", "Column matching & review", "Community support"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Team",
    price: "$99",
    period: "per month",
    description: "For production teams running real migrations.",
    features: ["Unlimited pipelines", "10M rows per run", "Reverse row-level lineage", "Drift gating + policy waivers", "Priority support"],
    cta: "Start 14-day trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual",
    description: "For regulated industries with deep audit needs.",
    features: ["Everything in Team", "Unlimited rows per run", "SAML SSO + SCIM", "Audit export to S3 / Azure", "Dedicated CSM + SLA"],
    cta: "Talk to sales",
    highlighted: false,
  },
];

const COMPLIANCE_BADGES = [
  { icon: ShieldCheck, label: "SOC 2 Type II" },
  { icon: Award, label: "ISO 27001" },
  { icon: FileCheck2, label: "GDPR ready" },
  { icon: Lock, label: "HIPAA aligned" },
];

// ============================================================
// PAGE
// ============================================================
export default function LandingPage() {
  const [category, setCategory] = useState("All");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConnectors = useMemo(() => {
    let f = CONNECTORS;
    if (category !== "All") f = f.filter((c) => c.category === category);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter((c) => c.name.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q));
    }
    return f;
  }, [category, searchQuery]);

  return (
    <div className="bg-white text-slate-900 font-sans antialiased overflow-x-hidden">
      <Hero />
      <FeaturesSection />
      <ConnectorsSection
        category={category}
        setCategory={setCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredConnectors={filteredConnectors}
      />
      <WorkflowSection />
      <BeforeAfterSection />
      <MetricsSection />
      <TestimonialsSection />
      <SecuritySection />
      <ComplianceStrip />
      <PricingPreviewSection />
      <FAQSection openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <FinalCTA />
    </div>
  );
}

// ============================================================
// HERO — clean white, no eyebrow, balanced color
// ============================================================
function Hero() {
  return (
    <section className="relative bg-white border-b border-slate-200">
      {/* Very subtle side hairlines only — no colored wash */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-y-0 left-1/4 w-px bg-slate-100" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-100" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-slate-100" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 sm:px-8 lg:px-10 pt-24 pb-20 sm:pt-28 sm:pb-24 text-center">
        {/* Headline — mostly neutral with one indigo accent word */}
        <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[76px] font-bold leading-[0.98] tracking-[-0.04em] text-slate-900 max-w-3xl mx-auto">
          Move your data{" "}
          without the{" "}
          <br className="hidden sm:block" />
          <span className="relative inline-block">
            <span className="text-indigo-700">guesswork.</span>
            <span className="absolute left-0 right-0 -bottom-1.5 h-1 bg-indigo-200 rounded-full" />
          </span>
        </h1>

        {/* Sub */}
        <p className="mt-8 text-[17px] sm:text-[19px] text-slate-600 leading-[1.6] max-w-xl mx-auto">
          Copy data from one system to another — safely, with a record of
          exactly what changed and where every row came from.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2.5 h-14 pl-8 pr-2 rounded-full bg-slate-900 text-white text-[15px] font-semibold transition-all hover:bg-slate-800 hover:scale-[1.02]"
          >
            <span>Get started free</span>
            <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 h-14 px-7 rounded-full border border-slate-300 bg-white text-[15px] font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <Play className="w-4 h-4" />
            See how it works
          </Link>
        </div>

        {/* Logo strip — subtle, neutral */}
        <div className="mt-20 pt-10 border-t border-slate-200">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-slate-400 mb-6">
            Works with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {HERO_LOGO_IDS.map((id) => (
              <div
                key={id}
                className="transition-transform duration-200 hover:scale-110 cursor-default opacity-70 hover:opacity-100"
                title={id}
              >
                <TechIcon name={id} className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FEATURES — white
// ============================================================
function FeaturesSection() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-28 scroll-mt-24">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-10 lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-6 h-px bg-indigo-700" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
              What you get
            </span>
          </div>
          <h2 className="font-display text-[34px] sm:text-[42px] lg:text-[48px] font-bold leading-[1.05] tracking-[-0.03em] text-slate-900">
            Everything you need to move data{" "}
            <span className="text-indigo-700">safely.</span>
          </h2>
          <p className="mt-5 text-[14.5px] text-slate-600 leading-relaxed max-w-xs">
            No more scripts, spreadsheets, or guesswork. Six things that make
            migrations boring — in the good way.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-3xl overflow-hidden">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group bg-white p-6 hover:bg-slate-50 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:border-slate-900 transition-colors">
                  <Icon className="w-5 h-5 text-slate-700 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display text-[16px] font-semibold text-slate-900 mb-1.5">
                  {f.title}
                </h3>
                <p className="text-[12.5px] text-slate-600 leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CONNECTORS — light neutral band
// ============================================================
function ConnectorsSection({
  category, setCategory, searchQuery, setSearchQuery, filteredConnectors,
}: any) {
  return (
    <section id="connectors" className="border-y border-slate-200 bg-slate-50 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-28">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-indigo-700" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
            Connect anything
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <h2 className="font-display text-[34px] sm:text-[42px] lg:text-[50px] font-bold leading-[1.02] tracking-[-0.03em] text-slate-900 max-w-xl">
            Your systems, already{" "}
            <span className="text-indigo-700">supported.</span>
          </h2>
          <div className="relative w-full lg:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Find a system..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-11 pr-4 rounded-full border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 text-[11.5px] font-medium rounded-full border transition-colors ${
                category === cat
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredConnectors.map((c: any) => (
            <div
              key={c.id}
              className="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 group-hover:bg-slate-100 transition-colors">
                  <TechIcon name={c.id} className="w-6 h-6" />
                </div>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                  {c.category}
                </span>
              </div>
              <h3 className="font-display text-[14px] font-semibold text-slate-900 mb-1">
                {c.name}
              </h3>
              <p className="text-[11.5px] text-slate-500 leading-relaxed">{c.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// WORKFLOW — white
// ============================================================
function WorkflowSection() {
  return (
    <section id="workflow" className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-28 scroll-mt-24">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-6 h-px bg-indigo-700" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
          How it works
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8 mb-12">
        <h2 className="font-display text-[34px] sm:text-[42px] lg:text-[50px] font-bold leading-[1.02] tracking-[-0.03em] text-slate-900">
          Four steps.{" "}
          <span className="text-indigo-700">No surprises.</span>
        </h2>
        <p className="text-[14.5px] text-slate-600 leading-relaxed self-end">
          Every step is checked and reversible. Nothing lands in your
          destination without your say-so.
        </p>
      </div>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="hidden lg:block absolute top-[32px] left-4 right-4 h-px bg-slate-200" />
        {WORKFLOW_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.n} className="relative group">
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm mb-4 group-hover:border-slate-400 transition-all">
                <Icon className="w-5 h-5 text-slate-800 group-hover:text-indigo-700 transition-colors" />
              </div>
              <p className="text-[9.5px] font-mono font-semibold tracking-[0.22em] mb-1.5 text-indigo-700">
                {step.n}
              </p>
              <h3 className="font-display text-[17px] font-semibold text-slate-900 mb-1.5">
                {step.title}
              </h3>
              <p className="text-[12.5px] text-slate-500 leading-relaxed">{step.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// BEFORE / AFTER — neutral band
// ============================================================
function BeforeAfterSection() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-28">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-indigo-700" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
            A better way
          </span>
        </div>

        <h2 className="font-display text-[34px] sm:text-[42px] lg:text-[50px] font-bold leading-[1.02] tracking-[-0.03em] text-slate-900 max-w-2xl mb-12">
          The old way vs{" "}
          <span className="text-indigo-700">the sane way.</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BEFORE */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                <X className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  The old way
                </p>
                <h3 className="font-display text-[17px] font-semibold text-slate-900">
                  Spreadsheets & scripts
                </h3>
              </div>
            </div>
            <ul className="space-y-3">
              {BEFORE_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-[13px] text-slate-600 leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AFTER */}
          <div className="relative rounded-3xl border border-slate-900 bg-white p-7 shadow-[0_16px_48px_-16px_rgba(15,23,42,0.15)]">
            <div className="absolute -top-3 right-5 px-3 py-1 rounded-full bg-slate-900 text-white text-[9.5px] font-bold uppercase tracking-wider">
              Migration Studio
            </div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-indigo-700" />
              </div>
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700">
                  The sane way
                </p>
                <h3 className="font-display text-[17px] font-semibold text-slate-900">
                  Structured & signed
                </h3>
              </div>
            </div>
            <ul className="space-y-3">
              {AFTER_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                  <span className="text-[13px] text-slate-800 leading-relaxed font-medium">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// METRICS — white
// ============================================================
function MetricsSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-16">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-3xl overflow-hidden">
        {METRICS.map((m) => (
          <div key={m.label} className="bg-white p-7 text-center">
            <p className="font-display text-[30px] sm:text-[36px] font-bold tracking-tight text-slate-900">
              {m.value}
            </p>
            <p className="text-[10.5px] text-slate-500 mt-1.5 font-mono uppercase tracking-[0.15em]">
              {m.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// TESTIMONIALS — white
// ============================================================
function TestimonialsSection() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-28">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-indigo-700" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
            Trusted by data teams
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8 mb-12">
          <h2 className="font-display text-[34px] sm:text-[42px] lg:text-[50px] font-bold leading-[1.02] tracking-[-0.03em] text-slate-900">
            What teams say after{" "}
            <span className="text-indigo-700">their first run.</span>
          </h2>
          <div className="self-end flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-[12px] text-slate-600 font-medium">
              4.9 · 120+ reviews
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-3xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.12)] transition-all"
            >
              <Quote className="w-6 h-6 text-slate-300 mb-4" />
              <p className="text-[13.5px] text-slate-700 leading-relaxed mb-6">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {t.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-slate-900 truncate">
                    {t.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SECURITY — neutral band
// ============================================================
function SecuritySection() {
  const items = [
    { icon: ShieldCheck, title: "Encrypted in transit and at rest", body: "TLS 1.3 for every connection. AES-256 at rest." },
    { icon: Lock, title: "Secrets never touch logs", body: "Credentials are referenced, never printed. Every log line is scrubbed." },
    { icon: Eye, title: "Full audit trail", body: "Every mutation produces a tamper-evident event with actor and timestamp." },
    { icon: Clock, title: "Reversible runs", body: "Rollback creates a separate record — the original run is preserved forever." },
  ];

  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-16 sm:py-20">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-indigo-700" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
            Built for regulated teams
          </span>
        </div>

        <h2 className="font-display text-[30px] sm:text-[38px] lg:text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-slate-900 max-w-2xl mb-10">
          Safe by default.{" "}
          <span className="text-indigo-700">Auditable by design.</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.title} className="group rounded-3xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.1)] transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 group-hover:bg-slate-900 group-hover:border-slate-900 transition-colors">
                  <Icon className="w-4 h-4 text-slate-700 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display text-[14px] font-semibold text-slate-900 mb-1.5">
                  {it.title}
                </h3>
                <p className="text-[12px] text-slate-600 leading-relaxed">{it.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// COMPLIANCE STRIP — white
// ============================================================
function ComplianceStrip() {
  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-14">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-900">
              Compliance, ready out of the box
            </p>
            <p className="text-[11.5px] text-slate-500">
              Evidence bundles mapped to every framework your auditors ask about.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {COMPLIANCE_BADGES.map((b) => {
            const Icon = b.icon;
            return (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-700"
              >
                <Icon className="w-3 h-3 text-slate-600" />
                {b.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// PRICING PREVIEW — neutral band
// ============================================================
function PricingPreviewSection() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-28">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-indigo-700" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
            Pricing
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <h2 className="font-display text-[34px] sm:text-[42px] lg:text-[50px] font-bold leading-[1.02] tracking-[-0.03em] text-slate-900 max-w-xl">
            Start free. Scale{" "}
            <span className="text-indigo-700">when you're ready.</span>
          </h2>
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            See full pricing
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING_PREVIEW.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-6 transition-all ${
                plan.highlighted
                  ? "border-slate-900 bg-white shadow-[0_16px_48px_-16px_rgba(15,23,42,0.15)]"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900 text-white text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap z-10">
                  Most popular
                </div>
              )}
              <div className="h-full">
                <h3 className="font-display text-[17px] font-semibold text-slate-900 mb-1">
                  {plan.name}
                </h3>
                <p className="text-[11.5px] text-slate-500 mb-5 leading-relaxed min-h-[34px]">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1.5 mb-6">
                  <span className="font-display text-[32px] font-bold tracking-tight text-slate-900">
                    {plan.price}
                  </span>
                  <span className="text-[11px] text-slate-500">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px] text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.name === "Enterprise" ? "/contact" : "/signup"}
                  className={`w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-[12.5px] font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ — white
// ============================================================
function FAQSection({ openFaq, setOpenFaq }: any) {
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-10">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-6 h-px bg-indigo-700" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-700">
                FAQ
              </span>
            </div>
            <h2 className="font-display text-[34px] sm:text-[42px] font-bold leading-[1.02] tracking-[-0.03em] text-slate-900">
              Common{" "}
              <span className="text-indigo-700">questions.</span>
            </h2>
            <p className="mt-4 text-[14px] text-slate-600 leading-relaxed max-w-xs">
              Short answers to the things people ask most.
            </p>
          </div>

          <div className="space-y-2.5">
            {FAQ.map((f, i) => (
              <div
                key={i}
                className={`rounded-2xl border overflow-hidden transition-colors ${
                  openFaq === i
                    ? "border-slate-300 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                >
                  <span className="font-display text-[15.5px] font-semibold text-slate-900">
                    {f.q}
                  </span>
                  {openFaq === i ? (
                    <Minus className="w-4 h-4 text-slate-700 shrink-0" />
                  ) : (
                    <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-[13.5px] text-slate-600 leading-relaxed">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FINAL CTA — dark, minimal indigo accent
// ============================================================
function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]">
        <div className="absolute inset-y-0 left-1/4 w-px bg-white" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-white" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-20 sm:py-24 text-center">
        <h2 className="font-display text-[38px] sm:text-[56px] lg:text-[68px] font-bold leading-[0.98] tracking-[-0.035em] max-w-3xl mx-auto">
          Your first migration,{" "}
          <span className="text-indigo-300">
            done this week.
          </span>
        </h2>

        <p className="mt-5 text-[15px] text-slate-400 leading-relaxed max-w-lg mx-auto">
          Add a source and a destination. Run a real pipeline. See the full
          report. Free to start.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2.5 h-14 pl-8 pr-2 rounded-full bg-white text-slate-900 text-[15px] font-semibold transition-all hover:bg-slate-100 hover:scale-[1.02]"
          >
            <span>Open console</span>
            <span className="w-10 h-10 rounded-full bg-slate-900/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 h-14 px-7 rounded-full border border-white/15 bg-white/[0.03] text-[15px] font-medium text-slate-200 hover:bg-white/[0.08] hover:border-white/25 transition-colors"
          >
            Create account
          </Link>
        </div>
      </div>
    </section>
  );
}