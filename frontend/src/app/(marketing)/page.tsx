"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Lock,
  RotateCcw,
  Server,
  Database,
  GitBranch,
  Play,
  BookOpen,
  ChevronRight,
  Minus,
  Plus,
  Activity,
  Layers,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TechIcon } from "@/components/tech-icons";

// ============================================================
// Connectors
// ============================================================
type Connector = {
  id: string;
  name: string;
  category: string;
  blurb: string;
  tags: string[];
};

const CONNECTORS: Connector[] = [
  { id: "fabric", name: "Microsoft Fabric", category: "Lakehouse", blurb: "OneLake, Delta tables, and DirectLake persistence for downstream analytics.", tags: ["Source", "Target"] },
  { id: "d365", name: "Dynamics 365", category: "CRM & ERP", blurb: "Dataverse entities, Finance & Ops schemas, and delta-token extraction.", tags: ["Source", "Target"] },
  { id: "snowflake", name: "Snowflake", category: "Warehouse", blurb: "External stages, time-travel audit, and zero-copy validation.", tags: ["Source", "Target"] },
  { id: "databricks", name: "Databricks", category: "Lakehouse", blurb: "Unity Catalog namespaces with ACID Delta Live Tables.", tags: ["Source", "Target"] },
  { id: "postgresql", name: "PostgreSQL", category: "RDBMS", blurb: "Logical replication, JSONB parsing, idempotent upserts.", tags: ["Source", "Target"] },
  { id: "sqlserver", name: "SQL Server", category: "RDBMS", blurb: "CDC capture, temporal tables, bulk-copy loading.", tags: ["Source", "Target"] },
  { id: "oracle", name: "Oracle Database", category: "RDBMS", blurb: "Parallel extract, PDB isolation, audited rollback.", tags: ["Source", "Target"] },
  { id: "mongodb", name: "MongoDB Atlas", category: "Document DB", blurb: "BSON typing, change streams, document flattening.", tags: ["Source", "Target"] },
  { id: "bigquery", name: "BigQuery", category: "Warehouse", blurb: "Streaming inserts, column-level security, dry-run validation.", tags: ["Source", "Target"] },
  { id: "salesforce", name: "Salesforce", category: "CRM & ERP", blurb: "Bulk API 2.0, custom field discovery, delta extraction.", tags: ["Source", "Target"] },
  { id: "s3", name: "Amazon S3", category: "Object Storage", blurb: "Parquet, Avro, Hive partitioning, SHA-256 checksums.", tags: ["Source", "Target"] },
  { id: "adls", name: "Azure Data Lake", category: "Object Storage", blurb: "Hierarchical namespace, AAD OAuth, Delta parquet tables.", tags: ["Source", "Target"] },
];

const CATEGORIES = ["All", "Lakehouse", "CRM & ERP", "RDBMS", "Warehouse", "Document DB", "Object Storage"];

const TRUST_LOGOS = [
  "fabric", "d365", "snowflake", "databricks",
  "postgresql", "oracle", "salesforce", "bigquery",
];

// ============================================================
// Features
// ============================================================
const FEATURES = [
  {
    icon: Server,
    title: "Live connection probes",
    body: "Register any source or destination, ping it, and inspect schemas with masked credentials — no secrets ever leak into logs.",
  },
  {
    icon: BookOpen,
    title: "Canonical ontologies",
    body: "Define business entities, attributes, and relationships once. Bind physical columns to canonical concepts with confidence scores.",
  },
  {
    icon: GitBranch,
    title: "AI-assisted mapping",
    body: "Match source columns to target fields with EXACT, SEMANTIC, and DERIVED classifications — reviewed before approval.",
  },
  {
    icon: Lock,
    title: "Immutable mapping versions",
    body: "Approve a mapping once. Its SHA-256 hash is frozen. Any change requires a new semantic child version.",
  },
  {
    icon: ShieldCheck,
    title: "Pre-flight drift gating",
    body: "Blocking schema drift halts the run before any write. Non-blocking changes require a signed policy waiver.",
  },
  {
    icon: FileText,
    title: "Reverse row-level lineage",
    body: "For any target row, retrieve its source record ID, mapping version, transformations applied, and originating run.",
  },
];

