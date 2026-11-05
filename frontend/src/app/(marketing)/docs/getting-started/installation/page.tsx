import Link from "next/link";
import { ChevronRight, Check, Clock, ExternalLink } from "lucide-react";

export default function InstallationPage() {
  return (
    <article className="max-w-3xl">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-500">Getting started</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Installation</span>
      </nav>

      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-2">
        Getting started
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">
        Installation
      </h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed">
        Get Migration Studio running in 10 minutes. Choose cloud-hosted or self-hosted — both use the same API and UI.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" strokeWidth={2} /> 10 minutes</span>
        <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> No credit card</span>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Option 1 — Cloud (recommended)</h2>
        <p className="text-[14px] text-zinc-600 leading-relaxed mb-4">
          Sign up at <a href="https://app.migration.studio" className="text-zinc-900 underline underline-offset-4">app.migration.studio</a> and you're live in 90 seconds. Nothing to install.
        </p>
        <ol className="space-y-3">
          {[
            "Open the signup page and enter your work email.",
            "Confirm the verification email (check spam if it doesn't arrive in 60 seconds).",
            "Create your first workspace — you'll be the owner.",
            "You're done. The dashboard loads with example connectors ready to inspect.",
          ].map((s, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] text-zinc-700 leading-relaxed">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 text-white text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Option 2 — Self-hosted (Docker)</h2>
        <p className="text-[14px] text-zinc-600 leading-relaxed mb-4">
          Requires Docker Compose and 4 GB RAM. Full stack runs in a single compose file.
        </p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`git clone https://github.com/migration-studio/deploy
cd deploy
cp .env.example .env
# edit .env: set DB_PASSWORD, JWT_SECRET, TENANT_DEFAULT

docker compose up -d

# App is at http://localhost:3000
# API is at http://localhost:8000`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Option 3 — Self-hosted (Kubernetes)</h2>
        <p className="text-[14px] text-zinc-600 leading-relaxed mb-4">
          For production deployments. Helm chart is published and versioned.
        </p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`helm repo add migration-studio https://charts.migration.studio
helm install ms migration-studio/migration-studio \\
  --set postgresql.auth.password=<strong-password> \\
  --set jwt.secret=<random-64-char> \\
  --namespace migration-studio --create-namespace`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Verify the install</h2>
        <p className="text-[14px] text-zinc-600 leading-relaxed mb-3">
          Confirm the API is healthy:
        </p>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`curl http://localhost:8000/health

→ { "status": "ok", "version": "1.4.2" }`}
        </pre>
      </section>

      <section className="mt-10 pt-6 border-t border-zinc-200">
        <h2 className="text-[15px] font-semibold text-zinc-900 mb-3">Next steps</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/docs/getting-started/first-migration" className="group rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition">
            <p className="text-[13px] font-semibold text-zinc-900">First migration</p>
            <p className="text-[12px] text-zinc-500 mt-1">Run a sample migration end to end.</p>
          </Link>
          <Link href="/docs/getting-started/concepts" className="group rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition">
            <p className="text-[13px] font-semibold text-zinc-900">Core concepts</p>
            <p className="text-[12px] text-zinc-500 mt-1">Connectors, ontology, mapping, runs.</p>
          </Link>
        </div>
      </section>
    </article>
  );
}