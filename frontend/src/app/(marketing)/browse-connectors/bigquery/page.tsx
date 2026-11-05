import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck, Lock, Key, Database, FileText, Clock, ExternalLink, Users, ChevronRight } from "lucide-react";

function BigQueryMark({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="bqA" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4386FA" /><stop offset="100%" stopColor="#1A56C4" /></linearGradient></defs>
      <rect x="14" y="14" width="68" height="68" rx="12" fill="url(#bqA)" />
      <g stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M30 34 L66 34" /><path d="M30 46 L58 46" /><path d="M30 58 L50 58" />
      </g>
    </svg>
  );
}

const META = { name: "BigQuery", category: "Lakehouse", tagline: "Read tables from any BigQuery dataset, use dry-run validation to preview scans, and stream inserts into partitioned tables — all over Google service account auth.", setupTime: "~10 minutes" };
const FACTS = [{ k: "Connector type", v: "Cloud warehouse" }, { k: "Direction", v: "Read + Write" }, { k: "Endpoint", v: "bigquery.googleapis.com" }, { k: "Auth", v: "Service account" }, { k: "Setup", v: "~10 min" }];
const STEPS = [{ n: "01", title: "Open connector form", body: "Connectors → Add new → BigQuery." }, { n: "02", title: "Enter project details", body: "Google Cloud project ID, dataset, and optional location." }, { n: "03", title: "Upload service account key", body: "Paste the JSON key from a service account with roles/bigquery.dataViewer (or dataEditor for writes)." }, { n: "04", title: "Test the connection", body: "The connector lists datasets and tables as proof." }, { n: "05", title: "Choose a table", body: "Select a table or view. Run a dry-run to preview bytes scanned before migrating." }];
const READ = [{ f: "Tables", d: "Standard and partitioned" }, { f: "Views", d: "Logical and authorized" }, { f: "STRUCT", d: "Nested records" }, { f: "ARRAY", d: "Repeated fields" }, { f: "External tables", d: "GCS, Drive, Bigtable" }];
const WRITE = [{ f: "Streaming insert", d: "Rows into partitioned tables" }, { f: "Batch load", d: "GCS to native tables" }, { f: "MERGE", d: "Upsert with match conditions" }, { f: "CREATE TABLE AS", d: "Materialize query results" }];
const AUTH = [{ icon: Key, title: "Service account", body: "Create a service account in Google Cloud, grant roles/bigquery.dataViewer (or dataEditor for writes), and download a JSON key. Paste it into the connector.", badge: "Recommended" }, { icon: Users, title: "Workload identity", body: "If Migration Studio runs inside GKE or GCE, use workload identity federation. No key files to rotate.", badge: null }];
const LIMITS = [{ k: "Max row size", v: "100 MB per row" }, { k: "Concurrent queries", v: "100 per project by default" }, { k: "Partition pruning", v: "Requires a partition filter on reads" }, { k: "Auth scope", v: "Service account or workload identity" }, { k: "Private connectivity", v: "VPC Service Controls supported" }, { k: "Read consistency", v: "Snapshot isolation per query" }];
const ERRORS = [{ code: "403 Access Denied: Project", what: "Service account not a member of the project or lacks BigQuery permissions.", fix: "In Google Cloud IAM: add the service account as BigQuery Data Viewer (or Data Editor for writes)." }, { code: "403 Access Denied: Dataset", what: "Project access granted but dataset ACL blocks the service account.", fix: "In BigQuery UI: dataset → Sharing → Add the service account with BigQuery Data Viewer." }, { code: "404 Not found: Table", what: "Table name wrong, in a different dataset, or project ID in the connector is wrong.", fix: "Use fully qualified names: project.dataset.table. Verify the project ID." }, { code: "400 Cannot query rows larger than 100MB", what: "A single row exceeds BigQuery's 100 MB per-row limit.", fix: "Split the row into multiple rows, or move large blobs to GCS." }, { code: "402 Billing is disabled", what: "Project has billing disabled or no billing account attached.", fix: "Enable billing on the Google Cloud project." }];
const FAQ = [{ q: "Does it support dry-run validation?", a: "Yes. Every read can be dry-run first — the connector shows bytes scanned and estimated cost before the migration starts." }, { q: "Can I read external tables?", a: "Yes. External tables (GCS, Drive, Bigtable) are read the same way as native tables." }, { q: "Does it work with VPC Service Controls?", a: "Yes, if Migration Studio runs inside the same VPC perimeter." }, { q: "Network drops mid-run?", a: "The connector checkpoints completed partitions. On reconnect it resumes from the next partition. Streaming inserts use idempotency keys." }];
const RELATED = [{ href: "/browse-connectors/snowflake", name: "Snowflake" }, { href: "/browse-connectors/databricks", name: "Databricks" }, { href: "/browse-connectors/s3", name: "Amazon S3" }];

