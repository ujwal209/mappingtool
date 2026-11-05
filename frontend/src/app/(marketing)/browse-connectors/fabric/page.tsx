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
// Microsoft Fabric mark — inline SVG
// ─────────────────────────────────────────────────────────────
function FabricMark({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fabricA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5FB7F2" />
          <stop offset="100%" stopColor="#1E7FD6" />
        </linearGradient>
        <linearGradient id="fabricB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3AA0EC" />
          <stop offset="100%" stopColor="#1668C7" />
        </linearGradient>
        <linearGradient id="fabricC" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8BC4F0" />
          <stop offset="100%" stopColor="#3A8FD0" />
        </linearGradient>
      </defs>
      {/* Three rounded squares stacked — Fabric logo motif */}
      <rect x="10" y="46" width="26" height="26" rx="6" fill="url(#fabricC)" />
      <rect x="35" y="26" width="30" height="30" rx="7" fill="url(#fabricB)" />
      <rect x="60" y="44" width="26" height="26" rx="6" fill="url(#fabricA)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────
const META = {
  name: "Microsoft Fabric",
  category: "Lakehouse",
  tagline:
    "Read OneLake Delta tables and warehouse data, follow DirectLake bindings, and write back to Lakehouse tables — all authenticated with Azure AD.",
  setupTime: "~15 minutes",
};

const FACTS = [
  { k: "Connector type", v: "Lakehouse" },
  { k: "Direction", v: "Read + Write" },
  { k: "Endpoint", v: "onelake.dfs.fabric.microsoft.com" },
  { k: "Auth", v: "Azure AD" },
  { k: "Setup", v: "~15 min" },
];

const STEPS = [
  {
    n: "01",
    title: "Open connector form",
    body: "Connectors → Add new → Microsoft Fabric.",
  },
  {
    n: "02",
    title: "Enter workspace details",
    body: "Workspace name and Lakehouse or Warehouse name. The connector resolves the OneLake endpoint automatically.",
  },
  {
    n: "03",
    title: "Pick a sign-in method",
    body: "Service principal (most common) or managed identity. Grant the principal Fabric workspace access first.",
  },
  {
    n: "04",
    title: "Test the connection",
    body: "The connector lists Lakehouses and Warehouses in the workspace. On failure you get the exact Fabric error.",
  },
  {
    n: "05",
    title: "Choose a table or folder",
    body: "Point at a Delta table (e.g. orders) or a folder. Preview columns + inferred types before migrating.",
  },
];

const READ = [
  { f: "Delta", d: "Lakehouse tables, _delta_log read" },
  { f: "Parquet", d: "OneLake files, schema in file" },
  { f: "CSV", d: "OneLake files, delimited" },
  { f: "JSON", d: "OneLake files, nested or flat" },
  { f: "Warehouse", d: "T-SQL tables via SQL endpoint" },
];

const WRITE = [
  { f: "Delta", d: "Lakehouse tables with MERGE" },
  { f: "Parquet", d: "OneLake files, one per partition" },
  { f: "CSV", d: "OneLake files with header" },
  { f: "JSON", d: "Line-delimited output" },
];

const AUTH = [
  {
    icon: Key,
    title: "Service principal",
    body: "Create an app registration in Azure AD. In Fabric, add it to the workspace as Contributor (or Member for reads only). Paste tenant ID, client ID and client secret into the connector.",
    badge: "Most common",
  },
  {
    icon: Users,
    title: "Managed identity",
    body: "If Migration Studio runs inside Azure, use a managed identity. Add the identity to the Fabric workspace the same way. No secrets leave Azure.",
    badge: null,
  },
];

const LIMITS = [
  { k: "Max file size", v: "5 GB per Parquet file (split larger first)" },
  { k: "DirectLake tables", v: "Read supported, write requires Import or DirectQuery" },
  { k: "Concurrent reads", v: "8 parallel streams per workspace" },
  { k: "Auth scope", v: "Azure AD only — no workspace keys" },
  { k: "Private endpoint", v: "Supported via managed private endpoints in Fabric" },
  { k: "Read consistency", v: "Strong for Delta, eventual for Warehouse SQL" },
];

const ERRORS = [
  {
    code: "401 Unauthorized",
    what: "The service principal has a valid token but is not a member of the Fabric workspace.",
    fix: "In Fabric → workspace → Manage access → Add the service principal as Contributor.",
  },
  {
    code: "403 Forbidden — workspace",
    what: "The principal can see the workspace but not the specific Lakehouse.",
    fix: "Grant workspace-level access, not just tenant-level. Fabric does not support per-item-only access for automated principals.",
  },
  {
    code: "404 LakehouseNotFound",
    what: "Lakehouse name is wrong or in a different workspace.",
    fix: "Double-check the workspace name and Lakehouse name in the Fabric portal.",
  },
  {
    code: "DirectLakeNotSupported",
    what: "The target is a DirectLake dataset; direct writes are not allowed.",
    fix: "Write to the underlying Delta table instead, then refresh the DirectLake dataset.",
  },
  {
    code: "CapacityThrottled",
    what: "The Fabric capacity is throttled for the current operation.",
    fix: "Wait for the capacity to recover, or run the migration against a larger capacity SKU.",
  },
];

const FAQ = [
  {
    q: "Does it work with both Lakehouse and Warehouse?",
    a: "Yes. Lakehouse tables are read via the OneLake DFS endpoint as Delta; Warehouse tables are read via the SQL analytics endpoint. Writes go to Lakehouse Delta tables — Warehouse writes are not supported because T-SQL tables don't expose a bulk load path the connector can safely use.",
  },
  {
    q: "Can I read DirectLake tables?",
    a: "Yes, DirectLake datasets read the underlying Delta tables — the connector reads those Delta files directly. You cannot write to a DirectLake dataset; write to the Delta table and refresh the dataset afterward.",
  },
  {
    q: "Do I need a Fabric capacity?",
    a: "Yes. Fabric requires an F-SKU capacity (F2 or higher) or a Power BI Premium capacity with Fabric enabled. The connector cannot read from trial or free workspaces.",
  },
  {
    q: "Network drops mid-run?",
    a: "The connector checkpoints completed Delta files. On reconnect it resumes from the next file. Delta files are tracked by their version number — if the table changed since the checkpoint, it re-reads the changed version rather than skipping.",
  },
];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function FabricConnectorPage() {
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
              <FabricMark className="w-9 h-9 sm:w-10 sm:h-10" />
            </div>
            <div className="min-w-0 pt-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-1">
                {META.category} connector
              </p>
              <h1 className="text-[26px] sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1] break-words">
                Microsoft Fabric
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
              href="/docs/connectors/fabric"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Read the setup guide
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-zinc-500">
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> Azure AD only
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} /> Private endpoints
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
                Five steps. Fifteen minutes.
              </h2>
            </div>
            <p className="text-[12.5px] text-zinc-500 max-w-sm leading-relaxed">
              You'll need Fabric workspace access to grant the sign-in identity. Everything else happens inside the app.
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
              Supported sources
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
                <span className="ml-auto text-[11px] text-zinc-500">5 sources</span>
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
                <span className="ml-auto text-[11px] text-zinc-500">4 formats</span>
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
              Both are Azure AD. Either way, the identity must be added to the Fabric workspace.
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
              <FabricMark className="w-8 h-8 shrink-0" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight break-words">
              Try the Microsoft Fabric connector.
            </h2>
            <p className="mt-3 text-[13.5px] text-zinc-600 leading-relaxed max-w-2xl break-words">
              Book a guided walkthrough, or follow the docs yourself. Either way — fifteen minutes to first read.
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
                href="/docs/connectors/fabric"
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-300 bg-white text-[13px] font-medium text-zinc-700 hover:bg-white transition-colors"
              >
                Read the docs
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-zinc-500">
              <span className="text-zinc-400">Related connectors:</span>
              <Link href="/browse-connectors/adls" className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-4 break-words">
                Azure Data Lake <ArrowUpRight className="w-3 h-3 shrink-0" />
              </Link>
              <Link href="/browse-connectors/databricks" className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-4 break-words">
                Databricks <ArrowUpRight className="w-3 h-3 shrink-0" />
              </Link>
              <Link href="/browse-connectors/snowflake" className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-4 break-words">
                Snowflake <ArrowUpRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}