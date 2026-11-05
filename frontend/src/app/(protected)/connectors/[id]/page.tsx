"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  connectorsApi,
  DiscoveredColumn,
  ConnectorTestResponse,
} from "@/lib/connectors-api";
import { TechIcon } from "@/components/tech-icons";
import { ProjectGuard } from "@/components/ProjectGuard";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Search,
  ChevronRight,
  Table as TableIcon,
  Key,
  Loader2,
  Database,
  Code2,
  X,
  Layers,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Hash,
  Copy,
} from "lucide-react";

const TABLES_PER_PAGE = 50;
const DATA_PAGE_OPTIONS = [25, 50, 100, 250] as const;
const DATA_PAGE_DEFAULT = 50;
const SEARCH_DEBOUNCE_MS = 200;

type Tab = "schema" | "data" | "raw";

interface TableMeta {
  name: string;
  row_count: number;
  column_count: number;
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function ConnectorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const systemId = (params?.id as string) || "";

  const [systemName, setSystemName] = useState("Connection");
  const [connectorType, setConnectorType] = useState<string>("");
  const [systemKind, setSystemKind] = useState<string>("");
  const [systemPurpose, setSystemPurpose] = useState<string>("");

  // Sidebar (paginated)
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [totalTables, setTotalTables] = useState(0);
  const [tablesPage, setTablesPage] = useState(0); // 0-indexed
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<ConnectorTestResponse | null>(
    null,
  );
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Debounce search ─────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(
      () => setSearchQuery(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Header ──────────────────────────────────────────────
  useEffect(() => {
    if (!systemId) return;
    connectorsApi
      .getSystem(systemId)
      .then((s) => {
        setSystemName(s.name);
        setConnectorType(s.connector_type || s.adapter_type);
        setSystemKind(s.kind);
        setSystemPurpose(s.purpose || "");
      })
      .catch((e) => setGlobalError(e.message));
  }, [systemId]);

  // ── Tables page fetch ───────────────────────────────────
  const fetchTablesPage = useCallback(
    async (page: number) => {
      setTablesLoading(true);
      setTablesError(null);
      try {
        const offset = page * TABLES_PER_PAGE;
        const res = await connectorsApi.listTablesPaginated(systemId, {
          q: searchQuery,
          offset,
          limit: TABLES_PER_PAGE,
        });
        setTotalTables(res.total);
        setTables(res.tables);
        setTablesPage(page);
      } catch (e: any) {
        setTablesError(e.message || "Failed to load tables");
        setTables([]);
      } finally {
        setTablesLoading(false);
      }
    },
    [systemId, searchQuery],
  );

  // Reset to page 0 on search change
  useEffect(() => {
    setSelectedName(null);
    setTables([]);
    fetchTablesPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Auto-select first table
  useEffect(() => {
    if (!selectedName && tables.length > 0) {
      setSelectedName(tables[0].name);
    }
  }, [tables, selectedName]);

  const totalTablePages = Math.max(
    1,
    Math.ceil(totalTables / TABLES_PER_PAGE),
  );

  const rePing = async () => {
    setPinging(true);
    setPingResult(null);
    setGlobalError(null);
    try {
      const res = await connectorsApi.testSystemConnection(systemId);
      setPingResult(res);
      await fetchTablesPage(0);
    } catch (e: any) {
      setGlobalError(e.message || "Ping failed");
    } finally {
      setPinging(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${systemName}" and all discovered datasets?`)) return;
    setDeleting(true);
    try {
      await connectorsApi.deleteSystem(systemId);
      router.push("/connectors");
    } catch (e: any) {
      setGlobalError(e.message);
      setDeleting(false);
    }
  };

  const isHealthy =
    pingResult?.status === "SUCCESS" || pingResult?.status === "CONNECTED";

  return (
    <ProjectGuard featureName="Connectors">
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 bg-white shrink-0">
          <div className="min-w-0">
            <Link
              href="/connectors"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </Link>
            <div className="flex items-center gap-2 min-w-0 mt-0.5">
              <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <TechIcon type={connectorType} className="w-4 h-4" />
              </div>
              <h1 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
                {systemName}
              </h1>
              {connectorType && (
                <span className="text-[9.5px] font-mono px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 shrink-0">
                  {connectorType}
                </span>
              )}
              {systemKind && (
                <span
                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                    systemKind === "SOURCE"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : systemKind === "TARGET"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {systemKind}
                </span>
              )}
            </div>
            {systemPurpose && (
              <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                {systemPurpose}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={rePing}
              disabled={pinging}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3 h-3 ${pinging ? "animate-spin" : ""}`}
              />
              Re-ping
            </button>
            <button
              onClick={remove}
              disabled={deleting}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-white text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>

        {/* ── Status banners ─────────────────────────────── */}
        {globalError && (
          <div className="px-4 py-1.5 bg-red-50 border-b border-red-200 text-red-800 text-[11px] flex items-start gap-1.5 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-all flex-1">{globalError}</span>
            <button onClick={() => setGlobalError(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {pingResult && (
          <div
            className={`px-4 py-1.5 border-b text-[11px] flex items-center justify-between gap-2 shrink-0 ${
              isHealthy
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isHealthy ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">
                <strong>
                  {pingResult.latency_ms?.toFixed?.(2) ??
                    pingResult.latency_ms}{" "}
                  ms
                </strong>{" "}
                — {pingResult.message || pingResult.status}
              </span>
            </div>
          </div>
        )}

        {/* ── Workspace ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* ── Sidebar ──────────────────────────────────── */}
          <aside className="w-full lg:w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
            {/* Search + count */}
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Filter tables…"
                  className="w-full pl-6 pr-6 py-1 text-[11px] border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <span className="text-[9.5px] font-mono text-slate-500 shrink-0 tabular-nums">
                {totalTables.toLocaleString()}
              </span>
            </div>

            {/* Table list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {tablesError ? (
                <div className="p-2 text-[11px] text-red-700">
                  {tablesError}{" "}
                  <button
                    onClick={() => fetchTablesPage(tablesPage)}
                    className="underline"
                  >
                    retry
                  </button>
                </div>
              ) : tablesLoading && tables.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto mb-1" />
                  Loading tables…
                </div>
              ) : tables.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-slate-400">
                  {searchQuery
                    ? `No tables match "${searchQuery}"`
                    : "No tables"}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tables.map((t) => (
                    <SidebarRow
                      key={t.name}
                      meta={t}
                      active={selectedName === t.name}
                      onSelect={setSelectedName}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination footer */}
            {totalTables > 0 && (
              <div className="px-1.5 py-1.5 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-1 shrink-0">
                <span className="text-[9.5px] font-mono text-slate-500 tabular-nums pl-1">
                  {tablesPage * TABLES_PER_PAGE + 1}–
                  {Math.min(
                    totalTables,
                    (tablesPage + 1) * TABLES_PER_PAGE,
                  )}
                  &nbsp;/ {totalTables.toLocaleString()}
                </span>
                <div className="flex items-center gap-0.5">
                  <PageBtn
                    disabled={tablesPage === 0 || tablesLoading}
                    onClick={() => fetchTablesPage(0)}
                    title="First page"
                  >
                    <ChevronsLeft className="w-3 h-3" />
                  </PageBtn>
                  <PageBtn
                    disabled={tablesPage === 0 || tablesLoading}
                    onClick={() => fetchTablesPage(tablesPage - 1)}
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </PageBtn>
                  <span className="text-[9.5px] font-mono text-slate-700 px-1 tabular-nums min-w-[44px] text-center">
                    {tablesPage + 1}/{totalTablePages}
                  </span>
                  <PageBtn
                    disabled={
                      tablesPage >= totalTablePages - 1 || tablesLoading
                    }
                    onClick={() => fetchTablesPage(tablesPage + 1)}
                    title="Next page"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </PageBtn>
                  <PageBtn
                    disabled={
                      tablesPage >= totalTablePages - 1 || tablesLoading
                    }
                    onClick={() => fetchTablesPage(totalTablePages - 1)}
                    title="Last page"
                  >
                    <ChevronsRight className="w-3 h-3" />
                  </PageBtn>
                </div>
              </div>
            )}
          </aside>

          {/* ── Inspector ────────────────────────────────── */}
          <TableInspector
            systemId={systemId}
            tableName={selectedName}
            onEmpty={
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1 bg-white">
                <TableIcon className="w-5 h-5" />
                <span className="text-[11px]">Select a table</span>
              </div>
            }
          />
        </div>
      </div>
    </ProjectGuard>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar row
// ─────────────────────────────────────────────────────────────
function SidebarRow({
  meta,
  active,
  onSelect,
}: {
  meta: TableMeta;
  active: boolean;
  onSelect: (name: string) => void;
}) {
  const child = meta.name.includes(".");
  return (
    <button
      onClick={() => onSelect(meta.name)}
      className={`w-full text-left px-2 py-1 flex items-center justify-between gap-2 transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-50"
      } ${child ? "pl-5" : ""}`}
    >
      <div className="min-w-0 flex items-center gap-1.5">
        {child && (
          <Layers
            className={`w-2.5 h-2.5 shrink-0 ${
              active ? "text-slate-300" : "text-slate-400"
            }`}
          />
        )}
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-medium truncate leading-tight">
            {child ? meta.name.split(".").slice(1).join(".") : meta.name}
          </div>
          <div
            className={`text-[9px] leading-tight ${
              active ? "text-slate-300" : "text-slate-500"
            }`}
          >
            {meta.column_count}c · {meta.row_count.toLocaleString()}r
          </div>
        </div>
      </div>
      <ChevronRight
        className={`w-2.5 h-2.5 shrink-0 ${
          active ? "text-white" : "text-slate-300"
        }`}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Page button (shared)
// ─────────────────────────────────────────────────────────────
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
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="p-1 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Inspector
// ─────────────────────────────────────────────────────────────
function TableInspector({
  systemId,
  tableName,
  onEmpty,
}: {
  systemId: string;
  tableName: string | null;
  onEmpty: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("schema");

  const [columns, setColumns] = useState<DiscoveredColumn[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [rowsOffset, setRowsOffset] = useState(0);
  const [rowsTotal, setRowsTotal] = useState<number | null>(null);
  const [rowsHasMore, setRowsHasMore] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(DATA_PAGE_DEFAULT);

  useEffect(() => {
    if (!tableName) return;
    setSchemaLoading(true);
    setSchemaError(null);
    connectorsApi
      .getTableSchema(systemId, tableName)
      .then((res) => {
        setColumns(res.columns);
        setRowCount(res.row_count);
      })
      .catch((e) => setSchemaError(e.message))
      .finally(() => setSchemaLoading(false));
  }, [systemId, tableName]);

  const fetchRows = useCallback(
    async (offset: number) => {
      if (!tableName) return;
      setRowsLoading(true);
      setRowsError(null);
      try {
        const res = await connectorsApi.previewTableRows(systemId, tableName, {
          offset,
          limit: pageSize,
        });
        setRows(res.rows);
        setRowsOffset(offset);
        setRowsTotal(res.total);
        setRowsHasMore(res.has_more);
      } catch (e: any) {
        setRowsError(e.message);
      } finally {
        setRowsLoading(false);
      }
    },
    [systemId, tableName, pageSize],
  );

  useEffect(() => {
    if (tab !== "data" || !tableName) return;
    fetchRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tableName, pageSize]);

  if (!tableName) return <div className="flex-1 min-w-0">{onEmpty}</div>;

  const pkCount = columns.filter((c) => c.is_pk === true).length;

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white">
      {/* Inspector header */}
      <div className="px-3 pt-2 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <div className="min-w-0 flex items-center gap-1.5">
            {tableName.includes(".") && (
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <h2 className="font-mono text-sm font-semibold text-slate-900 truncate">
              {tableName}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
              <TableIcon className="w-2.5 h-2.5" />
              {columns.length} fields
            </span>
            <span className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
              <Hash className="w-2.5 h-2.5" />
              {rowCount.toLocaleString()} rows
            </span>
            {pkCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                <Key className="w-2.5 h-2.5" />
                {pkCount} PK
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center -mb-px">
          <TabBtn
            active={tab === "schema"}
            onClick={() => setTab("schema")}
            icon={TableIcon}
            label="Schema"
          />
          <TabBtn
            active={tab === "data"}
            onClick={() => setTab("data")}
            icon={Database}
            label="Data"
          />
          <TabBtn
            active={tab === "raw"}
            onClick={() => setTab("raw")}
            icon={Code2}
            label="Raw"
          />
        </div>
      </div>

      {tab === "schema" && (
        <SchemaTab
          columns={columns}
          loading={schemaLoading}
          error={schemaError}
        />
      )}

      {tab === "data" && (
        <DataTab
          rows={rows}
          columns={columns}
          loading={rowsLoading}
          error={rowsError}
          offset={rowsOffset}
          total={rowsTotal}
          hasMore={rowsHasMore}
          pageSize={pageSize}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setRowsOffset(0);
          }}
          onPrev={() => fetchRows(Math.max(0, rowsOffset - pageSize))}
          onNext={() => fetchRows(rowsOffset + pageSize)}
          onFirst={() => fetchRows(0)}
          onLast={() => {
            if (rowsTotal != null) {
              const lastStart =
                Math.floor((rowsTotal - 1) / pageSize) * pageSize;
              fetchRows(Math.max(0, lastStart));
            }
          }}
        />
      )}

      {tab === "raw" && <RawTab rows={rows} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium border-b-2 -mb-px transition ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Schema tab
// ─────────────────────────────────────────────────────────────
function SchemaTab({
  columns,
  loading,
  error,
}: {
  columns: DiscoveredColumn[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-[11px]">
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading…
      </div>
    );
  }
  if (error) {
    return <div className="p-2 text-[11px] text-red-700">{error}</div>;
  }
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left text-[11px] whitespace-nowrap border-collapse">
        <thead className="bg-slate-50 text-slate-500 text-[9.5px] font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
          <tr>
            <th className="py-1.5 px-2 w-8">#</th>
            <th className="py-1.5 px-2">Column</th>
            <th className="py-1.5 px-2">Datatype</th>
            <th className="py-1.5 px-2">Constraints</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {columns.map((c, idx) => (
            <tr key={`${c.name}-${idx}`} className="hover:bg-slate-50/60">
              <td className="py-1 px-2 text-slate-400 font-mono text-[9.5px]">
                {idx + 1}
              </td>
              <td className="py-1 px-2 font-mono text-[11.5px] font-medium text-slate-900">
                {c.name}
              </td>
              <td className="py-1 px-2">
                <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                  {c.datatype || "string"}
                </span>
              </td>
              <td className="py-1 px-2">
                {c.is_pk === true ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-800">
                    <Key className="w-2.5 h-2.5" /> PK
                  </span>
                ) : (
                  <span className="text-slate-300 text-[10px]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Data tab — server-paginated
// ─────────────────────────────────────────────────────────────
function DataTab({
  rows,
  columns,
  loading,
  error,
  offset,
  total,
  hasMore,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
  onFirst,
  onLast,
}: {
  rows: Record<string, any>[];
  columns: DiscoveredColumn[];
  loading: boolean;
  error: string | null;
  offset: number;
  total: number | null;
  hasMore: boolean;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
}) {
  const colNames = useMemo(() => {
    if (columns.length > 0) return columns.map((c) => c.name);
    const set = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    return Array.from(set);
  }, [columns, rows]);

  const totalPages =
    total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const pageNum = Math.floor(offset / pageSize) + 1;

  if (loading && rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-[11px]">
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading…
      </div>
    );
  }
  if (error) {
    return <div className="p-2 text-[11px] text-red-700">{error}</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-[9.5px] font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="py-1.5 px-2 w-8 sticky left-0 bg-slate-50 z-20">
                #
              </th>
              {colNames.map((c) => (
                <th key={c} className="py-1.5 px-2 font-mono whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/50 align-top">
                <td className="py-1 px-2 text-slate-400 font-mono text-[9.5px] sticky left-0 bg-white">
                  {offset + i + 1}
                </td>
                {colNames.map((c) => {
                  const val = r[c];
                  let display: string;
                  let tone = "text-slate-800";
                  if (val === null || val === undefined) {
                    display = "∅";
                    tone = "text-slate-300";
                  } else if (typeof val === "object") {
                    display = JSON.stringify(val);
                    tone = "text-slate-500 font-mono text-[9.5px]";
                  } else {
                    display = String(val);
                    if (typeof val === "number")
                      tone = "text-blue-700 font-mono";
                    else if (typeof val === "boolean")
                      tone = val ? "text-emerald-700" : "text-red-700";
                  }
                  return (
                    <td
                      key={c}
                      className={`py-1 px-2 align-top whitespace-nowrap max-w-[260px] truncate ${tone}`}
                      title={display}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 px-2 py-1 flex items-center justify-between gap-2 flex-wrap shrink-0 bg-slate-50/60">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <span className="hidden sm:inline">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-[10px] px-1 py-0.5 border border-slate-200 rounded bg-white focus:outline-none"
          >
            {DATA_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="font-mono text-[9.5px] tabular-nums">
            {offset + 1}–{offset + rows.length}
            {total != null ? ` / ${total.toLocaleString()}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <PageBtn
            disabled={offset === 0 || loading}
            onClick={onFirst}
            title="First page"
          >
            <ChevronsLeft className="w-3 h-3" />
          </PageBtn>
          <PageBtn
            disabled={offset === 0 || loading}
            onClick={onPrev}
            title="Previous"
          >
            <ChevronLeft className="w-3 h-3" />
          </PageBtn>
          <span className="px-1 text-[9.5px] font-mono text-slate-700 min-w-[48px] text-center tabular-nums">
            {totalPages != null
              ? `${pageNum}/${totalPages}`
              : `${pageNum}`}
          </span>
          <PageBtn
            disabled={!hasMore || loading}
            onClick={onNext}
            title="Next"
          >
            <ChevronRight className="w-3 h-3" />
          </PageBtn>
          <PageBtn
            disabled={
              !hasMore ||
              loading ||
              totalPages == null ||
              pageNum >= totalPages
            }
            onClick={onLast}
            title="Last page"
          >
            <ChevronsRight className="w-3 h-3" />
          </PageBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Raw tab
// ─────────────────────────────────────────────────────────────
function RawTab({ rows }: { rows: Record<string, any>[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex-1 overflow-auto p-2 min-h-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9.5px] font-mono text-slate-500">
          {rows.length} row{rows.length === 1 ? "" : "s"} (current page)
        </span>
        <button
          onClick={copy}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[9.5px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Copy className="w-2.5 h-2.5" />
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <pre className="text-[10px] font-mono text-slate-700 leading-relaxed whitespace-pre-wrap break-all bg-slate-50 border border-slate-200 rounded p-2">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  );
}