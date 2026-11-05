"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  LoaderCircle,
  AlertTriangle,
  Save,
  X,
  Lock,
  Layers,
  Hash,
  Shield,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  pairMappingApi,
  type PairMappingSet,
  type PairBlock,
} from "@/lib/pair-mapping-api";

function resolveProjectId(urlParam: string | null): string {
  if (urlParam?.trim()) return urlParam.trim();
  if (typeof window !== "undefined") {
    const s = localStorage.getItem("active_project_id");
    if (s?.trim()) return s.trim();
  }
  return "proj-default";
}

export default function EditPairMappingPage() {
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

function Inner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setId = String(params?.id || "");
  const projectId = resolveProjectId(searchParams.get("project_id"));

  const [set, setSet] = useState<PairMappingSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Form state (top-level metadata) ───────────────────
  const [name, setName] = useState("");
  const [versionTag, setVersionTag] = useState("1.0.0");

  // Per-pair overrides (only the metadata that can be edited here)
  const [pairEdits, setPairEdits] = useState<
    Record<
      string,
      {
        rationale: string;
        requires_masking: boolean;
      }
    >
  >({});

  // ─────────────────────────────────────────────────────
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
      setSet(s);
      setName(s.name || "");
      setVersionTag(s.version_tag || "1.0.0");
      const init: Record<
        string,
        { rationale: string; requires_masking: boolean }
      > = {};
      for (const p of s.pairs) {
        init[p.pair_id] = {
          rationale: p.rationale || "",
          requires_masking: !!p.requires_masking,
        };
      }
      setPairEdits(init);
    } catch (e: any) {
      setError(e?.message || "Failed to load set");
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Diff detection ────────────────────────────────────
  const dirty = useMemo(() => {
    if (!set) return false;
    if (name !== (set.name || "")) return true;
    if (versionTag !== (set.version_tag || "1.0.0")) return true;
    for (const p of set.pairs) {
      const edit = pairEdits[p.pair_id];
      if (!edit) continue;
      if (edit.rationale !== (p.rationale || "")) return true;
      if (edit.requires_masking !== !!p.requires_masking) return true;
    }
    return false;
  }, [set, name, versionTag, pairEdits]);

  // ── Save ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!set || !dirty) {
      toast.info("Nothing to save.");
      return;
    }
    if (set.status === "APPROVED") {
      toast.error("Approved sets are immutable", {
        description:
          "You must create a new draft from the parent table-mapping set to edit it.",
      });
      return;
    }

    setSaving(true);
    const lid = toast.loading("Saving metadata…");
    try {
      // Build merged pair list: keep every column rule unchanged,
      // only touch rationale + requires_masking at the pair level.
      const mergedPairs: PairBlock[] = set.pairs.map((p) => {
        const edit = pairEdits[p.pair_id];
        if (!edit) return p;
        return {
          ...p,
          rationale: edit.rationale,
          requires_masking: edit.requires_masking,
        };
      });

      // pairMappingApi.reviewPair is per-pair. For whole-set metadata
      // edits, we reuse the direct-save endpoint via finalize-style
      // payload. The backend `save_pairs` method accepts:
      //   { pairs, name, version_tag }
      // and PUTs the entire pair list back. We preserve every column
      // rule untouched — only pair-level metadata is changed.
      await pairMappingApi.savePairs(setId, {
        pairs: mergedPairs as any[],
        name: name.trim() || undefined,
        version_tag: versionTag.trim() || undefined,
      });

      toast.success("Metadata saved", { id: lid });
      router.push(
        `/pair-mapping/${encodeURIComponent(
          setId
        )}?project_id=${encodeURIComponent(projectId)}`
      );
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message, id: lid });
      setSaving(false);
    }
  };

  const setPairField = (
    pairId: string,
    patch: Partial<{ rationale: string; requires_masking: boolean }>
  ) => {
    setPairEdits((prev) => ({
      ...prev,
      [pairId]: {
        ...(prev[pairId] || { rationale: "", requires_masking: false }),
        ...patch,
      },
    }));
  };

  // ── States ────────────────────────────────────────────
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
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium"
            >
              Retry
            </button>
            <Link
              href={`/pair-mapping?project_id=${encodeURIComponent(projectId)}`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 text-slate-700 text-[12px] font-medium"
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
        <Link
          href={`/pair-mapping/${encodeURIComponent(
            setId
          )}?project_id=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to set
        </Link>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Pair mapping
            </span>
            <span className="text-[10px] text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">
              Edit
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
              Edit set metadata
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
          <p className="text-[13px] text-slate-500 mt-1 font-mono">
            {set.set_id}
          </p>
        </div>

        {/* Immutable banner */}
        {isApproved && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">This set is approved and frozen.</p>
              <p className="mt-0.5 leading-relaxed">
                Approved sets are immutable. To make changes, create a new
                draft from the parent table-mapping set.
              </p>
            </div>
          </div>
        )}

        {/* ── Top-level metadata ───────────────────────── */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5 text-slate-500" />
            <h2 className="text-[13px] font-semibold text-slate-900">
              Set metadata
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Set name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isApproved}
                placeholder={set.name || "Untitled set"}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Version tag
              </label>
              <input
                type="text"
                value={versionTag}
                onChange={(e) => setVersionTag(e.target.value)}
                disabled={isApproved}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-mono text-slate-900 focus:outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <MetaRow
                icon={Layers}
                label="Pairs"
                value={String(set.pairs.length)}
              />
              <MetaRow
                icon={Hash}
                label="Hash"
                value={set.content_hash?.slice(0, 10) || "—"}
                mono
              />
              <MetaRow
                icon={Shield}
                label="Source"
                value={set.source_system_id || "—"}
                mono
              />
              <MetaRow
                icon={Shield}
                label="Target"
                value={set.target_system_id || "—"}
                mono
              />
            </div>
          </div>
        </section>

        {/* ── Per-pair metadata ────────────────────────── */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-[13px] font-semibold text-slate-900">
              Pair-level metadata
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Rationale and PII masking flag are editable per pair. Column
              rules are edited on the set page.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {set.pairs.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12px] text-slate-400">
                No pairs in this set.
              </div>
            ) : (
              set.pairs.map((pair) => {
                const edit = pairEdits[pair.pair_id] || {
                  rationale: "",
                  requires_masking: false,
                };
                return (
                  <div
                    key={pair.pair_id}
                    className="px-5 py-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[12px] font-semibold text-slate-900">
                        {pair.source_table}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-mono text-[12px] font-semibold text-slate-900">
                        {pair.target_table}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Rationale
                      </label>
                      <textarea
                        rows={2}
                        value={edit.rationale}
                        onChange={(e) =>
                          setPairField(pair.pair_id, {
                            rationale: e.target.value,
                          })
                        }
                        disabled={isApproved}
                        placeholder="Why does this pair exist?"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 resize-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2">
                      <div>
                        <p className="text-[11.5px] font-medium text-slate-900">
                          Requires masking
                        </p>
                        <p className="text-[10px] text-slate-500">
                          PII / regulated data
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={edit.requires_masking}
                        disabled={isApproved}
                        onClick={() =>
                          setPairField(pair.pair_id, {
                            requires_masking: !edit.requires_masking,
                          })
                        }
                        className={`relative inline-flex h-[20px] w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          edit.requires_masking
                            ? "border-slate-900 bg-slate-900"
                            : "border-slate-300 bg-slate-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                            edit.requires_masking
                              ? "translate-x-[17px]"
                              : "translate-x-[2px]"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Actions ──────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 sticky bottom-4">
          <Link
            href={`/pair-mapping/${encodeURIComponent(
              setId
            )}?project_id=${encodeURIComponent(projectId)}`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 text-[12px] font-medium hover:bg-slate-50"
          >
            Cancel
          </Link>
          <div className="flex items-center gap-2">
            {dirty && !isApproved && (
              <span className="text-[11px] text-amber-700 font-medium">
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || isApproved}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save metadata
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p
        className={`text-[12px] text-slate-800 mt-1 truncate ${
          mono ? "font-mono" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}