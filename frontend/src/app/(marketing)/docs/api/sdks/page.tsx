import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function ApiSdksPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">SDKs</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">SDKs</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Official clients for Python and TypeScript. Both mirror the REST API exactly.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Python</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`pip install migration-studio-sdk

# ── usage
from migration_studio import Client

client = Client(api_key="your-token", workspace="tenant-default")

# list connectors
for c in client.connectors.list():
    print(c.id, c.type, c.name)

# start a run
run = client.runs.start(
    mapping_id="map-def",
    mapping_version="sha256:a3f5...",
    mode="full",
)

# poll
import time
while run.state not in ("Signed off", "Failed"):
    time.sleep(10)
    run = client.runs.get(run.id)

# download evidence
if run.state == "Signed off":
    client.runs.evidence(run.id, out_path="evidence.zip")`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">TypeScript</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`npm install @migration-studio/sdk

// ── usage
import { Client } from "@migration-studio/sdk";

const client = new Client({
  apiKey: process.env.MS_API_KEY!,
  workspace: "tenant-default",
});

// list connectors
const connectors = await client.connectors.list();

// start a run
let run = await client.runs.start({
  mappingId: "map-def",
  mappingVersion: "sha256:a3f5...",
  mode: "full",
});

// poll
while (!["Signed off", "Failed"].includes(run.state)) {
  await new Promise((r) => setTimeout(r, 10000));
  run = await client.runs.get(run.id);
}

// download evidence
if (run.state === "Signed off") {
  await client.runs.evidence(run.id, { outPath: "evidence.zip" });
}`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">What's in each SDK</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Automatic retries", body: "Retries on 429 and 5xx with exponential backoff." },
            { title: "Typed responses", body: "Full type definitions for every endpoint." },
            { title: "Pagination helpers", body: "Iterators for list endpoints — no manual page=2." },
            { title: "Streaming telemetry", body: "Subscribe to run.status updates via SSE." },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-[13px] font-semibold text-zinc-900 mb-1">{c.title}</h3>
              <p className="text-[12px] text-zinc-600">{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}