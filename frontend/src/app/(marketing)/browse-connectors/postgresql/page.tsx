import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Lock,
  Key,
  Database,
  FileText,
  Clock,
  ExternalLink,
  Users,
  ChevronRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// PostgreSQL mark — inline SVG (elephant motif, official blue)
// ─────────────────────────────────────────────────────────────
function PostgresMark({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pgBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4A90D9" />
          <stop offset="100%" stopColor="#1E5FA8" />
        </linearGradient>
        <linearGradient id="pgTrunk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5DA8E8" />
          <stop offset="100%" stopColor="#2A6DB5" />
        </linearGradient>
      </defs>
      {/* Head */}
      <ellipse cx="48" cy="44" rx="24" ry="22" fill="url(#pgBody)" />
      {/* Ear */}
      <ellipse cx="30" cy="40" rx="7" ry="9" fill="#3A7FC4" />
      {/* Eye */}
      <circle cx="56" cy="40" r="3.5" fill="#FFFFFF" />
      <circle cx="56.5" cy="40.5" r="1.8" fill="#0C3057" />
      {/* Trunk */}
      <path
        d="M56 58 Q58 74 46 80 Q40 83 36 80 Q34 78 36 75 Q42 72 44 64 Q45 60 48 58 Z"
        fill="url(#pgTrunk)"
      />
      {/* Tusk */}
      <path d="M52 62 Q50 68 48 70" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      {/* Stripes on trunk */}
      <path d="M52 64 Q50 66 48 66" fill="none" stroke="#1E5FA8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M51 69 Q49 71 47 71" fill="none" stroke="#1E5FA8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────
const META = {
  name: "PostgreSQL",
  category: "Database",
  tagline:
    "Read tables from any PostgreSQL instance, follow logical replication for incremental runs, and parse JSONB into typed columns — all over a TLS connection.",
  setupTime: "~5 minutes",
};

const FACTS = [
  { k: "Connector type", v: "Relational database" },
  { k: "Direction", v: "Read + Write" },
  { k: "Protocol", v: "PostgreSQL wire (TLS)" },
  { k: "Auth", v: "SCRAM-SHA-256" },
  { k: "Setup", v: "~5 min" },
];

const STEPS = [
  {
    n: "01",
    title: "Open connector form",
    body: "Connectors → Add new → PostgreSQL.",
  },
  {
    n: "02",
    title: "Enter connection details",
    body: "Host, port (default 5432), database name, and schema (default public).",
  },
  {
    n: "03",
    title: "Pick a sign-in method",
    body: "Username + password (SCRAM-SHA-256) or SSL client certificate. TLS is mandatory.",
  },
  {
    n: "04",
    title: "Test the connection",
    body: "The connector lists schemas and tables as proof. On failure you get the exact PostgreSQL error code.",
  },
  {
    n: "05",
    title: "Choose a table",
    body: "Select a table or view. Preview columns + inferred types. Set an incremental column if you want replication.",
  },
];

const READ = [
  { f: "Tables", d: "All row types via SELECT" },
  { f: "Views", d: "Materialized and plain" },
  { f: "JSONB", d: "Parsed into typed columns" },
  { f: "Arrays", d: "int[], text[], custom types" },
  { f: "Enums", d: "Mapped to string with allowed values" },
];

const WRITE = [
  { f: "INSERT", d: "Row-by-row, transactional" },
  { f: "COPY", d: "Bulk load, minimal logging" },
  { f: "UPSERT", d: "ON CONFLICT DO UPDATE" },
  { f: "UPDATE", d: "Targeted by primary key" },
];

const AUTH = [
  {
    icon: Key,
    title: "Username + password",
    body: "SCRAM-SHA-256 over TLS. Create a read-only role for incremental runs, or a write role for the target database. Never reuse a superuser account.",
    badge: "Most common",
  },
  {
    icon: ShieldCheck,
    title: "SSL client certificate",
    body: "Mutual TLS with a client certificate. Set `pg_hba.conf` to `cert` auth for the connector's user. Best for locked-down environments where passwords are not permitted.",
    badge: null,
  },
];

const LIMITS = [
  { k: "Max row size", v: "1 GB per row (TOAST limit on PostgreSQL)" },
  { k: "Concurrent readers", v: "4 parallel connections per database" },
  { k: "Replication slot", v: "One slot per connector, requires `wal_level = logical`" },
  { k: "TLS", v: "Mandatory — plaintext connections are refused" },
  { k: "Replica support", v: "Reads work against replicas; writes require primary" },
  { k: "Read consistency", v: "Snapshot isolation per batch" },
];

const ERRORS = [
  {
    code: "28P01 password authentication failed",
    what: "Wrong username or password, or the user does not exist on this database.",
    fix: "Verify the username and password against psql. Check pg_hba.conf allows the connection method for this host.",
  },
  {
    code: "28000 no pg_hba.conf entry",
    what: "The server rejects the connection because the host/user/database combination is not in pg_hba.conf.",
    fix: "Add a pg_hba.conf line for the connector's IP, e.g. hostssl all all 10.0.0.0/8 scram-sha-256. Reload with pg_ctl reload.",
  },
  {
    code: "3D000 database does not exist",
    what: "Database name is wrong or the user has no access to it.",
    fix: "Double-check the database name in psql. If using a connection pooler (pgbouncer), verify the target database is configured.",
  },
  {
    code: "42501 permission denied for table",
    what: "The user can connect but cannot SELECT from the specific table.",
    fix: "GRANT SELECT ON TABLE <schema>.<table> TO <user>. For all tables in the schema: GRANT SELECT ON ALL TABLES IN SCHEMA <schema> TO <user>.",
  },
  {
    code: "55006 replication slot is active",
    what: "Another process is using the replication slot the connector needs.",
    fix: "Stop the other consumer, or create a dedicated slot for the connector via the 'Incremental column' setting. Slots cannot be shared.",
  },
];

const FAQ = [
  {
    q: "Do I need logical replication for incremental runs?",
    a: "Yes. Set wal_level = logical in postgresql.conf and restart. Then the connector can create a replication slot and stream changes. Without it, incremental runs fall back to timestamp-based polling, which misses deletes.",
  },
  {
    q: "Does it work with Amazon RDS or Azure Database for PostgreSQL?",
    a: "Yes. Both allow logical replication on supported versions (PG 11+). On RDS, you must set rds.logical_replication = 1 in the parameter group. On Azure, set azure.replication_support = logical. The connector's 'Test connection' surfaces a clear error if replication is not enabled.",
  },
  {
    q: "Can I read from a read replica?",
    a: "Yes, for read-only migrations. Replicas work for SELECT and logical replication. Writes require the primary — the connector refuses to write to a replica and tells you why.",
  },
  {
    q: "Network drops mid-run?",
    a: "The connector checkpoints completed tables and, for incremental runs, the last committed LSN. On reconnect it resumes from that LSN. Logical replication is durable across reconnects as long as the slot is not dropped.",
  },
];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function PostgresConnectorPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased">
      {/* HERO */}
      <section className="border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20">
          <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-8 flex-wrap">
            <Link href="/browse-connectors" className="hover:text-zinc-900 transition-colors">
              Browse connectors
            </Link>
            <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="text-zinc-900 font-medium">{META.name}</span>
          </nav>

          <div className="flex items-start gap-4 sm:gap-5 mb-6 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center shrink-0">
              <PostgresMark className="w-9 h-9 sm:w-10 sm:h-10" />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-1">
                {META.category} connector
              </p>
              <h1 className="text-[26px] sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1] break-words">
                PostgreSQL
              </h1>
            </div>
          </div>

          <p className="text-[15.5px] sm:text-base text-zinc-600 leading-relaxed max-w-3xl break-words">
            {META.tagline}
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
            <Link
              href="/contact"
              className="group inline-flex items-center justify-center gap-2 h-10 pl-5 pr-1.5 rounded-full bg-zinc-900 text-white text-[13px] font-medium hover:bg-zinc-800 transition-colors"
            >
              Try this connector
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
              </span>
            </Link>
            <Link
              href="/docs/connectors/postgresql"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Read the setup guide
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-zinc-500">
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> TLS mandatory
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> SCRAM-SHA-256
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> {META.setupTime} setup
            </li>
          </ul>
        </div>
      </section>

      {/* FACTS */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {FACTS.map((f) => (
              <div key={f.k} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-1 break-words">
                  {f.k}
                </p>
                <p className="text-[13px] font-medium text-zinc-900 leading-snug break-words">
                  {f.v}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SETUP */}
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="flex items-end justify-between gap-6 mb-8 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
                How to connect
              </p>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">
                Five steps. Five minutes.
              </h2>
            </div>
            <p className="text-[12.5px] text-zinc-500 max-w-sm leading-relaxed">
              You'll need a read-only database user. Everything else happens inside the app.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-5 min-w-0">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 text-white text-[10.5px] font-bold mb-4">
                  {s.n}
                </span>
                <h3 className="text-[13.5px] font-semibold text-zinc-900 leading-snug mb-1.5 break-words">
                  {s.title}
                </h3>
                <p className="text-[12px] text-zinc-600 leading-relaxed break-words">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORMATS */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
              Supported operations
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">
              What you can read and write.
            </h2>
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
                    <span className="text-[12.5px] font-mono font-medium text-zinc-900 shrink-0">
                      {r.f}
                    </span>
                    <span className="text-[11.5px] text-zinc-500 text-right break-words">
                      {r.d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 flex-wrap">
                <Database className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={2} />
                <h3 className="text-[12.5px] font-semibold text-zinc-900">Can write</h3>
                <span className="ml-auto text-[11px] text-zinc-500">4 operations</span>
              </div>
              <ul className="divide-y divide-zinc-200">
                {WRITE.map((r) => (
                  <li key={r.f} className="flex items-start justify-between gap-4 px-5 py-2.5 min-w-0">
                    <span className="text-[12.5px] font-mono font-medium text-zinc-900 shrink-0">
                      {r.f}
                    </span>
                    <span className="text-[11.5px] text-zinc-500 text-right break-words">
                      {r.d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* AUTH */}
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
              Sign-in
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">
              Two ways to authenticate.
            </h2>
            <p className="mt-3 text-[13px] text-zinc-600 leading-relaxed max-w-2xl">
              Both require TLS. Neither supports the legacy `md5` auth method — SCRAM-SHA-256 or certificate only.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {AUTH.map((m) => (
              <div
                key={m.title}
                className={`rounded-2xl border p-5 sm:p-6 min-w-0 ${
                  m.badge ? "border-zinc-900 bg-white" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <m.icon className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={2} />
                  <h3 className="text-[13.5px] font-semibold text-zinc-900 break-words">
                    {m.title}
                  </h3>
                  {m.badge && (
                    <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white bg-zinc-900 rounded-full px-2 py-0.5 whitespace-nowrap">
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] text-zinc-600 leading-relaxed break-words">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIMITS */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
              Limits
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">
              What it can and cannot do.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LIMITS.map((l) => (
              <div key={l.k} className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-3.5 min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500 mb-1 break-words">
                  {l.k}
                </p>
                <p className="text-[13px] text-zinc-900 leading-relaxed break-words">
                  {l.v}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TROUBLESHOOTING */}
      <section className="border-b border-zinc-200 bg-zinc-900 text-zinc-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400 mb-2">
              Troubleshooting
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] leading-tight">
              When the connection fails.
            </h2>
          </div>

          <div className="space-y-3">
            {ERRORS.map((e, i) => (
              <div key={e.code} className="rounded-2xl border border-zinc-800 bg-zinc-800/40 p-5 min-w-0">
                <div className="flex items-start gap-3 mb-2 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <code className="text-[12px] font-mono text-zinc-200 break-all pt-0.5 min-w-0">
                    {e.code}
                  </code>
                </div>
                <p className="text-[12px] text-zinc-400 leading-relaxed ml-9 mb-2 break-words">
                  {e.what}
                </p>
                <div className="flex items-start gap-2 ml-9 min-w-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" strokeWidth={2.5} />
                  <p className="text-[12.5px] text-zinc-300 leading-relaxed break-words">
                    <span className="font-semibold text-white">Fix: </span>
                    {e.fix}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="mb-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
              FAQ
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight">
              Common questions.
            </h2>
          </div>
          <div className="space-y-2">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-zinc-200 bg-white open:bg-zinc-50 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-start justify-between gap-4 cursor-pointer list-none px-5 py-4 min-w-0">
                  <span className="text-[13.5px] font-semibold text-zinc-900 break-words">
                    {item.q}
                  </span>
                  <ChevronRight
                    className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5 transition-transform group-open:rotate-90"
                    strokeWidth={2}
                  />
                </summary>
                <p className="px-5 pb-4 text-[13px] text-zinc-600 leading-relaxed break-words">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 sm:p-10 lg:p-12 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <PostgresMark className="w-8 h-8 shrink-0" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight break-words">
              Try the PostgreSQL connector.
            </h2>
            <p className="mt-3 text-[13.5px] text-zinc-600 leading-relaxed max-w-2xl break-words">
              Book a guided walkthrough, or follow the docs yourself. Either way — five minutes to first read.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <Link
                href="/contact"
                className="group inline-flex items-center justify-center gap-2 h-10 pl-5 pr-1.5 rounded-full bg-zinc-900 text-white text-[13px] font-medium hover:bg-zinc-800 transition-colors"
              >
                Book a demo
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
                </span>
              </Link>
              <Link
                href="/docs/connectors/postgresql"
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-white transition-colors"
              >
                Read the docs
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-zinc-500">
              <span className="text-zinc-400">Related connectors:</span>
              <Link href="/browse-connectors/sqlserver" className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-4 break-words">
                SQL Server <ArrowUpRight className="w-3 h-3 shrink-0" />
              </Link>
              <Link href="/browse-connectors/oracle" className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-4 break-words">
                Oracle <ArrowUpRight className="w-3 h-3 shrink-0" />
              </Link>
              <Link href="/browse-connectors/mongodb" className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-4 break-words">
                MongoDB Atlas <ArrowUpRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}