"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
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
      <MarketingNavbar />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt="Migration Studio"
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain"
                  />
                </div>
                <span className="text-[13px] font-semibold text-slate-900">
                  Migration Studio
                </span>
              </div>
              <p className="text-[12px] text-slate-500 leading-relaxed max-w-[220px]">
                Deterministic, audited data pipelines with canonical ontologies
                and reverse row-level lineage.
              </p>
            </div>

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

          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              © {new Date().getFullYear()} Migration Studio. All rights reserved.
            </span>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                All systems operational
              </span>
              <Link href="/login" className="hover:text-slate-900">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </footer>
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
      <h4 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
        {title}
      </h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[12px] text-slate-600 hover:text-slate-900 transition"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}