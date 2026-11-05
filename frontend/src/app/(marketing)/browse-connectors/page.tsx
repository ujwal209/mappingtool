import Link from "next/link";
import { ArrowRight, Database, Cloud, Boxes, ChevronRight } from "lucide-react";

const GROUPS = [
  { title: "Lakehouse", icon: Cloud, items: [
    { href: "/browse-connectors/fabric", name: "Microsoft Fabric", desc: "OneLake, Delta, DirectLake persistence." },
    { href: "/browse-connectors/databricks", name: "Databricks", desc: "Unity Catalog with Delta Live Tables." },
    { href: "/browse-connectors/snowflake", name: "Snowflake", desc: "External stages + time-travel audit." },
    { href: "/browse-connectors/bigquery", name: "BigQuery", desc: "Streaming inserts and dry-run validation." },
  ]},
  { title: "Databases", icon: Database, items: [
    { href: "/browse-connectors/postgresql", name: "PostgreSQL", desc: "Logical replication + JSONB parsing." },
    { href: "/browse-connectors/sqlserver", name: "SQL Server", desc: "CDC capture + temporal tables." },
    { href: "/browse-connectors/oracle", name: "Oracle", desc: "Parallel extract + PDB isolation." },
    { href: "/browse-connectors/mongodb", name: "MongoDB Atlas", desc: "BSON typing + change streams." },
  ]},
  { title: "SaaS & Storage", icon: Boxes, items: [
    { href: "/browse-connectors/d365", name: "Dynamics 365", desc: "Dataverse entity extraction." },
    { href: "/browse-connectors/salesforce", name: "Salesforce", desc: "Bulk API 2.0 with delta tokens." },
    { href: "/browse-connectors/s3", name: "Amazon S3", desc: "Parquet, Avro, SHA-256 checksums." },
    { href: "/browse-connectors/adls", name: "Azure Data Lake", desc: "AAD OAuth + Delta parquet." },
  ]},
];

export default function BrowseConnectorsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased">
      <section className="border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-20">
          <nav className="flex items-center gap-2 text-[12px] text-zinc-500 mb-8 flex-wrap">
            <Link href="/" className="hover:text-zinc-900 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="text-zinc-900 font-medium">Browse connectors</span>
          </nav>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500 mb-3">Connectors</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em] text-zinc-900 leading-[1.05] max-w-3xl break-words">
            12+ enterprise systems, one deterministic probe.
          </h1>
          <p className="mt-5 text-[15.5px] sm:text-base text-zinc-600 leading-relaxed max-w-2xl break-words">
            Every connector introspects the real source — types, constraints, and nullability included — so your mappings are built on facts, not assumptions.
          </p>
        </div>
      </section>
      {GROUPS.map((group) => (
        <section key={group.title} className="border-b border-zinc-200">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-14">
            <div className="flex items-center gap-2.5 mb-8">
              <group.icon className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={2} />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{group.title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {group.items.map((c) => (
                <Link key={c.href} href={c.href} className="group rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.15)] min-w-0">
                  <h3 className="text-[14px] font-semibold text-zinc-900 mb-1.5 break-words">{c.name}</h3>
                  <p className="text-[12.5px] text-zinc-600 leading-relaxed break-words">{c.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium text-zinc-900 group-hover:gap-2 transition-all">
                    View connector <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 sm:p-10 lg:p-12 min-w-0">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-zinc-900 leading-tight break-words">Don't see your system?</h2>
            <p className="mt-3 text-[13.5px] text-zinc-600 leading-relaxed max-w-2xl break-words">
              We add connectors weekly. Tell us what you run and we'll prioritize it.
            </p>
            <div className="mt-6">
              <Link href="/contact" className="group inline-flex items-center justify-center gap-2 h-10 pl-5 pr-1.5 rounded-full bg-zinc-900 text-white text-[13px] font-medium hover:bg-zinc-800 transition-colors">
                Request a connector
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
