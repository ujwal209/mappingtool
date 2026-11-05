import Link from "next/link";
import { ChevronRight } from "lucide-react";

const EVENTS = [
  { name: "run.started", body: "Emitted when a run transitions from Queued to Running." },
  { name: "run.completed", body: "Emitted when a run reaches Signed off. Includes reconciliation summary." },
  { name: "run.failed", body: "Emitted when a run halts at any stage. Includes error code and message." },
  { name: "mapping.frozen", body: "Emitted when a mapping version is approved and hashed." },
  { name: "connector.drift_detected", body: "Emitted when a source schema differs from the last frozen mapping." },
];

export default function ApiWebhooksPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Webhooks</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">Webhooks</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Real-time notifications for run and mapping lifecycle events. Delivery is at-least-once with HMAC-SHA256 signature verification.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Events</h2>
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          {EVENTS.map((e, i) => (
            <div key={e.name} className={`px-5 py-3 ${i < EVENTS.length - 1 ? "border-b border-zinc-100" : ""}`}>
              <code className="text-[12.5px] font-mono font-semibold text-zinc-900">{e.name}</code>
              <p className="text-[12px] text-zinc-600 mt-1">{e.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Request shape</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`POST <your-endpoint>
X-Migration-Signature: sha256=<hmac-hex>
Content-Type: application/json

{
  "event": "run.completed",
  "occurred_at": "2026-10-20T14:34:17Z",
  "workspace_id": "ws-abc",
  "data": {
    "run_id": "run-abc123",
    "mapping_version": "sha256:a3f5...",
    "reconciliation": {
      "row_counts_match": true,
      "sums_match": true,
      "hash_totals_match": true
    }
  }
}`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Verifying signatures</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`import hmac, hashlib

def verify(body_bytes, signature_header, secret):
    expected = "sha256=" + hmac.new(
        secret.encode(), body_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)`}
        </pre>
      </section>
    </main>
  );
}