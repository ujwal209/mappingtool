import React from "react";
import { PageHeader } from "../_components/page-header";
import { Prose, H2, H3, P, UL, Callout } from "../_components/prose";

export default function TermsPage() {
  const updated = "October 18, 2026";
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <PageHeader
        eyebrow="Legal"
        title="Terms of service"
        description={`Last updated: ${updated}. These terms govern your use of Migration Studio.`}
      />

      <div className="mt-12">
        <Prose>
          <section>
            <H2>1. Acceptance</H2>
            <P>
              By creating an account or using Migration Studio, you agree to
              these terms. If you're entering into this agreement on behalf of
              an organization, you represent that you have authority to bind
              that organization.
            </P>
          </section>

          <section>
            <H2>2. Your responsibilities</H2>
            <UL
              items={[
                "You may only run migrations against systems you are authorized to access.",
                "You're responsible for complying with all applicable data protection laws when migrating data.",
                "You must keep credentials and API keys secure.",
                "You must not use the platform to exfiltrate data you don't own.",
              ]}
            />
          </section>

          <section>
            <H2>3. Service availability</H2>
            <P>
              We target 99.9% monthly uptime for the control plane. Enterprise
              customers can negotiate a custom SLA. Planned maintenance is
              announced at least 72 hours in advance.
            </P>
            <Callout tone="warning" title="Migration risk">
              Data migrations are inherently risky. Our platform applies
              pre-flight gates and idempotent writes to reduce the chance of
              corruption, but you remain responsible for backing up any target
              systems before running a production migration.
            </Callout>
          </section>

          <section>
            <H2>4. Billing</H2>
            <P>
              Paid plans are billed in advance on a monthly or yearly basis.
              Fees are non-refundable except where required by law. Downgrades
              take effect at the end of the current billing period.
            </P>
          </section>

          <section>
            <H2>5. Intellectual property</H2>
            <H3>Our IP</H3>
            <P>
              The platform, its source code, and its documentation remain our
              exclusive property. Nothing in these terms grants you rights to
              them beyond the scope of your subscription.
            </P>
            <H3>Your IP</H3>
            <P>
              You retain all rights to the data you migrate, the ontologies you
              design, and the mapping artifacts you create. We claim no
              ownership over any of it.
            </P>
          </section>

          <section>
            <H2>6. Termination</H2>
            <P>
              You may terminate your account at any time from your settings.
              We may suspend accounts that violate these terms or pose a
              security risk. On termination, we retain migration metadata for
              30 days to allow export, then delete it permanently.
            </P>
          </section>

          <section>
            <H2>7. Limitation of liability</H2>
            <P>
              To the maximum extent permitted by law, Migration Studio is not
              liable for indirect, incidental, or consequential damages arising
              from your use of the platform. Our aggregate liability is limited
              to the amount you paid us in the previous 12 months.
            </P>
          </section>

          <section>
            <H2>8. Contact</H2>
            <P>
              Questions about these terms can be directed to{" "}
              <a
                href="mailto:legal@migrationstudio.example"
                className="text-slate-900 underline"
              >
                legal@migrationstudio.example
              </a>
              .
            </P>
          </section>
        </Prose>
      </div>
    </div>
  );
}