"use client";

import React, { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TechIcon } from "@/components/tech-icons";
import {
  Layers,
  Server,
  Table,
  BookOpen,
  GitBranch,
  Play,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Plus,
  FolderPlus,
  FolderKanban,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
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

  const loadDashboardData = async () => {
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
        ? sysList.filter((s) => s.project_id === activeProjectId || s.project_id === "proj-default")
        : sysList;

      const systemIds = new Set(filteredSystems.map((s) => s.system_id));
      const filteredDatasets = dsList.filter((d) => systemIds.has(d.system_id) || systemIds.size === 0);

      setSystems(filteredSystems);
      setDatasets(filteredDatasets);
      setOntologies(ontList);
      setMappings(mapList);
      setRecentRuns(runsList.slice(0, 5)); // Only show top 5 recent runs
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && activeProjectId) {
      loadDashboardData();
    }
  }, [tenantId, isAuthenticated, authLoading, activeProjectId]);

  // Metrics
  const sourceCount = systems.filter((s) => s.kind === "SOURCE").length;
  const destCount = systems.filter((s) => s.kind === "TARGET").length;
  const totalConceptsCount = ontologies.reduce((acc, ont) => acc + (ont.concepts ? ont.concepts.length : 0), 0);
  const approvedMappingsCount = mappings.filter((m) => m.status === "APPROVED").length;

  const setupSteps = [
    { title: "Connect Systems", done: systems.length >= 2, link: "/connectors/new" },
    { title: "Define Ontology", done: ontologies.length > 0, link: "/ontology/new" },
    { title: "Map Schemas", done: mappings.length > 0, link: "/mapping" },
    { title: "Execute Pipeline", done: recentRuns.length > 0, link: "/runs" },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedSteps / setupSteps.length) * 100);

  // ============================================================
  // GATE: No Projects Exist Yet
  // ============================================================
  if (!isLoadingProjects && !hasProjects) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto space-y-6 mt-12">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto shadow-md">
          <FolderPlus className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Create your first project</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Projects scope your data connections, ontologies, and migration pipelines.
          </p>
        </div>
        <Link href="/projects/new">
          <Button className="bg-slate-900 hover:bg-slate-800 text-white h-10 px-6">
            <Plus className="w-4 h-4 mr-2" /> Create Project
          </Button>
        </Link>
      </div>
    );
  }

  // ============================================================
  // MAIN WORKSPACE
  // ============================================================
  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of your active migration project.</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
            className="h-9 px-3 text-xs text-slate-700 border-slate-300 bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="h-9 px-3 text-xs text-slate-900 border-slate-300 bg-white font-medium min-w-[180px] justify-between"
            >
              <span className="truncate">{activeProject?.name || "Select Project"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-2" />
            </Button>

            {projectDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 text-sm">
                  <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-slate-400">Switch Project</div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {projects.map((p) => (
                      <button
                        key={p.project_id}
                        onClick={() => {
                          setActiveProjectId(p.project_id);
                          setProjectDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2 py-2 rounded-md transition flex items-center justify-between ${
                          p.project_id === activeProjectId
                            ? "bg-slate-100 text-slate-900 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {p.project_id === activeProjectId && <Check className="w-3.5 h-3.5 text-slate-900" />}
                      </button>
                    ))}
                  </div>
                  <div className="pt-1.5 mt-1.5 border-t border-slate-100">
                    <Link
                      href="/projects/new"
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-slate-700 hover:bg-slate-50 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Project
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <Link href="/connectors/new">
            <Button size="sm" className="h-9 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Connection
            </Button>
          </Link>
        </div>
      </div>

      {/* 2-Column Layout: Left (Readiness + Activity) / Right (Metrics) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Project Context Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{activeProject?.name}</h2>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{activeProject?.description || "No description provided."}</p>
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-mono text-[10px] uppercase shrink-0">
                {activeProject?.lifecycle_state || "Active"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Domain</span>
                <span className="text-sm font-medium text-slate-800 truncate block">{activeProject?.domain || "Enterprise"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Methodology</span>
                <span className="text-sm font-medium text-slate-800 truncate block">{activeProject?.methodology || "Phased"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cutover</span>
                <span className="text-sm font-medium text-slate-800 truncate block">{activeProject?.target_cutover_date || "TBD"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Target</span>
                <span className="text-sm font-medium text-slate-800 truncate block">{activeProject?.target_ecosystem || "Fabric"}</span>
              </div>
            </div>
          </div>

          {/* Readiness Tracker */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">Project Readiness</CardTitle>
                <span className="text-xs font-semibold text-slate-600">{progressPercent}% Complete</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                <div className="bg-slate-900 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {setupSteps.map((step, idx) => (
                <div
                  key={step.title}
                  className={`p-3 rounded-lg border flex items-center justify-between ${
                    step.done ? "bg-slate-50 border-slate-200" : "bg-white border-dashed border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={`text-sm font-medium truncate ${step.done ? "text-slate-900" : "text-slate-600"}`}>
                      {step.title}
                    </span>
                  </div>
                  {!step.done && (
                    <Link href={step.link} className="text-xs font-semibold text-slate-900 hover:underline shrink-0">
                      Configure
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active Systems List */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-bold text-slate-900">Connected Systems</CardTitle>
              <Link href="/connectors" className="text-xs font-medium text-slate-600 hover:text-slate-900">
                View all →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {systems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50">
                  <p className="text-sm text-slate-500 mb-3">No connections configured.</p>
                  <Link href="/connectors/new">
                    <Button size="sm" variant="outline" className="text-xs">Add Connection</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {systems.slice(0, 4).map((s) => (
                    <Link key={s.system_id} href={`/connectors/${s.system_id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <TechIcon name={s.adapter_type || s.connector_type || s.name} className="w-8 h-8 rounded-md shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-slate-900 block truncate">{s.name}</span>
                          <span className="text-[10px] font-mono text-slate-500 block truncate">{s.adapter_type || s.connector_type}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono bg-slate-50 text-slate-600 border-slate-200 shrink-0">
                        {s.kind}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (1/3 width) - Metrics & Recent Activity */}
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Endpoints</span>
                <Server className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{systems.length}</div>
              <p className="text-[11px] text-slate-500">{sourceCount} Src · {destCount} Tgt</p>
            </Card>

            <Card className="border-slate-200 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Datasets</span>
                <Table className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{datasets.length}</div>
              <Link href="/datasets" className="text-[11px] font-medium text-slate-900 hover:underline">Inspect →</Link>
            </Card>

            <Card className="border-slate-200 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Ontologies</span>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{totalConceptsCount}</div>
              <p className="text-[11px] text-slate-500">concepts defined</p>
            </Card>

            <Card className="border-slate-200 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Mappings</span>
                <GitBranch className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{mappings.length}</div>
              <p className="text-[11px] text-slate-500">{approvedMappingsCount} approved</p>
            </Card>
          </div>

          {/* Recent Runs */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900">Recent Runs</CardTitle>
              <Link href="/runs" className="text-xs font-medium text-slate-600 hover:text-slate-900">
                View all →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentRuns.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No runs yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentRuns.map((r) => (
                    <div key={r.run_id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-mono font-semibold text-slate-900 block truncate">{r.run_id}</span>
                        <span className="text-[10px] text-slate-500 block truncate flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {r.state}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono shrink-0 ${
                          r.state === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          (r.state as string) === "RUNNING" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {r.state}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { label: "Add Connection", href: "/connectors/new", icon: Plus },
                { label: "Open Ontology Studio", href: "/ontology", icon: BookOpen },
                { label: "Create Mapping", href: "/mapping", icon: GitBranch },
                { label: "Execute Run", href: "/runs", icon: Play },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-between p-2.5 rounded-md text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-slate-400" />
                      {action.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}