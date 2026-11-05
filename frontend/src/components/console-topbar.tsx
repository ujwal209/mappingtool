"use client";

import React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Mobile-only top bar with hamburger + wordmark + avatar.
 * Hidden on lg+ where the persistent sidebar takes over.
 */
export function ConsoleTopbar({
  onOpenSidebar,
}: {
  onOpenSidebar: () => void;
}) {
  const { user } = useAuth();

  const initial = (user?.full_name || user?.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header
      className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="h-14 px-3 flex items-center justify-between gap-3">
        {/* Left: hamburger + wordmark */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open navigation menu"
            className="p-2 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
          </button>

          <Link
            href="/dashboard"
            className="flex flex-col leading-none min-w-0"
            aria-label="Migration Studio — dashboard"
          >
            <span className="flex items-baseline gap-[2px]">
              <span className="text-[14px] font-bold tracking-[-0.03em] text-slate-900">
                Migration
              </span>
              <span className="text-[14px] font-light tracking-[-0.02em] text-slate-400">
                Studio
              </span>
              <span className="inline-block w-1 h-1 rounded-full bg-indigo-500 mb-[2px] ml-[1px]" />
            </span>
            <span className="text-[8.5px] font-mono uppercase tracking-[0.22em] text-slate-400">
              console
            </span>
          </Link>
        </div>

        {/* Right: avatar opens drawer too */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open account menu"
          className="w-8 h-8 rounded-full bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0 touch-manipulation"
        >
          {initial}
        </button>
      </div>
    </header>
  );
}