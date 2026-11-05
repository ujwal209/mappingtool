// src/app/(protected)/table-matching/page.tsx
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Search,
  X,
  Table2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ═════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api/v1";

const PAGE_SIZES = [10, 25, 50, 100] as const;

// ═════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════
interface TablePairLite {
  source_table: string;
  target_table: string;
  matched_concepts?: string[];
}

interface TableMappingSet {
  table_mapping_set_id: string;
  project_id: string;
  name?: string;
  source_system_id: string;
  target_system_id: string;
  version_tag: string;
  status: string;
  content_hash?: string | null;
  pairs?: TablePairLite[];
  created_at: number;
}

// ═════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) h.Authorization = `Bearer ${token}`;
    h["X-Tenant-ID"] = localStorage.getItem("tenant_id") || "tenant-default";
  }
  return h;
}

function resolveProjectId(urlParam: string | null): string {
  if (urlParam && urlParam.trim()) return urlParam.trim();
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("active_project_id");
    if (stored && stored.trim()) return stored.trim();
  }
  return "proj-default";
}

function fmtDate(ts?: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function relTime(ts?: number): string {
  if (!ts) return "—";
  const diffMs = Date.now() - ts * 1000;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(ts);
}

// ═════════════════════════════════════════════════════════════
// Page (default export wrapper)
// ═════════════════════════════════════════════════════════════
export default function TableMatchingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
          <RefreshCw size={16} className="animate-spin text-slate-400" />
        </div>
      }
    >
      <TableMatchingInner />
    </Suspense>
  );
}

