"use client";

import React, { useState } from "react";
import {
  Mail,
  MessageSquare,
  Building2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { PageHeader, SectionLabel } from "../_components/page-header";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    topic: "sales",
    message: "",
  });

  const setField = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div>
      <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Contact"
            title="Talk to us."
            description="Whether you're planning a migration, evaluating the platform, or already running it — we answer within one business day."
          />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-[18px] font-semibold text-slate-900">
                  Message received.
                </h2>
                <p className="mt-2 text-[13.5px] text-slate-600 max-w-md mx-auto">
                  We'll get back to you at{" "}
                  <span className="font-mono text-slate-900">
                    {form.email || "your email"}
                  </span>{" "}
                  within one business day.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      Work email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      Company
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => setField("company", e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                      Topic
                    </label>
                    <select
                      value={form.topic}
                      onChange={(e) => setField("topic", e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    >
                      <option value="sales">Sales / pricing</option>
                      <option value="support">Technical support</option>
                      <option value="partnership">Partnership</option>
                      <option value="security">Security review</option>
                      <option value="other">Something else</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1.5">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={form.message}
                    onChange={(e) => setField("message", e.target.value)}
                    placeholder="Tell us about your migration challenge…"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <p className="text-[10.5px] text-slate-500">
                    We never share your email. Read our{" "}
                    <a href="/privacy" className="text-slate-900 underline">
                      privacy policy
                    </a>
                    .
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-medium hover:bg-slate-800"
                  >
                    Send message <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            <ContactCard
              icon={Mail}
              title="Email us"
              body="hello@migrationstudio.example"
              href="mailto:hello@migrationstudio.example"
            />
            <ContactCard
              icon={MessageSquare}
              title="Book a call"
              body="30 min with a solutions engineer"
              href="/contact?type=call"
            />
            <ContactCard
              icon={Building2}
              title="Enterprise sales"
              body="sales@migrationstudio.example"
              href="mailto:sales@migrationstudio.example"
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <SectionLabel>Response time</SectionLabel>
              <p className="text-[12.5px] text-slate-700 leading-relaxed">
                Business hours support responds within <strong>4 hours</strong>.
                After-hours escalations for Enterprise customers respond within{" "}
                <strong>1 hour</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContactCard({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-slate-700" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-slate-900">{title}</div>
          <div className="text-[12px] text-slate-600 mt-0.5 break-all">
            {body}
          </div>
        </div>
      </div>
    </a>
  );
}