"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleSlash,
  Clock,
  Filter,
  Inbox,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { migrationsApi, type MigrationRun } from "@/lib/migrations-api";
import { CustomFilterDropdown } from "@/components/pair-mapping/CustomFilterDropdown";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function resolveProjectId(p: string | null): string {
  if (p?.trim()) return p.trim();
  if (typeof window !== "undefined") {
    const s = localStorage.getItem("active_project_id");
    if (s?.trim()) return s.trim();
  }
  return "proj-default";
}

interface StatusInfo {
  label: string;
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
  spin?: boolean;
  action?: "review" | "signoff";
}

function statusOf(state: string): StatusInfo {
  switch (state) {
    case "AWAITING_LOAD_REVIEW":
      return {
        label: "Awaiting approval",
        tone: "bg-amber-50 text-amber-900 border-amber-300",
        icon: AlertTriangle,
        action: "review",
      };
    case "COMPLETED":
      return {
        label: "Ready to sign off",
        tone: "bg-emerald-50 text-emerald-900 border-emerald-300",
        icon: CheckCircle2,
        action: "signoff",
      };
    case "SIGNED_OFF":
      return {
        label: "Done",
        tone: "bg-emerald-600 text-white border-emerald-600",
        icon: CheckCircle2,
      };
    case "FAILED":
      return {
        label: "Failed",
        tone: "bg-red-50 text-red-900 border-red-300",
        icon: XCircle,
      };
    case "ABORTED":
      return {
        label: "Cancelled",
        tone: "bg-slate-100 text-slate-700 border-slate-300",
        icon: XCircle,
      };
    case "EXCEPTION_REVIEW":
      return {
        label: "Needs review",
        tone: "bg-orange-50 text-orange-900 border-orange-300",
        icon: AlertTriangle,
      };
    case "QUEUED":
    case "RUNNING":
    case "LOADING":
    case "EXTRACTING":
    case "TRANSFORMING":
    case "VALIDATING":
    case "RECONCILING":
      return {
        label: "Running",
        tone: "bg-blue-50 text-blue-900 border-blue-300",
        icon: LoaderCircle,
        spin: true,
      };
    default:
      return {
        label: state,
        tone: "bg-slate-100 text-slate-700 border-slate-300",
        icon: Clock,
      };
  }
}

function isActive(state: string): boolean {
  return [
    "QUEUED",
    "RUNNING",
    "LOADING",
    "EXTRACTING",
    "TRANSFORMING",
    "VALIDATING",
    "RECONCILING",
  ].includes(state);
}

