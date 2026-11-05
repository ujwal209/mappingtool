import Link from "next/link";
import { ArrowRight, BookOpen, Cable, GitCompare, Network, PlayCircle, Code2, ShieldCheck, Layers } from "lucide-react";

const CARDS = [
  { icon: BookOpen, title: "Getting started", body: "Installation, first migration, and core concepts.", href: "/docs/getting-started/installation" },
  { icon: Cable, title: "Connectors", body: "12+ systems: ADLS, S3, Snowflake, BigQuery, Databricks, Fabric, Postgres, SQL Server, Oracle, MongoDB, D365, Salesforce.", href: "/docs/connectors" },
  { icon: GitCompare, title: "Mapping", body: "Build field-to-field translations. AI-suggest. Approve. Freeze into SHA-256 versions.", href: "/docs/mapping/quickstart" },
  { icon: Network, title: "Ontology", body: "Canonical entities, typed relationships, domain bindings.", href: "/docs/ontology/getting-started" },
  { icon: PlayCircle, title: "Runs", body: "Deterministic execution with automatic reconciliation and evidence.", href: "/docs/runs/execution" },
  { icon: Code2, title: "API Reference", body: "Every capability over HTTP with bearer JWT auth.", href: "/docs/api" },
  { icon: ShieldCheck, title: "Security", body: "Azure AD, IAM roles, private endpoints, audit logs.", href: "/docs/security/auth" },
  { icon: Layers, title: "Platform", body: "Architecture, limits, changelog.", href: "/docs/platform/architecture" },
];

export default function DocsHomePage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">Documentation</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">
        Welcome to Migration Studio docs
      </h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Set up connectors, define the ontology, build frozen mappings, and run deterministic migrations with full audit evidence.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="group rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.15)] transition-all">
            <c.icon className="w-5 h-5 text-zinc-700 mb-3" strokeWidth={1.75} />
            <h3 className="text-[14px] font-semibold text-zinc-900 mb-1.5">{c.title}</h3>
            <p className="text-[12.5px] text-zinc-600 leading-relaxed">{c.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-zinc-900 group-hover:gap-2 transition-all">
              Open <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}