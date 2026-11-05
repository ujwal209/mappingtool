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
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Hash,
  Lock,
  Layers,
  ChevronDown,
  ChevronUp,
  Play as PlayIcon,
  Sparkles,
  ChevronsDownUp, // ⭐ new
  ChevronsUpDown, // ⭐ new
} from "lucide-react";
import { toast } from "sonner";
import {
  pairMappingApi,
  type PairMappingSet,
  type PairBlock,
  type ColumnRule,
} from "@/lib/pair-mapping-api";
import {
  FilterBar,
  type ColumnStatusFilter,
  type ColumnSortMode,
} from "@/components/pair-mapping/FilterBar";
import { PaginatedColumnTable } from "@/components/pair-mapping/PaginatedColumnTable";
import type { ColumnOption } from "@/components/pair-mapping/ColumnPicker";

// ─────────────────────────────────────────────────────────────
// ⭐ Universal search — fuzzy, field-aware
// ─────────────────────────────────────────────────────────────
interface SearchableColumn {
  target_column: string;
  matched_source_column: string | null;
  transformation_rule: string | null;
  default_value: string | null;
  rationale: string;
  status: string;
}

/**
 * Levenshtein distance — capped for speed. Returns true if `a` and `b` are
 * within `maxDist` edits of each other.
 */
function withinDistance(a: string, b: string, maxDist: number): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;
  if (a.length > b.length) [a, b] = [b, a];
  let prev = new Array(a.length + 1).fill(0).map((_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    const curr = [j];
    let rowMin = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(
        prev[i] + 1,
        curr[i - 1] + 1,
        prev[i - 1] + cost
      );
      curr[i] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return false;
    prev = curr;
  }
  return prev[a.length] <= maxDist;
}

/**
 * Extracts tokens that should be matched against fields.
 * Supports:
 *   source:email      → matched_source_column contains "email"
 *   target:customer   → target_column contains "customer"
 *   transform:hash    → transformation_rule contains "hash"
 *   default:null      → default_value contains "null"
 *   status:manual     → status == "MANUAL_OVERRIDE"
 *   rationale:pii     → rationale contains "pii"
 *   plain words       → fuzzy matches across all fields
 */
function parseSearchQuery(raw: string): {
  source: string[];
  target: string[];
  transform: string[];
  default: string[];
  rationale: string[];
  status: string[];
  free: string[];
} {
  const out = {
    source: [] as string[],
    target: [] as string[],
    transform: [] as string[],
    default: [] as string[],
    rationale: [] as string[],
    status: [] as string[],
    free: [] as string[],
  };
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const [prefix, ...rest] = tok.split(":");
    const val = rest.join(":");
    if (!val) {
      out.free.push(tok);
      continue;
    }
    if (prefix === "source" || prefix === "src" || prefix === "s") {
      out.source.push(val);
    } else if (
      prefix === "target" ||
      prefix === "tgt" ||
      prefix === "t"
    ) {
      out.target.push(val);
    } else if (prefix === "transform" || prefix === "tx") {
      out.transform.push(val);
    } else if (prefix === "default" || prefix === "d") {
      out.default.push(val);
    } else if (prefix === "rationale" || prefix === "why") {
      out.rationale.push(val);
    } else if (prefix === "status" || prefix === "st") {
      out.status.push(val);
    } else {
      out.free.push(tok);
    }
  }
  return out;
}

/**
 * Field-aware fuzzy match.
 *
 * - Explicit `source:`, `target:` etc. tokens are AND-combined.
 * - Free tokens must ALL match (AND across fields, OR within a field).
 * - Each free token is fuzzy-checked (edit distance ≤ 2 for words ≥ 4 chars).
 */
