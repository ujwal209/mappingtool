"use client";

import React, {
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
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Play,
  Search,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { API_V1 } from "@/lib/api-config";
import { useAuth } from "@/context/AuthContext";
import {
  pairMappingApi,
  type PairMappingSet,
  type PairBlock,
} from "@/lib/pair-mapping-api";
import { migrationsApi, type ReviewMode } from "@/lib/migrations-api";

const API_BASE = API_V1;
const DROPDOWN_PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type LoadMode = "APPEND" | "UPSERT" | "REPLACE";

interface SystemOption {
  system_id: string;
  project_id?: string;
  name: string;
  kind: string;
  connector_type: string;
  environment?: string;
}

interface TableConfig {
  source_table: string;
  target_table: string;
  load_mode: LoadMode;
  primary_key_columns: string[];
  masking_columns: string[];
  requires_masking: boolean;
  mapped_target_columns: string[];
  mapped_count: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
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

function resolveProjectId(p: string | null): string {
  if (p?.trim()) return p.trim();
  if (typeof window !== "undefined") {
    const s = localStorage.getItem("active_project_id");
    if (s?.trim()) return s.trim();
  }
  return "proj-default";
}

function guessPrimaryKey(pair: PairBlock): string[] {
  const pk = pair.columns.find((c) =>
    c.target_column.toLowerCase().endsWith("id")
  );
  return pk ? [pk.target_column] : [];
}

// ─────────────────────────────────────────────────────────────
// Page Entry
// ─────────────────────────────────────────────────────────────
export default function NewMigrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] flex items-center justify-center">
          <LoaderCircle className="w-6 h-6 animate-spin text-[#432DD7]" />
        </div>
      }
    >
      <NewMigrationInner />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Self-Contained Component
