"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Search,
  LoaderCircle,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Check,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { API_V1 } from "@/lib/api-config";
import {
  pairMappingApi,
  type PairMappingSet,
  type PairBlock,
  type ColumnRule,
} from "@/lib/pair-mapping-api";
import {
  ColumnPicker,
  type ColumnOption,
} from "@/components/pair-mapping/ColumnPicker";
import { TransformPicker } from "@/components/pair-mapping/TransformPicker";

const API_BASE = API_V1;
const PICKER_PAGE_SIZE = 50;
const PICKER_DEBOUNCE_MS = 250;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
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

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface MatchedColumn {
  source_col: string;
  target_col: string;
  concept?: string;
}

interface TablePair {
  source_table: string;
  target_table: string;
  confidence_score: number;
  match_status:
    | "MATCHED"
    | "UNMATCHED"
    | "MANUAL_OVERRIDE"
    | "APPROVED"
    | "REJECTED"
    | string;
  matched_concepts: string[];
  matched_columns?: MatchedColumn[];
  matched_columns_count?: number;
  rationale?: string;
  requires_masking?: boolean;
  rules_applied?: string[];
  depends_on?: string[];
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

interface TableMeta {
  name: string;
  row_count: number;
  column_count: number;
}

// ─────────────────────────────────────────────────────────────
// Page Entry
// ─────────────────────────────────────────────────────────────
export default function UnifiedMappingStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <LoaderCircle className="w-7 h-7 animate-spin text-[#432DD7]" />
            <span className="text-xs font-medium">Loading Mapping Studio…</span>
          </div>
        </div>
      }
    >
      <UnifiedStudioInner />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Studio Component
