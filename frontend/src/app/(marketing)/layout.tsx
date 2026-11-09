// frontend/src/app/(marketing)/layout.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarketingNavbar } from "@/components/marketing-navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDocs = pathname?.startsWith("/docs");

  // Docs pages render their own sidebar layout — no marketing chrome.
  if (isDocs) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Floating navbar sits over the top — give the content room */}
      <MarketingNavbar />
      <main className="flex-1 pt-20 sm:pt-24">{children}</main>

      {/* ── Rounded footer card ──────────────────────────────── */}
      <div className="px-3 sm:px-5 lg:px-8 pb-4 sm:pb-6 pt-10">
        <footer className="relative mx-auto max-w-7xl rounded-3xl overflow-hidden border border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-white shadow-[0_20px_60px_-30px_rgba(49,46,129,0.25)]">
          {/* Indigo aurora wash */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -top-32 left-1/4 w-[600px] h-[400px] rounded-full blur-3xl opacity-70"
              style={{
                background:
                  "radial-gradient(circle, rgba(67,56,202,0.08), transparent 60%)",
              }}
            />
            <div
              className="absolute -bottom-24 right-1/4 w-[500px] h-[350px] rounded-full blur-3xl opacity-60"
              style={{
                background:
                  "radial-gradient(circle, rgba(30,27,75,0.06), transparent 60%)",
              }}
            />
            {/* Hairlines */}
            <div className="absolute inset-y-0 left-1/4 w-px bg-slate-100/60" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-100/60" />
            <div className="absolute inset-y-0 left-3/4 w-px bg-slate-100/60" />
          </div>

          {/* ── Massive wordmark ────────────────────────────── */}
          <div className="relative border-b border-slate-200/70 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 pt-10 sm:pt-14 pb-6">
              <Link
                href="/"
                className="group block select-none"
                aria-label="Migration Studio home"
              >
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-[0.86]">
                  <span className="text-[56px] sm:text-[92px] md:text-[120px] lg:text-[156px] xl:text-[180px] font-bold tracking-[-0.055em] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 bg-clip-text text-transparent transition-opacity group-hover:opacity-90">
                    Migration
                  </span>
                  <span className="text-[56px] sm:text-[92px] md:text-[120px] lg:text-[156px] xl:text-[180px] font-light tracking-[-0.045em] bg-gradient-to-br from-indigo-700 via-indigo-500 to-indigo-300 bg-clip-text text-transparent transition-opacity group-hover:opacity-90">
                    Studio
                  </span>
                  <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-indigo-700 to-indigo-500 mb-[6px] self-end" />
                </span>
              </Link>

              <p className="mt-4 max-w-xl text-[13px] sm:text-[14px] text-slate-500 leading-relaxed">
                Deterministic, audited data pipelines with canonical ontologies
                and reverse row-level lineage — from source schema to signed
                evidence bundle.
              </p>
            </div>
          </div>

          {/* ── Link grid ───────────────────────────────────── */}
          <div className="relative">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
                <FooterCol
                  title="Product"
                  links={[
                    { href: "/#features", label: "Features" },
                    { href: "/#connectors", label: "Connectors" },
                    { href: "/#ontology", label: "Ontology" },
                    { href: "/#workflow", label: "Workflow" },
                    { href: "/pricing", label: "Pricing" },
                  ]}
                />
                <FooterCol
                  title="Resources"
                  links={[
                    { href: "/docs", label: "Documentation" },
                    { href: "/blog", label: "Blog" },
                    { href: "/changelog", label: "Changelog" },
                    { href: "/#faq", label: "FAQ" },
                  ]}
                />
                <FooterCol
                  title="Company"
                  links={[
                    { href: "/about", label: "About" },
                    { href: "/contact", label: "Contact" },
                    { href: "/security", label: "Security" },
                  ]}
                />
                <FooterCol
                  title="Legal"
                  links={[
                    { href: "/privacy", label: "Privacy" },
                    { href: "/terms", label: "Terms" },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ── Legal bar ───────────────────────────────────── */}
          <div className="relative border-t border-slate-200/70 bg-white/60 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                © {new Date().getFullYear()} Migration Studio. All rights
                reserved.
              </span>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <Link
                  href="/login"
                  className="hover:text-indigo-900 transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-4">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group inline-flex items-center gap-1 text-[12.5px] text-slate-600 hover:text-indigo-900 transition-colors"
            >
              <span className="relative">
                {l.label}
                <span className="absolute left-0 right-0 -bottom-0.5 h-px bg-gradient-to-r from-indigo-900 to-indigo-500 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-200" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}