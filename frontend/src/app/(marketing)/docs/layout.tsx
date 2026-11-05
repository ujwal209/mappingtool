"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import {
  ChevronRight,
  Menu,
  X,
  Search,
  ArrowLeft,
  Rocket,
  Cable,
  GitCompare,
  Network,
  PlayCircle,
  Code2,
  ShieldCheck,
  Layers,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
}

interface NavSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
}

const SECTIONS: NavSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    icon: Rocket,
    defaultOpen: true,
    items: [
      { title: "Installation", href: "/docs/getting-started/installation" },
      { title: "First migration", href: "/docs/getting-started/first-migration" },
      { title: "Core concepts", href: "/docs/getting-started/concepts" },
    ],
  },
  {
    id: "connectors",
    title: "Connectors",
    icon: Cable,
    defaultOpen: true,
    items: [
      { title: "Overview", href: "/docs/connectors" },
      { title: "Azure Data Lake", href: "/docs/connectors/adls" },
      { title: "Amazon S3", href: "/docs/connectors/s3" },
      { title: "Snowflake", href: "/docs/connectors/snowflake" },
      { title: "BigQuery", href: "/docs/connectors/bigquery" },
      { title: "Databricks", href: "/docs/connectors/databricks" },
      { title: "Microsoft Fabric", href: "/docs/connectors/fabric" },
      { title: "PostgreSQL", href: "/docs/connectors/postgresql" },
      { title: "SQL Server", href: "/docs/connectors/sqlserver" },
      { title: "Oracle", href: "/docs/connectors/oracle" },
      { title: "MongoDB Atlas", href: "/docs/connectors/mongodb" },
      { title: "Dynamics 365", href: "/docs/connectors/d365" },
      { title: "Salesforce", href: "/docs/connectors/salesforce" },
    ],
  },
  {
    id: "mapping",
    title: "Mapping",
    icon: GitCompare,
    items: [
      { title: "Overview", href: "/docs/mapping" },
      { title: "Quickstart", href: "/docs/mapping/quickstart" },
      { title: "Auto-suggest", href: "/docs/mapping/auto-suggest" },
      { title: "Approval", href: "/docs/mapping/approval" },
      { title: "Transforms", href: "/docs/mapping/transforms" },
      { title: "Versioning", href: "/docs/mapping/versioning" },
    ],
  },
  {
    id: "ontology",
    title: "Ontology",
    icon: Network,
    items: [
      { title: "Overview", href: "/docs/ontology" },
      { title: "Getting started", href: "/docs/ontology/getting-started" },
      { title: "Entities", href: "/docs/ontology/entities" },
      { title: "Relationships", href: "/docs/ontology/relationships" },
      { title: "Versioning", href: "/docs/ontology/versioning" },
      { title: "Graph view", href: "/docs/ontology/graph" },
    ],
  },
  {
    id: "runs",
    title: "Runs & Lineage",
    icon: PlayCircle,
    items: [
      { title: "Overview", href: "/docs/runs" },
      { title: "Execution", href: "/docs/runs/execution" },
      { title: "Lineage", href: "/docs/runs/lineage" },
      { title: "Evidence", href: "/docs/runs/evidence" },
      { title: "Reconciliation", href: "/docs/runs/reconciliation" },
      { title: "Scheduling", href: "/docs/runs/scheduling" },
    ],
  },
  {
    id: "api",
    title: "API Reference",
    icon: Code2,
    items: [
      { title: "Overview", href: "/docs/api" },
      { title: "Authentication", href: "/docs/api/auth" },
      { title: "Connectors", href: "/docs/api/connectors" },
      { title: "Mappings", href: "/docs/api/mappings" },
      { title: "Runs", href: "/docs/api/runs" },
      { title: "Lineage", href: "/docs/api/lineage" },
      { title: "Webhooks", href: "/docs/api/webhooks" },
      { title: "Errors", href: "/docs/api/errors" },
      { title: "SDKs", href: "/docs/api/sdks" },
    ],
  },
  {
    id: "security",
    title: "Security",
    icon: ShieldCheck,
    items: [
      { title: "Authentication", href: "/docs/security/auth" },
      { title: "Private endpoints", href: "/docs/security/private-endpoints" },
      { title: "Audit logs", href: "/docs/security/audit" },
      { title: "Encryption", href: "/docs/security/encryption" },
    ],
  },
  {
    id: "platform",
    title: "Platform",
    icon: Layers,
    items: [
      { title: "Architecture", href: "/docs/platform/architecture" },
      { title: "Limits", href: "/docs/platform/limits" },
      { title: "Changelog", href: "/docs/platform/changelog" },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, s.defaultOpen ?? false])),
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const activeSection = SECTIONS.find((s) =>
      s.items.some(
        (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
      ),
    );
    if (activeSection) {
      setOpenSections((prev) => ({ ...prev, [activeSection.id]: true }));
    }
  }, [pathname]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS;
    const q = search.toLowerCase();
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.href.toLowerCase().includes(q),
      ),
    })).filter((s) => s.items.length > 0);
  }, [search]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const SidebarBody = (
    <>
      <div className="px-5 pt-5 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" strokeWidth={2} />
          Back to home
        </Link>
      </div>

      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" strokeWidth={2} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search docs…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 bg-white text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 transition"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {filteredSections.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-zinc-500">
            No results for &ldquo;{search}&rdquo;
          </p>
        ) : (
          filteredSections.map((section) => {
            const open = openSections[section.id] ?? false;
            const Icon = section.icon;
            const hasActive = section.items.some((i) => isActive(i.href));

            return (
              <div key={section.id} className="mb-1">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                    hasActive
                      ? "text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-100/60"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      hasActive ? "text-zinc-900" : "text-zinc-500"
                    }`}
                    strokeWidth={2}
                  />
                  <span className="flex-1 text-left">{section.title}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      open ? "rotate-90" : ""
                    }`}
                    strokeWidth={2}
                  />
                </button>

                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <ul className="pt-0.5 pb-1 ml-2 pl-3 border-l border-zinc-200 space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={`block px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ${
                                active
                                  ? "bg-zinc-900 text-white font-medium"
                                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/60"
                              }`}
                            >
                              {item.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-zinc-600 hover:bg-zinc-100"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <Link href="/docs" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-zinc-700" strokeWidth={2} />
            <span className="text-[14px] font-semibold">Documentation</span>
          </Link>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-10">
          {/* Sidebar — desktop */}
          <aside className="hidden lg:flex flex-col w-[260px] shrink-0 sticky top-0 h-screen border-r border-zinc-100">
            {SidebarBody}
          </aside>

          {/* Mobile drawer */}
          {mobileOpen && (
            <>
              <div
                className="lg:hidden fixed inset-0 z-40 bg-black/40"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="lg:hidden fixed left-0 top-0 z-50 w-[300px] max-w-[85vw] h-screen bg-white border-r border-zinc-200 flex flex-col">
                <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-200">
                  <span className="text-[13px] font-semibold">Documentation</span>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="p-2 -mr-2 rounded-lg text-zinc-600 hover:bg-zinc-100"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" strokeWidth={1.75} />
                  </button>
                </div>
                {SidebarBody}
              </aside>
            </>
          )}

          {/* Content */}
          <main className="flex-1 min-w-0 py-10 lg:py-12">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}