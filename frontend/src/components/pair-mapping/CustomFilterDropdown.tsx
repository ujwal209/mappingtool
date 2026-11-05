"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface FilterDropdownOption {
  value: string;
  label: string;
  /** Small hint shown on the right of the row (e.g. counts, descriptions). */
  hint?: string;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Group heading — when set, options group under headings. */
  group?: string;
}

interface Props {
  /** Currently selected value. */
  value: string;
  /** Called when the user picks an option. */
  onChange: (value: string) => void;
  /** Options to render. */
  options: FilterDropdownOption[];
  /** Leading icon in the trigger. */
  icon?: React.ReactNode;
  /** Placeholder / label shown in the trigger when value is empty. */
  placeholder?: string;
  /** Popover header title. */
  title?: string;
  /** Whether to show the built-in search box. */
  searchable?: boolean;
  /** Trigger width. */
  minWidth?: number;
  /** Disabled state. */
  disabled?: boolean;
  /** ARIA label. */
  ariaLabel?: string;
}

export function CustomFilterDropdown({
  value,
  onChange,
  options,
  icon,
  placeholder = "Select…",
  title = "Filter",
  searchable = true,
  minWidth = 160,
  disabled = false,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // ── Filter by search query ────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  // ── Group filtered options ────────────────────────────
  const grouped = useMemo(() => {
    const groups: Record<string, FilterDropdownOption[]> = {};
    for (const o of filtered) {
      const k = o.group || "";
      if (!groups[k]) groups[k] = [];
      groups[k].push(o);
    }
    return groups;
  }, [filtered]);

  const flat = useMemo(() => Object.values(grouped).flat(), [grouped]);

  // ── Close on outside click ────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ── Focus search on open ──────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("");
      const idx = flat.findIndex((o) => o.value === value);
      setActiveIdx(idx >= 0 ? idx : 0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
    // eslint-disable-next-line
  }, [open]);

  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(0);
  }, [flat.length, activeIdx]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(
      `[data-opt-idx="${activeIdx}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = flat[activeIdx];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative" style={{ minWidth }}>
      {/* Trigger */}
      <button
        type="button"
        aria-label={ariaLabel || title}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-9 pl-2.5 pr-2 rounded-lg border bg-white text-[11.5px] flex items-center justify-between gap-1.5 transition ${
          disabled
            ? "opacity-50 cursor-not-allowed border-slate-200"
            : open
            ? "border-slate-900 ring-1 ring-slate-900/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
          {icon && (
            <span className="text-slate-400 shrink-0">{icon}</span>
          )}
          <span
            className={`truncate ${
              selected && selected.value !== "ALL"
                ? "font-medium text-slate-900"
                : "text-slate-500"
            }`}
          >
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute z-50 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col"
          style={{ minWidth: Math.max(minWidth, 240), maxHeight: 340 }}
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 bg-slate-50/60 shrink-0 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {title}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 rounded p-0.5"
              aria-label="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Search */}
          {searchable && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 shrink-0">
              <Search className="w-3 h-3 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search…"
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
          )}

          {/* Options */}
          <div
            ref={listRef}
            className="overflow-y-auto flex-1 py-1"
            role="listbox"
          >
            {flat.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                No options match &ldquo;{query}&rdquo;
              </div>
            ) : (
              Object.entries(grouped).map(([groupName, opts]) => (
                <div key={groupName || "_default"} className="mb-0.5">
                  {groupName && (
                    <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      {groupName}
                    </div>
                  )}
                  {opts.map((opt) => {
                    const flatIdx = flat.indexOf(opt);
                    const isSel = opt.value === value;
                    const isActive = flatIdx === activeIdx;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        data-opt-idx={flatIdx}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 text-[11.5px] transition ${
                          isActive ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                      >
                        {opt.icon && (
                          <span className="text-slate-400 shrink-0">
                            {opt.icon}
                          </span>
                        )}
                        <span
                          className={`flex-1 min-w-0 truncate ${
                            isSel
                              ? "font-semibold text-slate-900"
                              : "text-slate-700"
                          }`}
                        >
                          {opt.label}
                        </span>
                        {opt.hint && (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {opt.hint}
                          </span>
                        )}
                        {isSel && (
                          <Check className="w-3 h-3 text-slate-900 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}