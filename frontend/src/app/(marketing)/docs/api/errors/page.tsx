import Link from "next/link";
import { ChevronRight } from "lucide-react";

const STATUS = [
  { code: "400", name: "Bad Request", meaning: "Malformed request body or query params.", fix: "Check JSON syntax and required fields." },
  { code: "401", name: "Unauthorized", meaning: "Missing or invalid bearer token.", fix: "Send Authorization: Bearer <token>. Refresh if expired." },
  { code: "403", name: "Forbidden", meaning: "Valid token but insufficient permissions.", fix: "Ask workspace admin to grant the role." },
  { code: "404", name: "Not Found", meaning: "Resource ID doesn't exist or was deleted.", fix: "Verify ID by listing the collection first." },
  { code: "409", name: "Conflict", meaning: "State conflict (e.g. editing frozen mapping).", fix: "Fork the mapping to make edits." },
  { code: "422", name: "Unprocessable Entity", meaning: "Validation errors.", fix: "Response includes field-level errors." },
  { code: "429", name: "Too Many Requests", meaning: "Rate limit exceeded (100/min reads, 20/min writes).", fix: "Back off with exponential retry." },
  { code: "500", name: "Internal Server Error", meaning: "Unexpected server-side error.", fix: "Retry once. If persists, contact support with request ID." },
  { code: "503", name: "Service Unavailable", meaning: "Maintenance or capacity.", fix: "Retry with backoff. Check status.migration.studio." },
];

export default function ApiErrorsPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Errors</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">Errors</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        HTTP status codes, error response shape, and how to handle each.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Error response shape</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`{
  "error": {
    "code": "schema_drift_detected",
    "message": "Source column 'quantity' changed type from int32 to int64",
    "request_id": "req-abc123",
    "details": {
      "previous": "int32",
      "current": "int64"
    }
  }
}`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Status codes</h2>
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          {STATUS.map((s, i) => (
            <div key={s.code} className={`grid grid-cols-1 sm:grid-cols-[60px_140px_1fr] gap-2 px-5 py-3 ${i < STATUS.length - 1 ? "border-b border-zinc-100" : ""}`}>
              <span className="text-[12px] font-mono font-bold text-zinc-900">{s.code}</span>
              <span className="text-[12px] font-semibold text-zinc-900">{s.name}</span>
              <div>
                <p className="text-[12px] text-zinc-600">{s.meaning}</p>
                <p className="text-[11.5px] text-zinc-500 mt-0.5">{s.fix}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}