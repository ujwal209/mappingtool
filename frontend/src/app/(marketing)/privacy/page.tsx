import React from "react";
import { PageHeader } from "../_components/page-header";
import { Prose, H2, H3, P, UL, InlineCode, Callout } from "../_components/prose";

export default function PrivacyPage() {
  const updated = "October 18, 2026";
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <PageHeader
        eyebrow="Legal"
        title="Privacy policy"
        description={`Last updated: ${updated}. This policy describes how Migration Studio collects, uses, and protects your data.`}
      />

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        {/* TOC */}
        <nav className="hidden lg:block sticky top-20 self-start">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-3">
            On this page
          </p>
          <ul className="space-y-1.5 text-[12px]">
            {[
              ["#collect", "Data we collect"],
              ["#use", "How we use data"],
              ["#share", "Sharing"],
              ["#retention", "Retention"],
              ["#rights", "Your rights"],
              ["#contact", "Contact"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="block py-0.5 text-slate-600 hover:text-slate-900 transition"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Prose>
          <section id="collect">
            <H2>1. Data we collect</H2>
            <P>
              Migration Studio stores the configuration and metadata required
              to run your migrations. We do not store customer record payloads
              outside the transient staging area used to execute each run.
            </P>
            <H3>Account data</H3>
            <UL
              items={[
                "Name, email, and organization of users who sign up.",
                "Authentication events (login times, IP addresses) for security monitoring.",
                "Billing details when a paid plan is activated.",
              ]}
            />
            <H3>Migration metadata</H3>
            <UL
              items={[
                "Connector configurations (host, port, database, service account identifiers).",
                "Ontology graphs, mapping versions, and rule packages.",
                "Run manifests, evidence bundles, and lineage traces.",
                <>
                  Credentials are always stored as vault references (e.g.{" "}
                  <InlineCode>vault://fabric/client-secret</InlineCode>), never as
                  raw values.
                </>,
              ]}
            />
          </section>

          <section id="use">
            <H2>2. How we use your data</H2>
            <P>
              We use account data to authenticate you, send transactional
              emails, and provide support. We use migration metadata solely to
              execute the migrations you configure.
            </P>
            <Callout tone="info" title="Zero secret leakage">
              Secret material — passwords, tokens, service principal keys — is
              redacted from every log, telemetry event, and API response. We
              enforce this at the framework level, not as an afterthought.
            </Callout>
          </section>

          <section id="share">
            <H2>3. Sharing</H2>
            <P>
              We do not sell your data. We share it only with subprocessors
              that help us operate the platform, and only to the extent
              required to provide the service.
            </P>
            <UL
              items={[
                "Cloud hosting (compute, storage, managed databases).",
                "Email delivery for transactional notifications.",
                "Payment processing for paid plans.",
              ]}
            />
          </section>

          <section id="retention">
            <H2>4. Retention</H2>
            <P>
              Migration metadata is retained for the life of your account, or
              for a shorter period if you request deletion. Transient staging
              data is purged immediately after run completion, but the
              corresponding evidence bundle (a cryptographic hash) is preserved
              permanently so past runs remain auditable.
            </P>
          </section>

          <section id="rights">
            <H2>5. Your rights</H2>
            <P>
              You can request a copy of your data, ask us to delete it, or
              export a machine-readable archive at any time. Contact us at{" "}
              <a
                href="mailto:privacy@migrationstudio.example"
                className="text-slate-900 underline"
              >
                privacy@migrationstudio.example
              </a>
              .
            </P>
          </section>

          <section id="contact">
            <H2>6. Contact</H2>
            <P>
              Questions about data handling can be directed to{" "}
              <a
                href="mailto:privacy@migrationstudio.example"
                className="text-slate-900 underline"
              >
                privacy@migrationstudio.example
              </a>
              . For security incidents, contact{" "}
              <a
                href="mailto:security@migrationstudio.example"
                className="text-slate-900 underline"
              >
                security@migrationstudio.example
              </a>
              .
            </P>
          </section>
        </Prose>
      </div>
    </div>
  );
}