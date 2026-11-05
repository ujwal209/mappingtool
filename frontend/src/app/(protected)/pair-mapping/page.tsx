"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Layers,
  ArrowRight,
  Trash2,
  AlertTriangle,
  X,
  Hash,
  Search,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Filter,
  CircleSlash,
} from "lucide-react";
import { toast } from "sonner";
import {
  pairMappingApi,
  type PairMappingSet,
} from "@/lib/pair-mapping-api";

type SortMode = "updated-desc" | "updated-asc" | "name-asc" | "name-desc" | "pairs-desc" | "pairs-asc";
type StatusFilter = "ALL" | "DRAFT" | "APPROVED";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 200;

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "updated-desc", label: "Newest first" },
  { value: "updated-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "pairs-desc", label: "Most pairs" },
  { value: "pairs-asc", label: "Fewest pairs" },
];

function resolveProjectId(urlParam: string | null): string {
  if (urlParam?.trim()) return urlParam.trim();
  if (typeof window !== "undefined") {
    const s = localStorage.getItem("active_project_id");
    if (s?.trim()) return s.trim();
  }
  return "proj-default";
}

export default function PairMappingListPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const searchParams = useSearchParams();
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [sets, setSets] = useState<PairMappingSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Filters ────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");

  // ── Pagination ─────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  // ── Debounce search ────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(
      () => setSearchQuery(searchInput.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page on filter/sort/size change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, statusFilter, sortMode, pageSize]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await pairMappingApi.list(projectId);
      setSets(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load pair mapping sets");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Filter + sort ──────────────────────────────────────
  const filtered = useMemo(() => {
    let list = sets;

    if (statusFilter !== "ALL") {
      list = list.filter((s) => s.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => {
        const name = (s.name || "").toLowerCase();
        const setIdStr = s.set_id.toLowerCase();
        const sys = `${s.source_system_id || ""} ${s.target_system_id || ""}`.toLowerCase();
        const pairTables = s.pairs
          .map((p) => `${p.source_table} ${p.target_table}`)
          .join(" ")
          .toLowerCase();
        return (
          name.includes(q) ||
          setIdStr.includes(q) ||
          sys.includes(q) ||
          pairTables.includes(q)
        );
      });
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case "name-asc":
          return (a.name || a.set_id).localeCompare(b.name || b.set_id);
        case "name-desc":
          return (b.name || b.set_id).localeCompare(a.name || a.set_id);
        case "pairs-desc":
          return b.pairs.length - a.pairs.length;
        case "pairs-asc":
          return a.pairs.length - b.pairs.length;
        case "updated-asc":
          return (a.updated_at || 0) - (b.updated_at || 0);
        case "updated-desc":
        default:
          return (b.updated_at || 0) - (a.updated_at || 0);
      }
    });
    return sorted;
  }, [sets, searchQuery, statusFilter, sortMode]);

  // ── Paginate ───────────────────────────────────────────
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const visible = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasActiveFilters =
    searchQuery.length > 0 || statusFilter !== "ALL";

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("ALL");
  };

  const handleDelete = useCallback(
    (setId: string, name: string) => {
      toast("Delete this mapping set?", {
        description: `"${name}" will be permanently removed.`,
        duration: 10000,
        action: {
          label: "Delete",
          onClick: async () => {
            setDeletingId(setId);
            const lid = toast.loading("Deleting…");
            try {
              await pairMappingApi.delete(setId);
              setSets((prev) => prev.filter((s) => s.set_id !== setId));
              toast.success("Deleted", { id: lid });
            } catch (e: any) {
              toast.error("Delete failed", {
                description: e?.message,
                id: lid,
              });
            } finally {
              setDeletingId(null);
            }
          },
        },
        cancel: { label: "Cancel", onClick: () => {} },
      });
    },
    []
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Pair mapping
              </span>
              {!loading && (
                <span className="text-[10.5px] font-mono text-slate-400">
                  {sets.length} set{sets.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
              Column mappings
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">
              Every set carries all pairs from a table-matching set, with
              per-pair AI and review.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href={`/pair-mapping/new?project_id=${encodeURIComponent(
                projectId
              )}`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New set</span>
            </Link>
          </div>
        </div>

        {/* ── Toolbar: search + filters ─────────────────── */}
        {!loading && sets.length > 0 && (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, ID, system, or table…"
                className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="relative shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-9 text-[12px] pl-8 pr-6 border border-slate-200 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:border-slate-900"
              >
                <option value="ALL">All status</option>
                <option value="DRAFT">Draft</option>
                <option value="APPROVED">Approved</option>
              </select>
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-9 text-[12px] pl-8 pr-6 border border-slate-200 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:border-slate-900"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11.5px] font-medium hover:bg-slate-50"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        )}

        {/* ── Result count ──────────────────────────────── */}
        {!loading && sets.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3">
            <span className="font-mono font-bold text-slate-700">
              {total}
            </span>
            <span>{total === 1 ? "match" : "matches"}</span>
            {hasActiveFilters && (
              <>
                <span className="text-slate-300">·</span>
                <span>from {sets.length}</span>
              </>
            )}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────── */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 px-2 py-0.5 rounded border border-red-200 bg-white text-[11px] font-semibold"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── List ──────────────────────────────────────── */}
        {loading && sets.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="px-5 py-4 border-b border-slate-100 last:border-b-0"
              >
                <div className="h-4 w-48 rounded bg-slate-100 animate-pulse mb-2" />
                <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : sets.length === 0 ? (
          <EmptyState projectId={projectId} />
        ) : total === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <CircleSlash className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              No sets match your filters
            </p>
            <p className="text-xs text-slate-500">
              Try a different search or clear your filters.
            </p>
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-900 underline hover:no-underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
              {visible.map((s) => {
                const matchedCount = s.pairs.reduce(
                  (acc, p) =>
                    acc +
                    p.columns.filter((c) => c.matched_source_column).length,
                  0
                );
                const displayName =
                  s.name ||
                  `${s.pairs.length} pair${s.pairs.length === 1 ? "" : "s"}`;
                const tone =
                  s.status === "APPROVED"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200";
                const isDeleting = deletingId === s.set_id;

                return (
                  <div
                    key={s.set_id}
                    className={`flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50/60 transition ${
                      isDeleting ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/pair-mapping/${encodeURIComponent(
                          s.set_id
                        )}?project_id=${encodeURIComponent(projectId)}`}
                        className="block group"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[12.5px] font-semibold text-slate-900 truncate group-hover:underline underline-offset-4">
                            {displayName}
                          </span>
                          <span
                            className={`inline-flex items-center justify-center text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${tone}`}
                          >
                            {s.status}
                          </span>
                          {s.content_hash && (
                            <span
                              className="text-[9px] font-mono text-slate-400 border border-slate-200 rounded px-1 py-0.5"
                              title={s.content_hash}
                            >
                              <Hash className="w-2.5 h-2.5 inline" />{" "}
                              {s.content_hash.slice(0, 6)}…
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-500 font-mono mt-0.5 truncate">
                          {s.set_id} · v{s.version_tag} · {s.pairs.length} pair
                          {s.pairs.length === 1 ? "" : "s"} · {matchedCount}{" "}
                          columns matched
                        </p>
                      </Link>
                    </div>

                    {/* Action icons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/pair-mapping/${encodeURIComponent(
                          s.set_id
                        )}/edit?project_id=${encodeURIComponent(projectId)}`}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit metadata"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.set_id, displayName)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                        title="Delete"
                      >
                        {isDeleting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <Link
                        href={`/pair-mapping/${encodeURIComponent(
                          s.set_id
                        )}?project_id=${encodeURIComponent(projectId)}`}
                        className="ml-1 inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
                      >
                        Open
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Pagination ────────────────────────────── */}
            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-900"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500 font-mono text-[11px]">
                  {page * pageSize + 1}–
                  {Math.min(total, (page + 1) * pageSize)} of{" "}
                  {total.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <PagerBtn
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                  title="First page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </PagerBtn>
                <PagerBtn
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  title="Previous"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </PagerBtn>
                <span className="px-3 text-xs font-semibold text-slate-700 font-mono min-w-[70px] text-center">
                  {page + 1} / {totalPages}
                </span>
                <PagerBtn
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  title="Next"
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
          </>
        )}
      </div>
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
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
      <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto mb-4">
        <Layers className="w-5 h-5 text-slate-400" />
      </div>
      <h3 className="text-[14px] font-semibold text-slate-900">
        No mapping sets yet
      </h3>
      <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
        Start from a table-matching set — every pair in it becomes a
        sub-section in the workbench.
      </p>
      <Link
        href={`/pair-mapping/new?project_id=${encodeURIComponent(projectId)}`}
        className="mt-4 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
      >
        <Plus className="w-3.5 h-3.5" />
        Create from table set
      </Link>
    </div>
  );
}