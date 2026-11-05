import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function ApiLineagePage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Lineage</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">Lineage API</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Trace any target row back to the exact source record that produced it, with the mapping version pinned.
      </p>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">GET</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/runs/&#123;id&#125;/lineage</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">Paginated lineage records for a run. Filter by target key.</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`GET /api/runs/run-abc123/lineage?target_key=ITM-1042&page=1&per_page=100

200 OK
{
  "records": [
    {
      "target_key": "ITM-1042",
      "target_row_id": "row-9845",
      "source_connector_id": "conn-abc",
      "source_path": "supplier/po-2081/receiving.parquet",
      "source_row_id": "row-17",
      "mapping_version": "sha256:a3f5...",
      "transform": "direct"
    }
  ],
  "total": 1,
  "next_page_url": null
}`}
        </pre>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">GET</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/lineage/reverse</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">Given a source row, find every target row it fed.</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`GET /api/lineage/reverse?connector_id=conn-abc&path=supplier/po-2081/receiving.parquet&row_id=row-17

200 OK
{
  "target_rows": [
    { "run_id": "run-abc123", "target_row_id": "row-9845", "target_key": "ITM-1042" }
  ]
}`}
        </pre>
      </section>
    </main>
  );
}