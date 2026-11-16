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
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { API_V1 } from "@/lib/api-config";

const API_BASE = API_V1;

const DEFAULT_MIN_CONFIDENCE = 0.5;
const MIN_ALLOWED_CONFIDENCE = 0.3;
const MAX_ALLOWED_CONFIDENCE = 0.95;
const CONFIDENCE_STEP = 0.05;
const DROPDOWN_PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface SystemOption {
  system_id: string;
  name: string;
  kind: string;
  connector_type?: string;
}

interface OntologyOption {
  ontology_version_id: string;
  name: string;
  version_tag: string;
  domain?: string;
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

function resolveProjectId(urlParam: string | null): string {
  if (urlParam && urlParam.trim()) return urlParam.trim();
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("active_project_id");
    if (stored && stored.trim()) return stored.trim();
  }
  return "proj-default";
}

function formatConfidence(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

// ─────────────────────────────────────────────────────────────
// Page Wrapper
// ─────────────────────────────────────────────────────────────
export default function DiscoverSchemaMappingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] flex items-center justify-center">
          <LoaderCircle className="w-5 h-5 animate-spin text-[#432DD7]" />
        </div>
      }
    >
      <DiscoverSchemaMappingInner />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────
// Inner Page
// ─────────────────────────────────────────────────────────────
function DiscoverSchemaMappingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [name, setName] = useState("");
  const [versionTag, setVersionTag] = useState("1.0.0");
  const [sourceSystemId, setSourceSystemId] = useState("");
  const [targetSystemId, setTargetSystemId] = useState("");
  const [ontologyVersionId, setOntologyVersionId] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [minConfidence, setMinConfidence] = useState(DEFAULT_MIN_CONFIDENCE);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Streaming progress states
  const [streamingStatus, setStreamingStatus] = useState<string>("");
  const [streamingProgress, setStreamingProgress] = useState<number>(0);
  const [streamedPairs, setStreamedPairs] = useState<
    Array<{
      source_table: string;
      target_table: string;
      confidence_score: number;
      rationale?: string;
    }>
  >([]);

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    !!sourceSystemId &&
    !!targetSystemId &&
    sourceSystemId !== targetSystemId;

  // ── Submit with SSE Streaming & Fallback ───────────────────
  const submit = async () => {
    if (!name.trim()) {
      setError("Enter a name for this schema mapping set.");
      return;
    }
    if (!sourceSystemId || !targetSystemId) {
      setError("Select both a source system and a target system.");
      return;
    }
    if (sourceSystemId === targetSystemId) {
      setError("Source and target systems must be different.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStreamingProgress(5);
    setStreamingStatus("Initializing schema alignment agent…");
    setStreamedPairs([]);

    const payload = {
      source_system_id: sourceSystemId,
      target_system_id: targetSystemId,
      name: name.trim(),
      version_tag: versionTag.trim() || "1.0.0",
      ontology_version_id: ontologyVersionId || null,
      custom_instructions: customInstructions.trim() || null,
      use_ai: useAi,
      min_confidence: minConfidence,
    };

    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(
          projectId
        )}/table-pairs/propose/stream`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const fallbackRes = await fetch(
          `${API_BASE}/mapping-sets/${encodeURIComponent(
            projectId
          )}/table-pairs/propose`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(payload),
          }
        );
        if (!fallbackRes.ok) {
          const body = await fallbackRes.json().catch(() => ({}));
          throw new Error(
            body?.detail || `Discovery failed (${fallbackRes.status})`
          );
        }
        const data = await fallbackRes.json();
        toast.success("Schema mapping set created", {
          description: `${data.pairs?.length ?? 0} schema alignment${
            (data.pairs?.length ?? 0) === 1 ? "" : "s"
          } proposed.`,
        });
        router.push(
          `/table-matching/${encodeURIComponent(
            data.table_mapping_set_id
          )}?project_id=${encodeURIComponent(projectId)}`
        );
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalSetId: string | null = null;
      let finalCount = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const chunk of parts) {
            const clean = chunk.trim();
            if (clean.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(clean.slice(6));
                if (parsed.type === "status") {
                  setStreamingStatus(parsed.message || "Analyzing schemas…");
                  if (typeof parsed.progress === "number") {
                    setStreamingProgress(parsed.progress);
                  }
                } else if (parsed.type === "pair") {
                  if (parsed.pair) {
                    setStreamedPairs((prev) => [...prev, parsed.pair]);
                  }
                  if (typeof parsed.progress === "number") {
                    setStreamingProgress(parsed.progress);
                  }
                } else if (parsed.type === "complete") {
                  setStreamingProgress(100);
                  setStreamingStatus(parsed.message || "Completed");
                  finalSetId = parsed.table_mapping_set_id;
                  finalCount = parsed.result?.pairs?.length || 0;
                } else if (parsed.type === "error") {
                  throw new Error(
                    parsed.message || "Schema matching engine returned an error"
                  );
                }
              } catch (err: any) {
                if (err.message && !err.message.includes("JSON")) {
                  throw err;
                }
              }
            }
          }
        }
      }

      if (finalSetId) {
        toast.success("Schema mapping set created", {
          description: `${finalCount} schema alignment${
            finalCount === 1 ? "" : "s"
          } proposed.`,
        });
        setTimeout(() => {
          router.push(
            `/table-matching/${encodeURIComponent(
              finalSetId!
            )}?project_id=${encodeURIComponent(projectId)}`
          );
        }, 700);
      } else {
        router.push(
          `/table-matching?project_id=${encodeURIComponent(projectId)}`
        );
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to discover schema mappings";
      setError(msg);
      toast.error("Discovery failed", { description: msg });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] text-slate-900 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Back link */}
        <div>
          <Link
            href={`/table-matching?project_id=${encodeURIComponent(projectId)}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to schema mappings</span>
          </Link>
        </div>

        {/* Header */}
        <header className="border-b border-slate-200/90 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Schema mapping
            </span>
            <span className="text-[10px] text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
              Discover
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            New schema mapping set
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Select a source and target system to generate candidate schema
            alignments. Every proposed schema and attribute rule can be reviewed
            and edited before saving.
          </p>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-white px-4 py-3 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="flex-1 break-words leading-relaxed">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-rose-400 hover:text-rose-700"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live Execution Progress Card */}
        {submitting && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <LoaderCircle className="w-5 h-5 animate-spin text-[#432DD7] shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                      Schema Alignment Agent Running
                    </h3>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#F8FAFC] px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#432DD7] animate-pulse" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 break-words">
                    {streamingStatus || "Evaluating topological schemas…"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                {streamingProgress}%
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#432DD7] h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${streamingProgress}%` }}
              />
            </div>

            {streamedPairs.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Proposed Alignments ({streamedPairs.length})</span>
                  <span>Confidence</span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {streamedPairs.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap font-mono">
                        <span className="font-semibold text-slate-900 break-all">
                          {p.source_table}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 break-all">
                          {p.target_table}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] font-semibold px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50/70 text-emerald-700">
                        {(p.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Configuration Card */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Mapping Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Define the mapping set identity, connected endpoints, and
              matching thresholds.
            </p>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Section 1: Identity */}
            <Section title="Identity">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-4">
                <Field label="Schema mapping set name" required>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Customer CRM to OneLake Schema"
                    disabled={submitting}
                    className={inputClass}
                  />
                </Field>
                <Field label="Version tag">
                  <input
                    type="text"
                    value={versionTag}
                    onChange={(e) => setVersionTag(e.target.value)}
                    placeholder="1.0.0"
                    disabled={submitting}
                    className={`${inputClass} font-mono`}
                  />
                </Field>
              </div>
            </Section>

            {/* Section 2: Systems */}
            <Section
              title="Connected Systems"
              hint="Schemas are introspected from the source system and aligned against the target system."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Source system" required>
                  <SystemCustomDropdown
                    value={sourceSystemId}
                    onChange={setSourceSystemId}
                    kindFilter="SOURCE"
                    placeholder="Select source system…"
                    disabled={submitting}
                  />
                </Field>
                <Field label="Target system" required>
                  <SystemCustomDropdown
                    value={targetSystemId}
                    onChange={setTargetSystemId}
                    kindFilter="TARGET"
                    placeholder="Select target system…"
                    disabled={submitting}
                  />
                </Field>
              </div>
              {sourceSystemId &&
                targetSystemId &&
                sourceSystemId === targetSystemId && (
                  <p className="text-xs text-rose-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Source and target systems must be different.</span>
                  </p>
                )}
            </Section>

            {/* Section 3: Ontology Grounding */}
            <Section
              title="Ontology Grounding"
              hint="Optional. Semantic concept bindings improve schema matching accuracy. Without an ontology, matching uses structural and lexical similarity."
            >
              <Field label="Ontology version">
                <OntologyCustomDropdown
                  projectId={projectId}
                  value={ontologyVersionId}
                  onChange={setOntologyVersionId}
                  disabled={submitting}
                />
              </Field>
            </Section>

            {/* Section 4: Matching Strategy */}
            <Section title="Matching Strategy">
              <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <label
                      htmlFor="use-ai"
                      className="cursor-pointer text-xs sm:text-[13px] font-semibold text-slate-900 block"
                    >
                      Semantic LLM alignment
                    </label>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Uses{" "}
                      <span className="font-mono text-[11px] text-slate-700">
                        gpt-oss-120b
                      </span>{" "}
                      to evaluate business semantics and foreign-key topology.
                      Disable for pure deterministic scoring.
                    </p>
                  </div>
                  <button
                    id="use-ai"
                    type="button"
                    role="switch"
                    aria-checked={useAi}
                    disabled={submitting}
                    onClick={() => setUseAi(!useAi)}
                    className={`relative mt-0.5 inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border transition-colors disabled:opacity-40 ${
                      useAi
                        ? "border-[#432DD7] bg-[#432DD7]"
                        : "border-slate-300 bg-slate-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                        useAi ? "translate-x-[19px]" : "translate-x-[3px]"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">
                    Minimum confidence threshold
                  </label>
                  <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                    {formatConfidence(minConfidence)}
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_ALLOWED_CONFIDENCE}
                  max={MAX_ALLOWED_CONFIDENCE}
                  step={CONFIDENCE_STEP}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  disabled={submitting}
                  className="w-full accent-[#432DD7] disabled:opacity-40"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{formatConfidence(MIN_ALLOWED_CONFIDENCE)}</span>
                  <span>{formatConfidence(MAX_ALLOWED_CONFIDENCE)}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Alignments below this threshold are filtered out automatically.
                </p>
              </div>
            </Section>

            {/* Section 5: Instructions */}
            <Section
              title="Reviewer Instructions"
              hint="Optional domain rules or naming conventions to guide the schema agent."
            >
              <textarea
                rows={3}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Prioritize schemas prefixed with 'cust_' and ignore '_archive' or '_temp' objects."
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] transition disabled:opacity-50 resize-none"
              />
            </Section>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-5 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl">
            <Link
              href={`/table-matching?project_id=${encodeURIComponent(projectId)}`}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-lg bg-[#432DD7] text-white text-xs font-medium hover:bg-[#3724B5] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  <span>Discovering schemas…</span>
                </>
              ) : (
                <>
                  <span>Discover schema mappings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Layout Helpers
// ═════════════════════════════════════════════════════════════
const inputClass =
  "w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#432DD7] transition disabled:opacity-50";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
        {hint && (
          <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
            {hint}
          </p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-700 block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Custom Paginated System Dropdown
// ═════════════════════════════════════════════════════════════
function SystemCustomDropdown({
  value,
  onChange,
  kindFilter = "ALL",
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (systemId: string) => void;
  kindFilter?: "SOURCE" | "TARGET" | "INTERMEDIATE" | "ALL";
  placeholder?: string;
  disabled?: boolean;
}) {
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/systems`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Load failed (${res.status})`);
      }
      const data = await res.json();
      const list: SystemOption[] = Array.isArray(data)
        ? data.map((s: any) => ({
            system_id: s.system_id,
            name: s.name || s.system_id,
            kind: (s.kind || "SOURCE").toUpperCase(),
            connector_type: s.connector_type || s.adapter_type,
          }))
        : [];
      setSystems(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load systems");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    let list = systems;
    if (kindFilter !== "ALL") {
      list = list.filter((s) => s.kind === kindFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.system_id.toLowerCase().includes(q) ||
        (s.connector_type || "").toLowerCase().includes(q)
    );
  }, [systems, kindFilter, query]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / DROPDOWN_PAGE_SIZE)
  );
  const paginated = useMemo(() => {
    const start = page * DROPDOWN_PAGE_SIZE;
    return filtered.slice(start, start + DROPDOWN_PAGE_SIZE);
  }, [filtered, page]);

  const current = systems.find((s) => s.system_id === value);

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg border bg-white text-xs text-left flex items-center justify-between gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "border-[#432DD7] ring-[3px] ring-[#432DD7]/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="min-w-0 flex-1">
          {current ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 break-words">
                {current.name}
              </span>
              {current.connector_type && (
                <span className="font-mono text-[10.5px] text-slate-400">
                  {current.connector_type}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">
              {loading
                ? "Loading systems…"
                : filtered.length === 0
                ? "No systems registered"
                : placeholder || "Select a system"}
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
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search systems by name or type…"
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

          {/* Options */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">
                No matching systems
              </div>
            ) : (
              paginated.map((s) => {
                const isSel = s.system_id === value;
                return (
                  <button
                    key={s.system_id}
                    type="button"
                    onClick={() => {
                      onChange(s.system_id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between gap-2 transition ${
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
                        {s.name}
                      </div>
                      <div className="text-[10.5px] text-slate-400 font-mono break-all">
                        {s.system_id}
                        {s.connector_type ? ` · ${s.connector_type}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9.5px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600">
                        {s.kind}
                      </span>
                      {isSel && (
                        <Check className="w-3.5 h-3.5 text-[#432DD7]" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          <div className="px-3 py-2 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono">
              {filtered.length === 0
                ? "0 systems"
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

      {error && (
        <p className="text-xs text-rose-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Custom Paginated Ontology Dropdown
// ═════════════════════════════════════════════════════════════
function OntologyCustomDropdown({
  projectId,
  value,
  onChange,
  disabled,
}: {
  projectId: string;
  value: string;
  onChange: (ontologyId: string) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<OntologyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/ontologies?project_id=${encodeURIComponent(projectId)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Load failed (${res.status})`);
      }
      const data = await res.json();
      const list: OntologyOption[] = Array.isArray(data)
        ? data.map((o: any) => ({
            ontology_version_id: o.ontology_version_id,
            name: o.name || "Untitled Ontology",
            version_tag: o.version_tag || "1.0.0",
            domain: o.domain,
          }))
        : [];
      setOptions(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load ontologies");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.ontology_version_id.toLowerCase().includes(q) ||
        (o.domain || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / DROPDOWN_PAGE_SIZE)
  );
  const paginated = useMemo(() => {
    const start = page * DROPDOWN_PAGE_SIZE;
    return filtered.slice(start, start + DROPDOWN_PAGE_SIZE);
  }, [filtered, page]);

  const current = options.find((o) => o.ontology_version_id === value);

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg border bg-white text-xs text-left flex items-center justify-between gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "border-[#432DD7] ring-[3px] ring-[#432DD7]/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="min-w-0 flex-1">
          {current ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 break-words">
                {current.name}
              </span>
              <span className="text-[10.5px] text-slate-400 font-mono">
                v{current.version_tag}
              </span>
            </div>
          ) : (
            <span className="text-slate-400">
              {loading
                ? "Loading ontologies…"
                : "No ontology selected (structural & lexical matching)"}
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
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ontologies by name or domain…"
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

          {/* Options */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs transition ${
                !value ? "bg-[#F8FAFC]" : "hover:bg-[#F8FAFC]"
              }`}
            >
              <span className="text-slate-500">
                No ontology — structural & lexical matching
              </span>
              {!value && <Check className="w-3.5 h-3.5 text-[#432DD7]" />}
            </button>

            {paginated.map((o) => {
              const isSel = o.ontology_version_id === value;
              return (
                <button
                  key={o.ontology_version_id}
                  type="button"
                  onClick={() => {
                    onChange(o.ontology_version_id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between gap-2 transition ${
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
                      {o.name}
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono break-all">
                      v{o.version_tag}
                      {o.domain ? ` · ${o.domain}` : ""}
                    </div>
                  </div>
                  {isSel && (
                    <Check className="w-3.5 h-3.5 text-[#432DD7] shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}

            {paginated.length === 0 && !loading && (
              <div className="px-3.5 py-4 text-center text-xs text-slate-400">
                No matching ontologies
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="px-3 py-2 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono">
              {filtered.length === 0
                ? "0 ontologies"
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

      {error && (
        <p className="text-xs text-rose-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}