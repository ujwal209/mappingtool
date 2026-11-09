"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { connectorsApi, SystemItem } from "@/lib/connectors-api";
import { useProject } from "@/context/ProjectContext";
import { TechIcon } from "@/components/tech-icons";
import { ProjectGuard } from "@/components/ProjectGuard";
import {
  Plus,
  RefreshCw,
  Search,
  X,
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Server,
  Loader2,
  AlertCircle,
  Pencil,
  Eye,
  ArrowRight,
  Layers,
  CircleSlash,
  Calendar,
  Box,
} from "lucide-react";

type SortMode = "name-asc" | "name-desc" | "created-desc" | "created-asc";
type KindFilter = "ALL" | "SOURCE" | "TARGET" | "INTERMEDIATE";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 200;
const LOAD_TIMEOUT_MS = 20_000;

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "created-desc", label: "Newest first" },
  { value: "created-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
];

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: "ALL", label: "All kinds" },
  { value: "SOURCE", label: "Sources" },
  { value: "TARGET", label: "Targets" },
  { value: "INTERMEDIATE", label: "Intermediate" },
];

export default function ConnectorsListPage() {
  return (
    <ProjectGuard featureName="Connectors">
      <ConnectorsListView />
    </ProjectGuard>
  );
}

function ConnectorsListView() {
  const router = useRouter();
  const { activeProjectId, isLoadingProjects } = useProject();

  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [connectorFilter, setConnectorFilter] = useState<string>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("created-desc");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (isLoadingProjects) return;

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    const watchdog = setTimeout(() => {
      if (!mountedRef.current) return;
      if (seq !== requestSeqRef.current) return;
      console.warn("[connectors] fetch exceeded 20s — forcing loading off");
      setLoading(false);
      setError(
        "Request timed out after 20s. The backend may be unreachable — " +
          "check backend connectivity and hit Refresh.",
      );
    }, LOAD_TIMEOUT_MS);

    try {
      console.log(
        `[connectors] loading (project=${activeProjectId || "all"}, seq=${seq})`,
      );
      const list = await connectorsApi.listSystems(activeProjectId || undefined);
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      console.log(`[connectors] loaded ${list.length} item(s)`);
      setSystems(list);
      setLoading(false);
    } catch (e: any) {
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      console.error("[connectors] load failed:", e);
      setError(e?.message || "Failed to load connectors");
      setSystems([]);
      setLoading(false);
    } finally {
      clearTimeout(watchdog);
    }
  }, [activeProjectId, isLoadingProjects]);

  useEffect(() => {
    if (isLoadingProjects) return;
    load();
  }, [load, isLoadingProjects]);

  useEffect(() => {
    const t = setTimeout(
      () => setSearchQuery(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [searchQuery, kindFilter, connectorFilter, sortMode, pageSize]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const connectorTypes = useMemo(() => {
    const set = new Set<string>();
    systems.forEach((s) =>
      set.add(s.connector_type || s.adapter_type || "unknown"),
    );
    return Array.from(set).sort();
  }, [systems]);

  const filtered = useMemo(() => {
    let list = systems;

    if (kindFilter !== "ALL") {
      list = list.filter((s) => (s.kind || "").toUpperCase() === kindFilter);
    }
    if (connectorFilter !== "ALL") {
      list = list.filter(
        (s) => (s.connector_type || s.adapter_type) === connectorFilter,
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.purpose || "").toLowerCase().includes(q) ||
          (s.connector_type || "").toLowerCase().includes(q) ||
          (s.environment || "").toLowerCase().includes(q) ||
          (s.system_id || "").toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      const an = (a.name || "").toLowerCase();
      const bn = (b.name || "").toLowerCase();
      const ac = a.created_at || 0;
      const bc = b.created_at || 0;
      switch (sortMode) {
        case "name-asc":
          return an.localeCompare(bn);
        case "name-desc":
          return bn.localeCompare(an);
        case "created-asc":
          return ac - bc;
        case "created-desc":
        default:
          return bc - ac;
      }
    });
    return sorted;
  }, [systems, kindFilter, connectorFilter, searchQuery, sortMode]);

  const totalCount = systems.length;
  const matchCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(matchCount / pageSize));
  const visible = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const hasFilters =
    searchQuery.length > 0 ||
    kindFilter !== "ALL" ||
    connectorFilter !== "ALL";

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setKindFilter("ALL");
    setConnectorFilter("ALL");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
      {/* ── Sticky header ─────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-3">
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Data Connectivity
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {totalCount.toLocaleString()} connector
                  {totalCount === 1 ? "" : "s"}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-slate-900">
                Connections
              </h1>
              <p className="text-[11px] sm:text-sm text-slate-500 mt-0.5 max-w-2xl">
                Source and target systems registered in this project.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={load}
                disabled={loading || isLoadingProjects}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <Link
                href="/connectors/new"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New connection</span>
                <span className="sm:hidden">New</span>
              </Link>
            </div>
          </div>

          {/* Search — full width, always first */}
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, purpose, type, or ID…"
              className="w-full text-xs pl-8 pr-8 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-700 rounded"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters — 2 columns on mobile, row on desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as KindFilter)}
                className="w-full text-xs pl-8 pr-6 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-auto">
              <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <select
                value={connectorFilter}
                onChange={(e) => setConnectorFilter(e.target.value)}
                className="w-full text-xs pl-8 pr-6 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900 sm:max-w-[180px]"
              >
                <option value="ALL">All types</option>
                {connectorTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-auto col-span-2 sm:col-span-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="w-full text-xs pl-8 pr-6 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900 sm:max-w-[180px]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="col-span-2 sm:col-span-1 shrink-0 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>

          {totalCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-mono font-bold text-slate-700">
                {matchCount.toLocaleString()}
              </span>
              <span>{matchCount === 1 ? "match" : "matches"}</span>
              {hasFilters && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>from {totalCount.toLocaleString()}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────── */}
      {error && (
        <div className="shrink-0 px-3 sm:px-6 py-2 bg-red-50 border-b border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-all flex-1">{error}</span>
          <button
            onClick={load}
            disabled={loading}
            className="shrink-0 px-2 py-0.5 rounded border border-red-200 bg-white text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Retry
          </button>
          <button onClick={() => setError(null)} className="shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          {isLoadingProjects || loading ? (
            <div className="py-20 text-center text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading connectors…</p>
            </div>
          ) : totalCount === 0 ? (
            <EmptyState onCreate={() => router.push("/connectors/new")} />
          ) : matchCount === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <CircleSlash className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-900">
                No connectors match
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
              {/* ── Mobile cards (below sm) ────────────── */}
              <div className="sm:hidden space-y-2.5">
                {visible.map((s) => (
                  <MobileCard key={s.system_id} system={s} />
                ))}
              </div>

              {/* ── Tablet + desktop table (>= sm) ─────── */}
              <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs table-fixed">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10"></th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3 w-24 hidden lg:table-cell">
                        Type
                      </th>
                      <th className="py-2.5 px-3 w-24">Kind</th>
                      <th className="py-2.5 px-3 w-28 hidden lg:table-cell">
                        Env
                      </th>
                      <th className="py-2.5 px-3 hidden xl:table-cell">
                        Purpose
                      </th>
                      <th className="py-2.5 px-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((s) => (
                      <ConnectorRow key={s.system_id} system={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Pagination footer ─────────────────────────── */}
      {matchCount > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 flex-wrap">
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
              <span className="font-mono text-[11px] text-slate-500">
                {page * pageSize + 1}–
                {Math.min(matchCount, (page + 1) * pageSize)} of{" "}
                {matchCount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
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
              <span className="px-2 text-xs font-semibold text-slate-700 font-mono min-w-[56px] text-center">
                {page + 1} / {totalPages}
              </span>
              <PagerBtn
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Mobile card
// ═══════════════════════════════════════════════════════════════
function MobileCard({ system }: { system: SystemItem }) {
  const kindUpper = (system.kind || "").toUpperCase();
  const kindStyles =
    kindUpper === "SOURCE"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : kindUpper === "TARGET"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      {/* Header row */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
          <TechIcon
            type={system.connector_type || system.adapter_type}
            className="w-4 h-4"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/connectors/${system.system_id}`}
            className="font-semibold text-sm text-slate-900 hover:text-slate-950 block truncate leading-tight"
            title={system.name}
          >
            {system.name}
          </Link>
          <span className="font-mono text-[10px] text-slate-400 block truncate">
            {system.system_id}
          </span>
        </div>
        <span
          className={`inline-flex text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${kindStyles}`}
        >
          {kindUpper || "—"}
        </span>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2.5">
        <div className="flex items-center gap-1 text-slate-500 truncate">
          <Box className="w-3 h-3 shrink-0" />
          <span className="font-mono text-slate-700 truncate">
            {system.connector_type || system.adapter_type || "—"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 truncate">
          <Calendar className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {system.environment || "Production"}
          </span>
        </div>
      </div>

      {system.purpose && (
        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2 mb-2.5">
          {system.purpose}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
        <Link
          href={`/connectors/${system.system_id}`}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
        >
          <Eye className="w-3 h-3" />
          View
        </Link>
        <Link
          href={`/connectors/${system.system_id}/edit`}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Table row
// ═══════════════════════════════════════════════════════════════
function ConnectorRow({ system }: { system: SystemItem }) {
  const kindUpper = (system.kind || "").toUpperCase();
  const kindStyles =
    kindUpper === "SOURCE"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : kindUpper === "TARGET"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="py-2.5 px-3">
        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
          <TechIcon
            type={system.connector_type || system.adapter_type}
            className="w-4 h-4"
          />
        </div>
      </td>
      <td className="py-2.5 px-3 min-w-0">
        <Link
          href={`/connectors/${system.system_id}`}
          className="font-semibold text-slate-900 hover:text-slate-950 block truncate"
          title={system.name}
        >
          {system.name}
        </Link>
        <span className="font-mono text-[10px] text-slate-400 block truncate">
          {system.system_id}
        </span>
      </td>
      <td className="py-2.5 px-3 hidden lg:table-cell">
        <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 truncate inline-block max-w-full">
          {system.connector_type || system.adapter_type || "—"}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span
          className={`inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${kindStyles}`}
        >
          {kindUpper || "—"}
        </span>
      </td>
      <td className="py-2.5 px-3 hidden lg:table-cell text-slate-600 text-[11.5px]">
        {system.environment || "Production"}
      </td>
      <td className="py-2.5 px-3 hidden xl:table-cell text-slate-500 max-w-[260px] truncate">
        {system.purpose || "—"}
      </td>
      <td className="py-2.5 px-3 text-right">
        <div className="inline-flex items-center gap-1">
          <Link
            href={`/connectors/${system.system_id}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            title="View connector"
          >
            <Eye className="w-3 h-3" />
            <span className="hidden lg:inline">View</span>
          </Link>
          <Link
            href={`/connectors/${system.system_id}/edit`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            title="Edit connector"
          >
            <Pencil className="w-3 h-3" />
            <span className="hidden lg:inline">Edit</span>
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════
// Empty
// ═══════════════════════════════════════════════════════════════
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="py-16 px-4 text-center max-w-md mx-auto space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-sm">
        <Server className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          No connectors yet
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Register a source or target system to begin building migration
          pipelines.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
      >
        <Plus className="w-3.5 h-3.5" />
        Create your first connection
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
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
      className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}