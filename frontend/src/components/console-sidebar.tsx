"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  FolderKanban,
  LayoutDashboard,
  Server,
  BookOpen,
  FileCode,
  GitBranch,
  LogOut,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Table2,
  Compass,
  Plus,
  Code2,
  Rocket,
  ListChecks,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function ConsoleSidebar({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navGroups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/projects", label: "Projects", icon: FolderKanban },
      ],
    },
    {
      label: "Connectivity",
      items: [
        { href: "/connectors", label: "Connectors", icon: Server },
      ],
    },
    {
      label: "Modeling",
      items: [
        { href: "/ontology", label: "Ontology Studio", icon: BookOpen },
        { href: "/knowledge-base", label: "Knowledge Base", icon: FileCode },
        { href: "/transformations", label: "Transformations", icon: Code2 },
      ],
    },
    {
      label: "Table Matching",
      items: [
        { href: "/table-matching", label: "Pair Sets", icon: Table2 },
        { href: "/table-matching/discover", label: "Discover Pairs", icon: Compass },
      ],
    },
    {
      label: "Column Mapping",
      items: [
        {
          href: "/pair-mapping",
          label: "All Mappings",
          icon: GitBranch,
        },
        {
          href: "/pair-mapping/new",
          label: "New Column Mapping",
          icon: Plus,
        },
      ],
    },
    {
      label: "Migrations",
      items: [
        {
          href: "/migrations",
          label: "Migration Runs",
          icon: ListChecks,
        },
        {
          href: "/migrations/new",
          label: "Start Migration",
          icon: Rocket,
        },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (pathname === href) return true;

    if (href === "/mapping") return pathname === "/mapping";

    if (href === "/mapping/new")
      return (
        pathname === "/mapping/new" ||
        pathname.startsWith("/mapping/new/")
      );

    if (href === "/table-matching") {
      if (pathname === "/table-matching") return true;
      if (pathname === "/table-matching/discover") return false;
      return pathname.startsWith("/table-matching/");
    }

    if (href === "/table-matching/discover") {
      return (
        pathname === "/table-matching/discover" ||
        pathname.startsWith("/table-matching/discover/")
      );
    }

    if (href === "/pair-mapping") {
      if (pathname === "/pair-mapping") return true;
      if (pathname === "/pair-mapping/new") return false;
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length >= 2 && segments[0] === "pair-mapping") {
        return segments[1] !== "new";
      }
      return false;
    }

    if (href === "/pair-mapping/new") {
      return (
        pathname === "/pair-mapping/new" ||
        pathname.startsWith("/pair-mapping/new/")
      );
    }

    // ── Migrations routing ──────────────────────────────────
    // /migrations          → list page active
    // /migrations/{id}     → list page active (detail is a child of list)
    // /migrations/new      → "Start Migration" active only
    if (href === "/migrations") {
      if (pathname === "/migrations") return true;
      if (pathname === "/migrations/new") return false;
      return pathname.startsWith("/migrations/");
    }

    if (href === "/migrations/new") {
      return (
        pathname === "/migrations/new" ||
        pathname.startsWith("/migrations/new/")
      );
    }

    if (href === "/transformations") {
      if (pathname === "/transformations") return true;
      if (pathname === "/transformations/new") return false;
      return false;
    }

    return pathname.startsWith(href + "/");
  };

  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, setMobileOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const renderSidebarInner = (forceExpanded: boolean) => {
    const collapsed = forceExpanded ? false : isCollapsed;

    return (
      <div className="flex flex-col h-full bg-white text-slate-700 font-sans select-none">
        {/* Header */}
        <div
          className={`h-16 flex items-center shrink-0 transition-all duration-300 ${
            collapsed ? "justify-center px-3" : "justify-between px-4"
          }`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {collapsed ? (
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Migration Studio — dashboard"
            >
              <Image
                src="/logo.png"
                alt="MS"
                width={22}
                height={22}
                className="w-[22px] h-[22px] object-contain"
              />
            </Link>
          ) : (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex flex-col leading-none min-w-0 group"
              >
                <span className="flex items-baseline gap-[3px]">
                  <span className="text-[17px] font-bold tracking-[-0.03em] text-slate-900 group-hover:text-slate-950 transition-colors">
                    Migration
                  </span>
                  <span className="text-[17px] font-light tracking-[-0.02em] text-slate-400">
                    Studio
                  </span>
                  <span className="inline-block w-1 h-1 rounded-full bg-indigo-500 mb-[2px] ml-[1px]" />
                </span>
                <span className="mt-1 text-[9px] font-mono uppercase tracking-[0.22em] text-slate-400">
                  console
                </span>
              </Link>

              {!forceExpanded && (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="hidden lg:flex p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                  title="Collapse sidebar (⌘B)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Expand handle (only when collapsed on desktop) */}
        {collapsed && !forceExpanded && (
          <div className="hidden lg:flex justify-center pb-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Expand sidebar (⌘B)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav
          className={`flex-1 overflow-y-auto sidebar-scrollbar py-2 transition-all duration-300 ${
            collapsed ? "px-2" : "px-3"
          }`}
        >
          <div className={collapsed ? "space-y-3" : "space-y-5"}>
            {navGroups.map((group) => (
              <div key={group.label}>
                {!collapsed ? (
                  <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    {group.label}
                  </p>
                ) : (
                  <div className="w-6 h-px bg-slate-200 mx-auto mb-2" />
                )}

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    if (collapsed) {
                      return (
                        <div
                          key={item.href}
                          className="relative group/collapsed"
                        >
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            aria-label={item.label}
                            className={`flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all ${
                              active
                                ? "bg-slate-900 text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            <Icon className="w-[18px] h-[18px]" />
                          </Link>

                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11.5px] font-medium whitespace-nowrap opacity-0 group-hover/collapsed:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg">
                            {item.label}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 -mr-1" />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                          active
                            ? "bg-slate-900 text-white shadow-sm font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            active
                              ? "text-white"
                              : "text-slate-400 group-hover:text-slate-700"
                          }`}
                        />
                        <span className="truncate text-[13px]">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="ml-auto text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div
          className={`shrink-0 border-t border-slate-100 transition-all duration-300 ${
            collapsed ? "py-3 px-2" : "p-3"
          }`}
          style={{
            paddingBottom: `calc(12px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="relative group/avatar flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-100 transition"
                title={user?.full_name || "Profile"}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-[11px] shrink-0">
                  {user?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
              </Link>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-xl hover:bg-slate-50 transition-colors p-1.5 min-w-0"
                title="View profile"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-[11px] shrink-0">
                  {user?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-slate-900 truncate leading-tight">
                    {user?.full_name || "Account"}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate leading-tight">
                    {user?.email || ""}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-1">
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors touch-manipulation"
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors touch-manipulation"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col h-screen sticky top-0 bg-white border-r border-slate-200 z-30 transition-[width] duration-300 ease-in-out ${
          isCollapsed ? "w-[76px]" : "w-[260px]"
        }`}
      >
        {renderSidebarInner(false)}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${
          mobileOpen ? "" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu backdrop"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`absolute inset-y-0 left-0 w-[85vw] max-w-[300px] bg-white border-r border-slate-200 shadow-2xl flex flex-col transition-transform duration-250 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-3 right-3 z-10 p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors touch-manipulation"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 min-h-0">{renderSidebarInner(true)}</div>
        </div>
      </div>
    </>
  );
}