// ============================================================
// Page
// ============================================================
export default function LandingPage() {
  const [category, setCategory] = useState("All");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filtered =
    category === "All" ? CONNECTORS : CONNECTORS.filter((c) => c.category === category);

  return (
    <div className="bg-white text-slate-900 font-sans antialiased">
      {/* ============================================================
          HERO
      ============================================================ */}
      <section className="relative pt-16 pb-16 sm:pt-24 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-slate-100 via-slate-50 to-transparent rounded-full blur-3xl opacity-70" />
          <div className="absolute top-24 left-1/3 w-[500px] h-[400px] bg-gradient-to-br from-indigo-100/40 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white/60 backdrop-blur-sm text-[11.5px] font-medium text-slate-600 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live · v1.4.2 · deterministic pipelines
            </div>

            <h1 className="text-[44px] sm:text-[60px] lg:text-[72px] font-semibold tracking-[-0.03em] leading-[0.98] text-slate-900">
              Enterprise data migration,{" "}
              <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent">
                finally deterministic.
              </span>
            </h1>

            <p className="mt-6 text-[15px] sm:text-[17px] text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Connect any source, align every field to a canonical ontology
              concept, and execute audited pipelines — with reverse lineage
              for every loaded row.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/dashboard">
                <Button className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white text-[13.5px] font-medium rounded-xl shadow-lg shadow-slate-900/10">
                  Open console
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="#connectors">
                <Button
                  variant="outline"
                  className="h-11 px-6 text-[13.5px] font-medium text-slate-700 border-slate-300 hover:bg-white rounded-xl bg-white/60 backdrop-blur-sm"
                >
                  Explore connectors
                </Button>
              </Link>
            </div>
          </div>

          {/* Product preview */}
          <div className="mt-16 sm:mt-20 relative">
            <div className="absolute inset-x-8 top-8 bottom-0 bg-gradient-to-b from-slate-200/50 to-transparent rounded-[40px] blur-2xl -z-10" />
            <div className="relative rounded-[24px] border border-slate-200/80 bg-white shadow-[0_20px_80px_-20px_rgba(15,23,42,0.25)] overflow-hidden">
              <div className="h-10 px-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <span className="text-[10.5px] font-mono text-slate-400">
                  run · a1f2-9c8e · v1.4.2
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700">
                  <Activity className="w-3 h-3" />
                  healthy
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3">
                <div className="hidden lg:flex flex-col gap-1 p-4 border-r border-slate-100 bg-slate-50/40">
                  {[
                    { icon: Server, label: "Connect", active: true },
                    { icon: GitBranch, label: "Align" },
                    { icon: Lock, label: "Approve" },
                    { icon: Play, label: "Execute" },
                    { icon: RotateCcw, label: "Reconcile" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] ${
                          item.active ? "bg-slate-900 text-white font-medium" : "text-slate-600"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {item.label}
                      </div>
                    );
                  })}
                </div>

                <div className="lg:col-span-2 p-5 sm:p-7">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
                        Active pipeline
                      </p>
                      <p className="text-[14px] font-semibold text-slate-900 mt-0.5">
                        PostgreSQL → Fabric OneLake
                      </p>
                    </div>
                    <span className="text-[10.5px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      5 phases
                    </span>
                  </div>

                  <div className="space-y-2">
                    <PipelineRow icon={Server} label="Extract" value="8 tables · 240K rows" status="complete" />
                    <PipelineRow icon={GitBranch} label="Transform" value="mapping v1.4.2 · SHA-256" status="complete" />
                    <PipelineRow icon={ShieldCheck} label="Validate" value="schema · records · refs" status="complete" />
                    <PipelineRow icon={Database} label="Load" value="idempotent upsert" status="running" />
                    <PipelineRow icon={RotateCcw} label="Reconcile" value="pending" status="pending" />
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
                    {[
                      { label: "Records", value: "238,412" },
                      { label: "Latency p95", value: "1.2s" },
                      { label: "Reconciliation", value: "100%" },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {m.label}
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900 font-mono mt-0.5">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          TRUST STRIP
      ============================================================ */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 text-center mb-6">
            Trusted across enterprise data stacks
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {TRUST_LOGOS.map((id) => (
              <div
                key={id}
                className="opacity-90 hover:opacity-100 transition-opacity"
                title={id}
              >
                <TechIcon name={id} className="w-8 h-8" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          #features
      ============================================================ */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 scroll-mt-24">
        <div className="max-w-2xl mb-12">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">
            Features
          </p>
          <h2 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.02em] leading-[1.1] text-slate-900">
            Everything the migration lifecycle needs — in one place.
          </h2>
          <p className="mt-4 text-[15px] text-slate-600 leading-relaxed">
            Six core capabilities that make enterprise migrations auditable,
            reversible, and reproducible. No scripts, no ad-hoc tooling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1)] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <Icon className="w-[18px] h-[18px] text-white" />
                </div>
                <h3 className="text-[14.5px] font-semibold text-slate-900 mb-1.5">
                  {f.title}
                </h3>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          #connectors
      ============================================================ */}
      <section
        id="connectors"
        className="border-y border-slate-200 bg-slate-50/40 scroll-mt-24"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="max-w-xl mb-10">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">
              Connectors
            </p>
            <h2 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.02em] text-slate-900">
              Bring your own stack.
            </h2>
            <p className="mt-4 text-[15px] text-slate-600 leading-relaxed">
              First-class adapters for lakehouses, warehouses, relational
              databases, CRMs, and object stores. Approved mapping catalogs
              are persisted directly into the destination system.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-8">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3.5 py-1.5 text-[12px] font-medium rounded-lg transition border ${
                  category === cat
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.08)] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-2">
                    <TechIcon name={c.id} className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    {c.category}
                  </span>
                </div>
                <h3 className="text-[14px] font-semibold text-slate-900 mb-1">
                  {c.name}
                </h3>
                <p className="text-[12.5px] text-slate-600 leading-relaxed mb-3">
                  {c.blurb}
                </p>
                <div className="flex items-center gap-1.5">
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          #ontology
      ============================================================ */}
      <section id="ontology" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">
              Ontology
            </p>
            <h2 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.02em] leading-[1.1] text-slate-900">
              A canonical model that outlives any single system.
            </h2>
            <p className="mt-4 text-[15px] text-slate-600 leading-relaxed">
              Instead of writing brittle column-to-column scripts, define
              business entities once and bind physical fields to them. The
              ontology becomes the semantic contract every pipeline reads
              from — and every analyst can reason about.
            </p>

            <div className="mt-6 space-y-3">
              {[
                { title: "Entities & relationships", body: "Customer, Order, Invoice — modeled with typed attributes and named relationships." },
                { title: "Typed attributes", body: "Canonical datatypes, nullability, uniqueness, and PII classification." },
                { title: "Versioned ontology", body: "Every edit produces a new immutable version with a content hash." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0 mt-1" />
                  <div>
                    <p className="text-[13.5px] font-medium text-slate-900">
                      {item.title}
                    </p>
                    <p className="text-[12.5px] text-slate-600 leading-relaxed mt-0.5">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/ontology"
              className="mt-6 inline-flex items-center gap-1 text-[12.5px] font-medium text-slate-900 hover:gap-1.5 transition-all"
            >
              Open ontology studio
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Ontology · v1.4.2
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                SHA · 8a3c…f9e2
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  name: "Customer",
                  category: "Master Data",
                  attrs: ["customer_id · uuid · PK", "email · string · PII", "created_at · timestamp"],
                },
                {
                  name: "Order",
                  category: "Transactional",
                  attrs: ["order_id · uuid · PK", "customer_id · uuid · FK", "total_amount · decimal(18,2)"],
                },
                {
                  name: "Invoice",
                  category: "Transactional",
                  attrs: ["invoice_id · uuid · PK", "order_id · uuid · FK", "status · enum"],
                },
              ].map((ent) => (
                <div
                  key={ent.name}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span className="text-[12px] font-semibold text-slate-900">
                        {ent.name}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-medium text-slate-500 uppercase tracking-wider">
                      {ent.category}
                    </span>
                  </div>
                  <div className="p-2 space-y-1">
                    {ent.attrs.map((a) => (
                      <div
                        key={a}
                        className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono text-slate-700"
                      >
                        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          #workflow
      ============================================================ */}
      <section
        id="workflow"
        className="border-y border-slate-200 bg-slate-50/40 scroll-mt-24"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="max-w-2xl mb-12">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">
              Workflow
            </p>
            <h2 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.02em] text-slate-900">
              Four phases. Zero surprises.
            </h2>
            <p className="mt-4 text-[15px] text-slate-600 leading-relaxed">
              Every phase is auditable, checkpointed, and reversible. Nothing
              is loaded into a destination without an approved mapping
              manifest.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "1", icon: Server, title: "Connect", body: "Register endpoints and probe live schemas with masked credentials." },
              { n: "2", icon: GitBranch, title: "Align", body: "Bind physical fields to canonical ontology concepts with confidence scoring." },
              { n: "3", icon: Lock, title: "Approve", body: "Freeze a mapping version with a SHA-256 content hash. No mutations after." },
              { n: "4", icon: RotateCcw, title: "Replicate", body: "Execute. Validate. Reconcile. Sign off with an immutable evidence bundle." },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.n}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-mono text-slate-400">
                      0{step.n}
                    </span>
                    <Icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-[13.5px] font-semibold text-slate-900 mb-1">
                    {step.title}
                  </h3>
                  <p className="text-[12.5px] text-slate-600 leading-relaxed">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          #architecture
      ============================================================ */}
      <section
        id="architecture"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 scroll-mt-24"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">
              Architecture
            </p>
            <h2 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.02em] text-slate-900 leading-[1.1]">
              Mapping catalogs live in the destination — not just in our database.
            </h2>
            <p className="mt-4 text-[15px] text-slate-600 leading-relaxed">
              When a run completes, the approved mapping catalog, version
              metadata, and ontology bindings are written into the target
              system itself. Downstream analytics and applications can query
              the exact schema contract their data was produced under.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                "Immutable SHA-256 mapping hashes",
                "Reverse row-level lineage per record",
                "Pre-flight schema drift gating",
                "Zero secret material in audit manifests",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-[13.5px] text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Pipeline
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  run_id · a1f2…
                </span>
              </div>
              <div className="space-y-2">
                <DiagRow icon={Server} label="Source" value="PostgreSQL" tone="slate" />
                <DiagConnector />
                <DiagRow icon={GitBranch} label="Transform" value="mapping v1.4.2 · SHA-256" tone="indigo" />
                <DiagConnector />
                <DiagRow icon={ShieldCheck} label="Validate" value="schema · records · refs" tone="emerald" />
                <DiagConnector />
                <DiagRow icon={Database} label="Destination" value="Fabric OneLake · Delta" tone="slate" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Catalog persisted</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          #faq
      ============================================================ */}
      <section id="faq" className="border-t border-slate-200 bg-slate-50/40 scroll-mt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="mb-10">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-3">
              FAQ
            </p>
            <h2 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.02em] text-slate-900">
              Common questions.
            </h2>
          </div>

          <div className="space-y-2">
            {[
              { q: "How does the platform prevent data corruption during load?", a: "Pre-flight gates compare live schemas against the approved baseline snapshot. If blocking drift is detected, the run halts before any write. Target writers are also idempotent, so worker restarts cannot produce duplicate records." },
              { q: "Where are approved mapping versions stored?", a: "Mappings live in the control-plane mappings collection with a SHA-256 content hash. On run completion, the full catalog is also written into the destination system so downstream consumers can inspect the exact contract." },
              { q: "What happens if a source schema changes?", a: "Drift analysis runs automatically and classifies changes as blocking or non-blocking. Blocking drift requires a policy waiver attached to the run manifest before execution can proceed." },
              { q: "Can I trace any record back to its source?", a: "Yes. Every loaded record carries a lineage trace containing the source record ID, mapping version, rule package version, applied transformations, and the run ID." },
            ].map((f, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-slate-300 transition">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[14px] font-medium text-slate-900">{f.q}</span>
                  {openFaq === i ? (
                    <Minus className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[13px] text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA
      ============================================================ */}
      <section className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-lg">
            <h2 className="text-[26px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-tight">
              Ship your first audited migration this week.
            </h2>
            <p className="mt-3 text-[14.5px] text-slate-400 leading-relaxed">
              Open the console, register a source and destination, and run an
              end-to-end pipeline against a live schema.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/dashboard">
              <Button className="h-11 px-6 bg-white hover:bg-slate-100 text-slate-900 text-[13.5px] font-medium rounded-xl">
                Open console
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                variant="outline"
                className="h-11 px-6 text-[13.5px] font-medium text-white border-white/20 hover:bg-white/10 rounded-xl"
              >
                Create account
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function PipelineRow({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  status: "complete" | "running" | "pending";
}) {
  const statusMap = {
    complete: {
      ring: "bg-emerald-50 border-emerald-100",
      icon: "text-emerald-600",
      dot: "bg-emerald-500",
      text: "complete",
    },
    running: {
      ring: "bg-blue-50 border-blue-100",
      icon: "text-blue-600",
      dot: "bg-blue-500 animate-pulse",
      text: "running",
    },
    pending: {
      ring: "bg-slate-50 border-slate-100",
      icon: "text-slate-400",
      dot: "bg-slate-300",
      text: "pending",
    },
  }[status];

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-slate-100 rounded-lg hover:border-slate-200 transition">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 ${statusMap.ring}`}>
          <Icon className={`w-3.5 h-3.5 ${statusMap.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-900 truncate">{label}</p>
          <p className="text-[11px] text-slate-500 truncate">{value}</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-slate-500 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${statusMap.dot}`} />
        {statusMap.text}
      </span>
    </div>
  );
}

function DiagRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "slate" | "indigo" | "emerald";
}) {
  const toneCls = {
    slate: "bg-slate-50 border-slate-200 text-slate-900",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-900",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
  }[tone];

  return (
    <div className={`flex items-center justify-between px-3 py-2.5 border rounded-lg ${toneCls}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="text-[12px] font-medium truncate">{label}</span>
      </div>
      <span className="text-[11px] font-mono opacity-70 truncate ml-2">{value}</span>
    </div>
  );
}

function DiagConnector() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-2 bg-slate-200" />
    </div>
  );
}