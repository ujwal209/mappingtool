"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Network,
  Search,
  X,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Share2,
  Hash,
  Clock,
  Globe2,
  Info,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { OntologyState } from "./useOntologyState";

type SortMode = "name-asc" | "name-desc" | "updated-desc" | "updated-asc" | "version-desc";
type ViewMode = "grid" | "list";

const PAGE_SIZES = [12, 24, 48, 96] as const;

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "updated-desc", label: "Recently updated" },
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "updated-asc", label: "Oldest first" },
  { value: "version-desc", label: "Version (high → low)" },
];

export function OntologyRegistry({ s }: { s: OntologyState }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(24);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const all = s.ontologies;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [debounced, sortMode, pageSize, viewMode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    let list = all;
    if (q) {
      list = list.filter((o) => {
        return (
          (o.name || "").toLowerCase().includes(q) ||
          (o.description || "").toLowerCase().includes(q) ||
          (o.domain || "").toLowerCase().includes(q) ||
          (o.version_tag || "").toLowerCase().includes(q)
        );
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      const aName = (a.name || "").toLowerCase();
      const bName = (b.name || "").toLowerCase();
      const aUpd = (a as any).updated_at || 0;
      const bUpd = (b as any).updated_at || 0;
      const aVer = (a.version_tag || "").toString();
      const bVer = (b.version_tag || "").toString();
      switch (sortMode) {
        case "name-asc": return aName.localeCompare(bName);
        case "name-desc": return bName.localeCompare(aName);
        case "updated-desc": return bUpd - aUpd;
        case "updated-asc": return aUpd - bUpd;
        case "version-desc": return bVer.localeCompare(aVer, undefined, { numeric: true });
        default: return 0;
      }
    });
    return sorted;
  }, [all, debounced, sortMode]);

  const matchCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(matchCount / pageSize));
  const visible = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  // Selected for preview
  const preview = useMemo(
    () => all.find((o) => o.ontology_version_id === previewId) || null,
    [all, previewId]
  );

  // Auto-select the first visible item for preview (desktop only, no-op on mobile visually)
  useEffect(() => {
    if (!preview && visible.length > 0) {
      setPreviewId(visible[0].ontology_version_id);
    }
  }, [visible, preview]);

  const hasActiveFilters = debounced.trim().length > 0;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* ── Fixed header ──────────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-5 pb-3">
        <div className="max-w-7xl mx-auto w-full space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded">
                  Enterprise Model Store
                </span>
                <span className="text-xs font-mono text-slate-500 truncate">
                  Scope: {s.activeProject?.name || "Global"}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">Business Ontologies</h1>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Define enterprise semantic entities, typed attributes, keys, and relational topology.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <button
                onClick={() => s.loadOntologies()}
                className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${s.loading ? "animate-spin" : ""}`} />
              </button>
              <Link
                href="/ontology/new"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Ontology</span>
              </Link>
            </div>
          </div>

          {!s.loading && all.length > 0 && (
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, description, domain, version..."
                  className="w-full text-xs pl-8 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="text-xs pl-8 pr-6 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition ${viewMode === "grid" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition ${viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {!s.loading && all.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
              <span className="font-mono font-bold text-slate-700">{all.length.toLocaleString()}</span>
              <span>total</span>
              {hasActiveFilters && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono font-bold text-blue-700">{matchCount.toLocaleString()}</span>
                  <span>matching</span>
                  <button
                    onClick={() => setQuery("")}
                    className="ml-1 text-blue-700 hover:underline font-semibold"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full pb-4">
          {s.loading ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin" />
              <p className="text-xs">Loading ontologies...</p>
            </div>
          ) : all.length === 0 ? (
            <EmptyState
              title="No ontologies yet"
              description="Create your first ontology — or let the AI Copilot synthesize one for you."
              action={
                <Link
                  href="/ontology/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" /> Create First Ontology
                </Link>
              }
            />
          ) : matchCount === 0 ? (
            <EmptyState
              title={`No matches for "${query}"`}
              description="Try a different search."
              action={
                <button
                  onClick={() => setQuery("")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Clear search
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
              {/* LIST */}
              <div>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visible.map((ont) => (
                      <OntologyCard
                        key={ont.ontology_version_id}
                        ont={ont}
                        s={s}
                        isSelected={ont.ontology_version_id === previewId}
                        onHover={() => setPreviewId(ont.ontology_version_id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
                    {visible.map((ont) => (
                      <OntologyRow
                        key={ont.ontology_version_id}
                        ont={ont}
                        s={s}
                        isSelected={ont.ontology_version_id === previewId}
                        onHover={() => setPreviewId(ont.ontology_version_id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* PREVIEW PANE (desktop only) */}
              <aside className="hidden lg:block">
                <div className="sticky top-2">
                  <PreviewPane ont={preview} s={s} />
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed pagination footer ──────────────────────── */}
      {!s.loading && matchCount > 0 && (
        <div className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="hidden sm:inline">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
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
              <PagerBtn disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} title="Previous">
                <ChevronLeft className="w-3.5 h-3.5" />
              </PagerBtn>
              <span className="px-3 text-xs font-semibold text-slate-700 font-mono min-w-[80px] text-center">
                {page + 1} / {totalPages}
              </span>
              <PagerBtn disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} title="Next">
                <ChevronRight className="w-3.5 h-3.5" />
              </PagerBtn>
              <PagerBtn disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} title="Last page">
                <ChevronsRight className="w-3.5 h-3.5" />
              </PagerBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ontology Card (grid)
// ─────────────────────────────────────────────────────────────
function OntologyCard({
  ont,
  s,
  isSelected,
  onHover,
}: {
  ont: any;
  s: OntologyState;
  isSelected: boolean;
  onHover: () => void;
}) {
  const fieldCount =
    ont.entities?.reduce((a: number, e: any) => a + (e.attributes?.length || 0), 0) || 0;
  const updatedAgo = relTime((ont as any).updated_at || (ont as any).created_at);

  return (
    <div
      onMouseEnter={onHover}
      className={`group bg-white border rounded-xl p-4 shadow-sm hover:shadow-md flex flex-col justify-between transition cursor-default ${
        isSelected ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 font-bold">
                v{ont.version_tag}
              </span>
              {ont.domain && (
                <span className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  <Globe2 className="w-3 h-3" />
                  {ont.domain}
                </span>
              )}
            </div>
            <h3 className="font-bold text-base mt-1.5 truncate" title={ont.name}>
              {ont.name}
            </h3>
          </div>
          <button
            onClick={() => s.deleteOntology(ont.ontology_version_id)}
            className="text-slate-400 hover:text-red-600 shrink-0 p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 line-clamp-2 min-h-[2.5rem]">
          {ont.description || "Canonical enterprise business model."}
        </p>

        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center">
          <Stat value={ont.entities?.length || 0} label="Entities" />
          <Stat value={ont.relationships?.length || 0} label="Relations" />
          <Stat value={fieldCount} label="Fields" />
        </div>

        {updatedAgo && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="w-3 h-3" />
            {updatedAgo}
          </div>
        )}
      </div>

      <div className="pt-3 mt-2 flex items-center justify-between gap-2 border-t border-slate-100">
        <button
          onClick={() => openEditModal(ont, s)}
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-50"
        >
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={() => s.handleOpenBuilderForOntology(ont)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
        >
          <Network className="w-3.5 h-3.5" /> Open Builder
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ontology Row (list)
// ─────────────────────────────────────────────────────────────
function OntologyRow({
  ont,
  s,
  isSelected,
  onHover,
}: {
  ont: any;
  s: OntologyState;
  isSelected: boolean;
  onHover: () => void;
}) {
  const fieldCount =
    ont.entities?.reduce((a: number, e: any) => a + (e.attributes?.length || 0), 0) || 0;
  return (
    <div
      onMouseEnter={onHover}
      className={`flex items-center gap-3 px-3 py-2.5 transition ${
        isSelected ? "bg-slate-50" : "hover:bg-slate-50"
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <Network className="w-4 h-4 text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-slate-900 truncate">{ont.name}</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 font-bold shrink-0">
            v{ont.version_tag}
          </span>
          {ont.domain && (
            <span className="text-[10px] text-slate-500 truncate hidden md:inline">· {ont.domain}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">
          {ont.description || "Canonical enterprise business model."}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-3 shrink-0 text-[10px] text-slate-500 font-mono">
        <span title="Entities"><span className="font-bold text-slate-800">{ont.entities?.length || 0}</span> ent</span>
        <span title="Relationships"><span className="font-bold text-slate-800">{ont.relationships?.length || 0}</span> rel</span>
        <span title="Fields"><span className="font-bold text-slate-800">{fieldCount}</span> fld</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => openEditModal(ont, s)}
          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => s.deleteOntology(ont.ontology_version_id)}
          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => s.handleOpenBuilderForOntology(ont)}
          className="ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
        >
          <Network className="w-3 h-3" />
          <span className="hidden sm:inline">Open</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Preview Pane (right side, desktop)
// ─────────────────────────────────────────────────────────────
function PreviewPane({ ont, s }: { ont: any; s: OntologyState }) {
  if (!ont) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
        <Info className="w-5 h-5 mx-auto mb-2 text-slate-300" />
        Hover a card to preview it.
      </div>
    );
  }
  const fieldCount =
    ont.entities?.reduce((a: number, e: any) => a + (e.attributes?.length || 0), 0) || 0;
  const topEntities = (ont.entities || []).slice(0, 6).map((e: any) => e.name);
  const sampleRels = (ont.relationships || []).slice(0, 4);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-white font-bold">
            v{ont.version_tag}
          </span>
          {ont.domain && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Globe2 className="w-3 h-3" /> {ont.domain}
            </span>
          )}
        </div>
        <h3 className="font-bold text-sm mt-1.5 truncate">{ont.name}</h3>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-slate-600 leading-relaxed">
          {ont.description || "Canonical enterprise business model."}
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat icon={Layers} value={ont.entities?.length || 0} label="Entities" />
          <MiniStat icon={Share2} value={ont.relationships?.length || 0} label="Relations" />
          <MiniStat icon={Hash} value={fieldCount} label="Fields" />
        </div>

        {topEntities.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Top Entities
            </span>
            <div className="flex flex-wrap gap-1">
              {topEntities.map((n: string) => (
                <span key={n} className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                  {n}
                </span>
              ))}
              {(ont.entities?.length || 0) > topEntities.length && (
                <span className="text-[10.5px] text-slate-400 px-1">
                  +{(ont.entities?.length || 0) - topEntities.length} more
                </span>
              )}
            </div>
          </div>
        )}

        {sampleRels.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Sample Relationships
            </span>
            <div className="space-y-1">
              {sampleRels.map((r: any) => (
                <div key={r.relationship_id} className="text-[10.5px] text-slate-600 flex items-center gap-1 truncate">
                  <span className="font-mono text-slate-800">{r.source_entity_name}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-semibold text-slate-700">{r.name}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-mono text-slate-800">{r.target_entity_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={() => openEditModal(ont, s)}
            className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-50"
          >
            <Edit2 className="w-3 h-3" /> Edit metadata
          </button>
          <button
            onClick={() => s.handleOpenBuilderForOntology(ont)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
          >
            <ExternalLink className="w-3 h-3" /> Open
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function openEditModal(ont: any, s: OntologyState) {
  s.setEditOntName(ont.name || "");
  s.setEditOntDomain(ont.domain || "");
  s.setEditOntVersion(ont.version_tag || "1.0.0");
  s.setEditOntDesc(ont.description || "");
  s.setEditOntologyModal(true);
  s.setSelectedOntology(ont);
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-slate-50/80 rounded-lg py-1.5 border border-slate-100">
      <span className="block text-xs font-bold font-mono">{value}</span>
      <span className="text-[10px] text-slate-500 uppercase">{label}</span>
    </div>
  );
}

function MiniStat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="bg-slate-50 rounded-lg py-1.5 border border-slate-100">
      <Icon className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
      <span className="block text-xs font-bold font-mono text-slate-800">{value}</span>
      <span className="text-[9px] text-slate-500 uppercase block">{label}</span>
    </div>
  );
}

function PagerBtn({
  children, disabled, onClick, title,
}: {
  children: React.ReactNode; disabled?: boolean; onClick: () => void; title: string;
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
  title, description, action,
}: {
  title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="py-16 px-6 bg-white border border-slate-200 rounded-2xl text-center max-w-lg mx-auto space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
        <Sparkles className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}

function relTime(ts?: number): string | null {
  if (!ts) return null;
  const diffMs = Date.now() - ts * 1000;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}