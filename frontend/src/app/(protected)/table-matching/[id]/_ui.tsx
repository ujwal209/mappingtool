// src/app/(protected)/table-matching/[id]/_ui.tsx
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Plus,
  AlertCircle,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Table2,
  Search,
  Check,
  LoaderCircle,
  AlertTriangle,
} from "lucide-react";

// ═════════════════════════════════════════════════════════════
// Inline types (no _types.ts dependency)
// ═════════════════════════════════════════════════════════════
interface MatchedColumn {
  source_col: string;
  target_col: string;
  concept: string;
}

interface TablePair {
  source_table: string;
  target_table: string;
  confidence_score: number;
  match_status: "MATCHED" | "UNMATCHED" | "MANUAL_OVERRIDE" | string;
  matched_concepts: string[];
  matched_columns: MatchedColumn[];
  matched_columns_count: number;
  rationale: string;
  requires_masking: boolean;
  rules_applied: string[];
  depends_on: string[];
}

import { API_V1 } from "@/lib/api-config";

const API_BASE = API_V1;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) h.Authorization = `Bearer ${token}`;
    h["X-Tenant-ID"] =
      localStorage.getItem("tenant_id") || "tenant-default";
  }
  return h;
}

// ═════════════════════════════════════════════════════════════
// TablePickerPanel — searchable, infinite-scroll table list
// ═════════════════════════════════════════════════════════════
const PAGE_SIZE = 50;
const DEBOUNCE_MS = 250;

interface TableMeta {
  name: string;
  row_count: number;
  column_count: number;
}

