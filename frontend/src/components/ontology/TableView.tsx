"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  X,
  ListTree,
  Filter,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { getCategoryStyle } from "./types";
import { OntologyState } from "./useOntologyState";

const CATEGORY_FILTER_OPTIONS = [
  { value: "ALL", label: "All Categories" },
  { value: "Master Data", label: "Master Data" },
  { value: "Transactional", label: "Transactional" },
  { value: "Reference", label: "Reference" },
  { value: "Associative", label: "Associative" },
  { value: "Operational", label: "Operational" },
];

const PAGE_SIZES = [10, 25, 50, 100] as const;

function matchEntity(entity: any, q: string): { matched: boolean; attrMatches: any[] | null } {
  if (!q) return { matched: true, attrMatches: null };
  const lq = q.toLowerCase();

  const entityHit =
    (entity.name || "").toLowerCase().includes(lq) ||
    (entity.label || "").toLowerCase().includes(lq) ||
    (entity.description || "").toLowerCase().includes(lq) ||
    (entity.category || "").toLowerCase().includes(lq);

  const attrMatches = (entity.attributes || []).filter(
    (a: any) =>
      (a.name || "").toLowerCase().includes(lq) ||
      (a.label || "").toLowerCase().includes(lq) ||
      (a.datatype || "").toLowerCase().includes(lq)
  );

  if (entityHit) return { matched: true, attrMatches: null };
  if (attrMatches.length > 0) return { matched: true, attrMatches };
  return { matched: false, attrMatches: null };
}

