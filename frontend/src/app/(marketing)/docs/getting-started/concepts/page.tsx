import Link from "next/link";
import { ChevronRight, Cable, Network, GitCompare, PlayCircle, ShieldCheck, FileText, Lock } from "lucide-react";

const CONCEPTS = [
  {
    icon: Cable,
    title: "Connector",
    what: "A configured connection to a source or target system.",
    why: "Connectors introspect the real schema, store credentials securely, and detect schema drift before any write.",
    example: "An ADLS Gen2 connector pointing at your production data lake's raw/ folder.",
  },
  {
    icon: Network,
    title: "Ontology",
    what: "Canonical entities (Customer, Order, Product) with typed relationships.",
    why: "Different systems call the same thing by different names. The ontology is the shared vocabulary every mapping binds to.",
    example: "Product (SKU, supplierCode, name) — with supplierCode bound to three different source systems.",
  },
  {
    icon: GitCompare,
    title: "Mapping",
    what: "A field-by-field translation from source schema to target schema.",
    why: "Mappings are frozen with SHA-256. Downstream runs pin to a version — no silent drift between environments.",
    example: "src.sku → dst.product_id, src.quantity → dst.qty (with cast:int64).",
  },
  {
    icon: PlayCircle,
    title: "Run",
    what: "One execution of a frozen mapping.",
    why: "Deterministic. Given identical source data and mapping version, two runs produce byte-identical output.",
    example: "A full-load run of 1M rows from ADLS to Databricks, reconciled and signed off.",
  },
  {
    icon: ShieldCheck,
    title: "Drift gating",
    what: "A schema fingerprint stored inside each frozen mapping.",
    why: "If the source schema changes, the next run halts before writing — nothing corrupts the target.",
    example: "A source column changed int32 → int64. The connector detects this at probe time and blocks the run.",
  },
  {
    icon: FileText,
    title: "Lineage",
    what: "A row-level record of which source row produced which target row.",
    why: "When an auditor asks 'where did this number come from', the answer is a click, not a two-week investigation.",
    example: "Target row 'ITM-1042' traces back to source row 'row-17' in supplier/po-2081/receiving.parquet.",
  },
  {
    icon: Lock,
    title: "Frozen version",
    what: "A SHA-256 hash of an approved mapping.",
    why: "Frozen versions are immutable. Any change creates a new version; the old one is verifiable forever.",
    example: "sha256:a3f5c8d9e1b2... — the exact mapping that produced a given run's output.",
  },
];

export default function ConceptsPage() {
  return (
    <article className="max-w-3xl">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-500">Getting started</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Core concepts</span>
      </nav>

      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
        Getting started
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">
        Core concepts
      </h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed">
        Seven concepts cover everything in the platform. Read this once and the rest of the docs will click.
      </p>

      <section className="mt-10 space-y-4">
        {CONCEPTS.map((c) => (
          <div key={c.title} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                <c.icon className="w-4 h-4 text-zinc-700" strokeWidth={2} />
              </div>
              <h3 className="text-[15px] font-semibold text-zinc-900">{c.title}</h3>
            </div>
            <dl className="space-y-2 mt-3">
              <div>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">What it is</dt>
                <dd className="text-[13px] text-zinc-700 leading-relaxed mt-0.5">{c.what}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Why it matters</dt>
                <dd className="text-[13px] text-zinc-700 leading-relaxed mt-0.5">{c.why}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Example</dt>
                <dd className="text-[12.5px] font-mono text-zinc-600 bg-zinc-50 border border-zinc-200 rounded px-2 py-1.5 mt-1 break-words">{c.example}</dd>
              </div>
            </dl>
          </div>
        ))}
      </section>

      <section className="mt-10 pt-6 border-t border-zinc-200">
        <h2 className="text-[15px] font-semibold text-zinc-900 mb-3">Ready to try it?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/docs/getting-started/first-migration" className="group rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition">
            <p className="text-[13px] font-semibold text-zinc-900">First migration</p>
            <p className="text-[12px] text-zinc-500 mt-1">Put these concepts into practice.</p>
          </Link>
          <Link href="/browse-connectors" className="group rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition">
            <p className="text-[13px] font-semibold text-zinc-900">Browse connectors</p>
            <p className="text-[12px] text-zinc-500 mt-1">Pick a source and start.</p>
          </Link>
        </div>
      </section>
    </article>
  );
}