function columnMatches(col: SearchableColumn, query: string): boolean {
  if (!query.trim()) return true;
  const parsed = parseSearchQuery(query);

  const fields = [
    col.target_column,
    col.matched_source_column || "",
    col.transformation_rule || "",
    col.default_value || "",
    col.rationale,
    col.status === "MANUAL_OVERRIDE" ? "manual" : col.status.toLowerCase(),
  ].map((s) => s.toLowerCase());

  const fieldHasToken = (f: string, tok: string) => {
    if (!tok) return true;
    if (f.includes(tok)) return true;
    // Only fuzzy-match tokens with ≥ 4 chars to avoid noise
    if (tok.length >= 4) {
      const words = f.split(/[\s_\-.]+/).filter(Boolean);
      return words.some((w) => withinDistance(w, tok, 2));
    }
    return false;
  };

  // Explicit prefix filters
  if (
    parsed.source.length > 0 &&
    !parsed.source.every((t) =>
      fieldHasToken(col.matched_source_column || "", t)
    )
  ) {
    return false;
  }
  if (
    parsed.target.length > 0 &&
    !parsed.target.every((t) =>
      fieldHasToken(col.target_column, t)
    )
  ) {
    return false;
  }
  if (
    parsed.transform.length > 0 &&
    !parsed.transform.every((t) =>
      fieldHasToken(col.transformation_rule || "", t)
    )
  ) {
    return false;
  }
  if (
    parsed.default.length > 0 &&
    !parsed.default.every((t) =>
      fieldHasToken(col.default_value || "", t)
    )
  ) {
    return false;
  }
  if (
    parsed.rationale.length > 0 &&
    !parsed.rationale.every((t) => fieldHasToken(col.rationale, t))
  ) {
    return false;
  }
  if (parsed.status.length > 0) {
    const statusNorm =
      col.status === "MANUAL_OVERRIDE"
        ? "manual"
        : col.status.toLowerCase();
    if (!parsed.status.every((t) => fieldHasToken(statusNorm, t))) {
      return false;
    }
  }

  // Free tokens — each must match at least one field
  for (const tok of parsed.free) {
    const hit = fields.some((f) => fieldHasToken(f, tok));
    if (!hit) return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function resolveProjectId(urlParam: string | null): string {
  if (urlParam?.trim()) return urlParam.trim();
  if (typeof window !== "undefined") {
    const s = localStorage.getItem("active_project_id");
    if (s?.trim()) return s.trim();
  }
  return "proj-default";
}

// ─────────────────────────────────────────────────────────────
// Page wrapper
// ─────────────────────────────────────────────────────────────
export default function PairMappingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
          <LoaderCircle className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────
// Inner
// ─────────────────────────────────────────────────────────────
function Inner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const setId = String(params?.id || "");
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [set, setSet] = useState<PairMappingSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [runningPairId, setRunningPairId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [savingPairId, setSavingPairId] = useState<string | null>(null);

  const [sourceColsByDataset, setSourceColsByDataset] = useState<
    Record<string, ColumnOption[]>
  >({});

  const [draftEdits, setDraftEdits] = useState<
    Record<string, Record<string, Partial<ColumnRule>>>
  >({});

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ColumnStatusFilter>("ALL");
  const [pairFilter, setPairFilter] = useState<string>("ALL");
  const [sortMode, setSortMode] = useState<ColumnSortMode>("default");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000/api/v1";

  const fetchSourceColumns = useCallback(
    async (datasetIds: string[]) => {
      const missing = datasetIds.filter(
        (id) => id && !sourceColsByDataset[id]
      );
      if (missing.length === 0) return;
      const results: Record<string, ColumnOption[]> = {};
      await Promise.all(
        missing.map(async (id) => {
          try {
            const token =
              typeof window !== "undefined"
                ? localStorage.getItem("auth_token")
                : null;
            const tenant =
              typeof window !== "undefined"
                ? localStorage.getItem("tenant_id") || "tenant-default"
                : "tenant-default";
            const res = await fetch(
              `${API_BASE}/datasets/${encodeURIComponent(id)}`,
              {
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  "X-Tenant-ID": tenant,
                },
              }
            );
            if (!res.ok) return;
            const ds = await res.json();
            results[id] = (ds.fields || []).map((f: any) => ({
              name: f.name,
              datatype: f.datatype,
            }));
          } catch {
            // silent
          }
        })
      );
      if (mountedRef.current && Object.keys(results).length > 0) {
        setSourceColsByDataset((prev) => ({ ...prev, ...results }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const load = useCallback(async () => {
    if (!setId) {
      setLoading(false);
      setError("No set ID in URL");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await pairMappingApi.get(setId);
      if (!mountedRef.current) return;
      setSet(s);
      setExpandedPairs(new Set(s.pairs.map((p) => p.pair_id)));
      setDraftEdits({});

      const datasetIds = Array.from(
        new Set(s.pairs.map((p) => p.source_dataset_id).filter(Boolean))
      );
      void fetchSourceColumns(datasetIds);
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e?.message || "Failed to load set");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [setId, fetchSourceColumns]);

  useEffect(() => {
    void load();
  }, [load]);

  // ⭐ Collapse all / expand all
  const allExpanded =
    !!set && set.pairs.length > 0 && expandedPairs.size === set.pairs.length;

  const collapseAll = () => {
    setExpandedPairs(new Set());
  };

  const expandAll = () => {
    if (!set) return;
    setExpandedPairs(new Set(set.pairs.map((p) => p.pair_id)));
  };

  const runAiOnPair = async (pair: PairBlock) => {
    setRunningPairId(pair.pair_id);
    const lid = toast.loading(
      `Running AI on ${pair.source_table} → ${pair.target_table}…`
    );
    try {
      const updated = await pairMappingApi.runAiOnPair(setId, pair.pair_id, {
        use_ai: true,
      });
      if (mountedRef.current) {
        setSet(updated);
        setDraftEdits((prev) => {
          const next = { ...prev };
          delete next[pair.pair_id];
          return next;
        });
      }
      const updatedPair = updated.pairs.find(
        (p) => p.pair_id === pair.pair_id
      );
      const matched =
        updatedPair?.columns.filter((c) => c.matched_source_column).length ??
        0;
      toast.success(
        `${matched}/${updatedPair?.columns.length ?? 0} columns matched`,
        { id: lid }
      );
    } catch (e: any) {
      toast.error("AI run failed", { description: e?.message, id: lid });
    } finally {
      if (mountedRef.current) setRunningPairId(null);
    }
  };

  const runAiOnAll = async () => {
    setRunningAll(true);
    const lid = toast.loading("Running AI on all pairs…");
    try {
      const updated = await pairMappingApi.runAiOnAll(setId, { use_ai: true });
      if (mountedRef.current) {
        setSet(updated);
        setDraftEdits({});
      }
      const total = updated.pairs.reduce(
        (acc, p) =>
          acc + p.columns.filter((c) => c.matched_source_column).length,
        0
      );
      toast.success(`${total} columns matched across all pairs`, {
        id: lid,
      });
    } catch (e: any) {
      toast.error("AI run failed", { description: e?.message, id: lid });
    } finally {
      if (mountedRef.current) setRunningAll(false);
    }
  };

  const setColumnEdit = (
    pairId: string,
    ruleId: string,
    patch: Partial<ColumnRule>
  ) => {
    setDraftEdits((prev) => ({
      ...prev,
      [pairId]: {
        ...(prev[pairId] || {}),
        [ruleId]: {
          ...(prev[pairId]?.[ruleId] || {}),
          ...patch,
        },
      },
    }));
  };

  const savePairEdits = async (pair: PairBlock) => {
    const edits = draftEdits[pair.pair_id];
    if (!edits || Object.keys(edits).length === 0) {
      toast.info("Nothing to save.");
      return;
    }
    setSavingPairId(pair.pair_id);
    const lid = toast.loading("Saving pair review…");
    try {
      const byRuleId = new Map<string, ColumnRule>();
      for (const col of pair.columns) byRuleId.set(col.rule_id, col);

            const adjustments = Object.entries(edits)
        .map(([ruleId, patch]) => {
          const original = byRuleId.get(ruleId);
          if (!original) return null;
          return {
            target_column: original.target_column,
            matched_source_column:
              patch.matched_source_column !== undefined
                ? patch.matched_source_column
                : original.matched_source_column ?? null,
            transformation_rule:
              patch.transformation_rule !== undefined
                ? patch.transformation_rule ?? undefined
                : original.transformation_rule ?? undefined,
            default_value:
              patch.default_value !== undefined
                ? patch.default_value ?? undefined
                : original.default_value ?? undefined,
            confidence_score:
              patch.confidence_score !== undefined
                ? patch.confidence_score
                : original.confidence_score,
            rationale:
              patch.rationale !== undefined
                ? patch.rationale ?? undefined
                : original.rationale,
          };
        })
        .filter(Boolean) as any[];

      const updated = await pairMappingApi.reviewPair(
        setId,
        pair.pair_id,
        {
          adjustments,
          actor: "reviewer@company.com",
          comments: "Inline review",
        }
      );
      if (mountedRef.current) {
        setSet(updated);
        setDraftEdits((prev) => {
          const next = { ...prev };
          delete next[pair.pair_id];
          return next;
        });
      }
      toast.success(`Saved ${adjustments.length} column edit(s)`, {
        id: lid,
      });
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message, id: lid });
    } finally {
      if (mountedRef.current) setSavingPairId(null);
    }
  };

  const finalize = async () => {
    if (Object.keys(draftEdits).length > 0) {
      toast.error("You have unsaved column edits", {
        description: "Save them first, then approve.",
      });
      return;
    }
    setFinalizing(true);
    const lid = toast.loading("Approving & freezing…");
    try {
      const updated = await pairMappingApi.finalize(setId, {
        actor: "architect@company.com",
      });
      if (mountedRef.current) setSet(updated);
      toast.success(
        `Approved · hash ${updated.content_hash?.slice(0, 10)}…`,
        { id: lid }
      );
    } catch (e: any) {
      toast.error("Finalize failed", { description: e?.message, id: lid });
    } finally {
      if (mountedRef.current) setFinalizing(false);
    }
  };

  const togglePair = (pairId: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(pairId)) next.delete(pairId);
      else next.add(pairId);
      return next;
    });
  };

  // ⭐ UPDATED: filter pipeline using the new universal search
  const filteredPairs = useMemo(() => {
    if (!set) return [];

    const queryTrimmed = search.trim();

    return set.pairs
      .filter((p) => {
        if (pairFilter !== "ALL" && p.pair_id !== pairFilter) {
          return false;
        }
        return true;
      })
      .map((p) => {
        let columns = p.columns;

        if (statusFilter !== "ALL") {
          columns = columns.filter((c) => c.status === statusFilter);
        }

        if (queryTrimmed) {
          columns = columns.filter((c) =>
            columnMatches(
              {
                target_column: c.target_column,
                matched_source_column: c.matched_source_column,
                transformation_rule: c.transformation_rule,
                default_value: c.default_value,
                rationale: c.rationale,
                status: c.status,
              },
              queryTrimmed
            )
          );
        }

        const sorted = [...columns];
        switch (sortMode) {
          case "target-asc":
            sorted.sort((a, b) =>
              a.target_column.localeCompare(b.target_column)
            );
            break;
          case "target-desc":
            sorted.sort((a, b) =>
              b.target_column.localeCompare(a.target_column)
            );
            break;
          case "confidence-desc":
            sorted.sort(
              (a, b) =>
                (b.confidence_score || 0) - (a.confidence_score || 0)
            );
            break;
          case "confidence-asc":
            sorted.sort(
              (a, b) =>
                (a.confidence_score || 0) - (b.confidence_score || 0)
            );
            break;
          case "status":
            sorted.sort((a, b) => {
              const order: Record<string, number> = {
                MANUAL_OVERRIDE: 0,
                MATCHED: 1,
                UNMATCHED: 2,
              };
              return (
                (order[a.status] ?? 3) - (order[b.status] ?? 3)
              );
            });
            break;
          default:
            break;
        }

        return { pair: p, columns: sorted };
      });
  }, [set, search, statusFilter, pairFilter, sortMode]);

  const globalCounts = useMemo(() => {
    if (!set) {
      return { total: 0, matched: 0, unmatched: 0, manual: 0, visible: 0 };
    }
    let total = 0;
    let matched = 0;
    let unmatched = 0;
    let manual = 0;
    for (const p of set.pairs) {
      for (const c of p.columns) {
        total++;
        if (c.status === "MANUAL_OVERRIDE") manual++;
        else if (c.matched_source_column) matched++;
        else unmatched++;
      }
    }
    const visible = filteredPairs.reduce(
      (acc, x) => acc + x.columns.length,
      0
    );
    return { total, matched, unmatched, manual, visible };
  }, [set, filteredPairs]);

  const pairOptions = useMemo(
    () =>
      set?.pairs.map((p) => ({
        pair_id: p.pair_id,
        label: `${p.source_table} → ${p.target_table}`,
        columnCount: p.columns.length,
      })) || [],
    [set]
  );

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "ALL" ||
    pairFilter !== "ALL" ||
    sortMode !== "default";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPairFilter("ALL");
    setSortMode("default");
  };

  // ─────────────────────────────────────────────────────────
  // Loading / error
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
        <LoaderCircle className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !set) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[14px] font-semibold text-red-900">
                Couldn't load set
              </h2>
              <p className="text-[12px] text-red-800 mt-1 break-all">
                {error || "Set not found"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            <Link
              href={`/pair-mapping?project_id=${encodeURIComponent(
                projectId
              )}`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 text-slate-700 text-[12px] font-medium hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isApproved = set.status === "APPROVED";
  const displayName =
    set.name ||
    `${set.pairs.length} pair${set.pairs.length === 1 ? "" : "s"}`;
  const hasAnyUnsavedEdits = Object.keys(draftEdits).length > 0;

  // ═══════════════════════════════════════════════════════
  // Main render
  // ═══════════════════════════════════════════════════════
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
        <Link
          href={`/pair-mapping?project_id=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to pair mappings
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Pair mapping
              </span>
              <span className="text-[10px] text-slate-300">/</span>
              <span className="text-[10px] font-mono text-slate-400 truncate">
                {set.set_id}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight truncate">
                {displayName}
              </h1>
              <span
                className={`inline-flex items-center justify-center text-[9.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                  isApproved
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {set.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11.5px] text-slate-500 font-mono flex-wrap">
              <span>v{set.version_tag}</span>
              <span className="text-slate-300">·</span>
              <span>
                {set.pairs.length} pair
                {set.pairs.length === 1 ? "" : "s"}
              </span>
              <span className="text-slate-300">·</span>
              <span>
                {globalCounts.matched}/{globalCounts.total} matched
              </span>
              {set.content_hash && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Hash className="w-3 h-3" />
                    {set.content_hash.slice(0, 10)}…
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* ⭐ Collapse/Expand all */}
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              disabled={set.pairs.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11.5px] font-medium hover:bg-slate-50 disabled:opacity-40"
              title={allExpanded ? "Collapse all pairs" : "Expand all pairs"}
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                  Collapse all
                </>
              ) : (
                <>
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                  Expand all
                </>
              )}
            </button>

            <button
              onClick={() => void load()}
              disabled={runningAll || !!runningPairId || finalizing}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              title="Reload"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {!isApproved && (
              <>
                <button
                  onClick={() => void runAiOnAll()}
                  disabled={runningAll || !!runningPairId || finalizing}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[12px] font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  {runningAll ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      Running all…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Run AI (all)
                    </>
                  )}
                </button>
                <button
                  onClick={() => void finalize()}
                  disabled={
                    finalizing ||
                    runningAll ||
                    !!runningPairId ||
                    set.pairs.length === 0
                  }
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                    hasAnyUnsavedEdits
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                  title={
                    hasAnyUnsavedEdits
                      ? "Save pending column edits first"
                      : "Approve & freeze"
                  }
                >
                  {finalizing ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      Finalizing…
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Approve & freeze
                    </>
                  )}
                </button>
              </>
            )}

            {isApproved && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved & frozen
              </span>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sortMode={sortMode}
          onSortChange={setSortMode}
          pairs={pairOptions}
          pairFilter={pairFilter}
          onPairFilterChange={setPairFilter}
          counts={globalCounts}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Unsaved banner */}
        {hasAnyUnsavedEdits && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              You have unsaved column edits. Click{" "}
              <strong>Save pair</strong> on each pair before approving.
            </span>
          </div>
        )}

        {/* Pair list */}
        {set.pairs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-[14px] font-semibold text-slate-900">
              No pairs in this set
            </h3>
            <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
              The parent table-mapping set had no resolvable pairs.
            </p>
          </div>
        ) : filteredPairs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <h3 className="text-[14px] font-semibold text-slate-900">
              No columns match the current filters
            </h3>
            <p className="text-[12px] text-slate-500 mt-1">
              Try clearing the search or filter chips.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 text-slate-700 text-[12px] font-medium hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPairs.map(({ pair, columns }) => {
              if (columns.length === 0 && pairFilter !== pair.pair_id) {
                return null;
              }
              const isExpanded = expandedPairs.has(pair.pair_id);
              const isRerunning = runningPairId === pair.pair_id;
              const isSaving = savingPairId === pair.pair_id;
              const pct = Math.round((pair.confidence_score || 0) * 100);
              const pairEdits = draftEdits[pair.pair_id] || {};
              const hasPendingEdits = Object.keys(pairEdits).length > 0;
              const matchedCount = pair.columns.filter(
                (c) => c.matched_source_column
              ).length;
              const columnCount = pair.columns.length;
              const sourceOpts =
                sourceColsByDataset[pair.source_dataset_id] || [];

              return (
                <div
                  key={pair.pair_id}
                  className={`rounded-xl border bg-white overflow-hidden shadow-sm transition ${
                    hasPendingEdits
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : "border-slate-200"
                  }`}
                >
                  {/* Pair header */}
                  <div className="px-5 py-3 flex items-start justify-between gap-3 flex-wrap border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[13px] font-semibold text-slate-900">
                          {pair.source_table}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-mono text-[13px] font-semibold text-slate-900">
                          {pair.target_table}
                        </span>
                        {pair.requires_masking && (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            <Shield className="w-2.5 h-2.5" />
                            Masking
                          </span>
                        )}
                        {hasPendingEdits && (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Unsaved
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          {columns.length}/{columnCount} shown
                        </span>
                      </div>
                      {pair.rationale && (
                        <p className="text-[11.5px] text-slate-600 mt-1 leading-relaxed line-clamp-2">
                          {pair.rationale}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 85
                                ? "bg-slate-900"
                                : pct >= 50
                                ? "bg-slate-600"
                                : "bg-slate-400"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10.5px] font-semibold text-slate-700 tabular-nums">
                          {pct}%
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {matchedCount}/{columnCount}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void runAiOnPair(pair)}
                        disabled={isRerunning || isApproved || runningAll}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Run AI on this pair only"
                      >
                        {isRerunning ? (
                          <>
                            <LoaderCircle className="w-3 h-3 animate-spin" />
                            Running…
                          </>
                        ) : (
                          <>
                            <PlayIcon className="w-3 h-3" />
                            Re-run AI
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePair(pair.pair_id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <>
                      {columns.length === 0 ? (
                        <div className="px-5 py-8 text-center text-[12px] text-slate-400">
                          No columns match the current filters.
                        </div>
                      ) : (
                        <PaginatedColumnTable
                          pair={pair}
                          visibleColumns={columns}
                          sourceColumns={sourceOpts}
                          readOnly={isApproved}
                          edits={pairEdits}
                          onEdit={(ruleId, patch) =>
                            setColumnEdit(pair.pair_id, ruleId, patch)
                          }
                          onSave={() => void savePairEdits(pair)}
                          saving={isSaving}
                          hasEdits={hasPendingEdits}
                        />
                      )}

                      {pair.depends_on.length > 0 && (
                        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/40 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Depends on:
                          </span>
                          {pair.depends_on.map((d) => (
                            <span
                              key={d}
                              className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Approved banner */}
        {isApproved && set.content_hash && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[11.5px] text-slate-600">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-slate-900" />
            <div className="min-w-0 flex-1">
              <p className="text-slate-900 font-medium">
                Approved and frozen
              </p>
              <p className="mt-0.5 leading-relaxed">
                This mapping set is immutable. Content hash:{" "}
                <code className="font-mono text-[10.5px] bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-slate-800 break-all">
                  {set.content_hash}
                </code>
              </p>
            </div>
          </div>
        )}

        {/* Info footer with search syntax help */}
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
          <div className="leading-relaxed">
            <p className="mb-1">
              <strong className="text-slate-700">Universal search:</strong>{" "}
              type any word — matches target, source, transform, default,
              rationale, and status. Fuzzy (tolerates typos).
            </p>
            <p>
              <strong className="text-slate-700">Field syntax:</strong>{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">
                source:email
              </code>{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">
                target:customer
              </code>{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">
                transform:hash
              </code>{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">
                status:manual
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}