export function TablePickerPanel({
  systemId,
  value,
  onChange,
  placeholder,
  accent = "slate",
}: {
  systemId: string;
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  accent?: "blue" | "emerald" | "slate";
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchPage = useCallback(
    async (q: string, pageOffset: number, append: boolean) => {
      if (!systemId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q,
          offset: String(pageOffset),
          limit: String(PAGE_SIZE),
        });
        const res = await fetch(
          `${API_BASE}/systems/${encodeURIComponent(systemId)}/tables?${params.toString()}`,
          { headers: authHeaders() }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body?.detail === "string"
              ? body.detail
              : `Failed to load tables (${res.status})`
          );
        }
        const data = await res.json();
        const list: TableMeta[] = (data.tables || []).map((t: any) => ({
          name: t.name,
          row_count: t.row_count ?? 0,
          column_count: t.column_count ?? 0,
        }));
        setTotal(Number(data.total ?? list.length));
        setOffset(pageOffset + list.length);
        setTables((prev) => (append ? [...prev, ...list] : list));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tables.");
        if (!append) setTables([]);
      } finally {
        setLoading(false);
      }
    },
    [systemId]
  );

  useEffect(() => {
    setTables([]);
    setOffset(0);
    void fetchPage(searchQuery, 0, false);
  }, [searchQuery, fetchPage]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      if (offset < total) void fetchPage(searchQuery, offset, true);
    }
  };

  const hasMore = offset < total;
  const accentRow =
    accent === "blue"
      ? "bg-blue-50 border-l-2 border-l-blue-500"
      : accent === "emerald"
      ? "bg-emerald-50 border-l-2 border-l-emerald-500"
      : "bg-slate-100 border-l-2 border-l-slate-700";
  const accentCheck =
    accent === "blue"
      ? "text-blue-600"
      : accent === "emerald"
      ? "text-emerald-600"
      : "text-slate-900";

  return (
    <div className="h-full flex flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="p-2 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-slate-50 border border-slate-200 focus-within:border-slate-900 transition-colors">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={placeholder ?? "Search tables…"}
            className="flex-1 min-w-0 bg-transparent text-[12.5px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="text-slate-400 hover:text-slate-700 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {tables.length === 0 && loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-[12px] text-slate-500">
            <LoaderCircle className="w-4 h-4 animate-spin" />
            Loading tables…
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center text-[11.5px] text-red-700">
            {error}
          </div>
        ) : tables.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12px] text-slate-400 italic">
            {searchQuery
              ? `No tables match "${searchQuery}"`
              : "No tables registered for this system"}
          </div>
        ) : (
          <>
            {tables.map((t) => {
              const selected = t.name === value;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => onChange(t.name)}
                  className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 transition border-b border-slate-50 last:border-b-0 ${
                    selected ? accentRow : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-mono text-[12px] truncate ${
                        selected
                          ? "text-slate-900 font-semibold"
                          : "text-slate-800 font-medium"
                      }`}
                    >
                      {t.name}
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5 tabular-nums">
                      {t.row_count.toLocaleString()} rows ·{" "}
                      {t.column_count} cols
                    </div>
                  </div>
                  {selected && (
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${accentCheck}`}
                    />
                  )}
                </button>
              );
            })}
            {loading && (
              <div className="flex items-center justify-center gap-2 px-3 py-3 text-[11px] text-slate-500">
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                Loading more…
              </div>
            )}
            {!loading && !hasMore && tables.length > PAGE_SIZE && (
              <div className="px-3 py-2 text-center text-[10px] text-slate-400 border-t border-slate-100">
                End of list
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 text-[10.5px] text-slate-500 shrink-0">
        <span>
          {tables.length} of {total} table{total === 1 ? "" : "s"}
        </span>
        {hasMore && <span className="text-slate-400">scroll for more</span>}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-slate-500 hover:text-red-600 font-medium"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ManualPairAddModal
// ═════════════════════════════════════════════════════════════
export function ManualPairAddModal({
  sourceSystemId,
  targetSystemId,
  onClose,
  onAdd,
}: {
  sourceSystemId: string;
  targetSystemId: string;
  onClose: () => void;
  onAdd: (sourceTable: string, targetTable: string) => boolean;
}) {
  const [sourceTable, setSourceTable] = useState("");
  const [targetTable, setTargetTable] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = !!sourceTable && !!targetTable;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !adding) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, adding]);

  const handleAdd = () => {
    if (!valid) return;
    setAdding(true);
    setError(null);
    const ok = onAdd(sourceTable, targetTable);
    setAdding(false);
    if (ok) {
      onClose();
    } else {
      setError("This pair already exists in the set.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !adding) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-pair-title"
    >
      <div className="bg-white w-full sm:max-w-4xl lg:max-w-5xl rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col h-[95vh] sm:h-[88vh] sm:max-h-[820px] overflow-hidden animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3 px-6 sm:px-8 py-5 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3
                id="add-pair-title"
                className="text-[17px] font-semibold text-slate-900 leading-tight"
              >
                Add table pair
              </h3>
              <p className="text-[12.5px] text-slate-500 mt-1 leading-snug">
                Pick a source table and a target table from the live
                connectors. Both pickers support thousands of tables.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            className="p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-6 sm:px-8 py-5 flex flex-col">
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-5">
            <div className="min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <Table2 className="w-3 h-3 text-blue-600" />
                </div>
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-600">
                  Source table
                </span>
                {sourceTable && (
                  <span className="ml-auto text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-[260px] md:min-h-0">
                <TablePickerPanel
                  systemId={sourceSystemId}
                  value={sourceTable}
                  onChange={setSourceTable}
                  placeholder="Search source tables…"
                  accent="blue"
                />
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center px-1">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </div>
            </div>
            <div className="md:hidden flex items-center justify-center -my-1">
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90" />
              </div>
            </div>

            <div className="min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Table2 className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-600">
                  Target table
                </span>
                {targetTable && (
                  <span className="ml-auto text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-[260px] md:min-h-0">
                <TablePickerPanel
                  systemId={targetSystemId}
                  value={targetTable}
                  onChange={setTargetTable}
                  placeholder="Search target tables…"
                  accent="emerald"
                />
              </div>
            </div>
          </div>

          {(valid || error) && (
            <div className="shrink-0 mt-4 space-y-3">
              {valid && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Pair preview
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[12.5px] font-semibold text-slate-900 truncate max-w-[42%]">
                      {sourceTable}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-[12.5px] font-semibold text-slate-900 truncate max-w-[42%]">
                      {targetTable}
                    </span>
                  </div>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[12px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-relaxed">{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 sm:px-8 py-4 border-t border-slate-200 bg-slate-50/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-2 shrink-0">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Manually added pairs start at{" "}
            <strong className="text-slate-700">100% confidence</strong>.
            Duplicates are blocked automatically.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={adding}
              className="h-10 px-4 rounded-lg text-[12.5px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid || adding}
              onClick={handleAdd}
              className="h-10 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {adding ? "Adding…" : "Add pair"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PairStats
// ═════════════════════════════════════════════════════════════
export function PairStats({
  total,
  duplicateCount,
}: {
  total: number;
  duplicateCount: number;
}) {
  const Card = ({
    label,
    value,
    hint,
  }: {
    label: string;
    value: string | number;
    hint?: string;
  }) => (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-lg font-semibold text-slate-900 font-mono mt-0.5">
        {value}
      </p>
      {hint && (
        <p className="text-[10.5px] text-slate-400 mt-0.5 truncate">
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Card label="Total pairs" value={total} />
      <Card
        label="Duplicates"
        value={duplicateCount}
        hint={
          duplicateCount > 0
            ? "Must be resolved before save"
            : "No duplicates"
        }
      />
      <Card
        label="Ready to save"
        value={duplicateCount === 0 ? "Yes" : "No"}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PairRow
// ═════════════════════════════════════════════════════════════
export function PairRow({
  pair,
  isDuplicate,
  onChange,
  onRemove,
}: {
  pair: TablePair;
  isDuplicate: boolean;
  onChange: (patch: Partial<TablePair>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(pair.confidence_score * 100);

  const tone =
    pair.confidence_score >= 0.85
      ? "bg-slate-900"
      : pair.confidence_score >= 0.5
      ? "bg-slate-500"
      : "bg-slate-300";

  return (
    <>
      <tr
        className={`hover:bg-slate-50/60 transition-colors border-b border-slate-100 ${
          isDuplicate ? "bg-red-50/40" : ""
        }`}
      >
        <td className="py-3 px-4 align-top">
          <span className="font-mono text-[12px] font-semibold text-slate-900 block truncate max-w-[200px]">
            {pair.source_table}
          </span>
          {pair.matched_concepts.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {pair.matched_concepts.slice(0, 2).map((c) => (
                <span
                  key={c}
                  className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600"
                >
                  {c}
                </span>
              ))}
              {pair.matched_concepts.length > 2 && (
                <span className="text-[9.5px] text-slate-400">
                  +{pair.matched_concepts.length - 2}
                </span>
              )}
            </div>
          )}
        </td>

        <td className="py-3 px-4 align-top">
          <span className="font-mono text-[12px] font-semibold text-slate-900 block truncate max-w-[200px]">
            {pair.target_table}
          </span>
          {pair.depends_on.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-1 truncate">
              depends on:{" "}
              <span className="font-mono">
                {pair.depends_on.slice(0, 2).join(", ")}
              </span>
              {pair.depends_on.length > 2 &&
                ` +${pair.depends_on.length - 2}`}
            </p>
          )}
          {isDuplicate && (
            <p className="text-[10px] font-semibold text-red-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Duplicate
            </p>
          )}
        </td>

        <td className="py-3 px-4 align-top w-[200px]">
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) =>
                onChange({
                  confidence_score: Number(e.target.value) / 100,
                  match_status: "MANUAL_OVERRIDE",
                })
              }
              className="w-full accent-slate-900"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tone}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10.5px] font-mono font-semibold text-slate-700 tabular-nums">
                  {pct}%
                </span>
              </div>
              <span className="text-[9.5px] text-slate-400 capitalize">
                {pair.match_status.toLowerCase().replace("_", " ")}
              </span>
            </div>
          </div>
        </td>

        <td className="py-3 px-4 align-top max-w-xs">
          <div className="flex items-start gap-1">
            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 flex-1">
              {pair.rationale || "—"}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? "Collapse" : "Edit details"}
              className="p-0.5 text-slate-400 hover:text-slate-900 shrink-0 mt-0.5"
            >
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </td>

        <td className="py-3 px-4 align-top text-right w-[60px]">
          <button
            type="button"
            onClick={onRemove}
            title="Remove pair"
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50/60">
          <td colSpan={5} className="px-4 py-3 border-b border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-semibold text-slate-700">
                  Rationale
                </label>
                <textarea
                  rows={2}
                  value={pair.rationale}
                  onChange={(e) => onChange({ rationale: e.target.value })}
                  placeholder="Why does this pair make sense?"
                  className="w-full text-[11.5px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900 resize-none"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 self-start">
                <div>
                  <p className="text-[11px] font-medium text-slate-900">
                    Requires masking
                  </p>
                  <p className="text-[9.5px] text-slate-500">
                    PII / regulated data
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pair.requires_masking}
                  onClick={() =>
                    onChange({ requires_masking: !pair.requires_masking })
                  }
                  className={`relative inline-flex h-[20px] w-9 shrink-0 items-center rounded-full border transition-colors ${
                    pair.requires_masking
                      ? "border-slate-900 bg-slate-900"
                      : "border-slate-300 bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                      pair.requires_masking
                        ? "translate-x-[17px]"
                        : "translate-x-[2px]"
                    }`}
                  />
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// PairListTable
// ═════════════════════════════════════════════════════════════
export function PairListTable({
  pairs,
  duplicateKeys,
  onChange,
  onRemove,
}: {
  pairs: TablePair[];
  duplicateKeys: Set<string>;
  onChange: (index: number, patch: Partial<TablePair>) => void;
  onRemove: (index: number) => void;
}) {
  if (pairs.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-[12.5px] text-slate-500">
          No pairs in this set. Add one manually or start a new discovery.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px] min-w-[900px]">
        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-4">Source table</th>
            <th className="py-2.5 px-4">Target table</th>
            <th className="py-2.5 px-4 w-[200px]">Confidence</th>
            <th className="py-2.5 px-4">Rationale</th>
            <th className="py-2.5 px-4 text-right w-[60px]"></th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, idx) => {
            const key = `${p.source_table}::${p.target_table}`;
            return (
              <PairRow
                key={`${key}-${idx}`}
                pair={p}
                isDuplicate={duplicateKeys.has(key)}
                onChange={(patch) => onChange(idx, patch)}
                onRemove={() => onRemove(idx)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}