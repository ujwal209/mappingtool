"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Bell,
  ChevronDown,
  LayoutDashboard,
  Network,
  Cable,
  GitCompare,
  PlayCircle,
  BookOpen,
  LogOut,
  Settings,
  User as UserIcon,
  Menu,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ontology", label: "Ontology", icon: Network },
  { href: "/connectors", label: "Connectors", icon: Cable },
  { href: "/mapping", label: "Mapping", icon: GitCompare },
  { href: "/runs", label: "Runs", icon: PlayCircle },
  { href: "/knowledge-base", label: "Knowledge", icon: BookOpen },
];

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function TopNavbar({
  onOpenSidebar,
}: {
  onOpenSidebar?: () => void;
}) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const handleLogout = () => {
    try {
      logout();
    } catch {}
    window.location.href = "/login";
  };

  // Derive display values from context
  const displayName = user?.full_name || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";
  const displayRole = user?.role || "Analyst";

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-all ${
        scrolled
          ? "bg-white/85 backdrop-blur-xl border-slate-200 shadow-[0_1px_0_0_rgba(15,23,42,0.05)]"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="h-20 px-3 sm:px-4 lg:px-6 flex items-center gap-4">
        {onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
        )}

        {/* Wordmark */}
        <Link
          href="/dashboard"
          className="group shrink-0 flex flex-col leading-none"
        >
          <span className="flex items-baseline gap-2">
            <span className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.045em] text-slate-900">
              Migration
            </span>
            <span className="text-[22px] sm:text-[24px] font-light tracking-[-0.02em] text-slate-400">
              Studio
            </span>
          </span>
          <span className="mt-1.5 text-[9px] font-mono uppercase tracking-[0.24em] text-slate-400">
            console
          </span>
        </Link>

        <div className="hidden md:block w-px h-10 bg-slate-200 mx-1 shrink-0" />

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 min-w-0">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-2 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-colors ${
                  active
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon
                  className="w-3.5 h-3.5"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="truncate">{item.label}</span>
                <span
                  className={`absolute left-3 right-3 bottom-0.5 h-[1.5px] rounded-full bg-slate-900 transition-transform duration-200 ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                  style={{ transformOrigin: "left" }}
                />
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            className="hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors text-[12px]"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-command-palette"));
            }}
            title="Search (Ctrl/Cmd + K)"
          >
            <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden lg:inline-block text-[9px] font-mono px-1.5 py-0 rounded border border-slate-200 bg-slate-50 text-slate-500">
              ⌘K
            </kbd>
          </button>

          <button
            className="relative p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" strokeWidth={1.75} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {/* User area — 3 states */}
          {isLoading ? (
            <div className="flex items-center gap-2 h-9 px-3 rounded-full bg-slate-50">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span className="hidden sm:inline text-[11.5px] text-slate-400">
                Loading…
              </span>
            </div>
          ) : isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 h-9 pl-1 pr-2 rounded-full hover:bg-slate-100 transition-colors"
                title={displayEmail || displayName}
              >
                <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-[10.5px] font-semibold flex items-center justify-center">
                  {initials(displayName)}
                </span>
                <span className="hidden sm:block text-left leading-tight max-w-[110px]">
                  <span className="block text-[12px] font-medium text-slate-900 truncate">
                    {displayName}
                  </span>
                  <span className="block text-[9.5px] text-slate-500 truncate">
                    {displayRole}
                  </span>
                </span>
                <ChevronDown
                  className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.75}
                />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="p-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-full bg-slate-900 text-white text-[11.5px] font-semibold flex items-center justify-center shrink-0">
                          {initials(displayName)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-slate-900 truncate">
                            {displayName}
                          </div>
                          <div className="text-[10.5px] text-slate-500 truncate">
                            {displayEmail || "no email"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-1">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-slate-700 hover:bg-slate-50"
                      >
                        <UserIcon
                          className="w-3.5 h-3.5 text-slate-400"
                          strokeWidth={1.75}
                        />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-slate-700 hover:bg-slate-50"
                      >
                        <Settings
                          className="w-3.5 h-3.5 text-slate-400"
                          strokeWidth={1.75}
                        />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-rose-700 hover:bg-rose-50"
                      >
                        <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="h-9 inline-flex items-center px-4 rounded-full bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}