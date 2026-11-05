"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ConsoleSidebar } from "@/components/console-sidebar";
import { ConsoleTopbar } from "@/components/console-topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close drawer on route change (redundant with sidebar's own
  // effect but keeps this component self-sufficient).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isFullBleed =
    (pathname.startsWith("/ontology") && pathname !== "/ontology/new") ||
    pathname.startsWith("/editor") ||
    pathname.startsWith("/knowledge-base/query");

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full overflow-hidden bg-slate-50">
      {/* Mobile-only top bar with hamburger */}
      <ConsoleTopbar onOpenSidebar={() => setMobileOpen(true)} />

      {/* Sidebar: desktop renders as persistent aside, mobile as drawer */}
      <ConsoleSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <main
          className={`flex-1 ${
            isFullBleed ? "overflow-hidden" : "overflow-y-auto"
          } bg-slate-50`}
        >
          {isFullBleed ? (
            children
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}