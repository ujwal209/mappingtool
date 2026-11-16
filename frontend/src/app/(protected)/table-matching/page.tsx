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
import { useRouter, useSearchParams } from "next/navigation";
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
import { API_V1 } from "@/lib/api-config";

const API_BASE = API_V1;
const PAGE_SIZES = [10, 25, 50, 100] as const;

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

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("auth_token") || localStorage.getItem("token");
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

export default function TableMatchingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-white flex items-center justify-center">
          <RefreshCw size={16} className="animate-spin text-slate-400" />
        </div>
      }
    >
      <TableMatchingInner />
    </Suspense>
  );
}

function TableMatchingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [sets, setSets] = useState<TableMappingSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
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
  }, [search, statusFilter, pageSize]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, setId: string, setName: string) => {
      e.stopPropagation();
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

  const statuses = useMemo(() => {
    const s = new Set<string>();
    sets.forEach((item) => {
      if (item.status) s.add(item.status.toUpperCase());
    });
    return Array.from(s).sort();
  }, [sets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sets.filter((s) => {
      if (
        statusFilter !== "ALL" &&
        (s.status || "DRAFT").toUpperCase() !== statusFilter
      ) {
        return false;
      }
      if (!q) return true;
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
  }, [sets, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const hasFilters = search.trim().length > 0 || statusFilter !== "ALL";

  const openSet = (setId: string) => {
    router.push(
      `/table-matching/${encodeURIComponent(
        setId
      )}?project_id=${encodeURIComponent(projectId)}`
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Table matching
              </span>
              {!loading && (
                <span className="text-[11px] font-mono text-slate-400">
                  · {sets.length} set{sets.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
              Table pair sets
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Curated source-to-target table alignments. Each set feeds
              column-level schema mapping and transformation generation.
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
              <span>Refresh</span>
            </button>
            <Link
              href={`/table-matching/discover?project_id=${encodeURIComponent(
                projectId
              )}`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#432DD7] text-white text-[12px] font-medium hover:bg-[#3724B5] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Discover pairs</span>
            </Link>
          </div>
        </div>

        {/* ── Error banner ──────────────────────────────── */}
        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-[12px] text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="flex-1 break-words leading-relaxed">{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 px-2 py-0.5 rounded border border-rose-200 bg-white text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-rose-500 hover:text-rose-900"
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
              placeholder="Search by set name, ID, system, or table name…"
              className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] transition"
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

          <div className="flex items-center gap-2 shrink-0">
            {statuses.length > 0 && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-800 focus:outline-none focus:border-[#432DD7]"
              >
                <option value="ALL">All statuses</option>
                {statuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline text-[11px] text-slate-500">
                Rows
              </span>
              <select
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
                className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-800 focus:outline-none focus:border-[#432DD7]"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_210px_100px_110px_84px] gap-3 px-5 py-2.5 border-b border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
              hasFilters={hasFilters}
              search={search}
              onClear={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((s) => {
                const displayName = s.name || s.table_mapping_set_id;
                const isDeleting = deletingId === s.table_mapping_set_id;
                const pairCount = s.pairs?.length || 0;
                const statusUpper = (s.status || "DRAFT").toUpperCase();

                return (
                  <div
                    key={s.table_mapping_set_id}
                    onClick={() => openSet(s.table_mapping_set_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSet(s.table_mapping_set_id);
                      }
                    }}
                    className={`group grid grid-cols-1 md:grid-cols-[1fr_210px_100px_110px_84px] gap-2 md:gap-3 items-start md:items-center px-4 sm:px-5 py-3.5 cursor-pointer transition ${
                      isDeleting
                        ? "opacity-50 pointer-events-none"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    {/* Name + ID */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-slate-900 break-words group-hover:text-[#432DD7] transition-colors">
                          {displayName}
                        </span>
                        <span
                          className={`text-[9.5px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                            statusUpper === "APPROVED"
                              ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          {statusUpper}
                        </span>
                      </div>
                      {s.name && s.name !== s.table_mapping_set_id && (
                        <p className="text-[10.5px] text-slate-400 font-mono mt-0.5 break-all">
                          {s.table_mapping_set_id}
                        </p>
                      )}

                      {/* Mobile-only meta row */}
                      <div className="md:hidden flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-[11px] text-slate-500 font-mono">
                        <span className="break-all">
                          {s.source_system_id} → {s.target_system_id}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>
                          {pairCount} {pairCount === 1 ? "table" : "tables"}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>v{s.version_tag}</span>
                      </div>
                    </div>

                    {/* Systems (desktop) */}
                    <div className="hidden md:flex items-center gap-1.5 min-w-0 text-[11px] text-slate-600 font-mono">
                      <span className="break-all">{s.source_system_id}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                      <span className="break-all">{s.target_system_id}</span>
                    </div>

                    {/* Table count */}
                    <div className="hidden md:flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-mono text-slate-700">
                        <Table2 className="w-3.5 h-3.5 text-slate-400" />
                        {pairCount}
                      </span>
                    </div>

                    {/* Version + created */}
                    <div className="hidden md:block text-center">
                      <span className="font-mono text-[11px] font-medium text-slate-700">
                        v{s.version_tag}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {relTime(s.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex items-center justify-end gap-1 pt-1 md:pt-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/table-matching/${encodeURIComponent(
                          s.table_mapping_set_id
                        )}?project_id=${encodeURIComponent(projectId)}`}
                        className="p-1.5 rounded-md text-slate-500 hover:text-[#432DD7] hover:bg-slate-100 transition"
                        title="Open pair set"
                        aria-label={`Open ${displayName}`}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={(e) =>
                          handleDelete(e, s.table_mapping_set_id, displayName)
                        }
                        disabled={isDeleting}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition"
                        title="Delete pair set"
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-t border-slate-200 bg-white">
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
          <p className="mt-4 text-[11.5px] text-slate-400 text-center">
            Pair sets define which source tables map to which target tables.
            Run{" "}
            <span className="font-medium text-slate-600">Discover pairs</span>{" "}
            to generate your first set.
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  projectId,
  hasSets,
  hasFilters,
  search,
  onClear,
}: {
  projectId: string;
  hasSets: boolean;
  hasFilters: boolean;
  search: string;
  onClear: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-11 h-11 rounded-lg border border-slate-200 bg-white flex items-center justify-center mx-auto mb-4">
        <Table2 className="w-5 h-5 text-slate-400" />
      </div>
      <h3 className="text-[14px] font-semibold text-slate-900">
        {hasSets ? "No matching pair sets" : "No table-pair sets yet"}
      </h3>
      <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
        {hasSets
          ? search
            ? `No sets match "${search}". Try a different term.`
            : "No sets match the selected status filter."
          : "Define which source tables map to which target tables to start column-level matching."}
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        {hasSets || hasFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        ) : (
          <Link
            href={`/table-matching/discover?project_id=${encodeURIComponent(
              projectId
            )}`}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#432DD7] text-white text-[12px] font-medium hover:bg-[#3724B5] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Discover pairs
          </Link>
        )}
      </div>
    </div>
  );
}

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
      if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) {
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
                ? "bg-[#432DD7] text-white font-semibold"
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