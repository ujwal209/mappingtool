// frontend/src/components/marketing-navbar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Network,
  Cable,
  GitCompare,
  PlayCircle,
  BookOpen,
  ShieldCheck,
  Lock,
  FileText,
  Layers,
  Activity,
  Server,
  RotateCcw,
  Users,
  Building2,
  LifeBuoy,
  LogOut,
  LayoutDashboard,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface MegaLink {
  href: string;
  label: string;
  description: string;
  icon?: LucideIcon;
}
interface MegaColumn {
  title: string;
  links: MegaLink[];
}
interface MegaFeatured {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}
interface NavItem {
  href: string;
  label: string;
  mega?: {
    columns: MegaColumn[];
    featured?: MegaFeatured;
  };
}

// ─────────────────────────────────────────────────────────────
// Nav tree
// ─────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  {
    href: "/product",
    label: "Product",
    mega: {
      columns: [
        {
          title: "Platform",
          links: [
            { href: "/product", label: "Overview", description: "The full migration lifecycle in one control plane.", icon: Layers },
            { href: "/product/connectors", label: "Connectors", description: "Live probes against 12+ enterprise systems.", icon: Cable },
            { href: "/product/ontology", label: "Ontology", description: "Canonical entities and typed relationships.", icon: Network },
            { href: "/product/mapping", label: "Mapping", description: "AI-assisted source-to-target field alignment.", icon: GitCompare },
            { href: "/product/runs", label: "Runs & Lineage", description: "Reverse row-level lineage for every load.", icon: PlayCircle },
          ],
        },
        {
          title: "Capabilities",
          links: [
            { href: "/product/drift-gating", label: "Drift gating", description: "Blocking schema changes halt before any write.", icon: ShieldCheck },
            { href: "/product/immutable-versions", label: "Immutable versions", description: "SHA-256 hashes freeze every mapping.", icon: Lock },
            { href: "/product/lineage", label: "Reverse lineage", description: "Trace target rows to source records.", icon: FileText },
            { href: "/product/reconciliation", label: "Reconciliation", description: "Row counts, sums, hash totals compared.", icon: RotateCcw },
            { href: "/product/destination-catalogs", label: "Destination catalogs", description: "Mapping contracts live in the target system.", icon: Server },
          ],
        },
      ],
      featured: {
        eyebrow: "New release",
        title: "v1.4.2 — Ontology RAG",
        body: "Ingest rulebooks and compliance specs, then query them semantically during mapping.",
        href: "/changelog",
        cta: "Read the changelog",
      },
    },
  },
  {
    href: "/browse-connectors",
    label: "Browse connectors",
    mega: {
      columns: [
        {
          title: "Lakehouse",
          links: [
            { href: "/browse-connectors/fabric", label: "Microsoft Fabric", description: "OneLake, Delta, DirectLake persistence." },
            { href: "/browse-connectors/databricks", label: "Databricks", description: "Unity Catalog with Delta Live Tables." },
            { href: "/browse-connectors/snowflake", label: "Snowflake", description: "External stages + time-travel audit." },
            { href: "/browse-connectors/bigquery", label: "BigQuery", description: "Streaming inserts and dry-run validation." },
          ],
        },
        {
          title: "Databases",
          links: [
            { href: "/browse-connectors/postgresql", label: "PostgreSQL", description: "Logical replication + JSONB parsing." },
            { href: "/browse-connectors/sqlserver", label: "SQL Server", description: "CDC capture + temporal tables." },
            { href: "/browse-connectors/oracle", label: "Oracle", description: "Parallel extract + PDB isolation." },
            { href: "/browse-connectors/mongodb", label: "MongoDB Atlas", description: "BSON typing + change streams." },
          ],
        },
        {
          title: "SaaS & Storage",
          links: [
            { href: "/browse-connectors/d365", label: "Dynamics 365", description: "Dataverse entity extraction." },
            { href: "/browse-connectors/salesforce", label: "Salesforce", description: "Bulk API 2.0 with delta tokens." },
            { href: "/browse-connectors/s3", label: "Amazon S3", description: "Parquet, Avro, SHA-256 checksums." },
            { href: "/browse-connectors/adls", label: "Azure Data Lake", description: "AAD OAuth + Delta parquet." },
          ],
        },
      ],
    },
  },
  {
    href: "/solutions",
    label: "Solutions",
    mega: {
      columns: [
        {
          title: "By industry",
          links: [
            { href: "/solutions/financial-services", label: "Financial services", description: "Core banking ledger migrations.", icon: Building2 },
            { href: "/solutions/logistics", label: "Logistics", description: "Multi-warehouse inventory replication.", icon: Building2 },
            { href: "/solutions/healthcare", label: "Healthcare", description: "Claims, encounters, HIPAA scoped.", icon: Building2 },
            { href: "/solutions/retail", label: "Retail & commerce", description: "Product catalogs and order history.", icon: Building2 },
          ],
        },
        {
          title: "By use case",
          links: [
            { href: "/solutions/erp-to-cloud", label: "ERP to cloud", description: "Oracle → Fabric, D365 → Databricks." },
            { href: "/solutions/crm-consolidation", label: "CRM consolidation", description: "Multi-CRM merge into canonical model." },
            { href: "/solutions/data-mesh", label: "Data mesh setup", description: "Domain-level ontologies with bindings." },
            { href: "/solutions/compliance-archival", label: "Compliance archival", description: "Audit-grade evidence bundles." },
          ],
        },
      ],
    },
  },
  { href: "/pricing", label: "Pricing" },
  {
    href: "/resources",
    label: "Resources",
    mega: {
      columns: [
        {
          title: "Learn",
          links: [
            { href: "/docs", label: "Documentation", description: "Step-by-step guides for every phase.", icon: BookOpen },
            { href: "/blog", label: "Blog", description: "Engineering deep-dives and playbooks.", icon: FileText },
            { href: "/changelog", label: "Changelog", description: "Every shipped release.", icon: Activity },
            { href: "/resources/faq", label: "FAQ", description: "The most common questions." },
          ],
        },
        {
          title: "Company",
          links: [
            { href: "/about", label: "About us", description: "The team and the mission.", icon: Users },
            { href: "/security", label: "Security", description: "SOC 2, GDPR, and threat model.", icon: ShieldCheck },
            { href: "/contact", label: "Contact", description: "Sales, support, and security.", icon: LifeBuoy },
          ],
        },
      ],
      featured: {
        eyebrow: "Case study",
        title: "How logistics firms run 240M row migrations",
        body: "A live walkthrough of the six-phase pipeline, from schema probe to evidence bundle.",
        href: "/blog/deterministic-pipelines",
        cta: "Read the case study",
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function MarketingNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [openMega, setOpenMega] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const megaCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpenMega(null);
    setMobileOpen(false);
    setAvatarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openMega) return;
    const onDoc = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpenMega(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMega]);

  useEffect(() => {
    if (!avatarOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!avatarRef.current?.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [avatarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMega(null);
        setAvatarOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const handleMegaEnter = (label: string) => {
    if (megaCloseTimer.current) {
      clearTimeout(megaCloseTimer.current);
      megaCloseTimer.current = null;
    }
    setOpenMega(label);
  };

  const scheduleMegaClose = () => {
    if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
    megaCloseTimer.current = setTimeout(() => setOpenMega(null), 120);
  };

  const cancelMegaClose = () => {
    if (megaCloseTimer.current) {
      clearTimeout(megaCloseTimer.current);
      megaCloseTimer.current = null;
    }
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isMegaOpen = (label: string) => openMega === label;

  const handleLogout = () => {
    logout();
    setAvatarOpen(false);
    setMobileOpen(false);
    router.push("/");
  };

  const initials = getInitials(user?.full_name, user?.email);
  const displayName =
    user?.full_name?.trim() || user?.email?.split("@")[0] || "Account";
  const displayEmail = user?.email || "";

  const activeMegaItem = openMega
    ? NAV_ITEMS.find((n) => n && n.label === openMega)
    : undefined;

  return (
    <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
      <div
        className={`max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 transition-all duration-300 ${
          scrolled ? "pt-2" : "pt-4 sm:pt-5"
        }`}
      >
        <header
          ref={headerRef}
          onMouseLeave={scheduleMegaClose}
          className={`pointer-events-auto relative w-full rounded-2xl transition-all duration-300 ${
            scrolled || openMega
              ? "bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-[0_8px_32px_-12px_rgba(49,46,129,0.25)]"
              : "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_4px_24px_-12px_rgba(15,23,42,0.1)]"
          }`}
        >
          <div className="h-14 flex items-center gap-4 px-3 sm:px-5">
            {/* ── Wordmark (text only) ─────────────────────── */}
            <Link
              href="/"
              className="group shrink-0 flex items-baseline gap-1.5 select-none"
              aria-label="Migration Studio home"
            >
              <span className="text-[17px] sm:text-[18px] font-bold tracking-[-0.03em] text-slate-950 transition-colors group-hover:text-indigo-900">
                Migration
              </span>
              <span className="text-[17px] sm:text-[18px] font-light tracking-[-0.02em] text-slate-500 transition-colors group-hover:text-indigo-700">
                Studio
              </span>
              <span className="w-1 h-1 rounded-full bg-gradient-to-br from-indigo-700 to-indigo-500 mb-[2px] ml-[1px]" />
            </Link>

            <div className="hidden lg:block w-px h-6 bg-gradient-to-b from-transparent via-slate-300 to-transparent shrink-0" />

            {/* ── Desktop nav ──────────────────────────────── */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1">
              {NAV_ITEMS.filter(Boolean).map((item) => {
                const active = isActive(item.href) || isMegaOpen(item.label);
                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() =>
                      item.mega && handleMegaEnter(item.label)
                    }
                  >
                    <Link
                      href={item.href}
                      className={`relative px-3 py-2 text-[13px] font-medium flex items-center gap-1 rounded-lg transition-colors ${
                        active
                          ? "text-indigo-900"
                          : "text-slate-600 hover:text-slate-950"
                      }`}
                    >
                      {item.label}
                      {item.mega && (
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            active
                              ? "text-indigo-600 rotate-180"
                              : "text-slate-400"
                          }`}
                          strokeWidth={2}
                        />
                      )}
                      <span
                        className={`absolute left-3 right-3 -bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-indigo-900 via-indigo-700 to-indigo-500 origin-left transition-transform duration-200 ${
                          active ? "scale-x-100" : "scale-x-0"
                        }`}
                        style={{ transformOrigin: "left" }}
                      />
                    </Link>
                  </div>
                );
              })}
            </nav>

            {/* ── Right side ──────────────────────────────── */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
              ) : isAuthenticated && user ? (
                <div className="relative" ref={avatarRef}>
                  <button
                    type="button"
                    onClick={() => setAvatarOpen((v) => !v)}
                    className="group flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-[0_4px_12px_-4px_rgba(49,46,129,0.15)] transition-all"
                    aria-haspopup="menu"
                    aria-expanded={avatarOpen}
                    aria-label="Open account menu"
                  >
                    <span
                      className="w-7 h-7 rounded-full text-white text-[11px] font-semibold flex items-center justify-center select-none"
                      style={{
                        background:
                          "linear-gradient(135deg, #1E1B4B 0%, #4338CA 55%, #4F46E5 100%)",
                      }}
                    >
                      {initials}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 text-slate-500 transition-transform ${
                        avatarOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {avatarOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.3)] overflow-hidden z-50"
                    >
                      <div
                        className="px-4 py-4 text-white relative overflow-hidden"
                        style={{
                          background:
                            "linear-gradient(135deg, #1E1B4B 0%, #312E81 60%, #4338CA 100%)",
                        }}
                      >
                        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
                        <div className="relative flex items-center gap-3">
                          <span className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[13px] font-semibold flex items-center justify-center">
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate">
                              {displayName}
                            </p>
                            {displayEmail && (
                              <p className="text-[11px] text-indigo-200 truncate mt-0.5">
                                {displayEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/dashboard"
                          onClick={() => setAvatarOpen(false)}
                          className="group flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
                          role="menuitem"
                        >
                          <LayoutDashboard className="w-4 h-4 text-slate-500 group-hover:text-indigo-700 transition-colors" />
                          Dashboard
                        </Link>
                        <Link
                          href="/account"
                          onClick={() => setAvatarOpen(false)}
                          className="group flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
                          role="menuitem"
                        >
                          <UserIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-700 transition-colors" />
                          Account settings
                        </Link>
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                          role="menuitem"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden sm:inline-flex items-center h-8 px-3 rounded-lg text-[12.5px] font-medium text-slate-600 hover:text-indigo-900 hover:bg-indigo-50 transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="group relative inline-flex items-center gap-1.5 h-8 pl-3.5 pr-1 rounded-full text-white text-[12.5px] font-medium transition-all hover:shadow-[0_8px_20px_-6px_rgba(49,46,129,0.6)] hover:scale-[1.02] overflow-hidden shadow-[0_4px_12px_-4px_rgba(49,46,129,0.5)]"
                    style={{
                      background:
                        "linear-gradient(135deg, #1E1B4B 0%, #4338CA 55%, #4F46E5 100%)",
                    }}
                  >
                    <span
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background:
                          "linear-gradient(135deg, #312E81 0%, #4F46E5 55%, #6366F1 100%)",
                      }}
                    />
                    <span className="relative z-10">Get started</span>
                    <span className="relative z-10 w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="w-3 h-3" strokeWidth={2.25} />
                    </span>
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="lg:hidden ml-0.5 p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
              >
                {mobileOpen ? (
                  <X className="w-4.5 h-4.5" strokeWidth={1.75} />
                ) : (
                  <Menu className="w-4.5 h-4.5" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          {/* ── Mega menu ───────────────────────────────── */}
          {openMega && activeMegaItem?.mega && (
            <div
              className="hidden lg:block absolute left-0 right-0 top-full mt-2 rounded-2xl border border-slate-200/90 bg-white shadow-[0_30px_60px_-30px_rgba(49,46,129,0.3)] overflow-hidden"
              onMouseEnter={cancelMegaClose}
              onMouseLeave={scheduleMegaClose}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at top right, rgba(67,56,202,0.045), transparent 55%)",
                }}
              />

              <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-9">
                {(() => {
                  const { columns, featured } = activeMegaItem.mega!;
                  return (
                    <div
                      className={`grid gap-10 ${
                        featured ? "grid-cols-4" : "grid-cols-3"
                      }`}
                    >
                      {columns.map((col) => (
                        <div key={col.title}>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-indigo-900 to-indigo-500" />
                            <h4 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-900/80">
                              {col.title}
                            </h4>
                          </div>
                          <ul className="space-y-0.5">
                            {col.links.map((link) => {
                              const Icon = link.icon;
                              return (
                                <li key={link.href + link.label}>
                                  <Link
                                    href={link.href}
                                    className="group flex items-start gap-3 p-2.5 -mx-2.5 rounded-lg hover:bg-indigo-50/60 transition-colors"
                                  >
                                    {Icon && (
                                      <span className="relative shrink-0 w-8 h-8 rounded-md flex items-center justify-center mt-0.5 border border-slate-200 bg-slate-50 overflow-hidden transition-colors group-hover:border-transparent">
                                        <span
                                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                          style={{
                                            background:
                                              "linear-gradient(135deg, #1E1B4B 0%, #4338CA 55%, #4F46E5 100%)",
                                          }}
                                        />
                                        <Icon
                                          className="relative w-3.5 h-3.5 text-slate-700 group-hover:text-white transition-colors"
                                          strokeWidth={1.75}
                                        />
                                      </span>
                                    )}
                                    <span className="min-w-0">
                                      <span className="block text-[13px] font-semibold text-slate-900 leading-snug group-hover:text-indigo-900 transition-colors">
                                        {link.label}
                                      </span>
                                      <span className="block text-[11.5px] text-slate-500 leading-relaxed mt-0.5">
                                        {link.description}
                                      </span>
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}

                      {featured && (
                        <div className="col-span-1">
                          <div className="relative h-full rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-900 via-indigo-700 to-indigo-500">
                            <Link
                              href={featured.href}
                              className="group relative block h-full rounded-2xl bg-white p-5 hover:shadow-[0_12px_32px_-12px_rgba(49,46,129,0.3)] transition-shadow overflow-hidden"
                            >
                              <div
                                className="absolute top-0 right-0 w-32 h-32 opacity-70 pointer-events-none"
                                style={{
                                  background:
                                    "radial-gradient(circle at top right, rgba(67,56,202,0.1), transparent 60%)",
                                }}
                              />
                              <div className="relative flex items-center gap-1.5 mb-2.5">
                                <span
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-md text-white"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, #1E1B4B 0%, #4338CA 55%, #4F46E5 100%)",
                                  }}
                                >
                                  <Sparkles className="w-3 h-3" strokeWidth={2} />
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
                                  {featured.eyebrow}
                                </span>
                              </div>
                              <h5 className="relative text-[14px] font-semibold text-slate-950 leading-snug mb-2">
                                {featured.title}
                              </h5>
                              <p className="relative text-[12px] text-slate-600 leading-relaxed mb-4">
                                {featured.body}
                              </p>
                              <span className="relative inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-800 group-hover:gap-2 transition-all">
                                {featured.cta}
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── Mobile drawer ──────────────────────────── */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-slate-200 bg-white rounded-b-2xl max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

              <nav className="px-4 py-3 space-y-1">
                {isAuthenticated && user && (
                  <div
                    className="relative flex items-center gap-3 px-3 py-3 mb-3 rounded-xl overflow-hidden text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, #1E1B4B 0%, #312E81 55%, #4338CA 100%)",
                    }}
                  >
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
                    <span className="relative w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[12px] font-semibold flex items-center justify-center">
                      {initials}
                    </span>
                    <div className="relative min-w-0">
                      <p className="text-[13px] font-semibold truncate">
                        {displayName}
                      </p>
                      {displayEmail && (
                        <p className="text-[11px] text-indigo-200 truncate mt-0.5">
                          {displayEmail}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {NAV_ITEMS.filter(Boolean).map((item) => (
                  <div key={item.label}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-indigo-50 text-indigo-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                      {isActive(item.href) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      )}
                    </Link>
                    {item.mega && (
                      <div className="ml-3 mt-1 mb-2 pl-3 border-l border-slate-200 space-y-1">
                        {item.mega.columns.flatMap((c) =>
                          c.links.slice(0, 4).map((link) => (
                            <Link
                              key={link.href + link.label}
                              href={link.href}
                              onClick={() => setMobileOpen(false)}
                              className="block px-2.5 py-1.5 rounded text-[12.5px] text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-900 transition-colors"
                            >
                              {link.label}
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-3 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                  {isAuthenticated ? (
                    <>
                      <Link
                        href="/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="text-center px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-200 transition-colors"
                      >
                        Dashboard
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-white text-[13px] font-medium transition-all hover:shadow-[0_8px_20px_-6px_rgba(49,46,129,0.6)]"
                        style={{
                          background:
                            "linear-gradient(135deg, #1E1B4B 0%, #4338CA 55%, #4F46E5 100%)",
                        }}
                      >
                        Sign out <LogOut className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                        className="text-center px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-200 transition-colors"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/signup"
                        onClick={() => setMobileOpen(false)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-white text-[13px] font-medium transition-all hover:shadow-[0_8px_20px_-6px_rgba(49,46,129,0.6)]"
                        style={{
                          background:
                            "linear-gradient(135deg, #1E1B4B 0%, #4338CA 55%, #4F46E5 100%)",
                        }}
                      >
                        Get started <ArrowRight className="w-4 h-4" />
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </div>
          )}
        </header>
      </div>
    </div>
  );
}