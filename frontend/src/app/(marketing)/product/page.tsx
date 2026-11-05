import Link from "next/link";
import { ArrowRight, Cable, ShieldCheck, Activity, Database } from "lucide-react";

const FEATURES = [
  { icon: Cable, title: "Live schema probes", body: "Connectors introspect real systems — no static YAML guessing. Types, nullability, and constraints are extracted at connection time." },
  { icon: ShieldCheck, title: "Read-only by default", body: "Probes run with the narrowest credentials that work. Writes are a separate, explicitly gated phase." },
  { icon: Activity, title: "Continuous drift detection", body: "Schema fingerprints are re-checked before every run. A blocking change halts the pipeline before any write." },
  { icon: Database, title: "12+ enterprise systems", body: "Fabric, Databricks, Snowflake, BigQuery, Postgres, SQL Server, Oracle, MongoDB, D365, Salesforce, S3, ADLS." },
];

export default function ConnectorsPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-4">Product / Connectors</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-slate-900 max-w-3xl leading-[1.05]">
            Live probes against 12+ enterprise systems.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
            Every connector introspects the real source — types, constraints, and nullability included — so your mappings are built on facts, not assumptions.
          </p>
        </div>
      </section>
      <section className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.15)] transition-all">
                <f.icon className="w-6 h-6 text-slate-700 mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-slate-900">Try a connector on your system.</h2>
          <p className="mt-4 text-base text-slate-600">We'll run a read-only probe and send you the schema fingerprint.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact" className="group inline-flex items-center gap-2 h-11 pl-6 pr-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors">
              Request a probe
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
              </span>
            </Link>
            <Link href="/connectors" className="inline-flex items-center h-11 px-6 rounded-full border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              Browse all connectors
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}