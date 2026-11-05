// src/app/(protected)/table-matching/discover/page.tsx
"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Layers,
  BookOpen,
  Check,
  ChevronsUpDown,
  LoaderCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ═════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api/v1";

const DEFAULT_MIN_CONFIDENCE = 0.5;
const MIN_ALLOWED_CONFIDENCE = 0.3;
const MAX_ALLOWED_CONFIDENCE = 0.95;
const CONFIDENCE_STEP = 0.05;

// ═════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════
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

function formatConfidence(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

// ═════════════════════════════════════════════════════════════
// Page (default export wrapper)
// ═════════════════════════════════════════════════════════════
export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
          <LoaderCircle className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      }
    >
      <DiscoverInner />
    </Suspense>
  );
}

// ═════════════════════════════════════════════════════════════
// Inner page
// ═════════════════════════════════════════════════════════════
function DiscoverInner() {
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

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    !!sourceSystemId &&
    !!targetSystemId &&
    sourceSystemId !== targetSystemId;

  // ── Submit ─────────────────────────────────────────────
  const submit = async () => {
    if (!name.trim()) {
      setError("Give this pair set a name.");
      return;
    }
    if (!sourceSystemId || !targetSystemId) {
      setError("Pick a source system and a target system.");
      return;
    }
    if (sourceSystemId === targetSystemId) {
      setError("Source and target systems must differ.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(
          projectId
        )}/table-pairs/propose`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            source_system_id: sourceSystemId,
            target_system_id: targetSystemId,
            name: name.trim(),
            version_tag: versionTag.trim() || "1.0.0",
            ontology_version_id: ontologyVersionId || null,
            custom_instructions: customInstructions.trim() || null,
            use_ai: useAi,
            min_confidence: minConfidence,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Propose failed (${res.status})`);
      }

      const data = await res.json();
      toast.success("Pair set created", {
        description: `${data.pairs?.length ?? 0} pair${
          (data.pairs?.length ?? 0) === 1 ? "" : "s"
        } proposed.`,
      });
      router.push(
        `/table-matching/${encodeURIComponent(
          data.table_mapping_set_id
        )}?project_id=${encodeURIComponent(projectId)}`
      );
    } catch (e: any) {
      const msg = e?.message || "Failed to propose table pairs";
      setError(msg);
      toast.error("Propose failed", { description: msg });
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
        <Link
          href={`/table-matching?project_id=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to table matching
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Table matching
            </span>
            <span className="text-[10px] text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">
              Discover
            </span>
          </div>
          <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
            New table pair set
          </h1>
          <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">
            Pick two systems and the agent proposes source → target table
            matches. You edit every pair before saving.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-red-600 hover:text-red-900"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Form card ─────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-[13px] font-semibold text-slate-900">
              Configuration
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              All fields except reviewer instructions are required unless
              marked optional.
            </p>
          </div>

          <div className="p-5 space-y-5">
            {/* ── Section 1: Identity ────────────────────── */}
            <Section title="Identity">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                <Field label="Pair set name" required>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Customer migration pairs"
                    disabled={submitting}
                    className={inputClass}
                  />
                </Field>
                <Field label="Version">
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

            {/* ── Section 2: Systems ─────────────────────── */}
            <Section
              title="Systems"
              hint="Source tables come from the source system, target tables from the target system."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Source system" required>
                  <SystemPicker
                    value={sourceSystemId}
                    onChange={setSourceSystemId}
                    kindFilter="SOURCE"
                    placeholder="Search source systems…"
                    disabled={submitting}
                  />
                </Field>
                <Field label="Target system" required>
                  <SystemPicker
                    value={targetSystemId}
                    onChange={setTargetSystemId}
                    kindFilter="TARGET"
                    placeholder="Search target systems…"
                    disabled={submitting}
                  />
                </Field>
              </div>
              {sourceSystemId &&
                targetSystemId &&
                sourceSystemId === targetSystemId && (
                  <p className="mt-2 text-[11px] text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Source and target systems must differ.
                  </p>
                )}
            </Section>

            {/* ── Section 3: Ontology (optional) ─────────── */}
            <Section
              title="Ontology grounding"
              hint="Optional. Concept bindings sharpen the matching. Without it, matching falls back to name similarity."
            >
              <Field label="Ontology version">
                <OntologyPicker
                  projectId={projectId}
                  value={ontologyVersionId}
                  onChange={setOntologyVersionId}
                  disabled={submitting}
                />
              </Field>
            </Section>

            {/* ── Section 4: Matching ────────────────────── */}
            <Section title="Matching">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <label
                      htmlFor="use-ai"
                      className="cursor-pointer text-[12.5px] font-medium text-slate-900 block"
                    >
                      AI-assisted matching
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Uses{" "}
                      <span className="font-mono text-[10.5px] text-slate-700">
                        gpt-oss-120b
                      </span>{" "}
                      for semantic matching. Turn off for pure deterministic
                      scoring.
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
                        ? "border-slate-900 bg-slate-900"
                        : "border-slate-300 bg-slate-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        useAi ? "translate-x-[19px]" : "translate-x-[3px]"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Minimum confidence threshold
                  </label>
                  <span className="text-[11px] font-mono font-semibold text-slate-900 tabular-nums">
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
                  className="w-full accent-slate-900 disabled:opacity-40"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{formatConfidence(MIN_ALLOWED_CONFIDENCE)}</span>
                  <span>{formatConfidence(MAX_ALLOWED_CONFIDENCE)}</span>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-relaxed">
                  Pairs below this score are hidden. Lower = more candidates
                  (noisier). Higher = fewer, stronger candidates.
                </p>
              </div>
            </Section>

            {/* ── Section 5: Instructions ────────────────── */}
            <Section
              title="Reviewer instructions"
              hint="Optional hints that guide the agent."
            >
              <textarea
                rows={3}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Prioritize tables whose names start with 'cust_'. Ignore any table ending in '_backup'."
                disabled={submitting}
                className={`${inputClass} resize-none`}
              />
            </Section>
          </div>

          {/* ── Actions ──────────────────────────────────── */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
            <Link
              href={`/table-matching?project_id=${encodeURIComponent(projectId)}`}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition order-2 sm:order-1"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="order-1 sm:order-2 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  Proposing…
                </>
              ) : (
                <>
                  Propose pairs
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-slate-400 text-center">
          After proposing, you'll review each pair in the workbench before
          column-level matching.
        </p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Shared style + layout bits
// ═════════════════════════════════════════════════════════════
const inputClass =
  "w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition disabled:opacity-50";

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
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>
      {hint && (
        <p className="text-[10.5px] text-slate-400 leading-relaxed">{hint}</p>
      )}
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
      <label className="text-[11px] font-semibold text-slate-700 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// SystemPicker — Popover + Command (searchable)
// ═════════════════════════════════════════════════════════════
function SystemPicker({
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

  const filtered = useMemo(() => {
    let list = systems;
    if (kindFilter !== "ALL") {
      list = list.filter((s) => s.kind === kindFilter);
    }
    return list;
  }, [systems, kindFilter]);

  const current = systems.find((s) => s.system_id === value);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          onClick={() => setOpen((o) => !o)}
          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-left flex items-center justify-between gap-2 hover:border-slate-300 focus:outline-none focus:border-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="min-w-0 flex-1 truncate">
            {current ? (
              <span className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900 truncate">
                  {current.name}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {current.kind}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">
                {loading
                  ? "Loading systems…"
                  : filtered.length === 0
                  ? "No systems registered"
                  : placeholder || "Select a system"}
              </span>
            )}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-72">
              <SystemSearchList
                systems={filtered}
                currentValue={value}
                onSelect={(id) => {
                  onChange(id);
                  setOpen(false);
                }}
              />
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="text-[10.5px] text-red-700 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function SystemSearchList({
  systems,
  currentValue,
  onSelect,
}: {
  systems: SystemOption[];
  currentValue: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.system_id.toLowerCase().includes(q) ||
        (s.connector_type || "").toLowerCase().includes(q)
    );
  }, [systems, query]);

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search systems…"
          className="flex-1 text-[11.5px] bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="text-slate-400 hover:text-slate-700 text-[10px]"
            type="button"
          >
            Clear
          </button>
        )}
      </div>
      <div className="overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-400">
            No systems match
          </div>
        ) : (
          filtered.map((s) => {
            const isSel = s.system_id === currentValue;
            return (
              <button
                key={s.system_id}
                type="button"
                onClick={() => onSelect(s.system_id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition ${
                  isSel ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-medium text-slate-900 truncate">
                    {s.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {s.system_id}
                    {s.connector_type ? ` · ${s.connector_type}` : ""}
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                  {s.kind}
                </span>
                {isSel && (
                  <Check className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// OntologyPicker — Popover with "no ontology" option
// ═════════════════════════════════════════════════════════════
function OntologyPicker({
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

  const current = options.find((o) => o.ontology_version_id === value);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          onClick={() => setOpen((o) => !o)}
          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-left flex items-center justify-between gap-2 hover:border-slate-300 focus:outline-none focus:border-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="min-w-0 flex-1 truncate">
            {current ? (
              <span className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900 truncate">
                  {current.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  v{current.version_tag}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">
                {loading
                  ? "Loading ontologies…"
                  : options.length === 0
                  ? "No ontologies yet — build one first"
                  : "No ontology (name-only matching)"}
              </span>
            )}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-72">
              <div className="overflow-y-auto">
                {/* No-ontology option */}
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[11.5px] transition ${
                    !value ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex-1 italic text-slate-500">
                    No ontology — name-only matching
                  </span>
                  {!value && (
                    <Check className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  )}
                </button>
                {options.map((o) => {
                  const isSel = o.ontology_version_id === value;
                  return (
                    <button
                      key={o.ontology_version_id}
                      type="button"
                      onClick={() => {
                        onChange(o.ontology_version_id);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 transition border-t border-slate-50 ${
                        isSel ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] font-medium text-slate-900 truncate">
                          {o.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          v{o.version_tag}
                          {o.domain ? ` · ${o.domain}` : ""}
                        </div>
                      </div>
                      {isSel && (
                        <Check className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      )}
                    </button>
                  );
                })}
                {options.length === 0 && !loading && (
                  <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                    No ontologies in this project
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="text-[10.5px] text-red-700 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}