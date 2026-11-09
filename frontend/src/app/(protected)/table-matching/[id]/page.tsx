// src/app/(protected)/table-matching/[id]/page.tsx
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
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Table2,
  LoaderCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ═════════════════════════════════════════════════════════════
// Constants + helpers
// ═════════════════════════════════════════════════════════════
import { API_V1 } from "@/lib/api-config";

const API_BASE = API_V1;

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

// ═════════════════════════════════════════════════════════════
// Types
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

interface TableMappingSet {
  table_mapping_set_id: string;
  project_id: string;
  name?: string;
  source_system_id: string;
  target_system_id: string;
  version_tag: string;
  status: string;
  content_hash?: string | null;
  pairs?: TablePair[];
  created_at: number;
}

// ═════════════════════════════════════════════════════════════
// Page wrapper
// ═════════════════════════════════════════════════════════════
export default function TablePairReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
          <LoaderCircle className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      }
    >
      <ReviewInner />
    </Suspense>
  );
}

// ═════════════════════════════════════════════════════════════
// Inner
// ═════════════════════════════════════════════════════════════
function ReviewInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const setId = String(params?.id || "");
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [set, setSet] = useState<TableMappingSet | null>(null);
  const [pairs, setPairs] = useState<TablePair[]>([]);
  const [baselinePairs, setBaselinePairs] = useState<TablePair[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
  const [addPairOpen, setAddPairOpen] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load ─────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!setId) {
      setLoading(false);
      setError("No table-pair set ID in URL");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(
          projectId
        )}/table-pairs/${encodeURIComponent(setId)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Load failed (${res.status})`);
      }
      const data: TableMappingSet = await res.json();
      if (!mountedRef.current) return;
      setSet(data);
      const copy = (data.pairs || []).map((p) => ({ ...p }));
      setPairs(copy);
      setBaselinePairs(copy.map((p) => ({ ...p })));
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e?.message || "Failed to load set");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [setId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Dirty detection ──────────────────────────────────
  const dirty = useMemo(() => {
    if (pairs.length !== baselinePairs.length) return true;
    const k = (p: TablePair) =>
      `${p.source_table}::${p.target_table}::${p.confidence_score}::${p.requires_masking}::${p.rationale}`;
    const a = pairs.map(k).sort();
    const b = baselinePairs.map(k).sort();
    return a.some((v, i) => v !== b[i]);
  }, [pairs, baselinePairs]);

  // ── Duplicate detection ──────────────────────────────
  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    const dup = new Set<string>();
    for (const p of pairs) {
      const k = `${p.source_table}::${p.target_table}`;
      if (seen.has(k)) dup.add(k);
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    return dup;
  }, [pairs]);

  const hasDuplicates = duplicateKeys.size > 0;

  // ── Mutators ─────────────────────────────────────────
  const updatePair = useCallback(
    (index: number, patch: Partial<TablePair>) => {
      setPairs((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    []
  );

  const removePair = useCallback((index: number) => {
    setPairs((prev) => prev.filter((_, i) => i !== index));
    setExpandedIdx((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }, []);

  const addPair = useCallback(
    (sourceTable: string, targetTable: string): boolean => {
      const s = sourceTable.trim();
      const t = targetTable.trim();
      if (!s || !t) return false;
      if (pairs.some((p) => p.source_table === s && p.target_table === t)) {
        return false;
      }
      setPairs((prev) => [
        ...prev,
        {
          source_table: s,
          target_table: t,
          confidence_score: 1,
          match_status: "MANUAL_OVERRIDE",
          matched_concepts: [],
          matched_columns: [],
          matched_columns_count: 0,
          rationale: "Manually added by reviewer.",
          requires_masking: false,
          rules_applied: [],
          depends_on: [],
        },
      ]);
      return true;
    },
    [pairs]
  );

  // ── Save ─────────────────────────────────────────────
  const save = useCallback(async () => {
    if (hasDuplicates) {
      toast.error("Cannot save — duplicates detected", {
        description: `${duplicateKeys.size} duplicate pair${
          duplicateKeys.size === 1 ? "" : "s"
        }. Remove them first.`,
      });
      return;
    }
    if (!dirty) {
      toast.info("Nothing to save.");
      return;
    }
    setSaving(true);
    const loadingId = toast.loading("Saving…");
    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(
          projectId
        )}/table-pairs/${encodeURIComponent(setId)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ pairs }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Save failed (${res.status})`);
      }
      const data = await res.json();
      if (mountedRef.current) {
        setSet((prev) =>
          prev
            ? {
                ...prev,
                pairs,
                content_hash: data?.content_hash ?? prev.content_hash,
              }
            : null
        );
        setBaselinePairs(pairs.map((p) => ({ ...p })));
      }
      toast.success("Saved", {
        description: `${pairs.length} pair${pairs.length === 1 ? "" : "s"}.`,
        id: loadingId,
      });
    } catch (e: any) {
      toast.error("Save failed", {
        description: e?.message || "Something went wrong",
        id: loadingId,
      });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [hasDuplicates, duplicateKeys.size, dirty, projectId, setId, pairs]);

  const discard = useCallback(() => {
    setPairs(baselinePairs.map((p) => ({ ...p })));
    toast("Reverted to last saved state.");
  }, [baselinePairs]);

  // ── Filter ───────────────────────────────────────────
  const filteredIndices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pairs
      .map((p, i) => ({ pair: p, idx: i }))
      .filter(({ pair }) => {
        if (!q) return true;
        return (
          pair.source_table.toLowerCase().includes(q) ||
          pair.target_table.toLowerCase().includes(q) ||
          (pair.rationale || "").toLowerCase().includes(q) ||
          (pair.matched_concepts || []).some((c) =>
            c.toLowerCase().includes(q)
          )
        );
      })
      .map((x) => x.idx);
  }, [pairs, search]);

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const backHref = `/table-matching?project_id=${encodeURIComponent(
    projectId
  )}`;

  // ═══════════════════════════════════════════════════════
  // Loading / error states
  // ═══════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
        <LoaderCircle className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !set) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-red-900">
                Couldn&apos;t load this pair set
              </h2>
              <p className="text-[12px] text-red-800 mt-1 break-all">
                {error}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            <Link
              href={backHref}
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

  if (!set) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
        <p className="text-[12px] text-slate-500">No data</p>
      </div>
    );
  }

  const displayName = set.name || set.table_mapping_set_id;

  // ═══════════════════════════════════════════════════════
  // Main render
  // ═══════════════════════════════════════════════════════
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Back ─────────────────────────────────────── */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to table matching
        </Link>

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Table matching
              </span>
              <span className="text-[10px] text-slate-300">/</span>
              <span className="text-[10px] font-mono text-slate-400">
                {set.table_mapping_set_id}
              </span>
            </div>
            <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight truncate">
              {displayName}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-[11.5px] text-slate-500 font-mono flex-wrap">
              <span>
                {set.source_system_id} → {set.target_system_id}
              </span>
              <span className="text-slate-300">·</span>
              <span>v{set.version_tag}</span>
              <span className="text-slate-300">·</span>
              <span>
                {pairs.length} pair{pairs.length === 1 ? "" : "s"}
              </span>
              {dirty && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-amber-700 font-medium">
                    Unsaved changes
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={saving}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              title="Reload"
              aria-label="Reload"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {dirty && (
              <button
                type="button"
                onClick={discard}
                disabled={saving}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving || hasDuplicates}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? (
                <>
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Warnings ─────────────────────────────────── */}
        {hasDuplicates && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              <strong>{duplicateKeys.size}</strong> duplicate pair
              {duplicateKeys.size === 1 ? "" : "s"} detected. Remove duplicates
              before saving.
            </span>
          </div>
        )}

        {/* ── Toolbar ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by table, concept, or rationale…"
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
          <button
            type="button"
            onClick={() => setAddPairOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add pair
          </button>
        </div>

        {/* ── Pair list ────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_1fr_180px_90px] gap-3 px-5 py-2.5 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Source table</span>
            <span>Target table</span>
            <span className="text-center">Confidence</span>
            <span className="text-right">Actions</span>
          </div>

          {pairs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Table2 className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="text-[14px] font-semibold text-slate-900">
                No pairs in this set
              </h3>
              <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
                Add pairs manually to start column-level matching.
              </p>
              <button
                type="button"
                onClick={() => setAddPairOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Add first pair
              </button>
            </div>
          ) : filteredIndices.length === 0 ? (
            <div className="px-6 py-12 text-center text-[12px] text-slate-500">
              No pairs match &ldquo;{search}&rdquo;.{" "}
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-slate-900 underline underline-offset-2 font-medium"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredIndices.map((idx) => {
                const pair = pairs[idx];
                const isExpanded = expandedIdx.has(idx);
                const dupKey = `${pair.source_table}::${pair.target_table}`;
                const isDuplicate = duplicateKeys.has(dupKey);
                const pct = Math.round(pair.confidence_score * 100);

                return (
                  <PairRow
                    key={`${dupKey}-${idx}`}
                    pair={pair}
                    pct={pct}
                    isExpanded={isExpanded}
                    isDuplicate={isDuplicate}
                    onToggleExpand={() => toggleExpand(idx)}
                    onChange={(patch) => updatePair(idx, patch)}
                    onRemove={() => removePair(idx)}
                  />
                );
              })}
            </div>
          )}

          {pairs.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-t border-slate-200 bg-slate-50/60 text-[11px] text-slate-500">
              <span>
                <span className="font-mono font-semibold text-slate-800">
                  {filteredIndices.length}
                </span>{" "}
                of {pairs.length} shown
              </span>
              {dirty && (
                <span className="text-amber-700 font-medium">
                  Unsaved changes
                </span>
              )}
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] text-slate-400 text-center">
          Rationale is AI-generated or reviewer-authored at approval time.
        </p>
      </div>

      {/* Add pair modal */}
      {addPairOpen && (
        <AddPairModal
          existing={pairs}
          onClose={() => setAddPairOpen(false)}
          onAdd={(s, t) => {
            const ok = addPair(s, t);
            if (ok) setAddPairOpen(false);
            return ok;
          }}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PairRow — one pair (collapsed + expanded)
// ═════════════════════════════════════════════════════════════
function PairRow({
  pair,
  pct,
  isExpanded,
  isDuplicate,
  onToggleExpand,
  onChange,
  onRemove,
}: {
  pair: TablePair;
  pct: number;
  isExpanded: boolean;
  isDuplicate: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<TablePair>) => void;
  onRemove: () => void;
}) {
  const barColor =
    pct >= 85 ? "bg-slate-900" : pct >= 50 ? "bg-slate-600" : "bg-slate-300";

  const statusLabel = pair.match_status.toLowerCase().replace(/_/g, " ");

  return (
    <div className={isDuplicate ? "bg-red-50/40" : ""}>
      {/* ── Collapsed row ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px_90px] gap-2 md:gap-3 items-start px-4 sm:px-5 py-3">
        {/* Source */}
        <div className="min-w-0">
          <span className="font-mono text-[12px] font-semibold text-slate-900 block truncate">
            {pair.source_table}
          </span>
          {pair.matched_concepts.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {pair.matched_concepts.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600"
                >
                  {c}
                </span>
              ))}
              {pair.matched_concepts.length > 3 && (
                <span className="text-[9.5px] text-slate-400 self-center">
                  +{pair.matched_concepts.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Target */}
        <div className="min-w-0">
          <span className="font-mono text-[12px] font-semibold text-slate-900 block truncate">
            {pair.target_table}
          </span>
          {isDuplicate && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 mt-1">
              <AlertTriangle className="w-3 h-3" />
              Duplicate
            </span>
          )}
        </div>

        {/* Confidence */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[10.5px] font-semibold text-slate-700 tabular-nums shrink-0">
              {pct}%
            </span>
          </div>
          <span className="text-[9.5px] text-slate-400 block capitalize">
            {statusLabel}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
            title="Remove pair"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Rationale preview (always visible, read-only) ── */}
      {pair.rationale && !isExpanded && (
        <div className="px-4 sm:px-5 pb-3">
          <p className="text-[11.5px] text-slate-600 leading-relaxed line-clamp-2">
            {pair.rationale}
          </p>
        </div>
      )}

      {/* ── Expanded ───────────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 sm:px-5 py-4 space-y-4">
          {/* Rationale (full, read-only) */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Rationale
            </label>
            <p className="text-[12px] text-slate-700 leading-[1.65] whitespace-pre-wrap">
              {pair.rationale || (
                <span className="italic text-slate-400">
                  No rationale yet.
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 mt-1.5 italic">
              Read-only. This is AI-generated or reviewer-authored at approval.
            </p>
          </div>

          {/* Confidence slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Adjust confidence
              </label>
              <span className="text-[11px] font-mono font-semibold text-slate-900 tabular-nums">
                {pct}%
              </span>
            </div>
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
          </div>

          {/* Requires masking */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-slate-900">
                Requires masking
              </p>
              <p className="text-[10.5px] text-slate-500 mt-0.5">
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

          {/* Depends on */}
          {pair.depends_on.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Depends on (FK parents)
              </label>
              <div className="flex flex-wrap gap-1">
                {pair.depends_on.map((d) => (
                  <span
                    key={d}
                    className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Matched columns */}
          {pair.matched_columns.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Matched columns ({pair.matched_columns_count})
              </label>
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-1.5">Source</th>
                      <th className="text-left px-3 py-1.5">Target</th>
                      <th className="text-left px-3 py-1.5">Concept</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pair.matched_columns.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-3 py-1.5 font-mono text-[11px] text-slate-900">
                          {c.source_col}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-slate-900">
                          {c.target_col}
                        </td>
                        <td className="px-3 py-1.5 text-[11px] text-slate-600">
                          {c.concept || (
                            <span className="italic text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// AddPairModal — simple inline modal, no shadcn Dialog needed
// ═════════════════════════════════════════════════════════════
function AddPairModal({
  existing,
  onClose,
  onAdd,
}: {
  existing: TablePair[];
  onClose: () => void;
  onAdd: (sourceTable: string, targetTable: string) => boolean;}) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleAdd = () => {
    const s = source.trim();
    const t = target.trim();
    if (!s || !t) {
      setErr("Both source and target table names are required.");
      return;
    }
    const duplicate = existing.some(
      (p) => p.source_table === s && p.target_table === t
    );
    if (duplicate) {
      setErr("This pair already exists in the set.");
      return;
    }
    const ok = onAdd(s, t);
    if (!ok) {
      setErr("Failed to add pair.");
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-pair-title"
    >
      <div className="bg-white rounded-xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-white" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3
                id="add-pair-title"
                className="text-[13.5px] font-semibold text-slate-900"
              >
                Add table pair
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enter both table names manually.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-700 block">
              Source table
            </label>
            <input
              autoFocus
              type="text"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setErr(null);
              }}
              placeholder="e.g. customers"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-slate-900 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-700 block">
              Target table
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setErr(null);
              }}
              placeholder="e.g. accounts"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-slate-900 transition"
            />
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{err}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!source.trim() || !target.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add pair
          </button>
        </div>
      </div>
    </div>
  );
}