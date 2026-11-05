"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Server,
  GitCompare,
  Table2,
  Ban,
  ShieldCheck,
  Play,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import {
  migrationsApi,
  type MigrationRun,
  type MigrationManifest,
} from "@/lib/migrations-api";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
const ACTIVE_STATES = new Set([
  "QUEUED",
  "RUNNING",
  "LOADING",
  "EXTRACTING",
  "TRANSFORMING",
  "VALIDATING",
  "RECONCILING",
]);

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
  icon: any;
  spin?: boolean;
}

function statusOf(state: string): StatusInfo {
  switch (state) {
    case "AWAITING_LOAD_REVIEW":
      return {
        label: "Awaiting approval",
        tone: "bg-amber-50 text-amber-900 border-amber-300",
        icon: AlertTriangle,
      };
    case "COMPLETED":
      return {
        label: "Ready to sign off",
        tone: "bg-emerald-50 text-emerald-900 border-emerald-300",
        icon: CheckCircle2,
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

// ═══════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════
export default function MigrationDetailPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const runId = String(params?.id || "");
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [run, setRun] = useState<MigrationRun | null>(null);
  const [manifest, setManifest] = useState<MigrationManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  // ═══════════════════════════════════════════════════════
  // Load run
  // ═══════════════════════════════════════════════════════
  const load = useCallback(async () => {
    if (!runId) return;
    setError(null);
    try {
      const r = await migrationsApi.get(runId);
      setRun(r);
      try {
        const m = await migrationsApi.getManifest(runId);
        setManifest(m);
      } catch {
        setManifest(null);
      }
    } catch (e: any) {
      setError(e?.message || "Could not load this migration");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ═══════════════════════════════════════════════════════
  // Poll while running
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (!run) return;
    if (!ACTIVE_STATES.has(run.state)) return;
    const id = setInterval(() => void load(), 2000);
    return () => clearInterval(id);
  }, [run, load]);

  // ═══════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════
  const actor = user?.email || user?.full_name || "operator@local";

  const handleApprove = async () => {
    if (!run) return;
    setActing(true);
    const lid = toast.loading("Approving…");
    try {
      const updated = await migrationsApi.approveLoad(run.run_id, {
        actor,
        comments: "Approved",
      });
      setRun(updated);
      toast.success("Approved — loading in progress", { id: lid });
    } catch (e: any) {
      toast.error("Could not approve", {
        description: e?.message,
        id: lid,
      });
    } finally {
      setActing(false);
    }
  };

  const handleAbort = async () => {
    if (!run) return;
    setActing(true);
    const lid = toast.loading("Cancelling…");
    try {
      const updated = await migrationsApi.abort(run.run_id, {
        actor,
        reason: "Cancelled from detail page",
      });
      setRun(updated);
      toast.success("Cancelled", { id: lid });
    } catch (e: any) {
      toast.error("Could not cancel", {
        description: e?.message,
        id: lid,
      });
    } finally {
      setActing(false);
    }
  };

  const handleSignoff = async () => {
    if (!run) return;
    setActing(true);
    const lid = toast.loading("Signing off…");
    try {
      const updated = await migrationsApi.signoff(run.run_id, {
        actor,
        comments: "Signed off",
      });
      setRun(updated);
      toast.success("Signed off", { id: lid });
    } catch (e: any) {
      toast.error("Could not sign off", {
        description: e?.message,
        id: lid,
      });
    } finally {
      setActing(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // Derived
  // ═══════════════════════════════════════════════════════
  const info = run ? statusOf(run.state) : null;
  const isActive = run ? ACTIVE_STATES.has(run.state) : false;
  const pct =
    run && run.tables_total > 0
      ? Math.round((run.tables_completed / run.tables_total) * 100)
      : 0;

  const tableConfigs = useMemo(
    () => manifest?.table_load_configs || [],
    [manifest]
  );

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
        <LoaderCircle className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !run || !info) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-red-900">
                Could not load this migration
              </h2>
              <p className="text-xs text-red-700 mt-1 break-all">
                {error || "Not found"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <Link
              href={`/migrations?project_id=${encodeURIComponent(projectId)}`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = info.icon;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
        {/* ── Back ────────────────────────────────────────── */}
        <Link
          href={`/migrations?project_id=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          All migrations
        </Link>

        {/* ── Header card ─────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 sm:p-7">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="font-mono text-lg font-semibold text-slate-900 truncate">
                    {run.run_id}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${info.tone}`}
                  >
                    <StatusIcon
                      className={`w-3 h-3 ${
                        info.spin ? "animate-spin" : ""
                      }`}
                    />
                    {info.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  Started {relTime(run.created_at)}
                  {run.completed_at &&
                    ` · Finished ${relTime(run.completed_at)}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void load()}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      loading ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {/* Source → Destination */}
            {manifest && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex items-center gap-3">
                <div className="flex-1 text-center min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    From
                  </span>
                  <span className="text-sm font-semibold text-slate-900 mt-0.5 block truncate font-mono">
                    {manifest.source_system_id}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 text-center min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    To
                  </span>
                  <span className="text-sm font-semibold text-slate-900 mt-0.5 block truncate font-mono">
                    {manifest.target_system_id}
                  </span>
                </div>
              </div>
            )}

            {/* Live progress */}
            {isActive && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 capitalize">
                    {run.phase.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Metrics grid */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric
                icon={Table2}
                label="Tables"
                value={`${run.tables_completed} / ${run.tables_total}`}
              />
              <Metric
                icon={Database}
                label="Rows moved"
                value={run.rows_loaded.toLocaleString()}
              />
              <Metric
                icon={CheckCircle2}
                label="Rows validated"
                value={run.rows_validated.toLocaleString()}
              />
              <Metric
                icon={XCircle}
                label="Rows failed"
                value={run.rows_failed.toLocaleString()}
                tone={run.rows_failed > 0 ? "text-red-700" : undefined}
              />
            </div>

            {/* Warnings */}
            {run.warnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-900">
                      {run.warnings.length} warning
                      {run.warnings.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-amber-800 list-disc pl-4">
                      {run.warnings.slice(0, 5).map((w, i) => (
                        <li key={i} className="break-all">
                          {w}
                        </li>
                      ))}
                      {run.warnings.length > 5 && (
                        <li className="italic text-amber-700">
                          +{run.warnings.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {run.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 break-all">
                <strong className="font-semibold">Error: </strong>
                {run.error}
              </div>
            )}
          </div>

          {/* ── Action bar ─────────────────────────────────── */}
          {(run.state === "AWAITING_LOAD_REVIEW" ||
            run.state === "COMPLETED" ||
            run.state === "EXCEPTION_REVIEW") && (
            <div className="px-6 sm:px-7 py-4 border-t border-slate-100 bg-slate-50/60">
              {run.state === "AWAITING_LOAD_REVIEW" && (
                <>
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 leading-relaxed">
                      Data is ready to be written to the destination. Nothing
                      has been written yet. Approve to load, or cancel.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => void handleAbort()}
                      disabled={acting}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-red-200 bg-white text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-40"
                    >
                      <Ban className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleApprove()}
                      disabled={acting}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40"
                    >
                      {acting ? (
                        <LoaderCircle className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve and load
                    </button>
                  </div>
                </>
              )}

              {run.state === "COMPLETED" && (
                <>
                  <div className="flex items-start gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-900 leading-relaxed">
                      Data has been written to the destination and
                      reconciliation passed. Sign off to close this
                      migration.
                    </p>
                  </div>
                  <button
                    onClick={() => void handleSignoff()}
                    disabled={acting}
                    className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {acting ? (
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    Sign off
                  </button>
                </>
              )}

              {run.state === "EXCEPTION_REVIEW" && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-900 leading-relaxed">
                    Reconciliation found differences between source and
                    destination. Review the exceptions before signing off.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Signed off banner ─────────────────────────── */}
          {run.state === "SIGNED_OFF" && run.signoff && (
            <div className="px-6 sm:px-7 py-4 border-t border-slate-100 bg-emerald-50">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-900">
                    Signed off by {run.signoff.actor}
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {relTime(run.signoff.signed_at)}
                    {run.signoff.comments && ` · ${run.signoff.comments}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Table breakdown ─────────────────────────────── */}
        {tableConfigs.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Tables
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tableConfigs.length} table
                {tableConfigs.length === 1 ? "" : "s"} in this migration
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {tableConfigs.map((cfg) => (
                <div
                  key={`${cfg.source_table}__${cfg.target_table}`}
                  className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-mono text-sm text-slate-900 truncate">
                      {cfg.source_table}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-sm text-slate-900 truncate">
                      {cfg.target_table}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                    <span>
                      {Object.keys(cfg.include_column_map || {}).length} columns
                    </span>
                    {cfg.requires_masking && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        PII
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Manifest details ────────────────────────────── */}
        {manifest && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Details
              </h2>
            </div>
            <div className="px-6 py-4 space-y-2 text-sm">
              <DetailRow label="Project" value={manifest.project_id} mono />
              <DetailRow
                label="Mapping set"
                value={manifest.pair_mapping_set_id}
                mono
              />
              <DetailRow
                label="Manifest hash"
                value={manifest.manifest_hash}
                mono
                truncate
              />
              <DetailRow
                label="Review mode"
                value={manifest.review_mode}
              />
              <DetailRow
                label="Created by"
                value={manifest.created_by}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════
function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p
        className={`text-base font-semibold font-mono mt-0.5 ${
          tone || "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-slate-500 w-32 shrink-0">{label}</span>
      <span
        className={`text-slate-900 flex-1 min-w-0 ${
          mono ? "font-mono text-xs" : ""
        } ${truncate ? "truncate" : "break-all"}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}