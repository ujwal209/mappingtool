import React from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { PageHeader, SectionLabel } from "../_components/page-header";

const POSTS = [
  {
    slug: "/blog/immutable-mappings",
    title: "Why immutable mapping versions beat 'edit and re-run'",
    excerpt:
      "A migration run pinned to a hash is reproducible six months later. A migration run that points at 'latest' is a compliance incident waiting to happen.",
    date: "Sep 22, 2026",
    readTime: "6 min read",
    category: "Engineering",
    featured: true,
  },
  {
    slug: "/blog/drift-gating",
    title: "Catching schema drift before it corrupts your target",
    excerpt:
      "Blocking drift gating compares live schemas to a baseline snapshot. Here's how we distinguish blocking vs. non-blocking changes.",
    date: "Sep 10, 2026",
    readTime: "4 min read",
    category: "Engineering",
  },
  {
    slug: "/blog/row-level-lineage",
    title: "Reverse row-level lineage: from target row to source record",
    excerpt:
      "For any target record, walk backwards to the source row, the mapping version, the rule package, and the exact transforms applied.",
    date: "Aug 28, 2026",
    readTime: "5 min read",
    category: "Product",
  },
  {
    slug: "/blog/deterministic-pipelines",
    title: "Deterministic pipelines: the case for pre-flight gates",
    excerpt:
      "How pre-flight gates turn a batch migration into a reproducible audit artifact — and why 90% of data corruption stories start with a skipped gate.",
    date: "Aug 15, 2026",
    readTime: "7 min read",
    category: "Engineering",
  },
  {
    slug: "/blog/ontology-vs-schema",
    title: "Ontology vs. schema: what's the difference, and why it matters",
    excerpt:
      "A schema is a physical contract. An ontology is a semantic one. Migrations that confuse them end up rewriting the same logic three times.",
    date: "Aug 02, 2026",
    readTime: "6 min read",
    category: "Design",
  },
  {
    slug: "/blog/canonical-concepts",
    title: "Canonical concepts: keeping semantics out of the pipes",
    excerpt:
      "The concept 'Customer Email' should outlive any column named `email_addr`. Here's how we bind physical columns to semantic concepts with confidence scores.",
    date: "Jul 19, 2026",
    readTime: "5 min read",
    category: "Design",
  },
];

export default function BlogPage() {
  const featured = POSTS.find((p) => p.featured);
  const rest = POSTS.filter((p) => !p.featured);

  return (
    <div>
      <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow="Blog"
            title="Notes on deterministic data."
            description="Engineering deep-dives, migration playbooks, and product releases — from the team building Migration Studio."
          />
        </div>
      </section>

      {/* Featured post */}
      {featured && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <SectionLabel>Featured</SectionLabel>
          <Link
            href={featured.slug}
            className="block group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-[0_16px_48px_-16px_rgba(15,23,42,0.15)] transition-all"
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="aspect-[16/9] md:aspect-auto md:h-full bg-gradient-to-br from-slate-100 via-slate-50 to-white border-b md:border-b-0 md:border-r border-slate-200 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-3">
                    <span className="text-white text-[20px] font-bold font-mono">
                      #
                    </span>
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    SHA-256 · immutable
                  </p>
                </div>
              </div>
              <div className="p-6 sm:p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {featured.category}
                  </span>
                  <span className="text-[11px] text-slate-400">·</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {featured.date}
                  </span>
                  <span className="text-[11px] text-slate-400">·</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {featured.readTime}
                  </span>
                </div>
                <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.015em] leading-[1.2] text-slate-900 group-hover:text-slate-950">
                  {featured.title}
                </h2>
                <p className="mt-3 text-[13.5px] text-slate-600 leading-relaxed">
                  {featured.excerpt}
                </p>
                <div className="mt-5 inline-flex items-center gap-1 text-[12.5px] font-medium text-slate-900 group-hover:gap-2 transition-all">
                  Read post <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Grid of posts */}
      <section className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <SectionLabel>All posts</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={post.slug}
                className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1)] transition-all flex flex-col"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {post.category}
                  </span>
                </div>
                <h3 className="text-[14px] font-semibold text-slate-900 leading-snug mb-2 group-hover:text-slate-950">
                  {post.title}
                </h3>
                <p className="text-[12.5px] text-slate-600 leading-relaxed line-clamp-3 mb-4">
                  {post.excerpt}
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="border-t border-slate-200 bg-slate-50/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-[24px] font-semibold tracking-[-0.015em] text-slate-900">
            Get new posts by email.
          </h2>
          <p className="mt-3 text-[14px] text-slate-600">
            One email per month. Engineering deep-dives, no marketing fluff.
          </p>
          <form className="mt-6 flex flex-col sm:flex-row items-stretch gap-2 max-w-md mx-auto">
            <input
              type="email"
              placeholder="you@company.com"
              className="flex-1 px-3 py-2 text-[13px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
            />
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-[12.5px] font-medium hover:bg-slate-800"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}