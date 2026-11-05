import Link from "next/link";
import { ChevronRight } from "lucide-react";

const ENDPOINTS = [
  { method: "GET", path: "/api/connectors", desc: "List all connectors in the workspace.", body: `{
  "connectors": [
    {
      "id": "conn-abc",
      "type": "adls",
      "name": "prod-data-lake",
      "status": "connected",
      "created_at": "2026-09-12T10:30:00Z"
    }
  ],
  "total": 1
}` },
  { method: "POST", path: "/api/connectors", desc: "Create a new connector.", body: `POST /api/connectors
{
  "type": "adls",
  "name": "prod-data-lake",
  "config": {
    "storage_account": "mystorage",
    "container": "raw-data",
    "tenant_id": "...",
    "client_id": "...",
    "client_secret": "..."
  }
}` },
  { method: "POST", path: "/api/connectors/{id}/test", desc: "Test a connection. Returns probe result.", body: `POST /api/connectors/conn-abc/test

200 OK
{
  "ok": true,
  "objects_found": 4,
  "sample": ["raw-data/", "supplier/", "orders/", "reference/"]
}` },
  { method: "GET", path: "/api/connectors/{id}/schema", desc: "Probe the source schema.", body: `GET /api/connectors/conn-abc/schema?path=supplier/po-2081/

200 OK
{
  "path": "supplier/po-2081/",
  "columns": [
    { "name": "sku", "type": "string", "nullable": false },
    { "name": "quantity", "type": "int32", "nullable": false },
    { "name": "received_at", "type": "timestamp", "nullable": true }
  ],
  "format": "parquet",
  "row_count_estimate": 100
}` },
  { method: "DELETE", path: "/api/connectors/{id}", desc: "Delete a connector. Runs referencing it are preserved.", body: `DELETE /api/connectors/conn-abc
204 No Content` },
];

export default function ApiConnectorsPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Connectors</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">Connectors API</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Create, test, and probe connectors. All endpoints are scoped to the current workspace.
      </p>

      <div className="mt-10 space-y-10">
        {ENDPOINTS.map((e) => (
          <section key={e.method + e.path}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${e.method === "GET" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : e.method === "POST" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {e.method}
              </span>
              <code className="text-[13.5px] font-mono font-semibold text-zinc-900">{e.path}</code>
            </div>
            <p className="text-[13px] text-zinc-600 mb-3">{e.desc}</p>
            <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
              <code>{e.body}</code>
            </pre>
          </section>
        ))}
      </div>
    </main>
  );
}