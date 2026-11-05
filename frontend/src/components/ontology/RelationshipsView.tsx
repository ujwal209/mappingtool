"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  ArrowRight,
  Search,
  X,
  Share2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { OntologyState } from "./useOntologyState";

type CardinalityFilter =
  | "ALL"
  | "ONE_TO_ONE"
  | "ONE_TO_MANY"
  | "MANY_TO_ONE"
  | "MANY_TO_MANY"
  | "INHERITANCE";

const PAGE_SIZES = [25, 50, 100, 250] as const;
const INFINITE_STEP = 50;

function formatCardinality(c?: string): string {
  if (!c) return "1:N";
  if (c.includes("MANY_TO_MANY")) return "N:M";
  if (c.includes("MANY_TO_ONE")) return "N:1";
  if (c.includes("ONE_TO_MANY")) return "1:N";
  if (c.includes("ONE_TO_ONE")) return "1:1";
  return "IS-A";
}

function cardinalityColor(c?: string): string {
  if (!c) return "bg-slate-100 text-slate-700 border-slate-200";
  if (c.includes("MANY_TO_MANY")) return "bg-purple-100 text-purple-800 border-purple-200";
  if (c.includes("MANY_TO_ONE")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (c.includes("ONE_TO_MANY")) return "bg-blue-100 text-blue-800 border-blue-200";
  if (c.includes("ONE_TO_ONE")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function RelationshipsView({ s }: { s: OntologyState }) {
  const ont = s.selectedOntology;
  const allRels = ont?.relationships || [];
  const entities = ont?.entities || [];

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cardFilter, setCardFilter] = useState<CardinalityFilter>("ALL");
  const [entityFilter, setEntityFilter] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);
  const [infiniteMode, setInfiniteMode] = useState(false);
  const [infiniteCount, setInfiniteCount] = useState<number>(INFINITE_STEP);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
    setInfiniteCount(INFINITE_STEP);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [debouncedQuery, cardFilter, entityFilter]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let list = allRels;
    if (entityFilter) {
      list = list.filter(
        (r) => r.source_entity_id === entityFilter || r.target_entity_id === entityFilter
      );
    }
    if (cardFilter !== "ALL") {
      list = list.filter((r) =>
        (r.cardinality || "").toUpperCase().includes(cardFilter)
      );
    }
    if (q) {
      list = list.filter((r) => {
        return (
          r.name.toLowerCase().includes(q) ||
          (r.label || "").toLowerCase().includes(q) ||
          (r.source_entity_name || "").toLowerCase().includes(q) ||
          (r.target_entity_name || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          (r.cardinality || "").toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [allRels, debouncedQuery, cardFilter, entityFilter]);

  const totalCount = allRels.length;
  const matchCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(matchCount / pageSize));

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const visibleRels = useMemo(() => {
    if (infiniteMode) return filtered.slice(0, infiniteCount);
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, infiniteMode, infiniteCount]);

  useEffect(() => {
    if (!infiniteMode) return;
    const el = sentinelRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && infiniteCount < matchCount) {
          setInfiniteCount((c) => Math.min(matchCount, c + INFINITE_STEP));
        }
      },
      { root: container, rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [infiniteMode, infiniteCount, matchCount]);

  const focusedEntity = entityFilter
    ? entities.find((e) => e.entity_id === entityFilter)
    : null;

  const hasActiveFilters =
    debouncedQuery.trim().length > 0 || cardFilter !== "ALL" || entityFilter !== null;

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setCardFilter("ALL");
    setEntityFilter(null);
  };

  if (!ont) return null;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* ── Fixed header ──────────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 pt-20 pb-3">
        <div className="max-w-7xl mx-auto w-full space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold">Ontological Relationships</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {totalCount.toLocaleString()} total
                </span>
                {hasActiveFilters && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {matchCount.toLocaleString()} shown
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Directional semantic bindings and cardinalities.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setInfiniteMode((v) => !v);
                  setPage(0);
                  setInfiniteCount(INFINITE_STEP);
                }}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  infiniteMode
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
                title={infiniteMode ? "Switch to paginated view" : "Load more as you scroll"}
              >
                {infiniteMode ? "Infinite" : "Paginated"}
              </button>
              <button
                onClick={s.openAddRelationship}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Relationship</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, source, target, description..."
                className="w-full text-xs pl-8 pr-8 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-700 rounded"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="relative shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <select
                value={cardFilter}
                onChange={(e) => setCardFilter(e.target.value as CardinalityFilter)}
                className="text-xs pl-8 pr-6 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All cardinalities</option>
                <option value="ONE_TO_ONE">1:1</option>
                <option value="ONE_TO_MANY">1:N</option>
                <option value="MANY_TO_ONE">N:1</option>
                <option value="MANY_TO_MANY">N:M</option>
                <option value="INHERITANCE">IS-A</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>

          {focusedEntity && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Focused on:
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-semibold">
                <span className="font-mono">{focusedEntity.name}</span>
                <button
                  onClick={() => setEntityFilter(null)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                  title="Clear entity filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable results ────────────────────────────────
          pb-4 = small gap between last row and footer.
          Footer itself carries the pb-20 (toolbar clearance).          */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="max-w-7xl mx-auto w-full pb-4">
          {totalCount === 0 ? (
            <EmptyState
              title="No relationships yet"
              description="Define how entities relate to each other — ownership, references, composition."
              action={
                <button
                  onClick={s.openAddRelationship}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add your first relationship
                </button>
              }
            />
          ) : matchCount === 0 ? (
            <EmptyState
              title="No relationships match your filters"
              description="Try clearing the search or the cardinality filter."
              action={
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleRels.map((rel) => (
                  <RelationshipCard
                    key={rel.relationship_id}
                    rel={rel}
                    src={entities.find((e) => e.entity_id === rel.source_entity_id)}
                    tgt={entities.find((e) => e.entity_id === rel.target_entity_id)}
                    onFocusEntity={setEntityFilter}
                    onEdit={() => s.openEditRelationship(rel)}
                    onDelete={() => s.deleteRelationship(rel.relationship_id)}
                  />
                ))}
              </div>

              {infiniteMode && (
                <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
                  {infiniteCount < matchCount ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading more...
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      End of results · {matchCount.toLocaleString()} total
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Fixed footer (carries toolbar clearance) ──────── */}
      {matchCount > 0 && !infiniteMode && (
        <div className="shrink-0 border-t border-slate-200 bg-white/90 backdrop-blur px-4 sm:px-6 py-2 pb-20">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="hidden sm:inline">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-slate-500 font-mono text-[11px]">
                {page * pageSize + 1}–{Math.min(matchCount, (page + 1) * pageSize)} of{" "}
                {matchCount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <PagerBtn disabled={page === 0} onClick={() => setPage(0)} title="First page">
                <ChevronsLeft className="w-3.5 h-3.5" />
              </PagerBtn>
              <PagerBtn
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </PagerBtn>
              <span className="px-3 text-xs font-semibold text-slate-700 font-mono min-w-[80px] text-center">
                {page + 1} / {totalPages}
              </span>
              <PagerBtn
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </PagerBtn>
              <PagerBtn
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
                title="Last page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </PagerBtn>
            </div>
          </div>
        </div>
      )}

      {matchCount > 0 && infiniteMode && (
        <div className="shrink-0 border-t border-slate-200 bg-white/90 backdrop-blur px-4 sm:px-6 py-2 pb-20">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3 text-xs text-slate-600">
            <span className="font-mono text-[11px]">
              Showing {Math.min(infiniteCount, matchCount).toLocaleString()} of{" "}
              {matchCount.toLocaleString()}
            </span>
            <button
              onClick={() => setInfiniteMode(false)}
              className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 underline"
            >
              Switch to paginated view
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RelationshipCard({
  rel,
  src,
  tgt,
  onFocusEntity,
  onEdit,
  onDelete,
}: {
  rel: any;
  src: any;
  tgt: any;
  onFocusEntity: (id: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOrphan = !src || !tgt;
  const cardClass = cardinalityColor(rel.cardinality);

  return (
    <div
      className={`bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition flex flex-col gap-2 min-w-0 ${
        isOrphan ? "border-red-300 bg-red-50/40" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${cardClass}`}
        >
          {formatCardinality(rel.cardinality)}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onEdit}
            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100"
            title="Edit"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs min-w-0">
        <button
          onClick={() => src && onFocusEntity(src.entity_id)}
          className={`px-2 py-1 rounded-md border font-mono text-[11px] font-semibold truncate flex-1 text-center transition ${
            src
              ? "bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-400 hover:bg-slate-100"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
          title={src ? `Focus on ${src.name}` : "Missing"}
        >
          {src?.name || "(missing)"}
        </button>
        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <button
          onClick={() => tgt && onFocusEntity(tgt.entity_id)}
          className={`px-2 py-1 rounded-md border font-mono text-[11px] font-semibold truncate flex-1 text-center transition ${
            tgt
              ? "bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-400 hover:bg-slate-100"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
          title={tgt ? `Focus on ${tgt.name}` : "Missing"}
        >
          {tgt?.name || "(missing)"}
        </button>
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        <Share2 className="w-3 h-3 text-slate-400 shrink-0" />
        <span
          className="font-mono text-[11px] font-bold text-slate-800 truncate"
          title={rel.name}
        >
          {rel.name}
        </span>
        {rel.label && rel.label !== rel.name && (
          <span className="text-[10px] text-slate-400 truncate">· {rel.label}</span>
        )}
      </div>

      {rel.description && (
        <p className="text-[10.5px] text-slate-500 italic line-clamp-2 leading-snug">
          {rel.description}
        </p>
      )}

      {isOrphan && (
        <p className="text-[10px] text-red-700 font-semibold">
          ⚠ Endpoint missing — delete and recreate.
        </p>
      )}
    </div>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-16 px-6 bg-white border border-slate-200 rounded-2xl text-center max-w-lg mx-auto space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
        <Share2 className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}