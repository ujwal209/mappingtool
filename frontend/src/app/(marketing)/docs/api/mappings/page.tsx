import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function ApiMappingsPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Mappings</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">Mappings API</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Create draft mappings, approve fields, freeze into SHA-256 versions, and list historical versions.
      </p>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">POST</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/mappings</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">Create a new draft mapping. Drafts are editable; frozen versions are not.</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`POST /api/mappings
{
  "source_connector_id": "conn-abc",
  "target_connector_id": "conn-xyz",
  "source_path": "supplier/po-2081/",
  "target_path": "lakehouse/orders/",
  "ontology_id": "onto-retail-v1"
}

201 Created
{
  "id": "map-def",
  "state": "draft",
  "source_schema": [...],
  "target_schema": [...]
}`}
        </pre>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">POST</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/mappings/&#123;id&#125;/approve</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">Approve all fields and freeze. Returns the SHA-256 hash of the frozen mapping.</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`POST /api/mappings/map-def/approve
{
  "fields": [
    { "source": "sku", "target": "sku", "transform": "direct" },
    { "source": "quantity", "target": "qty", "transform": "cast:int64" }
  ]
}

200 OK
{
  "id": "map-def",
  "version": "sha256:a3f5c8d9e1b2...",
  "state": "frozen",
  "frozen_at": "2026-10-20T14:00:00Z"
}`}
        </pre>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">GET</span>
          <code className="text-[13.5px] font-mono font-semibold text-zinc-900">/api/mappings/&#123;id&#125;/versions</code>
        </div>
        <p className="text-[13px] text-zinc-600 mb-3">List all frozen versions of a mapping, ordered newest first.</p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`GET /api/mappings/map-def/versions

200 OK
{
  "versions": [
    { "hash": "sha256:a3f5...", "frozen_at": "2026-10-20T14:00:00Z" },
    { "hash": "sha256:7b2e...", "frozen_at": "2026-10-15T09:12:00Z" }
  ]
}`}
        </pre>
      </section>
    </main>
  );
}