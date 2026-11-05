"use client";

import { X, Search, ChevronDown, Check } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export function ModalShell({
  children,
  title,
  icon: Icon,
  onClose,
  size = "md",
}: {
  children: React.ReactNode;
  title: string;
  icon: React.ElementType;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div
        className={`bg-white rounded-2xl ${sizeClass} w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col`}
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 truncate">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-semibold text-slate-700 block text-[11px]">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function Footer({
  onCancel,
  submitLabel,
  danger,
}: {
  onCancel: () => void;
  submitLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        className={`px-4 py-1.5 rounded-lg text-white font-semibold text-xs transition ${
          danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
        }`}
      >
        {submitLabel}
      </button>
    </div>
  );
}

export const inputClass =
  "w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white text-slate-800 placeholder:text-slate-400";

// ─── SearchableSelect ────────────────────────────────────────
// A combobox with inline search — perfect for entity pickers when
// there are thousands of entities.

export interface SearchableOption {
  value: string;
  label: string;
  description?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search...",
  emptyLabel = "No options",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 200);
    const scored: Array<{ o: SearchableOption; score: number }> = [];
    for (const o of options) {
      const t = o.label.toLowerCase();
      const d = (o.description || "").toLowerCase();
      let score = -1;
      if (t === q) score = 1000;
      else if (t.startsWith(q)) score = 500;
      else if (t.includes(q)) score = 200;
      else if (d.includes(q)) score = 40;
      if (score >= 0) scored.push({ o, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 200).map((x) => x.o);
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-left flex items-center justify-between gap-2 hover:border-slate-400"
      >
        <span className="truncate">
          {current ? (
            <>
              <span className="font-mono font-semibold">{current.label}</span>
              {current.description && (
                <span className="text-[10px] text-slate-400 ml-2">
                  {current.description}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">Select…</span>
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-72">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const o = filtered[activeIndex];
                  if (o) select(o.value);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={placeholder}
              className="flex-1 text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div ref={listRef} className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-slate-400">
                {emptyLabel}
              </div>
            ) : (
              filtered.map((o, i) => {
                const active = i === activeIndex;
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(o.value)}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[11.5px] ${
                      active ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-mono font-semibold text-slate-900 block truncate">
                        {o.label}
                      </span>
                      {o.description && (
                        <span className="text-[10px] text-slate-400 block truncate">
                          {o.description}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}