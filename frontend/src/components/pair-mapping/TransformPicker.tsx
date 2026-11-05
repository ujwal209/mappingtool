"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, LoaderCircle, Sparkles } from "lucide-react";
import {
  transformationsApi,
  type Transformation,
} from "@/lib/transformations-api";

interface Props {
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function TransformPicker({
  value,
  onChange,
  disabled = false,
  readOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Transformation[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = catalog.find((t) => t.key === value);

  // Fetch catalog once on mount
  useEffect(() => {
    if (fetched) return;
    setLoading(true);
    transformationsApi
      .list()
      .then((list) => {
        setCatalog(list);
        setFetched(true);
      })
      .catch(() => {
        // Fail silently — picker falls back to display-only
      })
      .finally(() => setLoading(false));
  }, [fetched]);

  // Group-filtered options
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [catalog, query]);

  const grouped = useMemo(() => {
    const g: Record<string, Transformation[]> = {};
    for (const t of filtered) {
      if (!g[t.category]) g[t.category] = [];
      g[t.category].push(t);
    }
    return g;
  }, [filtered]);

  const flat = useMemo(() => Object.values(grouped).flat(), [grouped]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      const idx = flat.findIndex((o) => o.key === value);
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
      `[data-tx-idx="${activeIdx}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  if (readOnly) {
    return (
      <span className="font-mono text-[10.5px] text-slate-500">
        {value || "—"}
      </span>
    );
  }

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
        onChange(opt.key);
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
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-7 px-1.5 rounded border text-left flex items-center justify-between gap-1 transition ${
          disabled || loading
            ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
            : "bg-white border-slate-200 hover:border-slate-300 focus:outline-none focus:border-slate-900"
        }`}
        title={current?.description || value || ""}
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-800">
          {loading ? (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <LoaderCircle className="w-3 h-3 animate-spin" />
              Loading…
            </span>
          ) : (
            value || "Select…"
          )}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 left-0 mt-1 w-[340px] max-w-[90vw] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-80">
          {/* Search */}
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
              placeholder="Search transforms…"
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
          <div ref={listRef} className="overflow-y-auto flex-1 py-1">
            {loading ? (
              <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                <LoaderCircle className="w-4 h-4 animate-spin mx-auto mb-1" />
                Loading catalog…
              </div>
            ) : flat.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                No transforms match &ldquo;{query}&rdquo;
              </div>
            ) : (
              Object.entries(grouped).map(([groupName, opts]) => (
                <div key={groupName} className="mb-1">
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    {groupName}
                    <span className="text-slate-300 font-mono">
                      ({opts.length})
                    </span>
                  </div>
                  {opts.map((opt) => {
                    const flatIdx = flat.indexOf(opt);
                    const isSel = opt.key === value;
                    const isActive = flatIdx === activeIdx;
                    return (
                      <button
                        key={opt.transform_id}
                        type="button"
                        data-tx-idx={flatIdx}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                        onClick={() => {
                          onChange(opt.key);
                          setOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 flex items-start justify-between gap-2 transition ${
                          isActive ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono text-[10.5px] truncate ${
                                isSel
                                  ? "font-semibold text-slate-900"
                                  : "text-slate-800"
                              }`}
                            >
                              {opt.key}
                            </span>
                            {!opt.is_system && (
                              <span className="text-[8px] font-mono font-bold px-1 py-0 rounded bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 shrink-0">
                                <Sparkles className="w-2 h-2 inline" />
                              </span>
                            )}
                            <span
                              className={`text-[9.5px] truncate ${
                                isSel
                                  ? "text-slate-700 font-medium"
                                  : "text-slate-400"
                              }`}
                            >
                              {opt.label}
                            </span>
                          </div>
                          <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight line-clamp-1">
                            {opt.description}
                          </p>
                          {opt.example && (
                            <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate">
                              {opt.example}
                            </p>
                          )}
                        </div>
                        {isSel && (
                          <Check className="w-3 h-3 text-slate-900 shrink-0 mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-slate-100 px-2 py-1 text-[9px] text-slate-400 bg-slate-50/60 flex items-center gap-2 shrink-0">
            <kbd className="font-mono px-1 rounded border border-slate-200 bg-white">
              ↑↓
            </kbd>
            <span>nav</span>
            <kbd className="font-mono px-1 rounded border border-slate-200 bg-white">
              ⏎
            </kbd>
            <span>select</span>
            <kbd className="font-mono px-1 rounded border border-slate-200 bg-white">
              esc
            </kbd>
            <span>close</span>
          </div>
        </div>
      )}
    </div>
  );
}