export default function BigQueryConnectorPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased">
      <section className="border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20">
          <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-8 flex-wrap">
            <Link href="/browse-connectors" className="hover:text-zinc-900 transition-colors">Browse connectors</Link>
            <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="text-zinc-900 font-medium">{META.name}</span>
          </nav>
          <div className="flex items-start gap-4 sm:gap-5 mb-6 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center shrink-0">
              <BigQueryMark className="w-9 h-9 sm:w-10 sm:h-10" />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-1">{META.category} connector</p>
              <h1 className="text-[26px] sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1] break-words">{META.name}</h1>
            </div>
          </div>
          <p className="text-[15.5px] sm:text-base text-zinc-600 leading-relaxed max-w-3xl break-words">{META.tagline}</p>
          <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
            <Link href="/contact" className="group inline-flex items-center justify-center gap-2 h-10 pl-5 pr-1.5 rounded-full bg-zinc-900 text-white text-[13px] font-medium hover:bg-zinc-800 transition-colors">
              Try this connector
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5"><ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} /></span>
            </Link>
            <Link href="/docs/connectors/bigquery" className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
              Read the setup guide <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-zinc-500">
            <li className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> Service account</li>
            <li className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> VPC-SC</li>
            <li className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> {META.setupTime} setup</li>
          </ul>
        </div>
      </section>
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {FACTS.map((f) => (
              <div key={f.k} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-1 break-words">{f.k}</p>
                <p className="text-[13px] font-medium text-zinc-900 leading-snug break-words">{f.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="flex items-end justify-between gap-6 mb-8 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">How to connect</p>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">Five steps. Ten minutes.</h2>
            </div>
            <p className="text-[12.5px] text-zinc-500 max-w-sm leading-relaxed">You'll need a Google Cloud project and a service account key.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-5 min-w-0">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 text-white text-[10.5px] font-bold mb-4">{s.n}</span>
                <h3 className="text-[13.5px] font-semibold text-zinc-900 leading-snug mb-1.5 break-words">{s.title}</h3>
                <p className="text-[12px] text-zinc-600 leading-relaxed break-words">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">Supported operations</p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">What you can read and write.</h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 flex-wrap">
                <FileText className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={2} />
                <h3 className="text-[12.5px] font-semibold text-zinc-900">Can read</h3>
                <span className="ml-auto text-[11px] text-zinc-500">5 types</span>
              </div>
              <ul className="divide-y divide-zinc-200">
                {READ.map((r) => (
                  <li key={r.f} className="flex items-start justify-between gap-4 px-5 py-2.5 min-w-0">
                    <span className="text-[12.5px] font-mono font-medium text-zinc-900 shrink-0">{r.f}</span>
                    <span className="text-[11.5px] text-zinc-500 text-right break-words">{r.d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 flex-wrap">
                <Database className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={2} />
                <h3 className="text-[12.5px] font-semibold text-zinc-900">Can write</h3>
                <span className="ml-auto text-[11px] text-zinc-500">4 modes</span>
              </div>
              <ul className="divide-y divide-zinc-200">
                {WRITE.map((r) => (
                  <li key={r.f} className="flex items-start justify-between gap-4 px-5 py-2.5 min-w-0">
                    <span className="text-[12.5px] font-mono font-medium text-zinc-900 shrink-0">{r.f}</span>
                    <span className="text-[11.5px] text-zinc-500 text-right break-words">{r.d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">Sign-in</p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">Two ways to authenticate.</h2>
            <p className="mt-3 text-[13px] text-zinc-600 leading-relaxed max-w-2xl">Service account key is the fastest path. Workload identity avoids key rotation.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {AUTH.map((m) => (
              <div key={m.title} className={`rounded-2xl border p-5 sm:p-6 min-w-0 ${m.badge ? "border-zinc-900 bg-white" : "border-zinc-200 bg-white"}`}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <m.icon className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={2} />
                  <h3 className="text-[13.5px] font-semibold text-zinc-900 break-words">{m.title}</h3>
                  {m.badge && <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white bg-zinc-900 rounded-full px-2 py-0.5 whitespace-nowrap">{m.badge}</span>}
                </div>
                <p className="text-[12.5px] text-zinc-600 leading-relaxed break-words">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">Limits</p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">What it can and cannot do.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LIMITS.map((l) => (
              <div key={l.k} className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-3.5 min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500 mb-1 break-words">{l.k}</p>
                <p className="text-[13px] text-zinc-900 leading-relaxed break-words">{l.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-b border-zinc-200 bg-zinc-900 text-zinc-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400 mb-2">Troubleshooting</p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] leading-tight">When the connection fails.</h2>
          </div>
          <div className="space-y-3">
            {ERRORS.map((e, i) => (
              <div key={e.code} className="rounded-2xl border border-zinc-800 bg-zinc-800/40 p-5 min-w-0">
                <div className="flex items-start gap-3 mb-2 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <code className="text-[12px] font-mono text-zinc-200 break-all pt-0.5 min-w-0">{e.code}</code>
                </div>
                <p className="text-[12px] text-zinc-400 leading-relaxed ml-9 mb-2 break-words">{e.what}</p>
                <div className="flex items-start gap-2 ml-9 min-w-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" strokeWidth={2.5} />
                  <p className="text-[12.5px] text-zinc-300 leading-relaxed break-words"><span className="font-semibold text-white">Fix: </span>{e.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">FAQ</p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">Common questions.</h2>
          </div>
          <div className="space-y-2">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl border border-zinc-200 bg-white open:bg-zinc-50 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-start justify-between gap-4 cursor-pointer list-none px-5 py-4 min-w-0">
                  <span className="text-[13.5px] font-semibold text-zinc-900 break-words">{item.q}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5 transition-transform group-open:rotate-90" strokeWidth={2} />
                </summary>
                <p className="px-5 pb-4 text-[13px] text-zinc-600 leading-relaxed break-words">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 sm:p-10 lg:p-12 min-w-0">
            <div className="flex items-center gap-3 mb-4"><BigQueryMark className="w-8 h-8 shrink-0" /></div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight break-words">Try the BigQuery connector.</h2>
            <p className="mt-3 text-[13.5px] text-zinc-600 leading-relaxed max-w-2xl break-words">Book a guided walkthrough, or follow the docs yourself.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <Link href="/contact" className="group inline-flex items-center justify-center gap-2 h-10 pl-5 pr-1.5 rounded-full bg-zinc-900 text-white text-[13px] font-medium hover:bg-zinc-800 transition-colors">
                Book a demo
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5"><ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} /></span>
              </Link>
              <Link href="/docs/connectors/bigquery" className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-white transition-colors">
                Read the docs <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
            </div>
            <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-zinc-500">
              <span className="text-zinc-400">Related connectors:</span>
              {RELATED.map((r) => (
                <Link key={r.href} href={r.href} className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-4 break-words">
                  {r.name} <ArrowUpRight className="w-3 h-3 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
