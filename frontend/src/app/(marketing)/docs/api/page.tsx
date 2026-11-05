import Link from "next/link";
import { ArrowRight, Lock, FileText, Key } from "lucide-react";

const ENDPOINTS = [
  { method: "POST", path: "/api/auth/login", desc: "Exchange credentials for a bearer token." },
  { method: "POST", path: "/api/auth/refresh", desc: "Refresh an expiring token." },
  { method: "GET", path: "/api/me", desc: "Current user profile." },
  { method: "GET", path: "/api/connectors", desc: "List all connectors." },
  { method: "POST", path: "/api/connectors", desc: "Create a connector." },
  { method: "POST", path: "/api/connectors/{id}/test", desc: "Test connection." },
  { method: "GET", path: "/api/connectors/{id}/schema", desc: "Probe source schema." },
  { method: "GET", path: "/api/mappings", desc: "List mappings." },
  { method: "POST", path: "/api/mappings", desc: "Create draft mapping." },
  { method: "POST", path: "/api/mappings/{id}/approve", desc: "Approve and freeze. Returns SHA-256 hash." },
  { method: "GET", path: "/api/mappings/{id}/versions", desc: "List frozen versions." },
  { method: "POST", path: "/api/runs", desc: "Start a run against a frozen version." },
  { method: "GET", path: "/api/runs/{id}", desc: "Run status and telemetry." },
  { method: "GET", path: "/api/runs/{id}/reconciliation", desc: "Reconciliation report." },
  { method: "GET", path: "/api/runs/{id}/lineage", desc: "Row-level lineage." },
  { method: "GET", path: "/api/runs/{id}/evidence", desc: "Download evidence bundle." },
];

export default function ApiOverviewPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">
        REST API
      </h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Every capability in Migration Studio is available over HTTP with bearer JWT auth. All responses are JSON.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-5 text-[12px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" strokeWidth={2} /> Bearer JWT</span>
        <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" strokeWidth={2} /> JSON</span>
        <span className="inline-flex items-center gap-1.5"><Key className="w-3.5 h-3.5" strokeWidth={2} /> 100 req/min</span>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Authentication</h2>
        <p className="text-[13.5px] text-zinc-700 leading-relaxed mb-4">
          Every request needs <code className="text-[12px] font-mono bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5">Authorization: Bearer &lt;token&gt;</code>. Get one with:
        </p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`POST /api/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "..." }

→ { "access_token": "eyJhbGc...", "tenant_id": "..." }`}
        </pre>
        <p className="mt-3 text-[12.5px] text-zinc-500">Tokens expire after 24 hours. See <Link href="/docs/api/auth" className="text-zinc-900 underline underline-offset-4">/docs/api/auth</Link> for refresh flow.</p>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Endpoints</h2>
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          {ENDPOINTS.map((e, i) => (
            <div key={e.method + e.path} className={`grid grid-cols-1 sm:grid-cols-[60px_1fr] gap-2 px-5 py-3 ${i < ENDPOINTS.length - 1 ? "border-b border-zinc-100" : ""}`}>
              <span className={`text-[10.5px] font-bold uppercase tracking-wider ${e.method === "GET" ? "text-emerald-700" : "text-amber-700"}`}>{e.method}</span>
              <div>
                <code className="text-[12.5px] font-mono text-zinc-900 block">{e.path}</code>
                <p className="text-[12px] text-zinc-500 mt-0.5">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { title: "Authentication", href: "/docs/api/auth", body: "Login, refresh, JWT structure." },
          { title: "Connectors API", href: "/docs/api/connectors", body: "CRUD, test, schema probe." },
          { title: "Mappings API", href: "/docs/api/mappings", body: "Create, approve, freeze, versions." },
          { title: "Runs API", href: "/docs/api/runs", body: "Start, status, reconciliation, evidence." },
          { title: "Lineage API", href: "/docs/api/lineage", body: "Row-level lineage queries." },
          { title: "Webhooks", href: "/docs/api/webhooks", body: "Run lifecycle events with HMAC." },
          { title: "Errors", href: "/docs/api/errors", body: "HTTP status codes, error shapes." },
          { title: "SDKs", href: "/docs/api/sdks", body: "Python and TypeScript clients." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="group rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 transition">
            <h3 className="text-[13.5px] font-semibold text-zinc-900 mb-1">{c.title}</h3>
            <p className="text-[12px] text-zinc-600">{c.body}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-900 group-hover:gap-2 transition-all">
              Open <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}