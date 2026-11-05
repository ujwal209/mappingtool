import React from "react";
import Link from "next/link";
import { ArrowRight, Heart, Zap, Shield, Users } from "lucide-react";
import { PageHeader, SectionLabel } from "../_components/page-header";

const VALUES = [
  {
    icon: Shield,
    title: "Deterministic by default",
    body: "Every action is reproducible from an immutable manifest. No 'latest' pointers, no surprise drifts.",
  },
  {
    icon: Zap,
    title: "Fast feedback loops",
    body: "Millisecond schema probes, live sample rows, and AI-assisted matches — so you iterate in minutes, not days.",
  },
  {
    icon: Users,
    title: "Humans in the loop",
    body: "AI proposes. A named human approves. Nothing lands in production without a signed decision.",
  },
  {
    icon: Heart,
    title: "Boring on purpose",
    body: "No flashy dashboards, no dark patterns. Just audited migrations that work the same way every time.",
  },
];

const TEAM = [
  { name: "A. Chandra", role: "Founder & Architect", initials: "AC" },
  { name: "J. Park", role: "Head of Engineering", initials: "JP" },
  { name: "M. Okafor", role: "Head of Product", initials: "MO" },
  { name: "S. Rao", role: "Head of Security", initials: "SR" },
];

export default function AboutPage() {
  return (
    <div>
      <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="About"
            title="Built by data engineers, for data engineers."
            description="We spent a decade writing brittle mapping sheets and 3am wake-up scripts. Migration Studio is the platform we always wished existed."
          />
        </div>
      </section>

      {/* Story */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <SectionLabel>The problem</SectionLabel>
            <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-slate-900 leading-snug">
              Enterprise migrations are still spreadsheet projects.
            </h2>
          </div>
          <div className="md:col-span-2 space-y-4 text-[14px] text-slate-700 leading-[1.75]">
            <p>
              In 2024 we led a migration of 240M records from a 15-year-old
              Oracle ERP to Fabric. The mapping file had 900 columns. The
              reconciliation workbook had 11 tabs. Nobody could answer "what
              changed last Tuesday?" without opening the sixth tab.
            </p>
            <p>
              We built Migration Studio because every migration we'd ever run
              needed the same six things: a schema-probe, an ontology, an AI
              mapping, an approval, a manifest, and a lineage trace. Nothing
              off-the-shelf did all six in one place.
            </p>
            <p>
              The platform has been in production at three logistics and
              financial-services companies since 2025. Every migration that
              runs through it is reproducible, auditable, and reversible.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-slate-200 bg-slate-50/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionLabel>Principles</SectionLabel>
          <h2 className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 mb-8">
            What we optimize for.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.title}
                  className="bg-white border border-slate-200 rounded-xl p-5"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-[14px] font-semibold text-slate-900 mb-1">
                    {v.title}
                  </h3>
                  <p className="text-[12.5px] text-slate-600 leading-relaxed">
                    {v.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionLabel>Team</SectionLabel>
        <h2 className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 mb-8">
          The people behind the platform.
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TEAM.map((m) => (
            <div
              key={m.name}
              className="bg-white border border-slate-200 rounded-xl p-5 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 text-white text-[16px] font-semibold flex items-center justify-center mx-auto mb-3">
                {m.initials}
              </div>
              <p className="text-[13px] font-semibold text-slate-900">
                {m.name}
              </p>
              <p className="text-[11.5px] text-slate-500 mt-0.5">{m.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-lg">
            <h2 className="text-[24px] font-semibold tracking-[-0.015em] leading-tight">
              See what deterministic migrations feel like.
            </h2>
            <p className="mt-3 text-[14px] text-slate-400 leading-relaxed">
              Open the console and run an end-to-end pipeline against a live
              schema — no setup, no credentials.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-white text-slate-900 text-[13px] font-medium hover:bg-slate-100 shrink-0"
          >
            Open the console <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}