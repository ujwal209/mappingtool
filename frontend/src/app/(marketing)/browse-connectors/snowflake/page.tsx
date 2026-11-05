import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck, Lock, Key, Database, FileText, Clock, ExternalLink, Users, ChevronRight } from "lucide-react";

function SnowflakeMark({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="sfA" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#29B5E8" /><stop offset="100%" stopColor="#0B7BB5" /></linearGradient></defs>
      <g stroke="url(#sfA)" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <line x1="48" y1="14" x2="48" y2="82" /><line x1="18" y1="32" x2="78" y2="64" /><line x1="18" y1="64" x2="78" y2="32" /><line x1="30" y1="20" x2="66" y2="76" /><line x1="66" y1="20" x2="30" y2="76" />
      </g>
      <circle cx="48" cy="48" r="6" fill="url(#sfA)" />
    </svg>
  );
}

const META = { name: "Snowflake", category: "Lakehouse", tagline: "Read tables from any Snowflake database, use key-pair auth over TLS, and leverage time-travel to re-read historical snapshots for reconciliation.", setupTime: "~10 minutes" };
const FACTS = [{ k: "Connector type", v: "Cloud warehouse" }, { k: "Direction", v: "Read + Write" }, { k: "Endpoint", v: "account.snowflakecomputing.com" }, { k: "Auth", v: "Key-pair RSA" }, { k: "Setup", v: "~10 min" }];
const STEPS = [{ n: "01", title: "Open connector form", body: "Connectors → Add new → Snowflake." }, { n: "02", title: "Enter account details", body: "Account identifier, database, schema, and warehouse." }, { n: "03", title: "Pick a sign-in method", body: "Key-pair RSA (recommended) or username + password." }, { n: "04", title: "Test the connection", body: "The connector lists databases and schemas as proof." }, { n: "05", title: "Choose a table", body: "Select a table. Enable time-travel to pin reads to a snapshot." }];
const READ = [{ f: "Tables", d: "All standard tables" }, { f: "Views", d: "Standard and secure views" }, { f: "VARIANT", d: "JSON-like semi-structured" }, { f: "ARRAY / OBJECT", d: "Nested semi-structured" }, { f: "Time-travel", d: "Historical snapshots (1-90 days)" }];
const WRITE = [{ f: "INSERT", d: "Row-by-row, transactional" }, { f: "COPY INTO", d: "Bulk load from stage" }, { f: "MERGE", d: "Upsert with match conditions" }, { f: "External stage", d: "S3, Azure Blob, GCS" }];
const AUTH = [{ icon: Key, title: "Key-pair RSA", body: "Generate an RSA key pair. Assign the public key to a Snowflake user with ALTER USER ... SET RSA_PUBLIC_KEY. Paste the private key.", badge: "Recommended" }, { icon: Users, title: "Username + password", body: "Standard password auth with optional MFA. Simpler but brittle for automated runs.", badge: null }];
const LIMITS = [{ k: "Max variant size", v: "16 MB per VARIANT value" }, { k: "Concurrent queries", v: "Warehouse-size dependent" }, { k: "Time-travel window", v: "1-90 days depending on edition" }, { k: "Auth scope", v: "Key-pair RSA or password+MFA" }, { k: "Private connectivity", v: "AWS PrivateLink / Azure Private Link" }, { k: "Read consistency", v: "Snapshot isolation per query" }];
const ERRORS = [{ code: "390100 Incorrect username or password", what: "Credentials wrong or MFA required.", fix: "Verify in Snowflake UI. If MFA is enforced, use key-pair auth." }, { code: "390201 No current database", what: "Database missing or not accessible.", fix: "GRANT USAGE ON DATABASE <db> TO ROLE <role>." }, { code: "390413 No active warehouse", what: "Warehouse missing or suspended.", fix: "Set the warehouse in the connector form." }, { code: "002003 Object does not exist", what: "Table name wrong or role cannot see it.", fix: "GRANT SELECT ON TABLE <db>.<schema>.<table> TO ROLE <role>." }, { code: "JWT token is invalid", what: "Private key doesn't match public key.", fix: "Regenerate the RSA key pair and re-assign the public key." }];
const FAQ = [{ q: "Does it support Snowflake's time-travel?", a: "Yes. Every read pins to a snapshot and the run is reproducible. For reconciliation, the connector can re-read an earlier snapshot within the retention window." }, { q: "Do I need a running warehouse?", a: "Yes. The connector suspends the warehouse automatically after the run if not using an always-on warehouse." }, { q: "Can I read VARIANT columns?", a: "Yes. VARIANT, ARRAY, and OBJECT columns are parsed and exposed as structured JSON." }, { q: "Network drops mid-run?", a: "The connector checkpoints completed micro-partitions. On reconnect it resumes from the next partition." }];
const RELATED = [{ href: "/browse-connectors/databricks", name: "Databricks" }, { href: "/browse-connectors/bigquery", name: "BigQuery" }, { href: "/browse-connectors/fabric", name: "Microsoft Fabric" }];

export default function SnowflakeConnectorPage() {
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
              <SnowflakeMark className="w-9 h-9 sm:w-10 sm:h-10" />
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
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
              </span>
            </Link>
            <Link href="/docs/connectors/snowflake" className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
              Read the setup guide <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-zinc-500">
            <li className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> Key-pair RSA</li>
            <li className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> Private Link</li>
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
            <p className="text-[12.5px] text-zinc-500 max-w-sm leading-relaxed">You'll need a running warehouse and a role with USAGE.</p>
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
            <p className="mt-3 text-[13px] text-zinc-600 leading-relaxed max-w-2xl">Key-pair RSA is strongly preferred. Password + MFA works but is brittle.</p>
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
            <div className="flex items-center gap-3 mb-4"><SnowflakeMark className="w-8 h-8 shrink-0" /></div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight break-words">Try the Snowflake connector.</h2>
            <p className="mt-3 text-[13.5px] text-zinc-600 leading-relaxed max-w-2xl break-words">Book a guided walkthrough, or follow the docs yourself.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <Link href="/contact" className="group inline-flex items-center justify-center gap-2 h-10 pl-5 pr-1.5 rounded-full bg-zinc-900 text-white text-[13px] font-medium hover:bg-zinc-800 transition-colors">
                Book a demo
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5"><ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} /></span>
              </Link>
              <Link href="/docs/connectors/snowflake" className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-white transition-colors">
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
