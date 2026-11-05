"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  GitCompare,
  Layers,
  LoaderCircle,
  Play,
  Server,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { connectorsApi, type SystemItem } from "@/lib/connectors-api";
import {
  pairMappingApi,
  type PairMappingSet,
  type PairBlock,
} from "@/lib/pair-mapping-api";
import { migrationsApi, type ReviewMode } from "@/lib/migrations-api";

import { PickerDropdown } from "./_components/PickerDropdown";
import { RadioCards } from "./_components/RadioCards";
import {
  TableConfigRow,
  type TableConfig,
} from "./_components/TableConfigRow";

// ─── Helpers ────────────────────────────────────────────────
function resolveProjectId(p: string | null): string {
  if (p?.trim()) return p.trim();
  if (typeof window !== "undefined") {
    const s = localStorage.getItem("active_project_id");
    if (s?.trim()) return s.trim();
  }
  return "proj-default";
}

const REVIEW_MODE_OPTIONS = [
  {
    value: "STANDARD",
    label: "Standard",
    description:
      "Pause only when warnings, PII, or destructive loads exist. Auto-approves clean runs.",
  },
  {
    value: "STRICT",
    label: "Strict",
    description:
      "Pause at the load gate on every run, regardless of warnings. Safest.",
  },
];

const PAGE_SIZE_SYSTEMS = 25;

type Step = 1 | 2 | 3 | 4;

const STEP_META: Array<{ n: Step; label: string }> = [
  { n: 1, label: "Details" },
  { n: 2, label: "Systems" },
  { n: 3, label: "Mapping" },
  { n: 4, label: "Review" },
];