// ─────────────────────────────────────────────────────────────
function UnifiedStudioInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const setId = String(params?.id || "");
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table mapping set & pairs
  const [tms, setTms] = useState<TableMappingSet | null>(null);
  const [tablePairs, setTablePairs] = useState<TablePair[]>([]);
  const [selectedPairIndex, setSelectedPairIndex] = useState<number>(0);
  const [showAddPairModal, setShowAddPairModal] = useState(false);

  // Pair mapping set (column rules)
  const [pms, setPms] = useState<PairMappingSet | null>(null);
  const [runningAiPairId, setRunningAiPairId] = useState<string | null>(null);
  const [runningAiAll, setRunningAiAll] = useState(false);

  // Column edits per pair
  const [columnEdits, setColumnEdits] = useState<
    Record<string, Record<string, Partial<ColumnRule>>>
  >({});
  const [columnSearch, setColumnSearch] = useState("");
  const [columnStatusFilter, setColumnStatusFilter] = useState<
    "ALL" | "MATCHED" | "UNMATCHED" | "MANUAL"
  >("ALL");

  // Dataset column schemas
  const [datasetColumns, setDatasetColumns] = useState<
    Record<string, ColumnOption[]>
  >({});

  // Human Review & Sign-Off
  const [reviewerName, setReviewerName] = useState("Lead Data Architect");
  const [reviewComments, setReviewComments] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  // Active Section View
  const [activeTab, setActiveTab] = useState<
    "columns" | "tables" | "signoff"
  >("columns");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── 1. Load Data ─────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!setId) {
      setLoading(false);
      setError("No mapping set ID found in URL.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let loadedTms: TableMappingSet | null = null;
      let loadedPms: PairMappingSet | null = null;

      if (setId.startsWith("pms-")) {
        loadedPms = await pairMappingApi.get(setId);
        if (loadedPms.table_mapping_set_id) {
          const tmsRes = await fetch(
            `${API_BASE}/mapping-sets/${encodeURIComponent(
              projectId
            )}/table-pairs/${encodeURIComponent(
              loadedPms.table_mapping_set_id
            )}`,
            { headers: authHeaders() }
          );
          if (tmsRes.ok) {
            loadedTms = await tmsRes.json();
          }
        }
      } else {
        const tmsRes = await fetch(
          `${API_BASE}/mapping-sets/${encodeURIComponent(
            projectId
          )}/table-pairs/${encodeURIComponent(setId)}`,
          { headers: authHeaders() }
        );
        if (!tmsRes.ok) {
          const b = await tmsRes.json().catch(() => ({}));
          throw new Error(
            b?.detail || `Failed to load table pairs (${tmsRes.status})`
          );
        }
        loadedTms = await tmsRes.json();

        const existingPmsList = await pairMappingApi
          .list(projectId, setId)
          .catch(() => []);
        if (existingPmsList.length > 0) {
          loadedPms = existingPmsList[0];
        } else {
          try {
            loadedPms = await pairMappingApi.createFromTableSet(projectId, {
              table_mapping_set_id: setId,
              name: loadedTms?.name || "Column Mapping Set",
              version_tag: loadedTms?.version_tag || "1.0.0",
            });
          } catch (initErr) {
            console.warn("Could not auto-create pair mapping set:", initErr);
          }
        }
      }

      if (!mountedRef.current) return;

      if (loadedTms) {
        setTms(loadedTms);
        const pairsCopy = (loadedTms.pairs || []).map((p) => ({
          ...p,
          matched_concepts: p.matched_concepts || [],
          depends_on: p.depends_on || [],
        }));
        setTablePairs(pairsCopy);
      }

      if (loadedPms) {
        setPms(loadedPms);
        if (loadedPms.status === "APPROVED") setFinalized(true);
      }

      if (loadedTms?.source_system_id) {
        try {
          const dsRes = await fetch(
            `${API_BASE}/datasets?system_id=${encodeURIComponent(
              loadedTms.source_system_id
            )}`,
            { headers: authHeaders() }
          );
          if (dsRes.ok) {
            const datasets = await dsRes.json();
            const colMap: Record<string, ColumnOption[]> = {};
            for (const ds of datasets) {
              const tblName = ds.physical_name || ds.dataset_name;
              colMap[tblName] = (ds.fields || []).map((f: any) => ({
                name: f.name,
                datatype: f.datatype || "string",
              }));
            }
            if (mountedRef.current) setDatasetColumns(colMap);
          }
        } catch {
          // non-blocking
        }
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message || "Failed to load mapping studio data.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [setId, projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Selected Pair & Column Rules ─────────────────────
  const selectedPair = tablePairs[selectedPairIndex] || null;

  const currentPairBlock: PairBlock | null = useMemo(() => {
    if (!pms || !selectedPair) return null;
    return (
      pms.pairs.find(
        (b) =>
          b.source_table.toLowerCase() ===
            selectedPair.source_table.toLowerCase() &&
          b.target_table.toLowerCase() ===
            selectedPair.target_table.toLowerCase()
      ) || null
    );
  }, [pms, selectedPair]);

  const sourceColumnOptions: ColumnOption[] = useMemo(() => {
    if (!selectedPair) return [];
    const direct = datasetColumns[selectedPair.source_table];
    if (direct && direct.length > 0) return direct;

    const names = new Set<string>();
    for (const mc of selectedPair.matched_columns || []) {
      if (mc.source_col) names.add(mc.source_col);
    }
    for (const col of currentPairBlock?.columns || []) {
      if (col.matched_source_column) names.add(col.matched_source_column);
    }
    return Array.from(names).map((n) => ({ name: n, datatype: "string" }));
  }, [selectedPair, datasetColumns, currentPairBlock]);

  const visibleColumnRules = useMemo(() => {
    if (!currentPairBlock) return [];
    const pairId = currentPairBlock.pair_id;
    const pairEdits = columnEdits[pairId] || {};

    let list = currentPairBlock.columns.map((c) => {
      const patch = pairEdits[c.rule_id] || {};
      return { ...c, ...patch };
    });

    if (columnSearch.trim()) {
      const q = columnSearch.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.target_column.toLowerCase().includes(q) ||
          (c.matched_source_column || "").toLowerCase().includes(q) ||
          (c.transformation_rule || "").toLowerCase().includes(q)
      );
    }

    if (columnStatusFilter === "MATCHED") {
      list = list.filter(
        (c) => c.status === "MATCHED" && !!c.matched_source_column
      );
    } else if (columnStatusFilter === "UNMATCHED") {
      list = list.filter(
        (c) => c.status === "UNMATCHED" || !c.matched_source_column
      );
    } else if (columnStatusFilter === "MANUAL") {
      list = list.filter((c) => c.status === "MANUAL_OVERRIDE");
    }

    return list;
  }, [currentPairBlock, columnEdits, columnSearch, columnStatusFilter]);

  const stats = useMemo(() => {
    const totalTables = tablePairs.length;
    const approvedTables = tablePairs.filter(
      (p) => p.match_status === "APPROVED" || p.match_status === "MATCHED"
    ).length;

    let totalCols = 0;
    let mappedCols = 0;

    for (const b of pms?.pairs || []) {
      for (const c of b.columns) {
        totalCols++;
        if (c.matched_source_column) mappedCols++;
      }
    }

    const avgConfidence =
      totalTables > 0
        ? tablePairs.reduce((acc, p) => acc + (p.confidence_score || 0), 0) /
          totalTables
        : 0;

    return {
      totalTables,
      approvedTables,
      totalCols,
      mappedCols,
      colPct: totalCols > 0 ? Math.round((mappedCols / totalCols) * 100) : 0,
      avgConfidence: (avgConfidence * 100).toFixed(0),
    };
  }, [tablePairs, pms]);

  // ── Mutators ─────────────────────────────────────────
  const handleAddTablePair = (
    sourceTable: string,
    targetTable: string
  ): boolean => {
    const exists = tablePairs.some(
      (p) =>
        p.source_table.toLowerCase() === sourceTable.toLowerCase() &&
        p.target_table.toLowerCase() === targetTable.toLowerCase()
    );
    if (exists) return false;

    const newPair: TablePair = {
      source_table: sourceTable,
      target_table: targetTable,
      confidence_score: 1.0,
      match_status: "MANUAL_OVERRIDE",
      matched_concepts: [],
      matched_columns: [],
      matched_columns_count: 0,
      rationale: "Manually paired in studio.",
      requires_masking: false,
      rules_applied: [],
      depends_on: [],
    };
    setTablePairs((prev) => {
      const next = [...prev, newPair];
      setSelectedPairIndex(next.length - 1);
      return next;
    });
    toast.success(`Added ${sourceTable} → ${targetTable}`);
    return true;
  };

  const handleRemoveTablePair = (index: number) => {
    setTablePairs((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (selectedPairIndex >= next.length) {
        setSelectedPairIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleToggleTableApproval = (index: number) => {
    setTablePairs((prev) => {
      const next = [...prev];
      const curr = next[index];
      const isApproved = curr.match_status === "APPROVED";
      next[index] = {
        ...curr,
        match_status: isApproved ? "PENDING_REVIEW" : "APPROVED",
      };
      return next;
    });
  };

  const handleRejectTable = (index: number) => {
    setTablePairs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], match_status: "REJECTED" };
      return next;
    });
    toast.info("Table pair marked as rejected.");
  };

  const handleUpdateTablePair = (index: number, patch: Partial<TablePair>) => {
    setTablePairs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleEditColumn = (ruleId: string, patch: Partial<ColumnRule>) => {
    if (!currentPairBlock) return;
    const pairId = currentPairBlock.pair_id;
    setColumnEdits((prev) => ({
      ...prev,
      [pairId]: {
        ...(prev[pairId] || {}),
        [ruleId]: {
          ...(prev[pairId]?.[ruleId] || {}),
          ...patch,
          status: "MANUAL_OVERRIDE",
        },
      },
    }));
  };

  const saveTablePairs = async () => {
    if (!tms) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(
          projectId
        )}/table-pairs/${encodeURIComponent(tms.table_mapping_set_id)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ pairs: tablePairs }),
        }
      );
      if (!res.ok) throw new Error("Failed to save table pairs");
      toast.success("Table pairs saved.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save table pairs");
    } finally {
      setSaving(false);
    }
  };

  const saveCurrentPairColumns = async () => {
    if (!pms || !currentPairBlock) return;
    const pairId = currentPairBlock.pair_id;
    const pairEdits = columnEdits[pairId];
    if (!pairEdits || Object.keys(pairEdits).length === 0) {
      toast.info("No column modifications to save for this table.");
      return;
    }

    setSaving(true);
    const adjustments = Object.entries(pairEdits).map(([ruleId, patch]) => {
      const orig = currentPairBlock.columns.find((c) => c.rule_id === ruleId);
      return {
        target_column: patch.target_column || orig?.target_column || "",
        matched_source_column:
          patch.matched_source_column !== undefined
            ? patch.matched_source_column
            : orig?.matched_source_column,
        transformation_rule:
          patch.transformation_rule ||
          orig?.transformation_rule ||
          "direct_cast",
        default_value:
          patch.default_value !== undefined
            ? patch.default_value
            : orig?.default_value,
        confidence_score:
          patch.confidence_score !== undefined
            ? patch.confidence_score
            : orig?.confidence_score,
      };
    });

    try {
      const updated = await pairMappingApi.reviewPair(pms.set_id, pairId, {
        adjustments,
        actor: reviewerName,
        comments: "Reviewed in Mapping Studio",
      });
      setPms(updated);
      setColumnEdits((prev) => {
        const next = { ...prev };
        delete next[pairId];
        return next;
      });
      toast.success(`Saved column rules for ${currentPairBlock.target_table}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save column rules");
    } finally {
      setSaving(false);
    }
  };

  const runAutoMapOnSelectedPair = async () => {
    if (!pms || !currentPairBlock) return;
    const pairId = currentPairBlock.pair_id;
    setRunningAiPairId(pairId);
    try {
      const updated = await pairMappingApi.runAiOnPair(pms.set_id, pairId, {
        use_ai: true,
      });
      setPms(updated);
      toast.success(
        `Auto-mapped columns for ${currentPairBlock.target_table}`
      );
    } catch (e: any) {
      toast.error(e?.message || "Column auto-mapping failed");
    } finally {
      setRunningAiPairId(null);
    }
  };

  const runAutoMapOnAllPairs = async () => {
    if (!pms) return;
    setRunningAiAll(true);
    try {
      const updated = await pairMappingApi.runAiOnAll(pms.set_id, {
        use_ai: true,
      });
      setPms(updated);
      toast.success("Auto-mapped columns across all tables.");
    } catch (e: any) {
      toast.error(e?.message || "Batch column mapping failed");
    } finally {
      setRunningAiAll(false);
    }
  };

  const handleFinalizeAndApproveAll = async () => {
    if (!pms || !tms) return;
    setFinalizing(true);
    try {
      await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(
          projectId
        )}/table-pairs/${encodeURIComponent(tms.table_mapping_set_id)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            pairs: tablePairs.map((p) => ({
              ...p,
              match_status:
                p.match_status === "REJECTED" ? "REJECTED" : "APPROVED",
            })),
          }),
        }
      );

      const finalizedSet = await pairMappingApi.finalize(pms.set_id, {
        actor: reviewerName,
        comments:
          reviewComments || "Approved and signed off via Mapping Studio",
      });

      setPms(finalizedSet);
      setFinalized(true);
      toast.success("Mapping set approved and finalized.");
    } catch (e: any) {
      toast.error(e?.message || "Finalization failed");
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] flex flex-col items-center justify-center gap-3 text-slate-500">
        <LoaderCircle className="w-7 h-7 animate-spin text-[#432DD7]" />
        <p className="text-xs font-medium">Loading Mapping Studio…</p>
      </div>
    );
  }

  if (error || !tms) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-slate-900">
            Unable to load mapping set
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || "Mapping set not found."}
          </p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#432DD7] hover:bg-[#3724B5] text-white rounded-lg text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] text-slate-900 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ─────────────────────────────────────────────────────────────
            1. Page Header & Primary Controls
        ───────────────────────────────────────────────────────────── */}
        <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-slate-200/90 pb-5">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/table-matching?project_id=${encodeURIComponent(projectId)}`
                )
              }
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
              title="Back to Table Pair Sets"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 break-words">
                  {tms.name ||
                    `${tms.source_system_id} → ${tms.target_system_id}`}
                </h1>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                  v{tms.version_tag}
                </span>
                {finalized ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" /> Signed Off
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#432DD7]" />
                    Draft · Review Gate
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-500 break-all">
                {tms.source_system_id} → {tms.target_system_id}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!finalized && (
              <button
                type="button"
                onClick={() => setShowAddPairModal(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add table pair</span>
              </button>
            )}

            <button
              type="button"
              onClick={runAutoMapOnAllPairs}
              disabled={runningAiAll || finalized}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition disabled:opacity-40"
            >
              {runningAiAll ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin text-[#432DD7]" />
              ) : (
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{runningAiAll ? "Mapping all…" : "Auto-map all"}</span>
            </button>

            <button
              type="button"
              onClick={() => void saveTablePairs()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#432DD7] hover:bg-[#3724B5] text-white text-xs font-medium transition disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save changes</span>
            </button>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────
            2. Compact KPI & Section Navigation Bar
        ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 self-start overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab("columns")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                activeTab === "columns"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Column Mappings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tables")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                activeTab === "tables"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Table Matrix ({tablePairs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("signoff")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                activeTab === "signoff"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Review & Sign-Off
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs">
            <div>
              <span className="text-slate-400">Tables approved: </span>
              <strong className="font-mono font-semibold text-slate-900">
                {stats.approvedTables}/{stats.totalTables}
              </strong>
            </div>
            <span className="text-slate-200 hidden sm:inline">|</span>
            <div>
              <span className="text-slate-400">Columns mapped: </span>
              <strong className="font-mono font-semibold text-slate-900">
                {stats.mappedCols}/{stats.totalCols} ({stats.colPct}%)
              </strong>
            </div>
            <span className="text-slate-200 hidden sm:inline">|</span>
            <div>
              <span className="text-slate-400">Avg confidence: </span>
              <strong className="font-mono font-semibold text-slate-900">
                {stats.avgConfidence}%
              </strong>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. TAB 1: COLUMN MAPPINGS
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "columns" && (
          <div className="space-y-5">
            {/* Active Table Pair Custom Paginated Dropdown Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Active Table Pair ({tablePairs.length} total)
                  </span>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-full sm:max-w-xl">
                      <TablePairCustomDropdown
                        pairs={tablePairs}
                        selectedIndex={selectedPairIndex}
                        onSelect={setSelectedPairIndex}
                      />
                    </div>

                    {selectedPair && (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleTableApproval(selectedPairIndex)
                        }
                        className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border text-xs font-medium transition self-start sm:self-auto shrink-0 ${
                          selectedPair.match_status === "APPROVED"
                            ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {selectedPair.match_status === "APPROVED"
                            ? "Table Approved"
                            : "Approve Table"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Per-Table Actions */}
                {selectedPair && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={runAutoMapOnSelectedPair}
                      disabled={
                        runningAiPairId === currentPairBlock?.pair_id ||
                        finalized
                      }
                      className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition disabled:opacity-40"
                    >
                      {runningAiPairId === currentPairBlock?.pair_id ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin text-[#432DD7]" />
                      ) : (
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>Auto-map table</span>
                    </button>

                    <button
                      type="button"
                      onClick={saveCurrentPairColumns}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition disabled:opacity-40"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save columns</span>
                    </button>
                  </div>
                )}
              </div>

              {selectedPair?.rationale && (
                <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3 break-words">
                  {selectedPair.rationale}
                </p>
              )}
            </div>

            {/* Column Search & Filter Toolbar */}
            {selectedPair && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter columns by name or transform…"
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7]"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  {(
                    [
                      {
                        key: "ALL",
                        label: `All (${
                          currentPairBlock?.columns.length || 0
                        })`,
                      },
                      {
                        key: "MATCHED",
                        label: `Mapped (${
                          currentPairBlock?.columns.filter(
                            (c) => !!c.matched_source_column
                          ).length || 0
                        })`,
                      },
                      {
                        key: "UNMATCHED",
                        label: `Unmapped (${
                          currentPairBlock?.columns.filter(
                            (c) => !c.matched_source_column
                          ).length || 0
                        })`,
                      },
                      {
                        key: "MANUAL",
                        label: `Edited (${
                          currentPairBlock?.columns.filter(
                            (c) => c.status === "MANUAL_OVERRIDE"
                          ).length || 0
                        })`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setColumnStatusFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                        columnStatusFilter === tab.key
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Spacious Column Mapping List */}
            {selectedPair ? (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Desktop Table (lg and up) */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                        <th className="py-3.5 px-5 w-[24%]">
                          Target Column ({selectedPair.target_table})
                        </th>
                        <th className="py-3.5 px-5 w-[26%]">
                          Source Column ({selectedPair.source_table})
                        </th>
                        <th className="py-3.5 px-5 w-[22%]">
                          Transformation
                        </th>
                        <th className="py-3.5 px-5 w-[16%]">Default Value</th>
                        <th className="py-3.5 px-5 text-right w-[12%]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleColumnRules.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-12 text-center text-slate-400"
                          >
                            No columns match your filter.
                          </td>
                        </tr>
                      ) : (
                        visibleColumnRules.map((col) => {
                          const isMatched = !!col.matched_source_column;
                          const isManual = col.status === "MANUAL_OVERRIDE";

                          return (
                            <tr
                              key={col.rule_id}
                              className="hover:bg-[#F8FAFC] transition"
                            >
                              <td className="py-3.5 px-5 align-middle">
                                <div className="font-mono text-[12.5px] font-semibold text-slate-900 break-all">
                                  {col.target_column}
                                  {!col.target_nullable && (
                                    <span
                                      className="ml-1 text-rose-500 font-bold"
                                      title="Required"
                                    >
                                      *
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  {col.target_datatype}
                                </div>
                              </td>

                              <td className="py-3.5 px-5 align-middle">
                                <ColumnPicker
                                  value={col.matched_source_column}
                                  options={sourceColumnOptions}
                                  onChange={(val) =>
                                    handleEditColumn(col.rule_id, {
                                      matched_source_column: val,
                                      transformation_rule: val
                                        ? col.transformation_rule ||
                                          "direct_cast"
                                        : null,
                                    })
                                  }
                                  placeholder="Select source column"
                                  readOnly={finalized}
                                />
                              </td>

                              <td className="py-3.5 px-5 align-middle">
                                <TransformPicker
                                  value={
                                    col.transformation_rule || "direct_cast"
                                  }
                                  onChange={(val) =>
                                    handleEditColumn(col.rule_id, {
                                      transformation_rule: val,
                                    })
                                  }
                                  disabled={
                                    !col.matched_source_column || finalized
                                  }
                                  readOnly={finalized}
                                />
                              </td>

                              <td className="py-3.5 px-5 align-middle">
                                <input
                                  type="text"
                                  value={col.default_value || ""}
                                  placeholder="Optional fallback"
                                  disabled={finalized}
                                  onChange={(e) =>
                                    handleEditColumn(col.rule_id, {
                                      default_value: e.target.value,
                                    })
                                  }
                                  className="w-full h-9 bg-white border border-slate-200 rounded-lg px-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] font-mono text-xs"
                                />
                              </td>

                              <td className="py-3.5 px-5 align-middle text-right">
                                {isManual ? (
                                  <span className="inline-block px-2 py-0.5 rounded border border-[#432DD7]/30 bg-white text-[#432DD7] text-[10.5px] font-medium">
                                    Edited
                                  </span>
                                ) : isMatched ? (
                                  <div className="inline-flex flex-col items-end">
                                    <span className="px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50/70 text-emerald-700 text-[10.5px] font-medium">
                                      Mapped
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                      {Math.round(col.confidence_score * 100)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 text-[10.5px]">
                                    Unmapped
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Tablet Stacked Cards (< lg) */}
                <div className="divide-y divide-slate-200 lg:hidden">
                  {visibleColumnRules.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No columns match your filter.
                    </div>
                  ) : (
                    visibleColumnRules.map((col) => {
                      const isMatched = !!col.matched_source_column;
                      const isManual = col.status === "MANUAL_OVERRIDE";

                      return (
                        <div key={col.rule_id} className="p-4 space-y-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-mono text-xs font-semibold text-slate-900 break-all">
                                {col.target_column}
                                {!col.target_nullable && (
                                  <span className="ml-1 text-rose-500">*</span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {col.target_datatype}
                              </div>
                            </div>

                            {isManual ? (
                              <span className="px-2 py-0.5 rounded border border-[#432DD7]/30 text-[#432DD7] text-[10px] font-medium shrink-0">
                                Edited
                              </span>
                            ) : isMatched ? (
                              <span className="px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50/70 text-emerald-700 text-[10px] font-medium shrink-0">
                                Mapped ({Math.round(col.confidence_score * 100)}
                                %)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-400 text-[10px] shrink-0">
                                Unmapped
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="block text-[10.5px] font-medium text-slate-500 mb-1">
                                Source Column
                              </span>
                              <ColumnPicker
                                value={col.matched_source_column}
                                options={sourceColumnOptions}
                                onChange={(val) =>
                                  handleEditColumn(col.rule_id, {
                                    matched_source_column: val,
                                    transformation_rule: val
                                      ? col.transformation_rule || "direct_cast"
                                      : null,
                                  })
                                }
                                placeholder="Select source column"
                                readOnly={finalized}
                              />
                            </div>

                            <div>
                              <span className="block text-[10.5px] font-medium text-slate-500 mb-1">
                                Transformation
                              </span>
                              <TransformPicker
                                value={col.transformation_rule || "direct_cast"}
                                onChange={(val) =>
                                  handleEditColumn(col.rule_id, {
                                    transformation_rule: val,
                                  })
                                }
                                disabled={
                                  !col.matched_source_column || finalized
                                }
                                readOnly={finalized}
                              />
                            </div>
                          </div>

                          <div>
                            <span className="block text-[10.5px] font-medium text-slate-500 mb-1">
                              Default Value
                            </span>
                            <input
                              type="text"
                              value={col.default_value || ""}
                              placeholder="Optional fallback value"
                              disabled={finalized}
                              onChange={(e) =>
                                handleEditColumn(col.rule_id, {
                                  default_value: e.target.value,
                                })
                              }
                              className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] font-mono text-xs"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
                No table pairs in this set yet. Click{" "}
                <strong>Add table pair</strong> above to get started.
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            4. TAB 2: TABLE ALIGNMENT MATRIX
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "tables" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Table Alignment & Wave Matrix
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure confidence thresholds, PII masking flags, and
                  approval decisions for each table pair.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!finalized && (
                  <button
                    type="button"
                    onClick={() => setShowAddPairModal(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add pair
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void saveTablePairs()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#432DD7] hover:bg-[#3724B5] text-white text-xs font-medium rounded-lg transition"
                >
                  <Save className="w-3.5 h-3.5" /> Save matrix
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                      <th className="py-3.5 px-5">Source Table</th>
                      <th className="py-3.5 px-5">Target Table</th>
                      <th className="py-3.5 px-5 w-44">Confidence</th>
                      <th className="py-3.5 px-5">Wave Dependency</th>
                      <th className="py-3.5 px-5 w-28">Masking</th>
                      <th className="py-3.5 px-5 text-right w-52">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tablePairs.map((pair, idx) => {
                      const pct = Math.round((pair.confidence_score || 0) * 100);
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-[#F8FAFC] transition"
                        >
                          <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 break-all">
                            {pair.source_table}
                          </td>
                          <td className="py-3.5 px-5 font-mono font-semibold text-slate-700 break-all">
                            {pair.target_table}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={pct}
                                disabled={finalized}
                                onChange={(e) =>
                                  handleUpdateTablePair(idx, {
                                    confidence_score:
                                      Number(e.target.value) / 100,
                                    match_status: "MANUAL_OVERRIDE",
                                  })
                                }
                                className="w-24 accent-[#432DD7]"
                              />
                              <span className="font-mono text-slate-700 font-semibold tabular-nums">
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-slate-500">
                            {pair.depends_on && pair.depends_on.length > 0 ? (
                              <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700">
                                {pair.depends_on.join(", ")}
                              </span>
                            ) : (
                              <span className="text-slate-400">Wave 1</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5">
                            <button
                              type="button"
                              disabled={finalized}
                              onClick={() =>
                                handleUpdateTablePair(idx, {
                                  requires_masking: !pair.requires_masking,
                                })
                              }
                              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition ${
                                pair.requires_masking
                                  ? "border-amber-200 bg-amber-50/70 text-amber-800"
                                  : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              {pair.requires_masking ? "PII Mask" : "None"}
                            </button>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleTableApproval(idx)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                                  pair.match_status === "APPROVED"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
                                }`}
                              >
                                {pair.match_status === "APPROVED"
                                  ? "Approved"
                                  : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectTable(idx)}
                                className={`px-2.5 py-1 rounded-md text-xs border transition ${
                                  pair.match_status === "REJECTED"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-white text-slate-500 border-slate-200 hover:text-rose-600"
                                }`}
                              >
                                Reject
                              </button>
                              {!finalized && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTablePair(idx)}
                                  title="Remove pair"
                                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards (< lg) */}
              <div className="divide-y divide-slate-200 lg:hidden">
                {tablePairs.map((pair, idx) => {
                  const pct = Math.round((pair.confidence_score || 0) * 100);
                  return (
                    <div key={idx} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-mono text-xs space-y-0.5">
                          <div className="font-semibold text-slate-900 break-all">
                            {pair.source_table}
                          </div>
                          <div className="text-slate-500 break-all">
                            → {pair.target_table}
                          </div>
                        </div>
                        {!finalized && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTablePair(idx)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-500">
                          Confidence:
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={pct}
                          disabled={finalized}
                          onChange={(e) =>
                            handleUpdateTablePair(idx, {
                              confidence_score: Number(e.target.value) / 100,
                              match_status: "MANUAL_OVERRIDE",
                            })
                          }
                          className="flex-1 accent-[#432DD7]"
                        />
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {pct}%
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          disabled={finalized}
                          onClick={() =>
                            handleUpdateTablePair(idx, {
                              requires_masking: !pair.requires_masking,
                            })
                          }
                          className={`px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                            pair.requires_masking
                              ? "border-amber-200 bg-amber-50/70 text-amber-800"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          {pair.requires_masking ? "PII Masking" : "No Masking"}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleTableApproval(idx)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                              pair.match_status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-white text-slate-600 border-slate-200"
                            }`}
                          >
                            {pair.match_status === "APPROVED"
                              ? "Approved"
                              : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectTable(idx)}
                            className={`px-2.5 py-1 rounded-md text-xs border ${
                              pair.match_status === "REJECTED"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-white text-slate-500 border-slate-200"
                            }`}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            5. TAB 3: SIGN-OFF GATE
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "signoff" && (
          <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Human Review & Formal Sign-Off
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Finalizing locks the SHA-256 content hash of your table pairs
                and column transformation rules for deterministic pipeline
                execution.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tables Approved
                </div>
                <div className="text-lg font-semibold font-mono text-slate-900">
                  {stats.approvedTables} / {stats.totalTables}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Column Coverage
                </div>
                <div className="text-lg font-semibold font-mono text-slate-900">
                  {stats.mappedCols} / {stats.totalCols} ({stats.colPct}%)
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Gate Status
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {finalized ? "Signed Off" : "Pending"}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Reviewer Identity
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  disabled={finalized}
                  className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-900 focus:outline-none focus:border-[#432DD7]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Sign-Off Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  disabled={finalized}
                  placeholder="e.g. Verified column transforms and PII masking policies."
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7]"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <p className="text-[11px] text-slate-400">
                  Computes and persists a tamper-evident SHA-256 hash.
                </p>

                <button
                  type="button"
                  onClick={handleFinalizeAndApproveAll}
                  disabled={finalizing || finalized}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[#432DD7] hover:bg-[#3724B5] text-white text-xs font-medium transition disabled:opacity-40"
                >
                  {finalizing ? (
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {finalized
                      ? "Signed Off & Approved"
                      : "Approve & Finalize Set"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. Inlined Manual Pair Add Modal
      ───────────────────────────────────────────────────────────── */}
      {showAddPairModal && tms && (
        <ManualPairAddModal
          sourceSystemId={tms.source_system_id}
          targetSystemId={tms.target_system_id}
          onClose={() => setShowAddPairModal(false)}
          onAdd={handleAddTablePair}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Custom Paginated & Searchable Dropdown for Table Pairs
// ═════════════════════════════════════════════════════════════
function TablePairCustomDropdown({
  pairs,
  selectedIndex,
  onSelect,
}: {
  pairs: TablePair[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const DROPDOWN_PAGE_SIZE = 10;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pairs
      .map((pair, idx) => ({ pair, idx }))
      .filter(({ pair }) => {
        if (!q) return true;
        return (
          pair.source_table.toLowerCase().includes(q) ||
          pair.target_table.toLowerCase().includes(q)
        );
      });
  }, [pairs, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / DROPDOWN_PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = page * DROPDOWN_PAGE_SIZE;
    return filtered.slice(start, start + DROPDOWN_PAGE_SIZE);
  }, [filtered, page]);

  const selected = pairs[selectedIndex] || null;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border bg-white text-left flex items-center justify-between gap-3 transition ${
          open
            ? "border-[#432DD7] ring-[3px] ring-[#432DD7]/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {selected ? (
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1 font-mono text-xs sm:text-[13px]">
            <span className="text-slate-400 font-normal">
              #{selectedIndex + 1}
            </span>
            <span className="font-semibold text-slate-900 break-all">
              {selected.source_table}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 break-all">
              {selected.target_table}
            </span>
            <span className="ml-auto text-[11px] font-medium text-slate-500 shrink-0">
              {Math.round((selected.confidence_score || 0) * 100)}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Select a table pair…</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            open ? "rotate-180 text-[#432DD7]" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* Search Input */}
          <div className="p-2.5 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search source or target table…"
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-200 bg-[#F8FAFC] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#432DD7] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                No matching table pairs found.
              </div>
            ) : (
              paginated.map(({ pair, idx }) => {
                const isSelected = idx === selectedPairIndex;
                const isApproved = pair.match_status === "APPROVED";

                return (
                  <button
                    key={`${pair.source_table}-${pair.target_table}-${idx}`}
                    type="button"
                    onClick={() => {
                      onSelect(idx);
                      setOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left flex items-start justify-between gap-3 transition ${
                      isSelected ? "bg-[#F8FAFC]" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
                        <span className="text-slate-400">#{idx + 1}</span>
                        <span
                          className={`break-all ${
                            isSelected
                              ? "font-semibold text-[#432DD7]"
                              : "font-semibold text-slate-900"
                          }`}
                        >
                          {pair.source_table}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 break-all">
                          {pair.target_table}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10.5px] font-mono text-slate-400">
                        <span>
                          {Math.round((pair.confidence_score || 0) * 100)}% match
                        </span>
                        {isApproved && (
                          <span className="text-emerald-600 font-medium">
                            · Approved
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#432DD7] shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Dropdown Pagination Footer */}
          <div className="px-3.5 py-2 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="font-mono">
              {filtered.length === 0
                ? "0 items"
                : `${page * DROPDOWN_PAGE_SIZE + 1}–${Math.min(
                    filtered.length,
                    (page + 1) * DROPDOWN_PAGE_SIZE
                  )} of ${filtered.length}`}
            </span>

            {totalPages > 1 && (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-mono text-slate-700">
                  {page + 1}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Inlined TablePickerPanel (searchable, infinite-scroll)
// ═════════════════════════════════════════════════════════════
function TablePickerPanel({
  systemId,
  value,
  onChange,
  placeholder,
}: {
  systemId: string;
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
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
    const t = setTimeout(
      () => setSearchQuery(searchInput.trim()),
      PICKER_DEBOUNCE_MS
    );
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
          limit: String(PICKER_PAGE_SIZE),
        });
        const res = await fetch(
          `${API_BASE}/systems/${encodeURIComponent(
            systemId
          )}/tables?${params.toString()}`,
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

  return (
    <div className="h-full flex flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="p-2 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-white border border-slate-200 focus-within:border-[#432DD7] transition-colors">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={placeholder ?? "Search tables…"}
            className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
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
        className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100"
      >
        {tables.length === 0 && loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-xs text-slate-500">
            <LoaderCircle className="w-4 h-4 animate-spin text-[#432DD7]" />
            Loading tables…
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center text-xs text-rose-600">
            {error}
          </div>
        ) : tables.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-slate-400">
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
                  className={`w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 transition ${
                    selected
                      ? "bg-[#F8FAFC] border-l-2 border-l-[#432DD7]"
                      : "hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-mono text-xs break-all ${
                        selected
                          ? "text-slate-900 font-semibold"
                          : "text-slate-800 font-medium"
                      }`}
                    >
                      {t.name}
                    </div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5 tabular-nums">
                      {t.row_count.toLocaleString()} rows · {t.column_count}{" "}
                      cols
                    </div>
                  </div>
                  {selected && (
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#432DD7]" />
                  )}
                </button>
              );
            })}
            {loading && (
              <div className="flex items-center justify-center gap-2 px-3 py-3 text-[11px] text-slate-400">
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                Loading more…
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-slate-100 bg-white flex items-center justify-between gap-2 text-[10.5px] text-slate-400 shrink-0">
        <span>
          {tables.length} of {total}
        </span>
        {hasMore && <span>scroll for more</span>}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-slate-600 hover:text-rose-600 font-medium"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Inlined ManualPairAddModal
// ═════════════════════════════════════════════════════════════
function ManualPairAddModal({
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
  const [error, setError] = useState<string | null>(null);
  const valid = !!sourceTable && !!targetTable;

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
    if (!valid) return;
    setError(null);
    const ok = onAdd(sourceTable, targetTable);
    if (ok) {
      onClose();
    } else {
      setError("This pair already exists in the set.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-xl border border-slate-200 shadow-xl flex flex-col h-[92vh] sm:h-[82vh] sm:max-h-[760px] overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Add table pair
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a source table and target table from the connected systems.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-5 flex flex-col">
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4">
            <div className="min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Source table
                </span>
                {sourceTable && (
                  <span className="text-[10px] font-mono text-[#432DD7] font-medium">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-[220px] md:min-h-0">
                <TablePickerPanel
                  systemId={sourceSystemId}
                  value={sourceTable}
                  onChange={setSourceTable}
                  placeholder="Search source tables…"
                />
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Target table
                </span>
                {targetTable && (
                  <span className="text-[10px] font-mono text-[#432DD7] font-medium">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-[220px] md:min-h-0">
                <TablePickerPanel
                  systemId={targetSystemId}
                  value={targetTable}
                  onChange={setTargetTable}
                  placeholder="Search target tables…"
                />
              </div>
            </div>
          </div>

          {(valid || error) && (
            <div className="shrink-0 mt-3 space-y-2">
              {valid && (
                <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-slate-900 break-all">
                    {sourceTable}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono text-xs font-semibold text-slate-900 break-all">
                    {targetTable}
                  </span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={handleAdd}
            className="h-9 px-4 rounded-lg bg-[#432DD7] hover:bg-[#3724B5] text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add pair</span>
          </button>
        </div>
      </div>
    </div>
  );
}