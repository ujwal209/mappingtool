"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Building2, Users, Zap } from "lucide-react";
import { PageHeader, SectionLabel } from "../_components/page-header";

const PLANS = [
  {
    id: "starter",
    icon: Zap,
    name: "Starter",
    priceMonthly: 0,
    priceYearly: 0,
    tagline: "For individual engineers exploring the platform.",
    features: [
      "Up to 3 concurrent pipelines",
      "10k rows / run",
      "Full ontology modeling",
      "Immutable mapping versions",
      "Community support",
    ],
    cta: "Start free",
    ctaHref: "/signup",
    highlighted: false,
  },
  {
    id: "team",
    icon: Users,
    name: "Team",
    priceMonthly: 99,
    priceYearly: 990,
    tagline: "For data teams running production migrations.",
    features: [
      "Unlimited concurrent pipelines",
      "10M rows / run",
      "Reverse row-level lineage",
      "Drift gating + policy waivers",
      "Priority email support",
      "SSO via Google / Microsoft",
    ],
    cta: "Start 14-day trial",
    ctaHref: "/signup?plan=team",
    highlighted: true,
  },
  {
    id: "enterprise",
    icon: Building2,
    name: "Enterprise",
    priceMonthly: null,
    priceYearly: null,
    tagline: "For regulated industries with deep audit needs.",
    features: [
      "Everything in Team",
      "Unlimited rows / run",
      "SAML SSO + SCIM provisioning",
      "Audit export to S3 / Azure Blob",
      "Dedicated CSM + quarterly reviews",
      "Custom SLA + on-prem deploys",
    ],
    cta: "Talk to sales",
    ctaHref: "/contact",
    highlighted: false,
  },
];

const FAQ = [
  {
    q: "Can I change plans mid-migration?",
    a: "Yes. Upgrading takes effect immediately, and downgrades take effect at the end of your current billing period. Any in-flight runs complete under the plan they started on.",
  },
  {
    q: "What happens if I exceed my row limit?",
    a: "Runs that would exceed the limit are paused before execution and you're shown an upgrade prompt. No data is written past the limit.",
  },
  {
    q: "Do you offer academic or nonprofit pricing?",
    a: "Yes — contact us and we'll set you up with a 50% discount on Team.",
  },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-16 pb-12 sm:pt-20 sm:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <PageHeader
            align="center"
            eyebrow="Pricing"
            title="Plans that scale with your migration."
            description="Start free. Upgrade when you're ready for production loads and audit-grade lineage. No hidden per-seat fees."
          />

          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span
              className={`text-[12.5px] font-medium ${
                !yearly ? "text-slate-900" : "text-slate-500"
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setYearly((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition ${
                yearly ? "bg-slate-900" : "bg-slate-300"
              }`}
              aria-label="Toggle billing period"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  yearly ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-[12.5px] font-medium ${
                yearly ? "text-slate-900" : "text-slate-500"
              }`}
            >
              Yearly
            </span>
            {yearly && (
              <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                2 months free
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const price = yearly ? plan.priceYearly : plan.priceMonthly;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-6 flex flex-col ${
                    plan.highlighted
                      ? "border-slate-900 shadow-[0_16px_48px_-16px_rgba(15,23,42,0.3)]"
                      : "border-slate-200 hover:border-slate-300 transition"
                  } bg-white`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-2.5 left-6 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-slate-900 px-2 py-0.5 rounded-full">
                      Most popular
                    </span>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-slate-700" strokeWidth={1.75} />
                    </div>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                      {plan.name}
                    </h2>
                  </div>

                  <p className="text-[12.5px] text-slate-600 leading-relaxed mb-5 mt-2 min-h-[36px]">
                    {plan.tagline}
                  </p>

                  <div className="mb-5">
                    {price === null ? (
                      <div className="text-[24px] font-semibold text-slate-900 font-mono">
                        Custom
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[36px] font-semibold text-slate-900 font-mono tracking-tight">
                          ${price}
                        </span>
                        <span className="text-[12px] text-slate-500">
                          / {yearly ? "year" : "month"}
                        </span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12.5px] text-slate-700">
                        <Check
                          className="w-3.5 h-3.5 text-slate-900 shrink-0 mt-0.5"
                          strokeWidth={2.25}
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.ctaHref}
                    className={`inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12.5px] font-medium transition ${
                      plan.highlighted
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-y border-slate-200 bg-slate-50/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionLabel>Compare</SectionLabel>
          <h2 className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 mb-8">
            What's in each plan.
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse bg-white border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 w-1/3">
                    Feature
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">
                    Starter
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-900 bg-slate-100">
                    Team
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Concurrent pipelines", "3", "Unlimited", "Unlimited"],
                  ["Rows per run", "10K", "10M", "Unlimited"],
                  ["Ontology modeling", true, true, true],
                  ["Immutable mapping versions", true, true, true],
                  ["Reverse row-level lineage", false, true, true],
                  ["Drift gating + waivers", false, true, true],
                  ["SAML SSO + SCIM", false, false, true],
                  ["Audit export to S3/Azure", false, false, true],
                  ["Support", "Community", "Priority", "Dedicated CSM"],
                ].map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-100"
                  >
                    <td className="py-2.5 px-4 text-slate-700">{row[0]}</td>
                    {[1, 2, 3].map((c) => (
                      <td
                        key={c}
                        className={`py-2.5 px-4 text-center ${
                          c === 2 ? "bg-slate-50/60" : ""
                        }`}
                      >
                        {typeof row[c] === "boolean" ? (
                          row[c] ? (
                            <Check
                              className="w-4 h-4 text-slate-900 inline"
                              strokeWidth={2.25}
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="text-slate-700 font-mono text-[11.5px]">
                            {row[c]}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionLabel>FAQ</SectionLabel>
        <h2 className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900 mb-6">
          Common pricing questions.
        </h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <div
              key={i}
              className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-slate-300 transition"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
              >
                <span className="text-[13px] font-medium text-slate-900">
                  {f.q}
                </span>
                <span className="text-slate-400 text-lg leading-none">
                  {openFaq === i ? "−" : "+"}
                </span>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-[13px] text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}