// ─── Page ───────────────────────────────────────────────────
export default function NewMigrationPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = resolveProjectId(searchParams.get("project_id"));
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);

  // Metadata
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [versionTag, setVersionTag] = useState("1.0.0");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("STANDARD");
  const [batchSize, setBatchSize] = useState(5000);

  // Systems
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  // Pair sets
  const [sets, setSets] = useState<PairMappingSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setId, setSetId] = useState("");

  // Table overrides
  const [tableConfigs, setTableConfigs] = useState<TableConfig[]>([]);

  // Previews
  const [targetRowCounts, setTargetRowCounts] = useState<
    Record<string, number>
  >({});
  const [previewing, setPreviewing] = useState(false);

  // Submit
  const [starting, setStarting] = useState(false);

  // ─── Load systems ──────────────────────────────────────
  const loadSystems = useCallback(async () => {
    setSystemsLoading(true);
    try {
      const list = await connectorsApi.listSystems(projectId);
      setSystems(list);
    } catch (e: any) {
      toast.error("Could not load connectors", { description: e?.message });
    } finally {
      setSystemsLoading(false);
    }
  }, [projectId]);

  // ─── Load pair mapping sets ────────────────────────────
  const loadSets = useCallback(async () => {
    setSetsLoading(true);
    try {
      const list = await pairMappingApi.list(projectId);
      setSets(list.filter((s) => s.status === "APPROVED"));
    } catch {
      // silent — no approved sets is a valid state
    } finally {
      setSetsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSystems();
    void loadSets();
  }, [loadSystems, loadSets]);

  // ─── Derived lists ─────────────────────────────────────
  const sources = useMemo(
    () => systems.filter((s) => s.kind === "SOURCE"),
    [systems],
  );
  const targets = useMemo(
    () => systems.filter((s) => s.kind === "TARGET"),
    [systems],
  );

  const compatibleSets = useMemo(() => {
    if (!sourceId || !targetId) return [];
    return sets.filter(
      (s) =>
        s.source_system_id === sourceId &&
        s.target_system_id === targetId,
    );
  }, [sets, sourceId, targetId]);

  const selectedSource = sources.find((s) => s.system_id === sourceId);
  const selectedTarget = targets.find((s) => s.system_id === targetId);
  const selectedSet = compatibleSets.find((s) => s.set_id === setId);

  // ─── Reset downstream selections on change ─────────────
  useEffect(() => {
    if (sourceId && sourceId === targetId) setTargetId("");
  }, [sourceId, targetId]);

  useEffect(() => {
    setSetId((prev) => {
      if (prev && compatibleSets.some((s) => s.set_id === prev)) return prev;
      return "";
    });
  }, [compatibleSets]);

  // ─── Seed table configs when set is picked ─────────────
  // FIX: populate mapped_target_columns + mapped_count so TableConfigRow
  // never crashes and the PK/masking pickers actually have options.
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
          mappedTargetColumns.includes(c),
        );

        const masking = p.requires_masking
          ? p.columns
              .filter((c) => !!c.matched_source_column)
              .map((c) => c.target_column)
          : [];

        return {
          source_table: p.source_table,
          target_table: p.target_table,
          load_mode: "APPEND" as const,
          primary_key_columns: pkCandidate,
          masking_columns: masking,
          requires_masking: p.requires_masking,
          mapped_target_columns: mappedTargetColumns,
          mapped_count: mappedTargetColumns.length,
        };
      }),
    );
  }, [selectedSet]);

  // ─── Preview target row counts ─────────────────────────
  useEffect(() => {
    if (!selectedTarget || tableConfigs.length === 0) return;
    setPreviewing(true);
    (async () => {
      try {
        const res = await connectorsApi.listTablesPaginated(
          selectedTarget.system_id,
          { q: "", offset: 0, limit: 500 },
        );
        const byName = new Map(
          res.tables.map((t) => [t.name, t.row_count]),
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

  // ─── Step gating ───────────────────────────────────────
  const canProceed = (s: Step): boolean => {
    if (s === 1) return name.trim().length > 0;
    if (s === 2) return !!sourceId && !!targetId && sourceId !== targetId;
    if (s === 3) return !!setId && tableConfigs.length > 0;
    return true;
  };

  const next = () => {
    if (!canProceed(step)) return;
    if (step < 4) setStep((s) => (s + 1) as Step);
  };
  const back = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else
      router.push(
        `/migrations?project_id=${encodeURIComponent(projectId)}`,
      );
  };

  // ─── Submit ────────────────────────────────────────────
  const handleStart = async () => {
    if (!setId) {
      toast.error("Pick a mapping first");
      return;
    }
    setStarting(true);
    const lid = toast.loading("Starting migration…");
    try {
      const actor = user?.email || user?.full_name || "operator@local";

      // Re-sanitize: PK and masking must be in the mapped set.
      const overrides = tableConfigs.map((c) => {
        const mapped = new Set(c.mapped_target_columns);
        const pk = c.primary_key_columns.filter((x) => mapped.has(x));
        const masking = c.masking_columns.filter((x) => mapped.has(x));

        return {
          source_table: c.source_table,
          target_table: c.target_table,
          load_mode: c.load_mode,
          primary_key_columns: pk,
          masking_columns: masking,
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

      toast.success("Migration started", { id: lid });
      router.push(
        `/migrations/${run.run_id}?project_id=${encodeURIComponent(
          projectId,
        )}`,
      );
    } catch (e: any) {
      toast.error("Could not start migration", {
        description: e?.message,
        id: lid,
      });
      setStarting(false);
    }
  };

  // ─── Options for pickers ───────────────────────────────
  const sourceOptions = sources.map((s) => ({
    value: s.system_id,
    label: s.name,
    description: `${s.connector_type} · ${s.environment || "Production"}`,
    badge: "SOURCE",
  }));
  const targetOptions = targets
    .filter((s) => s.system_id !== sourceId)
    .map((s) => ({
      value: s.system_id,
      label: s.name,
      description: `${s.connector_type} · ${s.environment || "Production"}`,
      badge: "TARGET",
    }));
  const setOptions = compatibleSets.map((s) => ({
    value: s.set_id,
    label: s.name || s.set_id,
    description: `v${s.version_tag} · ${s.pairs.length} pair${
      s.pairs.length === 1 ? "" : "s"
    }`,
    badge: `v${s.version_tag}`,
  }));

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
        <button
          onClick={back}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 hover:text-slate-900 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to migrations
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Migrations
            </span>
            <span className="text-[10px] text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">
              New
            </span>
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
            Start a migration
          </h1>
          <p className="text-[13px] text-slate-500 mt-1.5 max-w-2xl">
            Copy data from one system to another using an approved column
            mapping. Two human gates protect the target: a review before
            load, and a sign-off after reconciliation.
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Card */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 space-y-6">
            {step === 1 && (
              <StepDetails
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                versionTag={versionTag}
                setVersionTag={setVersionTag}
                reviewMode={reviewMode}
                setReviewMode={setReviewMode}
                batchSize={batchSize}
                setBatchSize={setBatchSize}
              />
            )}

            {step === 2 && (
              <StepSystems
                loading={systemsLoading}
                sourceId={sourceId}
                setSourceId={setSourceId}
                sourceOptions={sourceOptions}
                targetId={targetId}
                setTargetId={setTargetId}
                targetOptions={targetOptions}
                selectedSource={selectedSource}
                selectedTarget={selectedTarget}
                projectId={projectId}
                sourceCount={sources.length}
                targetCount={targets.length}
              />
            )}

            {step === 3 && (
              <StepMapping
                setsLoading={setsLoading}
                setId={setId}
                setSetId={setSetId}
                setOptions={setOptions}
                compatibleCount={compatibleSets.length}
                selectedSet={selectedSet}
                selectedSource={selectedSource}
                selectedTarget={selectedTarget}
                projectId={projectId}
                tableConfigs={tableConfigs}
                setTableConfigs={setTableConfigs}
                targetRowCounts={targetRowCounts}
              />
            )}

            {step === 4 && (
              <StepReview
                name={name}
                description={description}
                versionTag={versionTag}
                reviewMode={reviewMode}
                selectedSource={selectedSource}
                selectedTarget={selectedTarget}
                selectedSet={selectedSet}
                tableConfigs={tableConfigs}
                targetRowCounts={targetRowCounts}
                previewing={previewing}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={back}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            {step < 4 ? (
              <button
                onClick={next}
                disabled={!canProceed(step)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => void handleStart()}
                disabled={starting || !canProceed(3)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {starting ? (
                  <>
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Start migration
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-[10.5px] text-slate-400 text-center max-w-md mx-auto">
          The run pins every artifact version. Nothing loads to the target
          without an approved mapping and a signed review.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Step indicator
// ══════════════════════════════════════════════════════════
function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_META.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition ${
                done
                  ? "bg-emerald-600 text-white"
                  : active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : s.n}
            </div>
            <span
              className={`text-[12px] font-medium truncate ${
                active
                  ? "text-slate-900"
                  : done
                  ? "text-emerald-700"
                  : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
            {i < STEP_META.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  done ? "bg-emerald-300" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Step 1 — Details
// ══════════════════════════════════════════════════════════
function StepDetails(props: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  versionTag: string;
  setVersionTag: (v: string) => void;
  reviewMode: ReviewMode;
  setReviewMode: (v: ReviewMode) => void;
  batchSize: number;
  setBatchSize: (v: number) => void;
}) {
  return (
    <>
      <StepHeading
        icon={Sparkles}
        title="Name this migration"
        description="Give it a name you'll recognize in the run list."
      />

      <div className="space-y-4">
        <Field label="Name" required>
          <input
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="e.g. Customers → Fabric · Wave 1"
            className={inputCls}
            autoFocus
          />
        </Field>

        <Field label="Description" hint="Optional. What's moving and why.">
          <textarea
            rows={2}
            value={props.description}
            onChange={(e) => props.setDescription(e.target.value)}
            placeholder="First wave — customer master only."
            className={`${inputCls} resize-none h-auto`}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Version"
            hint="Bump when you re-run with a different mapping."
          >
            <input
              value={props.versionTag}
              onChange={(e) => props.setVersionTag(e.target.value)}
              placeholder="1.0.0"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field
            label="Batch size"
            hint="Rows per read/write batch. 5,000 is a safe default."
          >
            <input
              type="number"
              min={100}
              max={100000}
              step={100}
              value={props.batchSize}
              onChange={(e) =>
                props.setBatchSize(Number(e.target.value))
              }
              className={`${inputCls} font-mono`}
            />
          </Field>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Review mode
          </label>
          <RadioCards
            options={REVIEW_MODE_OPTIONS}
            value={props.reviewMode}
            onChange={(v) => props.setReviewMode(v as ReviewMode)}
            columns={2}
          />
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// Step 2 — Systems
// ══════════════════════════════════════════════════════════
function StepSystems(props: {
  loading: boolean;
  sourceId: string;
  setSourceId: (v: string) => void;
  sourceOptions: any[];
  targetId: string;
  setTargetId: (v: string) => void;
  targetOptions: any[];
  selectedSource?: SystemItem;
  selectedTarget?: SystemItem;
  projectId: string;
  sourceCount: number;
  targetCount: number;
}) {
  return (
    <>
      <StepHeading
        icon={Server}
        title="Choose source and destination"
        description="Data flows from the source system into the target system."
      />

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Source system
            {props.selectedSource && (
              <span className="ml-2 font-mono text-[10px] text-slate-400 normal-case">
                {props.selectedSource.connector_type}
              </span>
            )}
          </label>
          {props.sourceCount === 0 && !props.loading ? (
            <EmptyState
              icon={Database}
              title="No source systems registered"
              description="Register a source connector first."
              action={
                <Link
                  href={`/connectors/new?project_id=${encodeURIComponent(
                    props.projectId,
                  )}`}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
                >
                  Add connector
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          ) : (
            <PickerDropdown
              value={props.sourceId}
              onChange={props.setSourceId}
              options={props.sourceOptions}
              placeholder="Select a source system…"
              loading={props.loading}
              pageSize={PAGE_SIZE_SYSTEMS}
            />
          )}
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Destination system
            {props.selectedTarget && (
              <span className="ml-2 font-mono text-[10px] text-slate-400 normal-case">
                {props.selectedTarget.connector_type}
              </span>
            )}
          </label>
          {props.targetCount === 0 && !props.loading ? (
            <EmptyState
              icon={Server}
              title="No target systems registered"
              description="Register a target connector first."
              action={
                <Link
                  href={`/connectors/new?project_id=${encodeURIComponent(
                    props.projectId,
                  )}`}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
                >
                  Add connector
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          ) : (
            <PickerDropdown
              value={props.targetId}
              onChange={props.setTargetId}
              options={props.targetOptions}
              placeholder="Select a destination system…"
              loading={props.loading}
              pageSize={PAGE_SIZE_SYSTEMS}
            />
          )}
        </div>

        {props.selectedSource && props.selectedTarget && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  From
                </p>
                <p className="text-[12.5px] font-semibold text-slate-900 truncate">
                  {props.selectedSource.name}
                </p>
                <p className="text-[10.5px] font-mono text-slate-500 truncate">
                  {props.selectedSource.connector_type}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  To
                </p>
                <p className="text-[12.5px] font-semibold text-slate-900 truncate">
                  {props.selectedTarget.name}
                </p>
                <p className="text-[10.5px] font-mono text-slate-500 truncate">
                  {props.selectedTarget.connector_type}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// Step 3 — Mapping + per-table config
// ══════════════════════════════════════════════════════════
function StepMapping(props: {
  setsLoading: boolean;
  setId: string;
  setSetId: (v: string) => void;
  setOptions: any[];
  compatibleCount: number;
  selectedSet?: PairMappingSet;
  selectedSource?: SystemItem;
  selectedTarget?: SystemItem;
  projectId: string;
  tableConfigs: TableConfig[];
  setTableConfigs: React.Dispatch<React.SetStateAction<TableConfig[]>>;
  targetRowCounts: Record<string, number>;
}) {
  const updateConfig = (idx: number, patch: Partial<TableConfig>) => {
    props.setTableConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  };

  return (
    <>
      <StepHeading
        icon={GitCompare}
        title="Choose a mapping"
        description={
          props.selectedSource && props.selectedTarget
            ? `How columns in ${props.selectedSource.name} map to ${props.selectedTarget.name}.`
            : "How source columns map to destination columns."
        }
      />

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Approved mapping set
          </label>
          {props.compatibleCount === 0 && !props.setsLoading ? (
            <EmptyState
              icon={Layers}
              title="No approved mapping for this pair"
              description="Create and approve a column mapping first."
              action={
                <Link
                  href={`/pair-mapping?project_id=${encodeURIComponent(
                    props.projectId,
                  )}`}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
                >
                  Open Column Mappings
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          ) : (
            <PickerDropdown
              value={props.setId}
              onChange={props.setSetId}
              options={props.setOptions}
              placeholder="Select an approved mapping…"
              loading={props.setsLoading}
              pageSize={20}
            />
          )}
        </div>

        {props.selectedSet && props.tableConfigs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Per-table configuration
                <span className="ml-2 font-mono text-[10px] text-slate-400 normal-case">
                  {props.tableConfigs.length} table
                  {props.tableConfigs.length === 1 ? "" : "s"}
                </span>
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 mb-2 text-[11px] text-slate-600 leading-relaxed">
              Only <strong>mapped</strong> target columns will be written.
              Unmapped target columns stay untouched.
            </div>

            <div className="space-y-2">
              {props.tableConfigs.map((cfg, idx) => (
                <TableConfigRow
                  key={`${cfg.source_table}__${cfg.target_table}`}
                  config={cfg}
                  targetRowCount={
                    props.targetRowCounts[cfg.target_table]
                  }
                  onChange={(patch) => updateConfig(idx, patch)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// Step 4 — Review
// ══════════════════════════════════════════════════════════
function StepReview(props: {
  name: string;
  description: string;
  versionTag: string;
  reviewMode: ReviewMode;
  selectedSource?: SystemItem;
  selectedTarget?: SystemItem;
  selectedSet?: PairMappingSet;
  tableConfigs: TableConfig[];
  targetRowCounts: Record<string, number>;
  previewing: boolean;
}) {
  const destructive = props.tableConfigs.filter(
    (c) =>
      c.load_mode === "REPLACE" &&
      (props.targetRowCounts[c.target_table] || 0) > 0,
  ).length;

  const appendRisk = props.tableConfigs.filter(
    (c) =>
      c.load_mode === "APPEND" &&
      (props.targetRowCounts[c.target_table] || 0) > 0,
  ).length;

  const masking = props.tableConfigs.filter(
    (c) => c.requires_masking,
  ).length;

  const targetRows = props.tableConfigs.reduce(
    (acc, c) => acc + (props.targetRowCounts[c.target_table] || 0),
    0,
  );

  return (
    <>
      <StepHeading
        icon={ShieldCheck}
        title="Review and start"
        description="Confirm everything looks right. The run pins these artifact versions."
      />

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {props.name || "Untitled migration"}
          </p>
          {props.description && (
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              {props.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                From
              </p>
              <p className="text-[12px] font-semibold text-slate-900 truncate">
                {props.selectedSource?.name || "—"}
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                To
              </p>
              <p className="text-[12px] font-semibold text-slate-900 truncate">
                {props.selectedTarget?.name || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Metric label="Tables" value={props.tableConfigs.length} />
          <Metric
            label="Rows at target"
            value={props.previewing ? "…" : targetRows.toLocaleString()}
          />
          <Metric
            label="Version"
            value={props.versionTag || "1.0.0"}
            mono
          />
          <Metric
            label="Review"
            value={props.reviewMode === "STRICT" ? "Strict" : "Standard"}
          />
        </div>

        {(destructive > 0 || appendRisk > 0 || masking > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 space-y-1">
            {destructive > 0 && (
              <p className="text-[11.5px] text-amber-900 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>{destructive}</strong> table
                  {destructive === 1 ? "" : "s"} will <strong>delete</strong>{" "}
                  existing target rows (REPLACE mode).
                </span>
              </p>
            )}
            {appendRisk > 0 && (
              <p className="text-[11.5px] text-amber-900 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>{appendRisk}</strong> table
                  {appendRisk === 1 ? "" : "s"} use <strong>APPEND</strong>{" "}
                  into a non-empty target — this will insert duplicates if
                  the run is retried.
                </span>
              </p>
            )}
            {masking > 0 && (
              <p className="text-[11.5px] text-amber-900 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>{masking}</strong> table
                  {masking === 1 ? "" : "s"} will mask PII columns on load.
                </span>
              </p>
            )}
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Tables
          </p>
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-72 overflow-y-auto">
            {props.tableConfigs.map((c) => (
              <div
                key={`${c.source_table}__${c.target_table}`}
                className="px-3 py-2 border-b border-slate-100 last:border-b-0 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-800 truncate flex-1">
                    {c.source_table}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                  <span className="font-mono text-[11px] text-slate-800 truncate flex-1">
                    {c.target_table}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                      c.load_mode === "REPLACE" &&
                      (props.targetRowCounts[c.target_table] || 0) > 0
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {c.load_mode}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed pl-0.5">
                  <span className="text-slate-400">writes:</span>{" "}
                  {(c.mapped_target_columns ?? []).length === 0 ? (
                    <span className="italic text-amber-700">
                      no mapped columns
                    </span>
                  ) : (
                    (c.mapped_target_columns ?? []).slice(0, 6).join(", ")
                  )}
                  {(c.mapped_target_columns ?? []).length > 6 && (
                    <span className="text-slate-400">
                      {" "}
                      +{(c.mapped_target_columns ?? []).length - 6} more
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2.5 text-[11.5px] text-blue-900 leading-relaxed">
          Data will be written to the destination. Default load mode is{" "}
          <strong>APPEND</strong>. Reviewers can change per-table mode in
          step 3.
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// Small shared bits
// ══════════════════════════════════════════════════════════
const inputCls =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition";

function StepHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-slate-500" />
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      </div>
      <p className="text-[12.5px] text-slate-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10.5px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Metric({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">
        {label}
      </span>
      <span
        className={`text-[14px] font-semibold text-slate-900 block mt-0.5 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center">
      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-[12.5px] font-semibold text-slate-900">{title}</p>
      <p className="text-[11.5px] text-slate-500 mt-0.5">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PK guess helper
// ══════════════════════════════════════════════════════════
function guessPrimaryKey(pair: PairBlock): string[] {
  const pk = pair.columns.find((c) =>
    c.target_column.toLowerCase().endsWith("id"),
  );
  return pk ? [pk.target_column] : [];
}