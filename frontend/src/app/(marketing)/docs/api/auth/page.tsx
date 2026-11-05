import Link from "next/link";
import { ChevronRight, AlertTriangle, Check } from "lucide-react";

const ERRORS = [
  { code: "401 invalid_credentials", cause: "Wrong email or password.", fix: "Verify credentials. Passwords are case-sensitive." },
  { code: "401 email_not_verified", cause: "Account created but email not confirmed.", fix: "Check the inbox for the verification link. Use /resend-verification if the email was lost." },
  { code: "401 token_expired", cause: "Bearer token older than 24h.", fix: "POST /api/auth/refresh with the old token to get a new one." },
  { code: "429 too_many_requests", cause: "More than 10 login attempts in 5 minutes.", fix: "Wait 5 minutes, or contact support if account is locked." },
];

export default function ApiAuthPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
      <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-6 flex-wrap">
        <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/docs/api" className="hover:text-zinc-900">API</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-900 font-medium">Authentication</span>
      </nav>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">API Reference</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.1]">Authentication</h1>
      <p className="mt-4 text-[15px] text-zinc-600 leading-relaxed max-w-2xl">
        Login, refresh tokens, and understand the JWT structure. All authenticated endpoints use the Bearer scheme.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Login</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`POST /api/auth/login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "your-password"
}

200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "tenant_id": "tenant-default"
}`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Refresh</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`POST /api/auth/refresh
Authorization: Bearer <current-token>

200 OK
{
  "access_token": "<new-token>",
  "expires_in": 86400
}`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">JWT structure</h2>
        <pre className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-[12px] font-mono leading-relaxed overflow-x-auto">
{`{
  "sub": "user-uuid",
  "email": "you@example.com",
  "tenant_id": "tenant-default",
  "iat": 1729400000,
  "exp": 1729486400
}`}
        </pre>
        <p className="mt-3 text-[12.5px] text-zinc-600">The <code className="text-[11px] font-mono bg-zinc-100 px-1.5 py-0.5 rounded">sub</code> claim is the user ID; <code className="text-[11px] font-mono bg-zinc-100 px-1.5 py-0.5 rounded">tenant_id</code> scopes all subsequent requests to a workspace.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900 mb-3">Errors</h2>
        <div className="space-y-3">
          {ERRORS.map((e) => (
            <div key={e.code} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" strokeWidth={2} />
                <code className="text-[13px] font-mono font-semibold text-zinc-900">{e.code}</code>
              </div>
              <p className="text-[12.5px] text-zinc-600 leading-relaxed mb-2 ml-6"><strong>Cause:</strong> {e.cause}</p>
              <div className="flex items-start gap-2 ml-6">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={2.5} />
                <p className="text-[12.5px] text-zinc-700 leading-relaxed"><strong>Fix:</strong> {e.fix}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}