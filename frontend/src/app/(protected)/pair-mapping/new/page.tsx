"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  AlertTriangle,
  Search,
  X,
  CheckCircle2,
  Layers,
  GitBranch,
  Sparkles,
  Hash,
  Table2,
  Settings2,
  ShieldCheck,
  CircleDashed,
  FileCheck2,
} from "lucide-react";
import { toast } from "sonner";
import { pairMappingApi } from "@/lib/pair-mapping-api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api/v1";

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
  if (urlParam?.trim()) return urlParam.trim();
  if (typeof window !== "undefined") {
    const s = localStorage.getItem("active_project_id");
    if (s?.trim()) return s.trim();
  }
  return "proj-default";
}

interface TableMappingSetLite {
  table_mapping_set_id: string;
  project_id: string;
  name?: string;
  source_system_id: string;
  target_system_id: string;
  version_tag: string;
  status: string;
  pairs?: Array<{ source_table: string; target_table: string }>;
  created_at: number;
}

export default function NewPairMappingPage() {
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

  const [tableSets, setTableSets] = useState<TableMappingSetLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTmsId, setSelectedTmsId] = useState<string>("");
  const [versionTag, setVersionTag] = useState("1.0.0");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/mapping-sets/${encodeURIComponent(projectId)}/table-pairs`,
        { headers: authHeaders() }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `Load failed (${res.status})`);
      }
      const data = await res.json();
      setTableSets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load table-mapping sets");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tableSets;
    return tableSets.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        t.table_mapping_set_id.toLowerCase().includes(q) ||
        t.source_system_id.toLowerCase().includes(q) ||
        t.target_system_id.toLowerCase().includes(q)
    );
  }, [tableSets, query]);

  const selected = tableSets.find(
    (t) => t.table_mapping_set_id === selectedTmsId
  );

  const handleCreate = async () => {
    if (!selectedTmsId) {
      toast.error("Pick a table-mapping set first");
      return;
    }
    setCreating(true);
    const lid = toast.loading("Creating column mapping set…");
    try {
      const created = await pairMappingApi.createFromTableSet(projectId, {
        table_mapping_set_id: selectedTmsId,
        name: name.trim() || undefined,
        version_tag: versionTag.trim() || "1.0.0",
      });
      toast.success(
        `Created ${created.pairs.length} pair block${
          created.pairs.length === 1 ? "" : "s"
        }`,
        { id: lid }
      );
      router.push(
        `/pair-mapping/${encodeURIComponent(
          created.set_id
        )}?project_id=${encodeURIComponent(projectId)}`
      );
    } catch (e: any) {
      toast.error("Create failed", { description: e?.message, id: lid });
      setCreating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Back ─────────────────────────────────────── */}
        <Link
          href={`/pair-mapping?project_id=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to column mappings
        </Link>

        {/* ── Header ───────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Column mapping
            </span>
            <span className="text-[10px] text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">
              New
            </span>
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
            New column mapping set
          </h1>
          <p className="text-[13px] text-slate-500 mt-1.5 max-w-2xl">
            Pick a table-matching set. Every confirmed source → target pair in
            it becomes a sub-workbench where you can run AI, review, and edit
            column rules.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => void load()}
              className="shrink-0 px-2 py-0.5 rounded border border-red-200 bg-white text-[11px] font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Two-column layout ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
          {/* LEFT: Table-mapping picker */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Section header */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Table2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[13px] font-semibold text-slate-900">
                    Choose a table-mapping set
                  </h2>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                    {tableSets.length} set
                    {tableSets.length === 1 ? "" : "s"} available
                  </p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, ID, or system…"
                  className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-[68px] rounded-lg bg-slate-50 animate-pulse"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 px-6 text-center">
                  <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <Layers className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-slate-900">
                    {query
                      ? `No sets match "${query}"`
                      : "No table-mapping sets yet"}
                  </h3>
                  <p className="text-[11.5px] text-slate-500 mt-1 max-w-xs mx-auto">
                    {query
                      ? "Try a different search."
                      : "Create one in Table Matching first, then return here."}
                  </p>
                  {!query && (
                    <Link
                      href={`/table-matching/discover?project_id=${encodeURIComponent(
                        projectId
                      )}`}
                      className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 text-white text-[11.5px] font-medium hover:bg-slate-800"
                    >
                      <Sparkles className="w-3 h-3" />
                      Discover table pairs
                    </Link>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filtered.map((t) => {
                    const isSel = selectedTmsId === t.table_mapping_set_id;
                    const pairCount = t.pairs?.length ?? 0;
                    return (
                      <li key={t.table_mapping_set_id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTmsId(t.table_mapping_set_id)
                          }
                          className={`w-full text-left px-4 sm:px-5 py-3 transition-colors ${
                            isSel
                              ? "bg-slate-50"
                              : "hover:bg-slate-50/60"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Radio indicator */}
                            <span
                              className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSel
                                  ? "border-slate-900 bg-slate-900"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSel && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[12.5px] font-semibold text-slate-900 truncate">
                                  {t.name || t.table_mapping_set_id}
                                </span>
                                <span className="inline-flex items-center text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  v{t.version_tag}
                                </span>
                              </div>
                              <p className="text-[10.5px] text-slate-500 font-mono mt-1 truncate">
                                {t.table_mapping_set_id}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10.5px] text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />
                                  {t.source_system_id} → {t.target_system_id}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span>
                                  {pairCount} pair
                                  {pairCount === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* RIGHT: Configuration + summary */}
          <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            {/* Configuration card */}
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                <h2 className="text-[12.5px] font-semibold text-slate-900">
                  Configuration
                </h2>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    Set name
                    <span className="text-slate-400 font-normal ml-1">
                      (optional)
                    </span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      selected?.name ||
                      "Auto-derived from table-mapping set"
                    }
                    disabled={!selected}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    Version tag
                  </label>
                  <input
                    value={versionTag}
                    onChange={(e) => setVersionTag(e.target.value)}
                    disabled={!selected}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-mono text-slate-900 focus:outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </section>

            {/* Preview card */}
            {selected ? (
              <section className="rounded-xl border border-slate-900 bg-slate-900 text-white overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                  <h2 className="text-[12.5px] font-semibold">
                    Ready to create
                  </h2>
                </div>

                <div className="p-4 space-y-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      From
                    </p>
                    <p className="text-[12px] font-mono text-white truncate">
                      {selected.name || selected.table_mapping_set_id}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Pairs
                      </p>
                      <p className="text-[16px] font-semibold font-mono text-white mt-0.5">
                        {selected.pairs?.length ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Version
                      </p>
                      <p className="text-[16px] font-semibold font-mono text-white mt-0.5">
                        v{versionTag || "1.0.0"}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10.5px] text-slate-400">
                    <ShieldCheck className="w-3 h-3" />
                    <span>AI runs on demand after creation</span>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center">
                <CircleDashed className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-[11.5px] text-slate-500 leading-relaxed">
                  Select a table-mapping set from the list to see the
                  configuration preview.
                </p>
              </section>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!selectedTmsId || creating}
                className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {creating ? (
                  <>
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create mapping set
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              <Link
                href={`/pair-mapping?project_id=${encodeURIComponent(
                  projectId
                )}`}
                className="w-full inline-flex items-center justify-center h-9 px-4 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}