// ─────────────────────────────────────────────────────────────
function NewMigrationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = resolveProjectId(searchParams.get("project_id"));
  const preselectedSetId = searchParams.get("pair_mapping_set_id") || "";
  const { user } = useAuth();

  // Metadata
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [versionTag, setVersionTag] = useState("1.0.0");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("STANDARD");
  const [batchSize, setBatchSize] = useState<number>(5000);

  // Systems
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  // Mapping Sets
  const [sets, setSets] = useState<PairMappingSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setId, setSetId] = useState(preselectedSetId);

  // Per-Table Overrides
  const [tableConfigs, setTableConfigs] = useState<TableConfig[]>([]);
  const [expandedTableIdx, setExpandedTableIdx] = useState<number | null>(null);

  // Target Row Counts Preview
  const [targetRowCounts, setTargetRowCounts] = useState<
    Record<string, number>
  >({});
  const [previewing, setPreviewing] = useState(false);

  // Submit
  const [starting, setStarting] = useState(false);

  // ── 1. Load Systems (Direct resilient fetch) ─────────
  const loadSystems = useCallback(async () => {
    setSystemsLoading(true);
    setSystemsError(null);
    try {
      // Fetch both project-scoped and general tenant systems so none are missed
      const url =
        projectId && projectId !== "proj-default"
          ? `${API_BASE}/systems?project_id=${encodeURIComponent(projectId)}`
          : `${API_BASE}/systems`;

      let res = await fetch(url, { headers: authHeaders() });
      let data = res.ok ? await res.json() : [];

      // Fallback if project-filtered returned empty
      if (Array.isArray(data) && data.length === 0 && projectId) {
        const fallbackRes = await fetch(`${API_BASE}/systems`, {
          headers: authHeaders(),
        });
        if (fallbackRes.ok) {
          data = await fallbackRes.json();
        }
      }

      const list: SystemOption[] = Array.isArray(data)
        ? data.map((s: any) => ({
            system_id: s.system_id,
            project_id: s.project_id,
            name: s.name || s.system_id,
            kind: (s.kind || "SOURCE").toUpperCase(),
            connector_type: s.connector_type || s.adapter_type || "connector",
            environment: s.environment || "Production",
          }))
        : [];

      setSystems(list);
    } catch (e: any) {
      setSystemsError(e?.message || "Failed to load systems");
    } finally {
      setSystemsLoading(false);
    }
  }, [projectId]);

  // ── 2. Load Schema Mapping Sets ──────────────────────
  const loadSets = useCallback(async () => {
    setSetsLoading(true);
    try {
      const list = await pairMappingApi.list(projectId);
      // Prefer APPROVED sets, or fallback to all sets if none approved yet
      const approved = list.filter((s) => s.status === "APPROVED");
      const usable = approved.length > 0 ? approved : list;
      setSets(usable);

      if (preselectedSetId) {
        const match = usable.find((s) => s.set_id === preselectedSetId);
        if (match) {
          setSourceId(match.source_system_id);
          setTargetId(match.target_system_id);
          setSetId(match.set_id);
        }
      }
    } catch {
      setSets([]);
    } finally {
      setSetsLoading(false);
    }
  }, [projectId, preselectedSetId]);

  useEffect(() => {
    void loadSystems();
    void loadSets();
  }, [loadSystems, loadSets]);

  // ── Derived Lists ────────────────────────────────────
  const sources = useMemo(() => {
    const strictSources = systems.filter((s) => s.kind === "SOURCE");
    return strictSources.length > 0 ? strictSources : systems;
  }, [systems]);

  const targets = useMemo(() => {
    const strictTargets = systems.filter(
      (s) => s.kind === "TARGET" && s.system_id !== sourceId
    );
    if (strictTargets.length > 0) return strictTargets;
    return systems.filter((s) => s.system_id !== sourceId);
  }, [systems, sourceId]);

  const compatibleSets = useMemo(() => {
    if (!sourceId || !targetId) return sets;
    const exact = sets.filter(
      (s) =>
        s.source_system_id === sourceId && s.target_system_id === targetId
    );
    return exact;
  }, [sets, sourceId, targetId]);

  const selectedSource = systems.find((s) => s.system_id === sourceId);
  const selectedTarget = systems.find((s) => s.system_id === targetId);
  const selectedSet = compatibleSets.find((s) => s.set_id === setId);

  // Clear target if same as source
  useEffect(() => {
    if (sourceId && sourceId === targetId) {
      setTargetId("");
    }
  }, [sourceId, targetId]);

  // Keep setId valid when systems change
  useEffect(() => {
    if (!sourceId || !targetId) return;
    setSetId((prev) => {
      if (prev && compatibleSets.some((s) => s.set_id === prev)) return prev;
      return compatibleSets[0]?.set_id || "";
    });
  }, [sourceId, targetId, compatibleSets]);

  // Seed table configs when mapping set changes
  useEffect(() => {
    if (!selectedSet) {
      setTableConfigs([]);
      return;
    }
    setTableConfigs(
      selectedSet.pairs.map((p) => {
        const mappedTargetColumns = p.columns
          .filter((c) => !!c.matched_source_column)
          .map((c) => c.target_column);

        const pkCandidate = guessPrimaryKey(p).filter((c) =>
          mappedTargetColumns.includes(c)
        );

        const masking = p.requires_masking
          ? p.columns
              .filter((c) => !!c.matched_source_column)
              .map((c) => c.target_column)
          : [];

        return {
          source_table: p.source_table,
          target_table: p.target_table,
          load_mode: "APPEND",
          primary_key_columns: pkCandidate,
          masking_columns: masking,
          requires_masking: Boolean(p.requires_masking),
          mapped_target_columns: mappedTargetColumns,
          mapped_count: mappedTargetColumns.length,
        };
      })
    );
  }, [selectedSet]);

  // Fetch target row counts
  useEffect(() => {
    if (!selectedTarget || tableConfigs.length === 0) {
      setTargetRowCounts({});
      return;
    }
    setPreviewing(true);
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/systems/${encodeURIComponent(
            selectedTarget.system_id
          )}/tables?offset=0&limit=500`,
          { headers: authHeaders() }
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        const byName = new Map<string, number>(
          (data.tables || []).map((t: any) => [t.name, Number(t.row_count || 0)])
        );
        const next: Record<string, number> = {};
        for (const cfg of tableConfigs) {
          next[cfg.target_table] = byName.get(cfg.target_table) ?? 0;
        }
        setTargetRowCounts(next);
      } catch {
        setTargetRowCounts({});
      } finally {
        setPreviewing(false);
      }
    })();
  }, [selectedTarget, tableConfigs.length]);

  const updateTableConfig = (idx: number, patch: Partial<TableConfig>) => {
    setTableConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const toggleColumnInList = (
    idx: number,
    field: "primary_key_columns" | "masking_columns",
    colName: string
  ) => {
    setTableConfigs((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const current = c[field];
        const exists = current.includes(colName);
        return {
          ...c,
          [field]: exists
            ? current.filter((x) => x !== colName)
            : [...current, colName],
        };
      })
    );
  };

  // Risk indicators
  const destructiveCount = tableConfigs.filter(
    (c) =>
      c.load_mode === "REPLACE" &&
      (targetRowCounts[c.target_table] || 0) > 0
  ).length;

  const appendRiskCount = tableConfigs.filter(
    (c) =>
      c.load_mode === "APPEND" &&
      (targetRowCounts[c.target_table] || 0) > 0
  ).length;

  const maskingCount = tableConfigs.filter(
    (c) => c.masking_columns.length > 0 || c.requires_masking
  ).length;

  const totalTargetRows = tableConfigs.reduce(
    (acc, c) => acc + (targetRowCounts[c.target_table] || 0),
    0
  );

  const canStart =
    !starting &&
    name.trim().length > 0 &&
    !!sourceId &&
    !!targetId &&
    sourceId !== targetId &&
    !!setId &&
    tableConfigs.length > 0;

  // ── Submit Handler ───────────────────────────────────
  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    const lid = toast.loading("Starting migration run…");
    try {
      const actor = user?.email || user?.full_name || "operator@local";

      const overrides = tableConfigs.map((c) => {
        const mapped = new Set(c.mapped_target_columns);
        return {
          source_table: c.source_table,
          target_table: c.target_table,
          load_mode: c.load_mode,
          primary_key_columns: c.primary_key_columns.filter((x) =>
            mapped.has(x)
          ),
          masking_columns: c.masking_columns.filter((x) => mapped.has(x)),
        };
      });

      const run = await migrationsApi.create({
        project_id: projectId,
        pair_mapping_set_id: setId,
        review_mode: reviewMode,
        table_load_overrides: overrides,
        policy_waivers: [],
        actor,
        name: name.trim(),
        description: description.trim() || undefined,
        version_tag: versionTag.trim() || "1.0.0",
      } as any);

      toast.success("Migration run started", { id: lid });
      router.push(
        `/migrations/${encodeURIComponent(
          run.run_id
        )}?project_id=${encodeURIComponent(projectId)}`
      );
    } catch (e: any) {
      toast.error("Could not start migration", {
        description: e?.message || "Unexpected error",
        id: lid,
      });
      setStarting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] text-slate-900 pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href={`/migrations?project_id=${encodeURIComponent(projectId)}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to migration runs</span>
          </Link>
        </div>

        {/* Header */}
        <header className="border-b border-slate-200/90 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Migrations
            </span>
            <span className="text-[10px] text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
              Configure Run
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            New migration run
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure run metadata, select connected source and destination
            systems, bind an approved schema mapping set, and review per-table
            write modes before execution.
          </p>
        </header>

        {/* Responsive 2-Column Workspace (Form Left 2/3 + Summary Right 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN: Configuration Cards
          ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card 1: Run Identity & Governance */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  1. Run Identity & Governance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identify this execution run and set its human-in-the-loop gate
                  policy.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Migration run name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Customer Master → OneLake Wave 1"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Scope notes, cutover window, or validation notes…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] transition resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Version tag
                    </label>
                    <input
                      type="text"
                      value={versionTag}
                      onChange={(e) => setVersionTag(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Batch size (rows per chunk)
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={100000}
                      step={100}
                      value={batchSize}
                      onChange={(e) =>
                        setBatchSize(Number(e.target.value) || 5000)
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-900 focus:outline-none focus:border-[#432DD7] transition"
                    />
                  </div>
                </div>

                {/* Review Mode Selector */}
                <div className="space-y-2 pt-1">
                  <span className="block text-xs font-medium text-slate-700">
                    Load gate policy
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        value: "STANDARD" as ReviewMode,
                        label: "Standard Gate",
                        desc: "Pauses for approval when warnings, PII masking, or destructive loads exist.",
                      },
                      {
                        value: "STRICT" as ReviewMode,
                        label: "Strict Gate",
                        desc: "Always pauses before target load for mandatory human sign-off.",
                      },
                    ].map((opt) => {
                      const selected = reviewMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setReviewMode(opt.value)}
                          className={`text-left p-3.5 rounded-xl border transition space-y-1 ${
                            selected
                              ? "border-[#432DD7] bg-white ring-1 ring-[#432DD7]/20"
                              : "border-slate-200 bg-[#F8FAFC]/60 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                selected ? "text-[#432DD7]" : "text-slate-900"
                              }`}
                            >
                              {opt.label}
                            </span>
                            <span
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                selected
                                  ? "border-[#432DD7] bg-[#432DD7] text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {selected && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {opt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Card 2: Source & Destination Systems */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    2. Source & Destination Systems
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select the registered endpoints for data extraction and
                    loading.
                  </p>
                </div>
                <Link
                  href={`/connectors/new?project_id=${encodeURIComponent(
                    projectId
                  )}`}
                  className="text-xs font-medium text-[#432DD7] hover:underline"
                >
                  + Register connector
                </Link>
              </div>

              {systemsError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="break-words">{systemsError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Source system <span className="text-rose-500">*</span>
                  </label>
                  <SearchablePaginatedDropdown
                    items={sources.map((s) => ({
                      value: s.system_id,
                      label: s.name,
                      sublabel: `${s.connector_type} · ${
                        s.environment || "Prod"
                      }`,
                      badge: s.kind,
                    }))}
                    value={sourceId}
                    onChange={setSourceId}
                    loading={systemsLoading}
                    placeholder="Select source system…"
                    emptyText="No source connectors registered"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Destination system <span className="text-rose-500">*</span>
                  </label>
                  <SearchablePaginatedDropdown
                    items={targets.map((s) => ({
                      value: s.system_id,
                      label: s.name,
                      sublabel: `${s.connector_type} · ${
                        s.environment || "Prod"
                      }`,
                      badge: s.kind,
                    }))}
                    value={targetId}
                    onChange={setTargetId}
                    loading={systemsLoading}
                    placeholder="Select destination system…"
                    emptyText="No target connectors registered"
                  />
                </div>
              </div>

              {selectedSource && selectedTarget && (
                <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Source
                    </span>
                    <span className="font-semibold text-slate-900 break-words">
                      {selectedSource.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 ml-2">
                      ({selectedSource.connector_type})
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                  <div className="min-w-0 sm:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Destination
                    </span>
                    <span className="font-semibold text-slate-900 break-words">
                      {selectedTarget.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 ml-2">
                      ({selectedTarget.connector_type})
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Card 3: Schema Mapping & Table Write Rules */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    3. Schema Mapping & Table Load Rules
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a schema mapping set and configure load mode, primary
                    keys, and PII masking per schema.
                  </p>
                </div>
                <Link
                  href={`/table-matching?project_id=${encodeURIComponent(
                    projectId
                  )}`}
                  className="text-xs font-medium text-[#432DD7] hover:underline"
                >
                  Manage schema mappings
                </Link>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Schema mapping set <span className="text-rose-500">*</span>
                </label>
                <SearchablePaginatedDropdown
                  items={compatibleSets.map((s) => ({
                    value: s.set_id,
                    label: s.name || s.set_id,
                    sublabel: `${s.pairs.length} schema${
                      s.pairs.length === 1 ? "" : "s"
                    } · ${s.status}`,
                    badge: `v${s.version_tag}`,
                  }))}
                  value={setId}
                  onChange={setSetId}
                  loading={setsLoading}
                  placeholder={
                    !sourceId || !targetId
                      ? "Select source & destination systems first (or pick any set)…"
                      : "Select a schema mapping set…"
                  }
                  emptyText="No compatible schema mapping sets found"
                />
              </div>

              {/* Per-Table Configurations */}
              {selectedSet && tableConfigs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Schema Load Overrides ({tableConfigs.length})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Only mapped target attributes are written
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                    {tableConfigs.map((cfg, idx) => {
                      const isExpanded = expandedTableIdx === idx;
                      const rowCount = targetRowCounts[cfg.target_table] ?? 0;

                      return (
                        <div
                          key={`${cfg.source_table}__${cfg.target_table}`}
                          className="p-4 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                                <span className="font-semibold text-slate-900 break-all">
                                  {cfg.source_table}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-700 break-all">
                                  {cfg.target_table}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                <span>
                                  {cfg.mapped_count} mapped attribute
                                  {cfg.mapped_count === 1 ? "" : "s"}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span>
                                  {previewing
                                    ? "Checking target rows…"
                                    : `${rowCount.toLocaleString()} existing target rows`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              {/* Load Mode Pills */}
                              <div className="inline-flex rounded-lg border border-slate-200 bg-[#F8FAFC] p-0.5">
                                {(
                                  ["APPEND", "UPSERT", "REPLACE"] as LoadMode[]
                                ).map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() =>
                                      updateTableConfig(idx, {
                                        load_mode: mode,
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded-md font-mono text-[10.5px] font-semibold transition ${
                                      cfg.load_mode === mode
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-600 hover:text-slate-900"
                                    }`}
                                  >
                                    {mode}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedTableIdx(isExpanded ? null : idx)
                                }
                                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition"
                              >
                                {isExpanded ? "Hide keys" : "Keys & PII"}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Primary Keys & PII Masking Selector */}
                          {isExpanded && (
                            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <span className="block text-[11px] font-semibold text-slate-700">
                                  Primary / Upsert Keys
                                </span>
                                {cfg.mapped_target_columns.length === 0 ? (
                                  <p className="text-[11px] text-slate-400">
                                    No mapped columns available.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {cfg.mapped_target_columns.map((col) => {
                                      const active =
                                        cfg.primary_key_columns.includes(col);
                                      return (
                                        <button
                                          key={col}
                                          type="button"
                                          onClick={() =>
                                            toggleColumnInList(
                                              idx,
                                              "primary_key_columns",
                                              col
                                            )
                                          }
                                          className={`px-2 py-1 rounded-md border font-mono text-[11px] transition ${
                                            active
                                              ? "border-[#432DD7] bg-[#432DD7]/5 text-[#432DD7] font-semibold"
                                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                          }`}
                                        >
                                          {col}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <span className="block text-[11px] font-semibold text-slate-700">
                                  PII Masking Columns
                                </span>
                                {cfg.mapped_target_columns.length === 0 ? (
                                  <p className="text-[11px] text-slate-400">
                                    No mapped columns available.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {cfg.mapped_target_columns.map((col) => {
                                      const active =
                                        cfg.masking_columns.includes(col);
                                      return (
                                        <button
                                          key={col}
                                          type="button"
                                          onClick={() =>
                                            toggleColumnInList(
                                              idx,
                                              "masking_columns",
                                              col
                                            )
                                          }
                                          className={`px-2 py-1 rounded-md border font-mono text-[11px] transition ${
                                            active
                                              ? "border-amber-300 bg-amber-50 text-amber-800 font-semibold"
                                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                          }`}
                                        >
                                          {col}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN: Sticky Execution Summary & Launch Card
          ───────────────────────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Run Summary
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manifest pins all selected artifact versions prior to
                  execution.
                </p>
              </div>

              <div className="space-y-3 text-xs border-t border-slate-100 pt-4">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Run Name</span>
                  <span className="font-semibold text-slate-900 text-right break-words">
                    {name.trim() || "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Source</span>
                  <span className="font-medium text-slate-900 text-right break-words">
                    {selectedSource?.name || "Not selected"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Destination</span>
                  <span className="font-medium text-slate-900 text-right break-words">
                    {selectedTarget?.name || "Not selected"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Schema Set</span>
                  <span className="font-medium text-slate-900 text-right break-words">
                    {selectedSet?.name || "Not selected"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Schemas</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {tableConfigs.length}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Existing Target Rows</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {previewing ? "…" : totalTargetRows.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Gate Policy</span>
                  <span className="font-mono text-slate-800">{reviewMode}</span>
                </div>
              </div>

              {/* Warnings */}
              {(destructiveCount > 0 ||
                appendRiskCount > 0 ||
                maskingCount > 0) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-1.5 text-[11px] text-amber-900">
                  {destructiveCount > 0 && (
                    <p>
                      <strong>{destructiveCount}</strong> schema(s) set to{" "}
                      <strong>REPLACE</strong> will overwrite target rows.
                    </p>
                  )}
                  {appendRiskCount > 0 && (
                    <p>
                      <strong>{appendRiskCount}</strong> schema(s) use{" "}
                      <strong>APPEND</strong> on non-empty target tables.
                    </p>
                  )}
                  {maskingCount > 0 && (
                    <p>
                      PII masking enabled on <strong>{maskingCount}</strong>{" "}
                      schema(s).
                    </p>
                  )}
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={!canStart}
                  className="w-full h-10 px-4 rounded-lg bg-[#432DD7] hover:bg-[#3724B5] text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {starting ? (
                    <>
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      <span>Starting migration…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start migration run</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/migrations?project_id=${encodeURIComponent(
                    projectId
                  )}`}
                  className="w-full h-9 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition inline-flex items-center justify-center"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Self-Contained Custom Searchable & Paginated Dropdown
// ═════════════════════════════════════════════════════════════
interface DropdownOptionItem {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

function SearchablePaginatedDropdown({
  items,
  value,
  onChange,
  loading,
  placeholder,
  emptyText,
}: {
  items: DropdownOptionItem[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        (item.sublabel || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / DROPDOWN_PAGE_SIZE)
  );
  const paginated = useMemo(() => {
    const start = page * DROPDOWN_PAGE_SIZE;
    return filtered.slice(start, start + DROPDOWN_PAGE_SIZE);
  }, [filtered, page]);

  const selected = items.find((i) => i.value === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-expanded={open}
        disabled={loading}
        onClick={() => setOpen((o) => !o)}
        className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg border bg-white text-xs text-left flex items-center justify-between gap-2 transition disabled:opacity-50 ${
          open
            ? "border-[#432DD7] ring-[3px] ring-[#432DD7]/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="min-w-0 flex-1">
          {selected ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 break-words">
                {selected.label}
              </span>
              {selected.sublabel && (
                <span className="font-mono text-[10.5px] text-slate-400">
                  {selected.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">
              {loading ? "Loading…" : placeholder}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            open ? "rotate-180 text-[#432DD7]" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-200 bg-[#F8FAFC] text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#432DD7] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">
                {items.length === 0 ? emptyText : "No matching items"}
              </div>
            ) : (
              paginated.map((item) => {
                const isSel = item.value === value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-left flex items-start justify-between gap-2 transition ${
                      isSel ? "bg-[#F8FAFC]" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div
                        className={`text-xs break-words ${
                          isSel
                            ? "font-semibold text-[#432DD7]"
                            : "font-medium text-slate-900"
                        }`}
                      >
                        {item.label}
                      </div>
                      {item.sublabel && (
                        <div className="text-[10.5px] font-mono text-slate-400 break-all">
                          {item.sublabel}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span className="text-[9.5px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600">
                          {item.badge}
                        </span>
                      )}
                      {isSel && (
                        <Check className="w-3.5 h-3.5 text-[#432DD7]" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-[11px] text-slate-500">
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
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 font-mono text-slate-700">
                  {page + 1}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
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