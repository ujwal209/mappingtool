"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  /** How many options to render per page inside the popover. */
  pageSize?: number;
  /** Show the filter input at the top of the popover. */
  searchable?: boolean;
  /** Optional footer content (e.g. "Create a new one"). */
  footer?: React.ReactNode;
  className?: string;
}

export function PickerDropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  loading,
  pageSize = 25,
  searchable = true,
  footer,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const s = page * pageSize;
    return filtered.slice(s, s + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPage(0);
    const idx = filtered.findIndex((o) => o.value === value);
    setActiveIdx(idx >= 0 && idx < pageSize ? idx : 0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [open]);

  useEffect(() => setPage(0), [query]);

  useEffect(() => {
    if (activeIdx >= paged.length) setActiveIdx(0);
  }, [paged.length, activeIdx]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(paged.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = paged[activeIdx];
      if (o) {
        onChange(o.value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-10 px-3 rounded-lg border bg-white text-left flex items-center justify-between gap-2 text-[13px] transition outline-none ${
          disabled || loading
            ? "border-slate-200 text-slate-400 cursor-not-allowed"
            : open
            ? "border-slate-900 ring-1 ring-slate-900/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className="min-w-0 flex-1 flex items-center gap-2 truncate">
          {current?.icon}
          {current ? (
            <>
              <span className="font-medium text-slate-900 truncate">
                {current.label}
              </span>
              {current.badge && (
                <span className="text-[9.5px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 shrink-0">
                  {current.badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        {loading ? (
          <LoaderCircle className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
        ) : (
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[380px]">
          {searchable && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50/40">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search…"
                className="flex-1 text-[12px] bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-slate-400 hover:text-slate-700 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div ref={listRef} className="overflow-y-auto flex-1 py-1">
            {paged.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] text-slate-400">
                No matches{query ? ` for "${query}"` : ""}.
              </div>
            ) : (
              paged.map((opt, i) => {
                const sel = opt.value === value;
                const active = i === activeIdx;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2.5 text-[12.5px] transition ${
                      active ? "bg-slate-50" : ""
                    } ${sel ? "font-medium" : ""}`}
                  >
                    {opt.icon && (
                      <span className="shrink-0 mt-0.5">{opt.icon}</span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`truncate ${
                            sel ? "text-slate-900 font-semibold" : "text-slate-800"
                          }`}
                        >
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                            {opt.badge}
                          </span>
                        )}
                      </span>
                      {opt.description && (
                        <span className="block text-[11px] text-slate-500 truncate mt-0.5">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    {sel && (
                      <Check className="w-3.5 h-3.5 text-slate-900 shrink-0 mt-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {filtered.length > pageSize && (
            <div className="border-t border-slate-100 px-3 py-1.5 flex items-center justify-between text-[10.5px] text-slate-500 bg-slate-50/60">
              <span className="font-mono">
                {page * pageSize + 1}–
                {Math.min(filtered.length, (page + 1) * pageSize)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="font-mono min-w-[44px] text-center">
                  {page + 1}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {footer && (
            <div className="border-t border-slate-100 bg-slate-50/60">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}