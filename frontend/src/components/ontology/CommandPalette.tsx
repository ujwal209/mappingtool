"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Layers,
  KeyRound,
  Share2,
  CornerDownLeft,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { OntologyState } from "./useOntologyState";

type ResultKind = "entity" | "attribute" | "relationship";

interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string;
  secondary?: string;
  entityId?: string;
  relationshipId?: string;
}

export function CommandPalette({ s }: { s: OntologyState }) {
  const open = s.commandPaletteOpen;
  const ont = s.selectedOntology;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "entity" | "attribute" | "relationship">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Build the full-text index once per ontology
  const allResults = useMemo<SearchResult[]>(() => {
    if (!ont) return [];
    const out: SearchResult[] = [];
    for (const ent of ont.entities || []) {
      out.push({
        kind: "entity",
        id: ent.entity_id,
        title: ent.name,
        subtitle: ent.label && ent.label !== ent.name ? ent.label : undefined,
        secondary: ent.category || undefined,
        entityId: ent.entity_id,
      });
      for (const attr of ent.attributes || []) {
        out.push({
          kind: "attribute",
          id: attr.attribute_id,
          title: attr.name,
          subtitle: attr.label && attr.label !== attr.name ? attr.label : undefined,
          secondary: `${ent.name} · ${attr.datatype}`,
          entityId: ent.entity_id,
        });
      }
    }
    for (const rel of ont.relationships || []) {
      out.push({
        kind: "relationship",
        id: rel.relationship_id,
        title: rel.name,
        subtitle:
          rel.source_entity_name && rel.target_entity_name
            ? `${rel.source_entity_name} → ${rel.target_entity_name}`
            : undefined,
        secondary: rel.cardinality,
        relationshipId: rel.relationship_id,
      });
    }
    return out;
  }, [ont]);

  // Filter + rank
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = allResults;
    if (filter !== "all") filtered = filtered.filter((r) => r.kind === filter);
    if (!q) return filtered.slice(0, 80);

    const scored: Array<{ r: SearchResult; score: number }> = [];
    for (const r of filtered) {
      const t = r.title.toLowerCase();
      const s1 = (r.subtitle || "").toLowerCase();
      const s2 = (r.secondary || "").toLowerCase();
      let score = -1;
      if (t === q) score = 1000;
      else if (t.startsWith(q)) score = 500;
      else if (t.includes(q)) score = 200;
      else if (s1.includes(q)) score = 80;
      else if (s2.includes(q)) score = 40;
      if (score >= 0) {
        if (r.kind === "entity") score += 5;
        else if (r.kind === "relationship") score += 2;
        scored.push({ r, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 200).map((x) => x.r);
  }, [allResults, query, filter]);

  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(0);
  }, [results.length, activeIndex]);

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-cmd-index="${activeIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const jumpTo = (r: SearchResult) => {
    s.handleSearchJump(r.entityId, r.relationshipId);
    s.setCommandPaletteOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      s.setCommandPaletteOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) jumpTo(r);
      return;
    }
    if (e.key === "Tab") {
      // Cycle filter
      e.preventDefault();
      const order: Array<typeof filter> = ["all", "entity", "attribute", "relationship"];
      const idx = order.indexOf(filter);
      setFilter(order[(idx + 1) % order.length]);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] px-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => s.setCommandPaletteOpen(false)}
      />
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search entities, attributes, relationships..."
            className="flex-1 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <FilterChip label="All" count={allResults.length} active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip
            label="Entities"
            count={allResults.filter((r) => r.kind === "entity").length}
            active={filter === "entity"}
            onClick={() => setFilter("entity")}
          />
          <FilterChip
            label="Attributes"
            count={allResults.filter((r) => r.kind === "attribute").length}
            active={filter === "attribute"}
            onClick={() => setFilter("attribute")}
          />
          <FilterChip
            label="Relationships"
            count={allResults.filter((r) => r.kind === "relationship").length}
            active={filter === "relationship"}
            onClick={() => setFilter("relationship")}
          />
          <span className="ml-auto text-[10px] text-slate-400 font-mono">
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              {query.trim()
                ? `No matches for "${query.trim()}".`
                : "Start typing to search."}
            </div>
          ) : (
            results.map((r, i) => {
              const active = i === activeIndex;
              return (
                <button
                  key={`${r.kind}:${r.id}`}
                  data-cmd-index={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => jumpTo(r)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${
                    active ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <ResultIcon kind={r.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[12px] font-semibold text-slate-900 truncate">
                        {r.title}
                      </span>
                      {r.subtitle && (
                        <span className="text-[10.5px] text-slate-500 truncate">
                          {r.subtitle}
                        </span>
                      )}
                    </div>
                    {r.secondary && (
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {r.secondary}
                      </div>
                    )}
                  </div>
                  {active && (
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                      <CornerDownLeft className="w-3 h-3" /> Jump
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="border-t border-slate-200 px-3 py-2 flex items-center gap-3 text-[10px] text-slate-500 bg-slate-50/60 shrink-0">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            Jump to
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 rounded border border-slate-300">Tab</kbd>
            Cycle filter
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 rounded border border-slate-300">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 transition ${
        active
          ? "bg-slate-900 text-white shadow"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[9px] font-mono px-1 rounded ${
          active ? "bg-white/20" : "bg-slate-100 text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ResultIcon({ kind }: { kind: ResultKind }) {
  if (kind === "entity")
    return (
      <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
        <Layers className="w-3.5 h-3.5" />
      </span>
    );
  if (kind === "attribute")
    return (
      <span className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <KeyRound className="w-3.5 h-3.5" />
      </span>
    );
  return (
    <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
      <Share2 className="w-3.5 h-3.5" />
    </span>
  );
}