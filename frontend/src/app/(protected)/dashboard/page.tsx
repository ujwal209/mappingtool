"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  api,
  SystemItem,
  DatasetItem,
  OntologyVersionItem,
  MappingSetItem,
  RunItem,
} from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { TechIcon } from "@/components/tech-icons";
import {
  RefreshCw,
  CheckCircle2,
  ArrowUpRight,
  Plus,
  FolderPlus,
  Check,
  ChevronDown,
} from "lucide-react";

export default function DashboardConsolePage() {
  const { tenantId, isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    hasProjects,
    isLoadingProjects,
  } = useProject();

  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [ontologies, setOntologies] = useState<OntologyVersionItem[]>([]);
  const [mappings, setMappings] = useState<MappingSetItem[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [sysList, dsList, ontList, mapList, runsList] = await Promise.all([
        api.getSystems().catch(() => []),
        api.getDatasets().catch(() => []),
        api.getOntologies(activeProjectId || undefined).catch(() => []),
        api.getMappingSets(activeProjectId || undefined).catch(() => []),
        api.getRuns().catch(() => []),
      ]);

      const filteredSystems = activeProjectId
        ? sysList.filter(
            (s) =>
              s.project_id === activeProjectId ||
              s.project_id === "proj-default"
          )
        : sysList;

      const systemIds = new Set(filteredSystems.map((s) => s.system_id));
      const filteredDatasets = dsList.filter(
        (d) => systemIds.has(d.system_id) || systemIds.size === 0
      );

      setSystems(filteredSystems);
      setDatasets(filteredDatasets);
      setOntologies(ontList);
      setMappings(mapList);
      setRecentRuns(runsList.slice(0, 6));
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && activeProjectId) {
      loadDashboardData();
    }
  }, [tenantId, isAuthenticated, authLoading, activeProjectId, loadDashboardData]);

  const sourceCount = systems.filter((s) => s.kind === "SOURCE").length;
  const destCount = systems.filter((s) => s.kind === "TARGET").length;
  const totalConceptsCount = ontologies.reduce(
    (acc, ont) => acc + (ont.concepts ? ont.concepts.length : 0),
    0
  );
  const approvedMappingsCount = mappings.filter(
    (m) => m.status === "APPROVED"
  ).length;

  const setupSteps = [
    {
      step: "01",
      title: "Connect Source & Target Systems",
      detail: `${systems.length} of 2 minimum endpoints configured`,
      done: systems.length >= 2,
      link: "/connectors/new",
      cta: "Add system",
    },
    {
      step: "02",
      title: "Define Business Ontology",
      detail:
        ontologies.length > 0
          ? `${ontologies.length} version(s) · ${totalConceptsCount} concepts`
          : "No semantic model published",
      done: ontologies.length > 0,
      link: "/ontology/new",
      cta: "Create ontology",
    },
    {
      step: "03",
      title: "Map & Verify Schemas",
      detail:
        mappings.length > 0
          ? `${approvedMappingsCount} of ${mappings.length} mapping sets approved`
          : "No attribute alignments drafted",
      done: mappings.length > 0,
      link: "/pair-mapping",
      cta: "Open mapper",
    },
    {
      step: "04",
      title: "Execute Migration Run",
      detail:
        recentRuns.length > 0
          ? `${recentRuns.length} run(s) recorded`
          : "Awaiting initial pipeline run",
      done: recentRuns.length > 0,
      link: "/migrations",
      cta: "Launch run",
    },
  ];

  const completedSteps = setupSteps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedSteps / setupSteps.length) * 100);

  const getRunBadgeStyle = (state: string) => {
    const normalized = (state || "").toUpperCase();
    if (normalized === "COMPLETED" || normalized === "SIGNED_OFF") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (
      normalized === "RUNNING" ||
      normalized === "EXTRACTING" ||
      normalized === "LOADING"
    ) {
      return "bg-[#432DD7]/10 text-[#432DD7] border-[#432DD7]/25";
    }
    if (
      normalized === "AWAITING_LOAD_REVIEW" ||
      normalized === "EXCEPTION_REVIEW"
    ) {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    if (normalized === "FAILED" || normalized === "ABORTED") {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  // ============================================================
  // EMPTY PROJECT GATE
  // ============================================================
  if (!isLoadingProjects && !hasProjects) {
    return (
      <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs sm:mt-16 sm:p-12">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#432DD7] text-white">
          <FolderPlus className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
          Initialize a migration project
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Projects isolate your source and target connectors, ontology graphs,
          mapping sets, and execution manifests.
        </p>
        <div className="mt-6">
          <Link href="/projects/new">
            <Button className="h-10 bg-[#432DD7] px-5 text-sm font-medium text-white hover:bg-[#3622B8]">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN WORKSPACE
  // ============================================================
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      {/* Top Action Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-start">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {activeProject?.name || "Workspace Overview"}
            </h1>
            <span className="inline-flex items-center rounded-full border border-[#432DD7]/20 bg-[#432DD7]/10 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase text-[#432DD7]">
              {activeProject?.lifecycle_state || "Active"}
            </span>
          </div>
          <p className="max-w-3xl break-words text-sm leading-relaxed text-slate-500">
            {activeProject?.description ||
              "Schema alignment, semantic bindings, and pipeline execution state."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
            className="h-9 border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${
                loading ? "animate-spin text-[#432DD7]" : "text-slate-500"
              }`}
            />
            Sync
          </Button>

          {/* Project Switcher */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="h-auto min-h-9 max-w-full justify-between gap-2 border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-900 hover:bg-slate-50"
            >
              <span className="break-words">
                {activeProject?.name || "Select Project"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </Button>

            {projectDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProjectDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg sm:left-auto sm:right-0">
                  <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
                    Projects
                  </div>
                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                    {projects.map((p) => {
                      const selected = p.project_id === activeProjectId;
                      return (
                        <button
                          key={p.project_id}
                          onClick={() => {
                            setActiveProjectId(p.project_id);
                            setProjectDropdownOpen(false);
                          }}
                          className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                            selected
                              ? "bg-[#432DD7]/10 font-semibold text-[#432DD7]"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="break-words leading-snug">
                            {p.name}
                          </span>
                          {selected && (
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#432DD7]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                    <Link
                      href="/projects/new"
                      onClick={() => setProjectDropdownOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#432DD7]"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      New project
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <Link href="/connectors/new">
            <Button
              size="sm"
              className="h-9 bg-[#432DD7] px-3.5 text-xs font-medium text-white shadow-2xs hover:bg-[#3622B8]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Connection
            </Button>
          </Link>
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/connectors"
          className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 transition hover:border-[#432DD7]/40 hover:shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Connected Systems
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#432DD7]" />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {loading ? "—" : systems.length}
            </span>
            <span className="font-mono text-xs text-slate-500">
              {sourceCount} src · {destCount} tgt
            </span>
          </div>
        </Link>

        <Link
          href="/datasets"
          className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 transition hover:border-[#432DD7]/40 hover:shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Registered Datasets
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#432DD7]" />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {loading ? "—" : datasets.length}
            </span>
            <span className="text-xs text-slate-500">Profiled tables</span>
          </div>
        </Link>

        <Link
          href="/ontology"
          className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 transition hover:border-[#432DD7]/40 hover:shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Ontology Concepts
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#432DD7]" />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {loading ? "—" : totalConceptsCount}
            </span>
            <span className="text-xs text-slate-500">
              {ontologies.length} version(s)
            </span>
          </div>
        </Link>

        <Link
          href="/pair-mapping"
          className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 transition hover:border-[#432DD7]/40 hover:shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Schema Mappings
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#432DD7]" />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {loading ? "—" : mappings.length}
            </span>
            <span className="text-xs text-slate-500">
              {approvedMappingsCount} approved
            </span>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Project Metadata Strip */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <span className="block text-xs text-slate-400">Domain</span>
                <span className="mt-1 block break-words text-sm font-medium text-slate-900">
                  {activeProject?.domain || "Enterprise"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Methodology</span>
                <span className="mt-1 block break-words text-sm font-medium text-slate-900">
                  {activeProject?.methodology || "Phased"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Target Date</span>
                <span className="mt-1 block break-words text-sm font-medium text-slate-900">
                  {activeProject?.target_cutover_date || "Unscheduled"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Destination</span>
                <span className="mt-1 block break-words text-sm font-medium text-slate-900">
                  {activeProject?.target_ecosystem || "Fabric"}
                </span>
              </div>
            </div>
          </div>

          {/* Pipeline Readiness */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Migration Readiness
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {completedSteps} of {setupSteps.length} prerequisites satisfied
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-[#432DD7]">
                {progressPercent}%
              </span>
            </div>

            <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#432DD7] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {setupSteps.map((item) => (
                <div
                  key={item.step}
                  className={`flex flex-col justify-between gap-3 rounded-lg border p-3.5 transition sm:flex-row sm:items-center ${
                    item.done
                      ? "border-slate-200/80 bg-slate-50/70"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {item.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#432DD7]" />
                    ) : (
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 font-mono text-[9px] font-semibold text-slate-500">
                        {item.step}
                      </span>
                    )}
                    <div className="space-y-0.5">
                      <p className="break-words text-xs font-semibold leading-snug text-slate-900">
                        {item.title}
                      </p>
                      <p className="break-words text-[11px] leading-snug text-slate-500">
                        {item.detail}
                      </p>
                    </div>
                  </div>

                  {!item.done && (
                    <Link
                      href={item.link}
                      className="self-start shrink-0 rounded-md bg-[#432DD7]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#432DD7] transition hover:bg-[#432DD7] hover:text-white sm:self-center"
                    >
                      {item.cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Connected Systems List */}
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Connected Systems
              </h2>
              <Link
                href="/connectors"
                className="text-xs font-medium text-[#432DD7] hover:underline"
              >
                Manage all
              </Link>
            </div>

            {systems.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-slate-500">
                  No source or target systems connected to this project.
                </p>
                <div className="mt-3">
                  <Link href="/connectors/new">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-slate-200 text-xs font-medium text-slate-800 hover:border-[#432DD7] hover:text-[#432DD7]"
                    >
                      Add connection
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {systems.slice(0, 5).map((s) => (
                  <Link
                    key={s.system_id}
                    href={`/connectors/${s.system_id}`}
                    className="flex flex-col justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50/80 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3 sm:items-center">
                      <TechIcon
                        name={s.adapter_type || s.connector_type || s.name}
                        className="mt-0.5 h-8 w-8 shrink-0 rounded-lg sm:mt-0"
                      />
                      <div className="space-y-0.5">
                        <p className="break-words text-sm font-medium leading-snug text-slate-900">
                          {s.name}
                        </p>
                        <p className="break-all font-mono text-[11px] text-slate-500">
                          {s.adapter_type || s.connector_type}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`self-start shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium uppercase sm:self-center ${
                        s.kind === "TARGET"
                          ? "border-[#432DD7]/20 bg-[#432DD7]/10 text-[#432DD7]"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {s.kind}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="space-y-6">
          {/* Quick Navigation */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Workspace</h2>
            <div className="mt-3 space-y-1">
              {[
                { label: "Register Connector", href: "/connectors/new" },
                { label: "Ontology Studio", href: "/ontology" },
                { label: "Table Pair Matching", href: "/table-matching" },
                { label: "Column Mapping Workbench", href: "/pair-mapping" },
                { label: "Migration Runs", href: "/migrations" },
              ].map((nav) => (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[#432DD7]/5 hover:text-[#432DD7]"
                >
                  <span className="break-words">{nav.label}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#432DD7]" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Runs */}
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Recent Runs
              </h2>
              <Link
                href="/migrations"
                className="text-xs font-medium text-[#432DD7] hover:underline"
              >
                All runs
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-slate-500">
                No pipeline runs executed yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentRuns.map((r) => (
                  <Link
                    key={r.run_id}
                    href="/runs"
                    className="flex flex-col justify-between gap-2.5 px-5 py-3.5 transition hover:bg-slate-50/80 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-0.5">
                      <p className="break-all font-mono text-xs font-medium text-slate-900">
                        {r.run_id}
                      </p>
                      <p className="break-all text-[11px] text-slate-500">
                        Manifest {r.manifest_id || "pinned"}
                      </p>
                    </div>
                    <span
                      className={`self-start shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium uppercase sm:self-center ${getRunBadgeStyle(
                        r.state
                      )}`}
                    >
                      {r.state}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}