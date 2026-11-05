import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function ApiRunsPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Runs</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">Runs API</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Start runs, poll status, fetch reconciliation reports, and download evidence bundles.
      </p>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">POST</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/runs</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">Start a run against a frozen mapping version. Incremental requires a watermark column.</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`POST /api/runs
{
  "mapping_id": "map-def",
  "mapping_version": "sha256:a3f5...",
  "mode": "full" // or "incremental"
}

202 Accepted
{
  "id": "run-abc123",
  "state": "Queued",
  "created_at": "2026-10-20T14:12:00Z"
}`}
        </pre>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">GET</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/runs/&#123;id&#125;</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">Poll the run status. Safe to call every 10 seconds.</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`GET /api/runs/run-abc123

200 OK
{
  "id": "run-abc123",
  "state": "Signed off",
  "mapping_version": "sha256:a3f5...",
  "started_at": "2026-10-20T14:12:00Z",
  "finished_at": "2026-10-20T14:34:17Z",
  "telemetry": {
    "rows_read": 1000000,
    "rows_written": 1000000,
    "bytes_read": 48000000,
    "avg_rows_per_sec": 780
  },
  "reconciliation": {
    "row_counts_match": true,
    "sums_match": true,
    "hash_totals_match": true
  }
}`}
        </pre>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">GET</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/runs/&#123;id&#125;/evidence</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">Download the signed evidence bundle (ZIP).</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`GET /api/runs/run-abc123/evidence

200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename="evidence-run-abc123.zip"

<binary>
`}
        </pre>
      </section>
    </main>
  );
}