function relTime(ts?: number | null): string {
  if (!ts) return "—";
  const diffMs = Date.now() - ts * 1000;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Best-effort display title for a run. */
function displayName(run: MigrationRun): string {
  const n = (run.name || "").trim();
  if (n) return n;
  // Backend backfill should always populate this — but be defensive.
  return run.run_id;
}

// ─────────────────────────────────────────────────────────────
// Filter / sort types
// ─────────────────────────────────────────────────────────────
type StateFilter =
  | "ALL"
  | "AWAITING_LOAD_REVIEW"
  | "COMPLETED"
  | "SIGNED_OFF"
  | "EXCEPTION_REVIEW"
  | "FAILED"
  | "ABORTED"
  | "RUNNING";

type ReviewFilter = "ALL" | "STANDARD" | "STRICT";
type SortMode = "created-desc" | "created-asc" | "rows-desc" | "name-asc";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 180;

const STATE_OPTIONS = [
  { value: "ALL", label: "All states" },
  { value: "AWAITING_LOAD_REVIEW", label: "Awaiting approval" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Ready to sign off" },
  { value: "SIGNED_OFF", label: "Signed off" },
  { value: "EXCEPTION_REVIEW", label: "Exception review" },
  { value: "FAILED", label: "Failed" },
  { value: "ABORTED", label: "Cancelled" },
];

const REVIEW_OPTIONS = [
  { value: "ALL", label: "Any review mode" },
  { value: "STANDARD", label: "Standard" },
  { value: "STRICT", label: "Strict" },
];

const SORT_OPTIONS = [
  { value: "created-desc", label: "Newest first" },
  { value: "created-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "rows-desc", label: "Most rows loaded" },
];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function MigrationsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const searchParams = useSearchParams();
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [runs, setRuns] = useState<MigrationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (state)
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("created-desc");

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  // ─── Load ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await migrationsApi.list({ project_id: projectId });
      setRuns(list);
    } catch (e: any) {
      setError(e?.message || "Could not load migrations");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while any run is in flight
  useEffect(() => {
    const anyRunning = runs.some((r) => isActive(r.state));
    if (!anyRunning) return;
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [runs, load]);

  // ─── Debounce search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(
      () => setSearchQuery(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, stateFilter, reviewFilter, sortMode, pageSize]);

  // ─── Filter + sort ─────────────────────────────────────
  const filtered = useMemo(() => {
    let list = runs;

    if (stateFilter !== "ALL") {
      if (stateFilter === "RUNNING") {
        list = list.filter((r) => isActive(r.state));
      } else {
        list = list.filter((r) => r.state === stateFilter);
      }
    }

    if (reviewFilter !== "ALL") {
      list = list.filter(
        (r) => ((r as any).review_mode || "").toUpperCase() === reviewFilter,
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const runId = (r.run_id || "").toLowerCase();
        const manifestId = (r.manifest_id || "").toLowerCase();
        const error = ((r as any).error || "").toLowerCase();
        const name = (displayName(r) || "").toLowerCase();
        const desc = ((r as any).description || "").toLowerCase();
        return (
          runId.includes(q) ||
          manifestId.includes(q) ||
          error.includes(q) ||
          name.includes(q) ||
          desc.includes(q)
        );
      });
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      const aC = a.created_at || 0;
      const bC = b.created_at || 0;
      const aR = (a as any).rows_loaded || 0;
      const bR = (b as any).rows_loaded || 0;
      const aN = (displayName(a) || "").toLowerCase();
      const bN = (displayName(b) || "").toLowerCase();
      switch (sortMode) {
        case "created-asc":
          return aC - bC;
        case "rows-desc":
          return bR - aR;
        case "name-asc":
          return aN.localeCompare(bN);
        case "created-desc":
        default:
          return bC - aC;
      }
    });
    return sorted;
  }, [runs, searchQuery, stateFilter, reviewFilter, sortMode]);

  // ─── Paginate ──────────────────────────────────────────
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const visible = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const activeCount = runs.filter((r) => isActive(r.state)).length;
  const reviewCount = runs.filter((r) => r.state === "AWAITING_LOAD_REVIEW")
    .length;

  const hasFilters =
    searchQuery.length > 0 ||
    stateFilter !== "ALL" ||
    reviewFilter !== "ALL" ||
    sortMode !== "created-desc";

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStateFilter("ALL");
    setReviewFilter("ALL");
    setSortMode("created-desc");
  };

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Migrations
              </span>
              {!loading && (
                <span className="text-[10.5px] font-mono text-slate-400">
                  {runs.length} run{runs.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
              Migration runs
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">
              Every run pins the exact mapping and rule versions used to
              move data.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href={`/migrations/new?project_id=${encodeURIComponent(
                projectId,
              )}`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              New migration
            </Link>
          </div>
        </div>

        {/* Alerts row */}
        {(activeCount > 0 || reviewCount > 0) && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                <LoaderCircle className="w-3 h-3 animate-spin" />
                {activeCount} running
              </span>
            )}
            {reviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                {reviewCount} awaiting your approval
              </span>
            )}
          </div>
        )}

        {/* Search + filters */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
          <div className="p-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, run id, manifest id, or error…"
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

            <CustomFilterDropdown
              value={stateFilter}
              onChange={(v) => setStateFilter(v as StateFilter)}
              options={STATE_OPTIONS}
              icon={<Filter className="w-3 h-3" />}
              title="Filter by state"
              placeholder="All states"
              searchable={false}
              minWidth={190}
              ariaLabel="Filter by state"
            />

            <CustomFilterDropdown
              value={reviewFilter}
              onChange={(v) => setReviewFilter(v as ReviewFilter)}
              options={REVIEW_OPTIONS}
              icon={<Filter className="w-3 h-3" />}
              title="Filter by review mode"
              placeholder="Any review mode"
              searchable={false}
              minWidth={170}
              ariaLabel="Filter by review mode"
            />

            <CustomFilterDropdown
              value={sortMode}
              onChange={(v) => setSortMode(v as SortMode)}
              options={SORT_OPTIONS}
              icon={<ArrowUpDown className="w-3 h-3" />}
              title="Sort"
              placeholder="Sort"
              searchable={false}
              minWidth={170}
              ariaLabel="Sort runs"
            />

            {hasFilters && (
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

          {!loading && runs.length > 0 && (
            <div className="px-3 pb-2 flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
              <span className="font-mono font-bold text-slate-700">
                {total.toLocaleString()}
              </span>
              <span>{total === 1 ? "match" : "matches"}</span>
              {hasFilters && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>from {runs.length.toLocaleString()}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => void load()}
              className="shrink-0 px-2 py-0.5 rounded border border-red-200 bg-white text-[11px] font-semibold"
            >
              Retry
            </button>
            <button onClick={() => setError(null)} className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* List */}
        {loading && runs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="px-5 py-4 border-b border-slate-100 last:border-b-0"
              >
                <div className="h-4 w-48 rounded bg-slate-100 animate-pulse mb-2" />
                <div className="h-3 w-64 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <EmptyState projectId={projectId} />
        ) : total === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <CircleSlash className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              No runs match your filters
            </p>
            <p className="text-xs text-slate-500">
              Try a different search term or clear your filters.
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
            <div className="space-y-2.5">
              {visible.map((run) => (
                <RunRow
                  key={run.run_id}
                  run={run}
                  projectId={projectId}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Per page:</span>
                <CustomFilterDropdown
                  value={String(pageSize)}
                  onChange={(v) => setPageSize(Number(v))}
                  options={PAGE_SIZES.map((n) => ({
                    value: String(n),
                    label: String(n),
                  }))}
                  searchable={false}
                  minWidth={90}
                  title="Page size"
                  placeholder="25"
                  ariaLabel="Rows per page"
                />
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
                  title="Previous page"
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
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────
function RunRow({
  run,
  projectId,
}: {
  run: MigrationRun;
  projectId: string;
}) {
  const info = statusOf(run.state);
  const Icon = info.icon;
  const pct =
    run.tables_total > 0
      ? Math.round((run.tables_completed / run.tables_total) * 100)
      : 0;
  const active = isActive(run.state);
  const title = displayName(run);
  const version = (run.version_tag || "").trim() || "1.0.0";
  const description = ((run as any).description || "").trim();

  return (
    <Link
      href={`/migrations/${run.run_id}?project_id=${encodeURIComponent(
        projectId,
      )}`}
      className={`block rounded-xl border bg-white hover:shadow-md transition-shadow ${
        info.action === "review"
          ? "border-amber-300"
          : info.action === "signoff"
          ? "border-emerald-300"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="px-4 sm:px-5 py-4">
        {/* Title row: name + version chip + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-sm font-semibold text-slate-900 truncate max-w-[60vw] sm:max-w-[420px]"
                title={title}
              >
                {title}
              </span>
              <span className="inline-flex items-center text-[9.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 shrink-0">
                v{version}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${info.tone}`}
              >
                <Icon
                  className={`w-3 h-3 ${info.spin ? "animate-spin" : ""}`}
                />
                {info.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-1 truncate">
              {run.run_id} · manifest {run.manifest_id || "—"}
            </p>
            {description && (
              <p
                className="text-[11.5px] text-slate-500 mt-0.5 truncate"
                title={description}
              >
                {description}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Started {relTime(run.created_at)}
              {run.completed_at && ` · Finished ${relTime(run.completed_at)}`}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider block">
              Tables
            </span>
            <span className="text-slate-900 font-medium">
              {run.tables_completed} / {run.tables_total}
            </span>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider block">
              Rows moved
            </span>
            <span className="text-slate-900 font-medium font-mono">
              {run.rows_loaded.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider block">
              Phase
            </span>
            <span className="text-slate-900 font-medium capitalize">
              {active
                ? run.phase.replace(/_/g, " ").toLowerCase()
                : info.label.toLowerCase()}
            </span>
          </div>
        </div>

        {active && (
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-900 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {run.error && (
          <p className="mt-2 text-xs text-red-700 truncate">{run.error}</p>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Inbox className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        No migrations yet
      </h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
        Copy data from a source system into a destination using one of your
        approved mappings.
      </p>
      <Link
        href={`/migrations/new?project_id=${encodeURIComponent(projectId)}`}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
      >
        <Plus className="w-4 h-4" />
        Start your first migration
      </Link>
    </div>
  );
}