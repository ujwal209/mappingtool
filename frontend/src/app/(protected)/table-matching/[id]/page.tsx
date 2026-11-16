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
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
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
  CheckCircle2,
  Shield,
  Sparkles,
  Database,
  Filter,
  Check,
  X,
  Play,
  FileCheck2,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";

import { API_V1 } from "@/lib/api-config";
import {
  pairMappingApi,
  type PairMappingSet,
  type PairBlock,
  type ColumnRule,
} from "@/lib/pair-mapping-api";
import { ColumnPicker, type ColumnOption } from "@/components/pair-mapping/ColumnPicker";
import { TransformPicker } from "@/components/pair-mapping/TransformPicker";

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

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface TablePair {
  source_table: string;
  target_table: string;
  confidence_score: number;
  match_status: "MATCHED" | "UNMATCHED" | "MANUAL_OVERRIDE" | "APPROVED" | "REJECTED" | string;
  matched_concepts: string[];
  matched_columns?: Array<{ source_col: string; target_col: string; concept?: string }>;
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

export default function UnifiedMappingStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-slate-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <LoaderCircle className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading Mapping Studio…</span>
          </div>
        </div>
      }
    >
      <UnifiedStudioInner />
    </Suspense>
  );
}

function UnifiedStudioInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const setId = String(params?.id || "");
  const projectId = resolveProjectId(searchParams.get("project_id"));

  // ── States ───────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table mapping set & pairs
  const [tms, setTms] = useState<TableMappingSet | null>(null);
  const [tablePairs, setTablePairs] = useState<TablePair[]>([]);
  const [baselineTablePairs, setBaselineTablePairs] = useState<TablePair[]>([]);
  const [selectedPairIndex, setSelectedPairIndex] = useState<number>(0);

  // Pair mapping set (column rules)
  const [pms, setPms] = useState<PairMappingSet | null>(null);
  const [runningAiPairId, setRunningAiPairId] = useState<string | null>(null);
  const [runningAiAll, setRunningAiAll] = useState(false);

  // Column edits per pair
  const [columnEdits, setColumnEdits] = useState<Record<string, Record<string, Partial<ColumnRule>>>>({});
  const [columnSearch, setColumnSearch] = useState("");
  const [columnStatusFilter, setColumnStatusFilter] = useState<"ALL" | "MATCHED" | "UNMATCHED" | "MANUAL">("ALL");

  // System & dataset column options
  const [datasetColumns, setDatasetColumns] = useState<Record<string, ColumnOption[]>>({});

  // Human Review & Sign-Off
  const [reviewerName, setReviewerName] = useState("Lead Data Architect");
  const [reviewComments, setReviewComments] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"studio" | "table_matrix" | "signoff">("studio");
  const [tableFilter, setTableFilter] = useState<"ALL" | "APPROVED" | "PENDING">("ALL");
  const [tableSearch, setTableSearch] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── 1. Fetch or Initialize Sets ──────────────────────
  const loadData = useCallback(async () => {
    if (!setId) {
      setLoading(false);
      setError("No mapping set ID found in URL.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Step A: Load TableMappingSet
      let loadedTms: TableMappingSet | null = null;
      let loadedPms: PairMappingSet | null = null;

      if (setId.startsWith("pms-")) {
        // ID is a PairMappingSet
        loadedPms = await pairMappingApi.get(setId);
        if (loadedPms.table_mapping_set_id) {
          const tmsRes = await fetch(
            `${API_BASE}/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/${encodeURIComponent(loadedPms.table_mapping_set_id)}`,
            { headers: authHeaders() }
          );
          if (tmsRes.ok) {
            loadedTms = await tmsRes.json();
          }
        }
      } else {
        // ID is a TableMappingSet
        const tmsRes = await fetch(
          `${API_BASE}/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/${encodeURIComponent(setId)}`,
          { headers: authHeaders() }
        );
        if (!tmsRes.ok) {
          const b = await tmsRes.json().catch(() => ({}));
          throw new Error(b?.detail || `Failed to load table pairs (${tmsRes.status})`);
        }
        loadedTms = await tmsRes.json();

        // Check if matching PairMappingSet exists
        const existingPmsList = await pairMappingApi.list(projectId, setId).catch(() => []);
        if (existingPmsList.length > 0) {
          loadedPms = existingPmsList[0];
        } else {
          // Initialize PairMappingSet from table set
          try {
            loadedPms = await pairMappingApi.createFromTableSet(projectId, {
              table_mapping_set_id: setId,
              name: loadedTms?.name || "Auto-Generated Column Mapping Set",
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
        const pairsCopy = (loadedTms.pairs || []).map((p) => ({ ...p }));
        setTablePairs(pairsCopy);
        setBaselineTablePairs(pairsCopy.map((p) => ({ ...p })));
      }

      if (loadedPms) {
        setPms(loadedPms);
        if (loadedPms.status === "APPROVED") setFinalized(true);
      }

      // Load dataset column schemas for pickers
      if (loadedTms?.source_system_id) {
        try {
          const dsRes = await fetch(`${API_BASE}/datasets?system_id=${encodeURIComponent(loadedTms.source_system_id)}`, {
            headers: authHeaders(),
          });
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

  // ── Selected Pair & Available Columns ───────────────
  const selectedPair = tablePairs[selectedPairIndex] || null;

  const currentPairBlock: PairBlock | null = useMemo(() => {
    if (!pms || !selectedPair) return null;
    return (
      pms.pairs.find(
        (b) =>
          b.source_table.toLowerCase() === selectedPair.source_table.toLowerCase() &&
          b.target_table.toLowerCase() === selectedPair.target_table.toLowerCase()
      ) || null
    );
  }, [pms, selectedPair]);

  const sourceColumnOptions: ColumnOption[] = useMemo(() => {
    if (!selectedPair) return [];
    const direct = datasetColumns[selectedPair.source_table];
    if (direct && direct.length > 0) return direct;

    // Fallback: extract from seeded matched_columns or known rules
    const names = new Set<string>();
    for (const mc of selectedPair.matched_columns || []) {
      if (mc.source_col) names.add(mc.source_col);
    }
    for (const col of currentPairBlock?.columns || []) {
      if (col.matched_source_column) names.add(col.matched_source_column);
    }
    return Array.from(names).map((n) => ({ name: n, datatype: "string" }));
  }, [selectedPair, datasetColumns, currentPairBlock]);

  // ── Filtered Column Rules for Selected Pair ─────────
  const visibleColumnRules = useMemo(() => {
    if (!currentPairBlock) return [];
    const pairId = currentPairBlock.pair_id;
    const pairEdits = columnEdits[pairId] || {};

    let list = currentPairBlock.columns.map((c) => {
      const patch = pairEdits[c.rule_id] || {};
      return { ...c, ...patch };
    });

    // Filter by search query
    if (columnSearch.trim()) {
      const q = columnSearch.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.target_column.toLowerCase().includes(q) ||
          (c.matched_source_column || "").toLowerCase().includes(q) ||
          (c.transformation_rule || "").toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (columnStatusFilter === "MATCHED") {
      list = list.filter((c) => c.status === "MATCHED" && !!c.matched_source_column);
    } else if (columnStatusFilter === "UNMATCHED") {
      list = list.filter((c) => c.status === "UNMATCHED" || !c.matched_source_column);
    } else if (columnStatusFilter === "MANUAL") {
      list = list.filter((c) => c.status === "MANUAL_OVERRIDE");
    }

    return list;
  }, [currentPairBlock, columnEdits, columnSearch, columnStatusFilter]);

  // ── Progress & Coverage Calculations ────────────────
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
        ? tablePairs.reduce((acc, p) => acc + (p.confidence_score || 0), 0) / totalTables
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

  // ── Mutators: Table Pair Approvals & Overrides ───────
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

  // ── Mutators: Column Rule Edits ──────────────────────
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

  // ── Save Table Pairs (TMS) ───────────────────────────
  const saveTablePairs = async () => {
    if (!tms) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/${encodeURIComponent(tms.table_mapping_set_id)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ pairs: tablePairs }),
        }
      );
      if (!res.ok) throw new Error("Failed to save table pairs");
      setBaselineTablePairs(tablePairs.map((p) => ({ ...p })));
      toast.success("Table pairs saved successfully.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save table pairs");
    } finally {
      setSaving(false);
    }
  };

  // ── Save Column Reviews for Current Pair ─────────────
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
        matched_source_column: patch.matched_source_column !== undefined ? patch.matched_source_column : orig?.matched_source_column,
        transformation_rule: patch.transformation_rule || orig?.transformation_rule || "direct_cast",
        default_value: patch.default_value !== undefined ? patch.default_value : orig?.default_value,
        confidence_score: patch.confidence_score !== undefined ? patch.confidence_score : orig?.confidence_score,
      };
    });

    try {
      const updated = await pairMappingApi.reviewPair(pms.set_id, pairId, {
        adjustments,
        actor: reviewerName,
        comments: "Reviewed in Unified Mapping Studio",
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

  // ── Trigger AI on Current Table Pair ─────────────────
  const runAiOnSelectedPair = async () => {
    if (!pms || !currentPairBlock) return;
    const pairId = currentPairBlock.pair_id;
    setRunningAiPairId(pairId);
    try {
      const updated = await pairMappingApi.runAiOnPair(pms.set_id, pairId, {
        use_ai: true,
      });
      setPms(updated);
      toast.success(`AI column mapping completed for ${currentPairBlock.target_table}!`);
    } catch (e: any) {
      toast.error(e?.message || "AI column mapping failed");
    } finally {
      setRunningAiPairId(null);
    }
  };

  // ── Trigger AI on All Table Pairs ────────────────────
  const runAiOnAllPairs = async () => {
    if (!pms) return;
    setRunningAiAll(true);
    try {
      const updated = await pairMappingApi.runAiOnAll(pms.set_id, { use_ai: true });
      setPms(updated);
      toast.success("AI column mapping completed across all tables!");
    } catch (e: any) {
      toast.error(e?.message || "AI batch mapping failed");
    } finally {
      setRunningAiAll(false);
    }
  };

  // ── Final Human Review Sign-Off Gate ─────────────────
  const handleFinalizeAndApproveAll = async () => {
    if (!pms || !tms) return;
    setFinalizing(true);
    try {
      // 1. Save table pairs
      await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/${encodeURIComponent(tms.table_mapping_set_id)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            pairs: tablePairs.map((p) => ({
              ...p,
              match_status: p.match_status === "REJECTED" ? "REJECTED" : "APPROVED",
            })),
          }),
        }
      );

      // 2. Finalize Pair Mapping Set
      const finalizedSet = await pairMappingApi.finalize(pms.set_id, {
        actor: reviewerName,
        comments: reviewComments || "Approved and signed off via Unified Mapping Studio",
      });

      setPms(finalizedSet);
      setFinalized(true);
      toast.success("Mapping Set Approved & Finalized!", {
        description: "Ready for live data migration execution.",
      });
    } catch (e: any) {
      toast.error(e?.message || "Finalization failed");
    } finally {
      setFinalizing(false);
    }
  };

  // ── Filtered Table Pairs List ────────────────────────
  const filteredTablePairs = useMemo(() => {
    return tablePairs.filter((p) => {
      if (tableFilter === "APPROVED" && p.match_status !== "APPROVED") return false;
      if (tableFilter === "PENDING" && p.match_status === "APPROVED") return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        return (
          p.source_table.toLowerCase().includes(q) ||
          p.target_table.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tablePairs, tableFilter, tableSearch]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-300">
        <LoaderCircle className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Assembling Unified Mapping Studio…</p>
      </div>
    );
  }

  if (error || !tms) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-xl p-6 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-semibold text-white">Mapping Studio Error</h2>
          <p className="text-sm text-slate-400">{error || "Mapping set not found."}</p>
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col">
      {/* ─────────────────────────────────────────────────────────────
          1. Studio Header & Live Pipeline Progress
      ───────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-4 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Title & Context */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects`)}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Back to Projects"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {tms.name || `${tms.source_system_id} → ${tms.target_system_id}`}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  v{tms.version_tag}
                </span>
                {finalized ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signed Off & Approved
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                    Human Review Gate Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Unified Data Mapping Studio • Table Alignment & Column Transformations in One Workspace
              </p>
            </div>
          </div>

          {/* Metrics & Actions */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Stat Badges */}
            <div className="hidden lg:flex items-center gap-3 border-r border-slate-800 pr-4">
              <div className="text-right">
                <div className="text-xs text-slate-400">Table Alignment</div>
                <div className="text-sm font-semibold text-white">
                  {stats.approvedTables} / {stats.totalTables} Approved
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Columns Mapped</div>
                <div className="text-sm font-semibold text-emerald-400">
                  {stats.mappedCols} / {stats.totalCols} ({stats.colPct}%)
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Avg Confidence</div>
                <div className="text-sm font-semibold text-blue-400 font-mono">
                  {stats.avgConfidence}%
                </div>
              </div>
            </div>

            {/* AI Batch Button */}
            <button
              onClick={runAiOnAllPairs}
              disabled={runningAiAll || finalized}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition disabled:opacity-50"
            >
              {runningAiAll ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              )}
              {runningAiAll ? "Analyzing All Tables…" : "Run AI on All Columns"}
            </button>

            {/* Save Button */}
            <button
              onClick={() => void saveTablePairs()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <Save className="w-3.5 h-3.5" />
              Save Progress
            </button>

            {/* Migration Direct Link */}
            {pms && (
              <button
                onClick={() =>
                  router.push(`/migrations/new?project_id=${projectId}&pair_mapping_set_id=${pms.set_id}`)
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Migration
              </button>
            )}
          </div>
        </div>

        {/* Studio View Navigation Tabs */}
        <div className="flex items-center justify-between border-t border-slate-800/80 mt-4 pt-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("studio")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === "studio"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Unified Studio (Tables & Columns)
            </button>
            <button
              onClick={() => setActiveTab("table_matrix")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === "table_matrix"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Table2 className="w-3.5 h-3.5" /> Table Pairing Matrix
            </button>
            <button
              onClick={() => setActiveTab("signoff")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === "signoff"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" /> Human Review & Sign-Off Gate
            </button>
          </div>

          <span className="text-xs text-slate-500 hidden sm:inline">
            Project: <code className="text-slate-400 font-mono">{projectId}</code>
          </span>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. Main Workspace Panes
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "studio" && (
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* ── Left Pane: Table Pairs Master List ────────────────── */}
          <aside className="w-full lg:w-96 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">
            {/* Table Search & Filter Bar */}
            <div className="p-3 border-b border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter table pairs…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setTableFilter("ALL")}
                  className={`px-2 py-1 rounded ${
                    tableFilter === "ALL" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  All ({tablePairs.length})
                </button>
                <button
                  onClick={() => setTableFilter("APPROVED")}
                  className={`px-2 py-1 rounded ${
                    tableFilter === "APPROVED" ? "bg-slate-800 text-emerald-400 font-medium" : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  Approved ({tablePairs.filter((p) => p.match_status === "APPROVED").length})
                </button>
                <button
                  onClick={() => setTableFilter("PENDING")}
                  className={`px-2 py-1 rounded ${
                    tableFilter === "PENDING" ? "bg-slate-800 text-amber-400 font-medium" : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  Needs Review ({tablePairs.filter((p) => p.match_status !== "APPROVED").length})
                </button>
              </div>
            </div>

            {/* Table List Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredTablePairs.map((pair, idx) => {
                const isSelected = selectedPairIndex === idx;
                const isApproved = pair.match_status === "APPROVED";
                const isRejected = pair.match_status === "REJECTED";

                // Check corresponding pair block for column count
                const block = pms?.pairs.find(
                  (b) =>
                    b.source_table.toLowerCase() === pair.source_table.toLowerCase() &&
                    b.target_table.toLowerCase() === pair.target_table.toLowerCase()
                );
                const colCount = block ? block.columns.length : pair.matched_columns_count || 0;
                const mappedCount = block
                  ? block.columns.filter((c) => !!c.matched_source_column).length
                  : pair.matched_columns_count || 0;

                return (
                  <div
                    key={`${pair.source_table}-${pair.target_table}`}
                    onClick={() => setSelectedPairIndex(idx)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition relative group ${
                      isSelected
                        ? "bg-blue-950/30 border-blue-500 shadow-md shadow-blue-500/10"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-white truncate">
                          <span className="truncate">{pair.source_table}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-blue-400 truncate">{pair.target_table}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-mono text-emerald-400 font-medium">
                            {(pair.confidence_score * 100).toFixed(0)}% Match
                          </span>
                          <span>•</span>
                          <span>{mappedCount}/{colCount} cols</span>
                        </div>
                      </div>

                      {/* Approval Status Toggle */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleTableApproval(idx)}
                          className={`p-1 rounded-md border text-xs transition ${
                            isApproved
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "text-slate-500 border-slate-800 hover:bg-slate-800 hover:text-slate-300"
                          }`}
                          title={isApproved ? "Approved (Click to Unapprove)" : "Click to Approve Table Pair"}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ── Right Pane: Column Mapping Workbench ─────────────── */}
          <section className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            {selectedPair ? (
              <>
                {/* Selected Table Pair Banner */}
                <div className="p-5 border-b border-slate-800 bg-slate-900/50 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-400 font-mono">
                          {selectedPair.source_table}
                        </span>
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        <span className="text-base font-bold text-white font-mono">
                          {selectedPair.target_table}
                        </span>
                        {selectedPair.match_status === "APPROVED" ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Table Approved
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Awaiting Table Approval
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                        {selectedPair.rationale || "Matched by LLM based on entity semantics and column overlap."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={runAiOnSelectedPair}
                        disabled={runningAiPairId === currentPairBlock?.pair_id || finalized}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition disabled:opacity-50"
                      >
                        {runningAiPairId === currentPairBlock?.pair_id ? (
                          <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        Run AI on Table
                      </button>

                      <button
                        onClick={saveCurrentPairColumns}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Column Changes
                      </button>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search columns or transforms…"
                        value={columnSearch}
                        onChange={(e) => setColumnSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-1 w-full sm:w-auto text-xs">
                      <button
                        onClick={() => setColumnStatusFilter("ALL")}
                        className={`px-2.5 py-1 rounded-lg ${
                          columnStatusFilter === "ALL"
                            ? "bg-slate-800 text-white font-medium"
                            : "text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        All ({currentPairBlock?.columns.length || 0})
                      </button>
                      <button
                        onClick={() => setColumnStatusFilter("MATCHED")}
                        className={`px-2.5 py-1 rounded-lg ${
                          columnStatusFilter === "MATCHED"
                            ? "bg-slate-800 text-emerald-400 font-medium"
                            : "text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        Matched ({currentPairBlock?.columns.filter((c) => !!c.matched_source_column).length || 0})
                      </button>
                      <button
                        onClick={() => setColumnStatusFilter("UNMATCHED")}
                        className={`px-2.5 py-1 rounded-lg ${
                          columnStatusFilter === "UNMATCHED"
                            ? "bg-slate-800 text-amber-400 font-medium"
                            : "text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        Unmatched ({currentPairBlock?.columns.filter((c) => !c.matched_source_column).length || 0})
                      </button>
                      <button
                        onClick={() => setColumnStatusFilter("MANUAL")}
                        className={`px-2.5 py-1 rounded-lg ${
                          columnStatusFilter === "MANUAL"
                            ? "bg-slate-800 text-blue-400 font-medium"
                            : "text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        Manual Overrides ({currentPairBlock?.columns.filter((c) => c.status === "MANUAL_OVERRIDE").length || 0})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Column Mapping Grid */}
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-medium">
                          <th className="py-2.5 px-4">Source Column ({selectedPair.source_table})</th>
                          <th className="py-2.5 px-4 w-44">Transformation Rule</th>
                          <th className="py-2.5 px-4">Target Column ({selectedPair.target_table})</th>
                          <th className="py-2.5 px-4 w-28">Confidence</th>
                          <th className="py-2.5 px-4 w-28">Status</th>
                          <th className="py-2.5 px-4 w-32">Default Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {visibleColumnRules.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              No columns matched the active filter.
                            </td>
                          </tr>
                        ) : (
                          visibleColumnRules.map((col) => {
                            const isMatched = !!col.matched_source_column;
                            const isManual = col.status === "MANUAL_OVERRIDE";

                            return (
                              <tr key={col.rule_id} className="hover:bg-slate-800/40 transition">
                                {/* Source Column Picker */}
                                <td className="py-2 px-4">
                                  <ColumnPicker
                                    value={col.matched_source_column}
                                    options={sourceColumnOptions}
                                    onChange={(val) =>
                                      handleEditColumn(col.rule_id, {
                                        matched_source_column: val,
                                        transformation_rule: val ? col.transformation_rule || "direct_cast" : null,
                                      })
                                    }
                                    placeholder="Unmapped"
                                    readOnly={finalized}
                                  />
                                </td>

                                {/* Transformation Picker */}
                                <td className="py-2 px-4">
                                  <TransformPicker
                                    value={col.transformation_rule || "direct_cast"}
                                    onChange={(val) =>
                                      handleEditColumn(col.rule_id, { transformation_rule: val })
                                    }
                                    disabled={!col.matched_source_column || finalized}
                                    readOnly={finalized}
                                  />
                                </td>

                                {/* Target Column */}
                                <td className="py-2 px-4">
                                  <div className="flex items-center gap-1.5 font-mono text-white font-medium">
                                    <span>{col.target_column}</span>
                                    {!col.target_nullable && (
                                      <span className="text-[10px] text-amber-400 font-bold" title="Required (NOT NULL)">
                                        *
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {col.target_datatype}
                                  </div>
                                </td>

                                {/* Confidence */}
                                <td className="py-2 px-4">
                                  {isMatched ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-emerald-500 h-full rounded-full"
                                          style={{ width: `${Math.min(100, Math.round(col.confidence_score * 100))}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-slate-400 text-[11px]">
                                        {(col.confidence_score * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600 font-mono">—</span>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="py-2 px-4">
                                  {isManual ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                      Manual
                                    </span>
                                  ) : isMatched ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                      Matched
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                      Unmapped
                                    </span>
                                  )}
                                </td>

                                {/* Default Value */}
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={col.default_value || ""}
                                    placeholder="None"
                                    disabled={finalized}
                                    onChange={(e) =>
                                      handleEditColumn(col.rule_id, { default_value: e.target.value })
                                    }
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
                                  />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                Select a table pair from the left panel to review and map columns.
              </div>
            )}
          </section>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. Table Matrix Tab (High-level Topology & Dependencies)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "table_matrix" && (
        <main className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Table Alignment & Migration Order Matrix</h2>
              <p className="text-xs text-slate-400">
                Review topological dependencies, masking policies, and business justifications across all tables.
              </p>
            </div>
            <button
              onClick={() => void saveTablePairs()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
            >
              <Save className="w-3.5 h-3.5" /> Save Table Alignments
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-medium">
                  <th className="py-3 px-4">Source Table</th>
                  <th className="py-3 px-4">Target Table</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Depends On (Wave Order)</th>
                  <th className="py-3 px-4">Masking Required</th>
                  <th className="py-3 px-4">Human Review Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tablePairs.map((pair, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-medium text-white">{pair.source_table}</td>
                    <td className="py-3 px-4 font-mono font-medium text-blue-400">{pair.target_table}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-emerald-400 font-semibold">
                        {(pair.confidence_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {pair.depends_on && pair.depends_on.length > 0 ? (
                        <span className="font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded text-amber-300">
                          {pair.depends_on.join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-600">Wave 1 (Independent)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {pair.requires_masking ? (
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                          PII Masking
                        </span>
                      ) : (
                        <span className="text-slate-600">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleTableApproval(idx)}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                            pair.match_status === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                          }`}
                        >
                          {pair.match_status === "APPROVED" ? "Approved" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleRejectTable(idx)}
                          className={`px-2 py-1 rounded text-xs border transition ${
                            pair.match_status === "REJECTED"
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : "text-slate-500 border-slate-800 hover:text-red-400"
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. Human Sign-Off Gate Tab
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "signoff" && (
        <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" /> Human Review & Formal Sign-Off Gate
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Before data migration executes against production systems, an engineer must review and approve the mapping catalog.
              </p>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                <div className="text-xs text-slate-400">Table Alignment</div>
                <div className="text-lg font-bold text-white">
                  {stats.approvedTables} / {stats.totalTables}
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready for approval
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                <div className="text-xs text-slate-400">Column Coverage</div>
                <div className="text-lg font-bold text-white">
                  {stats.mappedCols} / {stats.totalCols}
                </div>
                <div className="text-[11px] text-blue-400">
                  {stats.colPct}% total columns mapped
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-1">
                <div className="text-xs text-slate-400">Sign-Off Status</div>
                <div className="text-lg font-bold text-white">
                  {finalized ? "Signed Off" : "Pending Signature"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {finalized ? "Locked for execution" : "Review in progress"}
                </div>
              </div>
            </div>

            {/* Sign-Off Form */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reviewer Name / Identity
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  disabled={finalized}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sign-Off Notes & Regulatory Justification (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  disabled={finalized}
                  placeholder="e.g. Reviewed column transforms against enterprise data dictionary. Masking verified for customer PII."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-500">
                  Approving persists a cryptographically signed content hash for compliance audits.
                </p>

                <button
                  onClick={handleFinalizeAndApproveAll}
                  disabled={finalizing || finalized}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
                >
                  {finalizing ? (
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {finalized ? "Signed Off & Approved" : "Approve & Finalize Mapping Set"}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. Sticky Review & Execution Bar
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>
            Active Pair: <strong className="text-white">{selectedPair?.source_table || "None"}</strong> → <strong className="text-blue-400">{selectedPair?.target_table || "None"}</strong>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            Status: <span className="text-emerald-400 font-medium">{stats.approvedTables}/{stats.totalTables} Tables Approved</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("signoff")}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            Review Gate Checklist
          </button>

          {pms && (
            <button
              onClick={() =>
                router.push(`/migrations/new?project_id=${projectId}&pair_mapping_set_id=${pms.set_id}`)
              }
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Migration
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
