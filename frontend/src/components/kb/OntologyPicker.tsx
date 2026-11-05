"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check, Loader2 } from "lucide-react";
import { KBOntology, listOntologies } from "@/lib/kb-api";

const PAGE_SIZE = 20;

export function OntologyPicker({
  value,
  onChange,
  disabled,
  placeholder = "Select ontology...",
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [all, setAll] = useState<KBOntology[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
    setActiveIdx(0);
  }, [debounced]);

  useEffect(() => {
    if (!open || loaded || loading) return;
    setLoading(true);
    listOntologies()
      .then((list) => {
        setAll(list);
        setLoaded(true);
      })
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, [open, loaded, loading]);

  useEffect(() => {
    if (open && loaded) {
      listOntologies()
        .then(setAll)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        (o.name || "").toLowerCase().includes(q) ||
        (o.domain || "").toLowerCase().includes(q) ||
        (o.version_tag || "").toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q)
    );
  }, [all, debounced]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const current = all.find((o) => o.ontology_version_id === value);

  const commit = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = visible[activeIdx];
      if (item) commit(item.ontology_version_id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-item-index="${activeIdx}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full h-[36px] px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 text-left flex items-center justify-between gap-2 hover:border-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {current ? (
            <>
              <span className="font-semibold">{current.name}</span>
              <span className="text-slate-400 font-mono ml-1.5">
                · v{current.version_tag}
              </span>
            </>
          ) : value ? (
            <span className="font-mono text-slate-500">{value}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-80">
          <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-slate-100 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search ontologies..."
              className="flex-1 text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
            />
            {loading && (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            )}
          </div>

          <div ref={listRef} className="overflow-y-auto">
            {loading && !loaded ? (
              <div className="p-4 text-center text-[11px] text-slate-400">
                Loading ontologies...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-400">
                {debounced.trim()
                  ? `No matches for "${debounced.trim()}"`
                  : "No ontologies yet"}
              </div>
            ) : (
              visible.map((o, i) => {
                const active = i === activeIdx;
                const isSel = o.ontology_version_id === value;
                return (
                  <button
                    key={o.ontology_version_id}
                    type="button"
                    data-item-index={i}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => commit(o.ontology_version_id)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[12px] ${
                      active ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-900 block truncate">
                        {o.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate font-mono">
                        v{o.version_tag}
                        {o.domain ? ` · ${o.domain}` : ""}
                        {" · "}
                        {o.ontology_version_id}
                      </span>
                    </span>
                    {isSel && (
                      <Check className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="border-t border-slate-100 px-2 py-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-500 shrink-0">
              <span className="font-mono">
                {page * PAGE_SIZE + 1}–
                {Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="font-mono min-w-[44px] text-center">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}