import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader, SectionLabel } from "../_components/page-header";

const RELEASES = [
  {
    version: "1.4.2",
    date: "October 18, 2026",
    tag: "current",
    changes: [
      "Reverse row-level lineage is now queryable directly from the destination system.",
      "The REST API connector can now hit any public endpoint and infer schema automatically.",
      "Warehouse demo bootstrap seeds an entire 11-table dataset for immediate exploration.",
    ],
  },
  {
    version: "1.4.0",
    date: "September 28, 2026",
    changes: [
      "Drift gating distinguishes blocking vs. non-blocking schema changes with policy waiver support.",
      "Ontology RAG: ingest rulebooks, glossaries, and compliance specs — query them semantically.",
      "Connector telemetry dashboard shows per-system latency and success rates.",
    ],
  },
  {
    version: "1.3.0",
    date: "August 14, 2026",
    changes: [
      "Immutable mapping versions freeze a SHA-256 content hash on approval.",
      "Rule packages compile mappings into a deterministic execution plan.",
      "Checkpointed pause/resume lets long runs survive worker restarts.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div>
      <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Changelog"
            title="What's new."
            description="Every shipping release, in reverse chronological order. No marketing fluff — just what changed."
          />
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

          <div className="space-y-10">
            {RELEASES.map((release) => (
              <div key={release.version} className="relative pl-12">
                {/* Dot */}
                <div
                  className={`absolute left-2 top-1.5 w-4 h-4 rounded-full border-2 ${
                    release.tag === "current"
                      ? "bg-slate-900 border-slate-900"
                      : "bg-white border-slate-300"
                  }`}
                />

                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="font-mono text-[13px] font-semibold text-slate-900">
                    v{release.version}
                  </span>
                  {release.tag === "current" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-600 px-2 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                  <span className="text-[11.5px] text-slate-500">
                    {release.date}
                  </span>
                </div>

                <ul className="space-y-2">
                  {release.changes.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[13.5px] text-slate-700 leading-relaxed"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
          <p className="text-[13px] text-slate-500">
            Looking for the full API diff? Open the console.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-medium hover:bg-slate-800"
          >
            Open console <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}