// ═════════════════════════════════════════════════════════════
// Inner page
// ═════════════════════════════════════════════════════════════
function TableMatchingInner() {
  const searchParams = useSearchParams();
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [sets, setSets] = useState<TableMappingSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(projectId)}/table-pairs`,
        { headers: authHeaders() }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Load failed (${res.status})`);
      }
      const data = await res.json();
      if (mountedRef.current) {
        setSets(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to load table-pair sets";
      if (mountedRef.current) {
        setError(msg);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [search, pageSize]);

  // ── Delete ───────────────────────────────────────────
  const handleDelete = useCallback(
    (setId: string, setName: string) => {
      toast("Delete this table-pair set?", {
        description: `"${setName}" will be permanently removed. This cannot be undone.`,
        duration: 10000,
        action: {
          label: "Delete",
          onClick: async () => {
            setDeletingId(setId);
            const loadingId = toast.loading(`Deleting "${setName}"…`);
            try {
              const res = await fetch(
                `${API_BASE}/mapping-sets/${encodeURIComponent(
                  projectId
                )}/table-pairs/${encodeURIComponent(setId)}`,
                { method: "DELETE", headers: authHeaders() }
              );
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.detail || `Delete failed (${res.status})`);
              }
              if (mountedRef.current) {
                setSets((prev) =>
                  prev.filter((s) => s.table_mapping_set_id !== setId)
                );
              }
              toast.success("Deleted", {
                description: `"${setName}" removed.`,
                id: loadingId,
              });
            } catch (e: any) {
              toast.error("Delete failed", {
                description: e?.message || "Something went wrong",
                id: loadingId,
              });
            } finally {
              if (mountedRef.current) setDeletingId(null);
            }
          },
        },
        cancel: { label: "Cancel", onClick: () => {} },
      });
    },
    [projectId]
  );

  // ── Filter + paginate ────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter((s) => {
      return (
        (s.name || "").toLowerCase().includes(q) ||
        s.table_mapping_set_id.toLowerCase().includes(q) ||
        s.source_system_id.toLowerCase().includes(q) ||
        s.target_system_id.toLowerCase().includes(q) ||
        (s.pairs || []).some(
          (p) =>
            p.source_table.toLowerCase().includes(q) ||
            p.target_table.toLowerCase().includes(q)
        )
      );
    });
  }, [sets, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const hasFilters = search.trim().length > 0;

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Table matching
              </span>
              {!loading && (
                <span className="text-[10.5px] font-mono text-slate-400">
                  {sets.length} set{sets.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
              Table pair sets
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">
              Curated source → target table mappings. Each set feeds a
              column-level matching pass.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href={`/table-matching/discover?project_id=${encodeURIComponent(
                projectId
              )}`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Discover pairs</span>
            </Link>
          </div>
        </div>

        {/* ── Error banner ──────────────────────────────── */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 px-2 py-0.5 rounded border border-red-200 bg-white text-[11px] font-semibold text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-red-600 hover:text-red-900"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Toolbar ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, id, system, or table…"
              className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline text-[11px] text-slate-500">
              Rows
            </span>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-800 focus:outline-none focus:border-slate-900"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────── */}
        <div ref={scrollRef} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_180px_110px_100px_90px] gap-3 px-5 py-2.5 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Pair set</span>
            <span>Systems</span>
            <span className="text-center">Tables</span>
            <span className="text-center">Version</span>
            <span className="text-right">Actions</span>
          </div>

          {loading && sets.length === 0 ? (
            <div className="divide-y divide-slate-100">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-4">
                  <div className="h-4 w-48 rounded bg-slate-100 animate-pulse mb-2" />
                  <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              projectId={projectId}
              hasSets={sets.length > 0}
              search={search}
              onClear={() => setSearch("")}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((s) => {
                const displayName = s.name || s.table_mapping_set_id;
                const isDeleting = deletingId === s.table_mapping_set_id;
                const pairCount = s.pairs?.length || 0;

                return (
                  <div
                    key={s.table_mapping_set_id}
                    className={`grid grid-cols-1 md:grid-cols-[1fr_180px_110px_100px_90px] gap-2 md:gap-3 items-center px-4 sm:px-5 py-3 transition ${
                      isDeleting
                        ? "opacity-50 pointer-events-none"
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Name + ID */}
                    <div className="min-w-0">
                      <Link
                        href={`/table-matching/${encodeURIComponent(
                          s.table_mapping_set_id
                        )}?project_id=${encodeURIComponent(projectId)}`}
                        className="block group"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[12.5px] font-semibold text-slate-900 truncate group-hover:underline underline-offset-4">
                            {displayName}
                          </span>
                          {s.status && s.status !== "DRAFT" && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {s.status}
                            </span>
                          )}
                        </div>
                        {s.name && s.name !== s.table_mapping_set_id && (
                          <p className="text-[10.5px] text-slate-400 font-mono mt-0.5 truncate">
                            {s.table_mapping_set_id}
                          </p>
                        )}
                      </Link>
                      {/* Mobile-only meta row */}
                      <div className="md:hidden flex items-center gap-3 mt-1.5 text-[10.5px] text-slate-500 font-mono">
                        <span className="truncate">
                          {s.source_system_id} → {s.target_system_id}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>{pairCount} tables</span>
                      </div>
                    </div>

                    {/* Systems (desktop) */}
                    <div className="hidden md:flex items-center gap-1 min-w-0 text-[11px] text-slate-600 font-mono">
                      <span className="truncate max-w-[80px]" title={s.source_system_id}>
                        {s.source_system_id}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                      <span className="truncate max-w-[80px]" title={s.target_system_id}>
                        {s.target_system_id}
                      </span>
                    </div>

                    {/* Table count */}
                    <div className="hidden md:block text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-700">
                        <Table2 className="w-3 h-3 text-slate-400" />
                        {pairCount}
                      </span>
                    </div>

                    {/* Version + created */}
                    <div className="hidden md:block text-center">
                      <span className="font-mono text-[10.5px] text-slate-500">
                        v{s.version_tag}
                      </span>
                      <p className="text-[9.5px] text-slate-400 mt-0.5">
                        {relTime(s.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/table-matching/${encodeURIComponent(
                          s.table_mapping_set_id
                        )}?project_id=${encodeURIComponent(projectId)}`}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        title="Open"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(s.table_mapping_set_id, displayName)
                        }
                        disabled={isDeleting}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition"
                        title="Delete"
                        aria-label={`Delete ${displayName}`}
                      >
                        {isDeleting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer / pagination */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-t border-slate-200 bg-slate-50/60">
              <span className="text-[11px] text-slate-500 font-mono">
                {page * pageSize + 1}–
                {Math.min(filtered.length, (page + 1) * pageSize)} of{" "}
                {filtered.length}
                {hasFilters && ` (filtered from ${sets.length})`}
              </span>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPage={setPage}
              />
            </div>
          )}
        </div>

        {/* Empty-set helper */}
        {!loading && sets.length === 0 && !error && (
          <p className="mt-4 text-[11px] text-slate-400 text-center">
            Pair sets define which source tables map to which target tables.
            Run <span className="text-slate-600">Discover pairs</span> to
            generate your first set.
          </p>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Empty state (used when filtered = 0)
// ═════════════════════════════════════════════════════════════
function EmptyState({
  projectId,
  hasSets,
  search,
  onClear,
}: {
  projectId: string;
  hasSets: boolean;
  search: string;
  onClear: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto mb-4">
        <Table2 className="w-5 h-5 text-slate-400" />
      </div>
      <h3 className="text-[14px] font-semibold text-slate-900">
        {hasSets ? "No matching pair sets" : "No table-pair sets yet"}
      </h3>
      <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
        {hasSets
          ? `No sets match "${search}". Try a different term.`
          : "Define which source tables map to which target tables to start column-level matching."}
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        {hasSets ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <X className="w-3.5 h-3.5" />
            Clear search
          </button>
        ) : (
          <Link
            href={`/table-matching/discover?project_id=${encodeURIComponent(
              projectId
            )}`}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Discover pairs
          </Link>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Pagination (compact, plain — matches table-strip styling)
// ═════════════════════════════════════════════════════════════
function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pageNumbers = useMemo(() => {
    const out: (number | "…")[] = [];
    for (let i = 0; i < totalPages; i++) {
      if (
        i === 0 ||
        i === totalPages - 1 ||
        Math.abs(i - page) <= 1
      ) {
        out.push(i);
      } else if (out[out.length - 1] !== "…") {
        out.push("…");
      }
    }
    return out;
  }, [page, totalPages]);

  return (
    <div className="flex items-center gap-0.5">
      <PageBtn
        disabled={page === 0}
        onClick={() => onPage(0)}
        title="First page"
      >
        <ChevronsLeft className="w-3.5 h-3.5" />
      </PageBtn>
      <PageBtn
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        title="Previous page"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </PageBtn>

      {pageNumbers.map((n, i) =>
        n === "…" ? (
          <span
            key={`e-${i}`}
            className="px-1.5 text-[11px] text-slate-400 font-mono"
          >
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            className={`min-w-[24px] h-6 px-1.5 rounded text-[11px] font-mono transition ${
              n === page
                ? "bg-slate-900 text-white font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {n + 1}
          </button>
        )
      )}

      <PageBtn
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
        title="Next page"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </PageBtn>
      <PageBtn
        disabled={page >= totalPages - 1}
        onClick={() => onPage(totalPages - 1)}
        title="Last page"
      >
        <ChevronsRight className="w-3.5 h-3.5" />
      </PageBtn>
    </div>
  );
}

function PageBtn({
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
      className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}