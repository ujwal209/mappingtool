import Link from "next/link";
import { ChevronRight, Check, Clock, AlertTriangle } from "lucide-react";

const STEPS = [
  {
    title: "Pick a source connector",
    body: "Open Browse connectors. Choose something you can test immediately — a public S3 bucket, an ADLS container you have read access to, or a local PostgreSQL instance. Click Add connector, enter credentials, click Test.",
  },
  {
    title: "Bind to the ontology (optional)",
    body: "If you're migrating an existing source into a known target, spend 5 minutes defining 2-3 entities in Ontology first. If this is just a test, skip and bind later.",
  },
  {
    title: "Create a draft mapping",
    body: "Open Mapping → New. Pick your source on the left, target on the right. If your target is empty, choose a path that doesn't exist yet — the connector will create it on the first run.",
  },
  {
    title: "Map the fields",
    body: "Click each source column and connect it to a target field. For a quick test, map everything directly. For real migrations, use Auto-suggest and review each proposal.",
  },
  {
    title: "Add transforms where types differ",
    body: "If a source column is int32 and the target wants int64, the mapping will fail without a Cast transform. Click the edge between the two fields, choose Cast, pick the target type.",
  },
  {
    title: "Preview",
    body: "Click Preview. The connector reads 100 rows from the source, applies every transform, and shows you what would land. No writes happen — it's a dry run.",
  },
  {
    title: "Approve and freeze",
    body: "Click Approve all fields. Then click Freeze. This computes the SHA-256 hash of the mapping and makes it immutable. Downstream runs will pin to this exact version.",
  },
  {
    title: "Run",
    body: "Click Run from the mapping editor. The connector probes the source for drift, then reads every row, transforms, writes, and reconciles. Watch the progress bar.",
  },
  {
    title: "Review reconciliation",
    body: "When the run finishes, click the reconciliation tab. Row counts, sums, and hash totals should all match. If they don't, the run halts without sign-off and shows exactly which check failed.",
  },
  {
    title: "Download evidence",
    body: "Click Download evidence bundle. Inside: signed lineage (every target row → source row), reconciliation report, and the mapping's SHA-256 hash. This is what auditors see.",
  },
];

export default function FirstMigrationPage() {
  return (
    <article className="max-w-3xl">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-500">Getting started</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">First migration</span>
      </nav>

      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
        Getting started
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">
        Your first migration
      </h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed">
        Ten steps, roughly 25 minutes. By the end you'll have a frozen mapping, a signed-off run, and a downloadable evidence bundle.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" strokeWidth={2} /> 25 minutes</span>
        <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> End-to-end</span>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" strokeWidth={2} />
          <p className="text-[12.5px] text-amber-900 leading-relaxed">
            <strong>Test with a small dataset first.</strong> Point at a folder with fewer than 10,000 rows for the first run so you can verify the entire flow in under a minute. Then scale up.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <ol className="space-y-6">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 text-white text-[10.5px] font-bold shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-zinc-900 mb-1">{s.title}</h3>
                <p className="text-[13px] text-zinc-700 leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">If something fails</h2>
        <div className="space-y-2">
          {[
            { q: "Connection test fails", a: "Check firewall, credentials, and scope. Most ADLS failures are missing container-level RBAC (a role on the account doesn't cascade)." },
            { q: "Mapping freeze fails", a: "Every field must be approved. Click Approve all — it walks through any unapproved fields one by one." },
            { q: "Run halts at 'Probing'", a: "The source schema changed since you froze the mapping. Open the mapping, review the drift diff, update the fields, and freeze a new version." },
            { q: "Reconciliation fails", a: "The source had concurrent writes during your run. Re-run in a maintenance window or use a snapshot read." },
          ].map((e) => (
            <details key={e.q} className="group rounded-lg border border-zinc-200 bg-white open:bg-zinc-50 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-4 py-3">
                <span className="text-[13px] font-semibold text-zinc-900">{e.q}</span>
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 transition-transform group-open:rotate-90" strokeWidth={2} />
              </summary>
              <p className="px-4 pb-3 text-[12.5px] text-zinc-600 leading-relaxed">{e.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-10 pt-6 border-t border-zinc-200">
        <h2 className="text-[15px] font-semibold text-zinc-900 mb-3">Next up</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/docs/mapping/quickstart" className="group rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition">
            <p className="text-[13px] font-semibold text-zinc-900">Mapping quickstart</p>
            <p className="text-[12px] text-zinc-500 mt-1">Full mapping reference.</p>
          </Link>
          <Link href="/docs/runs/execution" className="group rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition">
            <p className="text-[13px] font-semibold text-zinc-900">Runs in depth</p>
            <p className="text-[12px] text-zinc-500 mt-1">Every state and stage explained.</p>
          </Link>
        </div>
      </section>
    </article>
  );
}