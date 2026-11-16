"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
        {
          href: "/table-matching/discover",
          label: "Discover Pairs",
          icon: Compass,
        },
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

  const userInitials = (() => {
    const name = (user?.full_name || user?.email || "U").trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  })();

  const renderSidebarInner = (forceExpanded: boolean) => {
    const collapsed = forceExpanded ? false : isCollapsed;

    return (
      <div className="flex h-full flex-col bg-white text-slate-700 font-sans select-none">
        {/* Top Brand Header */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-100 transition-all duration-300 ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {collapsed ? (
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-900 transition hover:border-slate-300 hover:bg-slate-100"
              aria-label="Migration Studio — dashboard"
              title="Migration Studio"
            >
              <span className="text-[12px] font-bold tracking-tighter">
                MS
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-baseline gap-1 py-1 pr-2"
              >
                <span className="text-[16px] font-bold tracking-[-0.04em] text-slate-900 leading-none">
                  Migration
                </span>
                <span className="text-[16px] font-light tracking-[-0.02em] text-slate-400 leading-none">
                  Studio
                </span>
                <span className="mb-[2px] ml-[1px] h-1.5 w-1.5 rounded-full bg-[#432DD7]" />
              </Link>

              {!forceExpanded && (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="hidden lg:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  title="Collapse sidebar (⌘B)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Desktop Expand Trigger when Collapsed */}
        {collapsed && !forceExpanded && (
          <div className="hidden lg:flex justify-center border-b border-slate-100 py-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
              title="Expand sidebar (⌘B)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation Groups */}
        <nav
          className={`flex-1 overflow-y-auto sidebar-scrollbar py-4 transition-all duration-300 ${
            collapsed ? "px-2" : "px-3"
          }`}
        >
          <div className={collapsed ? "space-y-4" : "space-y-5"}>
            {navGroups.map((group) => (
              <div key={group.label}>
                {!collapsed ? (
                  <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {group.label}
                  </p>
                ) : (
                  <div className="mx-auto mb-2.5 h-px w-6 bg-slate-200/80" />
                )}

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    if (collapsed) {
                      return (
                        <div
                          key={item.href}
                          className="group/collapsed relative"
                        >
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            aria-label={item.label}
                            className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                              active
                                ? "bg-slate-100 text-slate-950 ring-1 ring-slate-200/90"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <Icon
                              className={`h-[17px] w-[17px] ${
                                active ? "text-[#432DD7]" : ""
                              }`}
                              strokeWidth={active ? 2.1 : 1.75}
                            />
                          </Link>

                          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/collapsed:opacity-100">
                            {item.label}
                            <div className="absolute right-full top-1/2 -mr-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-slate-900" />
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
                            ? "bg-slate-100/90 text-slate-950 font-semibold"
                            : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-[#432DD7]" />
                        )}
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active
                              ? "text-[#432DD7]"
                              : "text-slate-400 group-hover:text-slate-700"
                          }`}
                          strokeWidth={active ? 2.1 : 1.75}
                        />
                        <span className="break-words text-[13px] leading-snug">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
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

        {/* Account & Session Footer */}
        <div
          className={`shrink-0 border-t border-slate-100 bg-slate-50/40 transition-all duration-300 ${
            collapsed ? "px-2 py-3" : "p-3"
          }`}
          style={{
            paddingBottom: `calc(12px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                title={user?.full_name || "Profile"}
              >
                {userInitials}
              </Link>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-start gap-2.5 rounded-lg border border-transparent p-2 transition-colors hover:border-slate-200/80 hover:bg-white"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-800">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="break-words text-[12.5px] font-semibold leading-tight text-slate-900">
                    {user?.full_name || "Account"}
                  </p>
                  {user?.email && (
                    <p className="break-all text-[11px] leading-tight text-slate-500">
                      {user.email}
                    </p>
                  )}
                </div>
              </Link>

              <div className="grid grid-cols-2 gap-1.5">
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 touch-manipulation"
                >
                  <Settings className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>Settings</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 touch-manipulation"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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
      {/* Desktop Sticky Rail */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col h-screen sticky top-0 bg-white border-r border-slate-200/90 z-30 transition-[width] duration-300 ease-in-out ${
          isCollapsed ? "w-[74px]" : "w-[260px]"
        }`}
      >
        {renderSidebarInner(false)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${
          mobileOpen ? "" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-200 ${
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
            className="absolute top-3.5 right-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 touch-manipulation"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex-1 min-h-0">{renderSidebarInner(true)}</div>
        </div>
      </div>
    </>
  );
}