export function TableView({ s }: { s: OntologyState }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [debounced, s.categoryFilter, pageSize]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const filteredResults = useMemo(() => {
    return s.filteredEntities
      .map((ent) => {
        const { matched, attrMatches } = matchEntity(ent, debounced.trim());
        return matched ? { ent, attrMatches } : null;
      })
      .filter(Boolean) as Array<{ ent: any; attrMatches: any[] | null }>;
  }, [s.filteredEntities, debounced]);

  const totalEntities = s.selectedOntology?.entities?.length || 0;
  const matchCount = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(matchCount / pageSize));

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const visible = useMemo(() => {
    const start = page * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, page, pageSize]);

  const allVisibleCollapsed =
    visible.length > 0 && visible.every((v) => collapsedIds.has(v.ent.entity_id));

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCollapseAllVisible = () => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      const ids = visible.map((v) => v.ent.entity_id);
      const allCollapsed = ids.every((id) => next.has(id));
      if (allCollapsed) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const hasActiveFilters = debounced.trim().length > 0 || s.categoryFilter !== "ALL";

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* ── Fixed header ──────────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 pt-20 pb-3">
        <div className="max-w-6xl mx-auto w-full space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 sm:max-w-md min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search entities, fields, datatypes..."
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
              <div className="w-full sm:w-52 shrink-0">
                <CustomSelect
                  value={s.categoryFilter}
                  onChange={s.setCategoryFilter}
                  options={CATEGORY_FILTER_OPTIONS}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleCollapseAllVisible}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50"
                title={
                  allVisibleCollapsed ? "Expand all on this page" : "Collapse all on this page"
                }
              >
                {allVisibleCollapsed ? (
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {allVisibleCollapsed ? "Expand" : "Collapse"}
                </span>
              </button>
              <button
                onClick={s.openAddEntity}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Entity</span>
              </button>
            </div>
          </div>

          {totalEntities > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
              <span className="font-mono font-bold text-slate-700">
                {totalEntities.toLocaleString()}
              </span>
              <span>entities</span>
              {hasActiveFilters && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono font-bold text-blue-700">
                    {matchCount.toLocaleString()}
                  </span>
                  <span>matching</span>
                  <button
                    onClick={() => {
                      setQuery("");
                      s.setCategoryFilter("ALL");
                    }}
                    className="ml-1 text-blue-700 hover:underline font-semibold"
                  >
                    Clear
                  </button>
                </>
              )}
              {debounced.trim() && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <Filter className="w-3 h-3" />
                    Attribute hits are highlighted
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable list ──────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="max-w-6xl mx-auto w-full pb-4 space-y-3">
          {totalEntities === 0 ? (
            <EmptyState
              title="No entities yet"
              description="Create entities or let the AI Copilot synthesize an ontology for you."
              action={
                <button
                  onClick={s.openAddEntity}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Add first entity
                </button>
              }
            />
          ) : matchCount === 0 ? (
            <EmptyState
              title="No entities match your filters"
              description="Try clearing the search or choosing a different category."
              action={
                <button
                  onClick={() => {
                    setQuery("");
                    s.setCategoryFilter("ALL");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            visible.map(({ ent, attrMatches }) => (
              <EntityCardRow
                key={ent.entity_id}
                entity={ent}
                attrMatches={attrMatches}
                isCollapsed={collapsedIds.has(ent.entity_id)}
                onToggleCollapse={() => toggleCollapse(ent.entity_id)}
                s={s}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Fixed pagination footer (carries toolbar clearance) ─── */}
      {matchCount > 0 && (
        <div className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-2 pb-20">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="hidden sm:inline">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
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
    </div>
  );
}

function EntityCardRow({
  entity,
  attrMatches,
  isCollapsed,
  onToggleCollapse,
  s,
}: {
  entity: any;
  attrMatches: any[] | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  s: OntologyState;
}) {
  const style = getCategoryStyle(entity.category);
  const totalAttrs = entity.attributes?.length || 0;
  const shownAttrs = attrMatches ? attrMatches : entity.attributes || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div
        className={`px-3 sm:px-4 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:brightness-95 transition ${style.headerBg}`}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white/70 shrink-0"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          <span className={`w-2 h-2 rounded-full shrink-0 ${style.accentDot}`} />
          <h3 className="font-bold text-sm truncate">{entity.name}</h3>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${style.badgeBg} ${style.badgeText}`}
          >
            {entity.category}
          </span>
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            {totalAttrs} field{totalAttrs === 1 ? "" : "s"}
          </span>
          {attrMatches && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 border border-blue-200 text-blue-800 shrink-0">
              <ListTree className="w-2.5 h-2.5" />
              {attrMatches.length} match{attrMatches.length === 1 ? "" : "es"} in fields
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => s.openAddAttribute(entity)}
            className="text-[11px] flex items-center gap-1 bg-white/80 px-2 py-1 rounded border border-slate-200 hover:bg-white whitespace-nowrap"
          >
            <Plus className="w-3 h-3" /> Add Field
          </button>
          <button
            onClick={() => s.openEditEntity(entity)}
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white/70"
            title="Edit entity"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => s.deleteEntity(entity.entity_id)}
            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-white/70"
            title="Delete entity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="overflow-x-auto">
          {shownAttrs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No attributes yet. Click + to add fields.
            </div>
          ) : (
            <table className="w-full text-xs text-left min-w-[600px]">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3 whitespace-nowrap">Column</th>
                  <th className="py-2 px-3 whitespace-nowrap">Datatype</th>
                  <th className="py-2 px-3 whitespace-nowrap">Constraints</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shownAttrs.map((attr: any) => (
                  <tr
                    key={attr.attribute_id}
                    className="hover:bg-slate-50/60 even:bg-slate-50/30"
                  >
                    <td className="py-2 px-3 font-mono font-semibold whitespace-nowrap">
                      {attr.name}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {attr.datatype}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {attr.is_primary_key && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            PK
                          </span>
                        )}
                        {attr.is_foreign_key && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                            FK
                          </span>
                        )}
                        {attr.is_indexed && !attr.is_primary_key && !attr.is_foreign_key && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            IDX
                          </span>
                        )}
                        {attr.is_pii && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                            PII
                          </span>
                        )}
                        {attr.is_nullable ? (
                          <span className="text-[10px] text-slate-400">NULL</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-700">
                            NOT NULL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => s.openEditAttribute(entity, attr)}
                          className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => s.deleteAttribute(entity, attr.attribute_id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
        <ListTree className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}