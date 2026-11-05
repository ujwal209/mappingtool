"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface ColumnOption {
  name: string;
  datatype?: string;
}

interface Props {
  value: string | null;
  onChange: (name: string | null) => void;
  options: ColumnOption[];
  placeholder?: string;
  disabled?: boolean;
  /** When true, the picker is read-only (renders the value as plain text). */
  readOnly?: boolean;
  /** Optional title shown in the popover header. */
  title?: string;
}

export function ColumnPicker({
  value,
  onChange,
  options,
  placeholder = "Select source column…",
  disabled = false,
  readOnly = false,
  title = "Source columns",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter options by search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.datatype || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Focus search on open + reset active index
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Clamp active index when filter changes
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered.length, activeIdx]);

  // Scroll active into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(
      `[data-opt-idx="${activeIdx}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  if (readOnly) {
    return (
      <span className="font-mono text-[11.5px] text-slate-800">
        {value ? (
          value
        ) : (
          <span className="text-slate-300 italic">—</span>
        )}
      </span>
    );
  }

  const selected = options.find((o) => o.name === value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) {
        onChange(opt.name);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-7 px-2 rounded border text-left flex items-center justify-between gap-1 transition ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
            : "bg-white border-slate-200 hover:border-slate-300 focus:outline-none focus:border-slate-900"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-medium text-slate-900 truncate">
                {selected.name}
              </span>
              {selected.datatype && (
                <span className="text-[9px] font-mono text-slate-400 shrink-0">
                  {selected.datatype}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              {placeholder}
            </span>
          )}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              title="Clear"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[260px] max-w-[340px]">
          {/* Search */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 shrink-0">
            <Search className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search columns…"
              className="flex-1 text-[11px] bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-700 text-[10px]"
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options */}
          <div
            ref={listRef}
            className="overflow-y-auto max-h-56"
            role="listbox"
          >
            {/* Clear option */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[11px] italic ${
                !value
                  ? "bg-slate-50 text-slate-600"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="flex-1">— Unmatched —</span>
              {!value && (
                <Check className="w-3 h-3 text-slate-700 shrink-0" />
              )}
            </button>

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                No columns match &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((opt, i) => {
                const isSel = opt.name === value;
                const isActive = i === activeIdx;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    data-opt-idx={i}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => {
                      onChange(opt.name);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[11px] transition ${
                      isActive ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span
                        className={`font-mono truncate ${
                          isSel
                            ? "font-semibold text-slate-900"
                            : "text-slate-800"
                        }`}
                      >
                        {opt.name}
                      </span>
                      {opt.datatype && (
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">
                          {opt.datatype}
                        </span>
                      )}
                    </span>
                    {isSel && (
                      <Check className="w-3 h-3 text-slate-900 shrink-0" />
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