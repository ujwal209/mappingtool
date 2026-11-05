"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, LogOut, Menu, X, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const links = [
    { href: "/#features", label: "Features" },
    { href: "/#connectors", label: "Connectors" },
    { href: "/#ontology", label: "Ontology" },
    { href: "/#workflow", label: "Workflow" },
    { href: "/#faq", label: "FAQ" },
  ];

  return (
    <>
      {/* ============================================================
          FLOATING PILL NAVBAR
      ============================================================ */}
      <header className="fixed top-0 inset-x-0 z-50 pointer-events-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5">
          <nav
            className={`pointer-events-auto flex items-center justify-between gap-3 h-14 px-3 sm:px-4 rounded-2xl border transition-all duration-300 ${
              scrolled
                ? "bg-white/85 backdrop-blur-xl border-slate-200/90 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.15)]"
                : "bg-white/60 backdrop-blur-md border-white/50 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]"
            }`}
          >
            {/* Brand — designed wordmark */}
            <Link
              href="/"
              className="flex items-center shrink-0 group"
              aria-label="Migration Studio — home"
            >
              <span className="flex items-baseline gap-[3px]">
                <span className="text-[15px] font-bold tracking-[-0.02em] text-slate-900 leading-none">
                  Migration
                </span>
                <span className="text-[15px] font-semibold tracking-[-0.02em] text-slate-400 leading-none group-hover:text-slate-500 transition-colors">
                  Studio
                </span>
                <span className="inline-block w-1 h-1 rounded-full bg-indigo-500 mb-[1px] ml-[1px]" />
              </span>
            </Link>

            {/* Center links */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-900/[0.04] transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isAuthenticated && user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="hidden md:flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg hover:bg-slate-900/[0.04] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold">
                      {user.full_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="flex flex-col leading-tight max-w-[120px]">
                      <span className="text-[12px] font-medium text-slate-900 truncate">
                        {user.full_name}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">
                        {user.email}
                      </span>
                    </div>
                  </Link>

                  <Link href="/dashboard" className="hidden sm:block">
                    <button className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 transition">
                      Console
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>

                  <button
                    onClick={logout}
                    title="Sign out"
                    className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-900/[0.04] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden sm:flex items-center px-3 h-9 rounded-lg text-[12.5px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-900/[0.04] transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link href="/signup" className="hidden sm:block">
                    <button className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 transition">
                      Get started
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </>
              )}

              {/* Mobile toggle */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-900/[0.04] transition"
                aria-label="Open menu"
              >
                {mobileOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* ============================================================
          MOBILE SHEET
      ============================================================ */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setMobileOpen(false)}
          />

          <div className="absolute top-24 inset-x-4 sm:inset-x-6 max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 fade-in duration-200">
            <div className="p-2">
              <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Navigate
              </p>
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-slate-800 hover:bg-slate-50 transition"
                >
                  {l.label}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                </Link>
              ))}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/60">
              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition"
                  >
                    <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-[12px] font-semibold shrink-0">
                      {user.full_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-slate-900 truncate">
                        {user.full_name}
                      </p>
                      <p className="text-[10.5px] text-slate-500 truncate">
                        {user.email}
                      </p>
                    </div>
                    <LayoutDashboard className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>

                  <button
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <button className="w-full h-10 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition">
                      Sign in
                    </button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <button className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium transition">
                      Get started
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}