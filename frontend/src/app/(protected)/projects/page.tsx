"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ProjectItem } from "@/lib/api-client";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Activity,
  Search,
  FolderKanban,
  Calendar,
  Layers,
} from "lucide-react";

export default function ProjectsListPage() {
  const router = useRouter();
  const { activeProjectId, setActiveProjectId, refreshProjects } = useProject();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await refreshProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleActivateProject = (projectId: string) => {
    setActiveProjectId(projectId);
    router.push("/dashboard");
  };

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.domain?.toLowerCase().includes(q) ||
      p.project_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {projects.length} Total
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Select a project container to manage connectors, ontologies, and migrations.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={loadProjects}
            disabled={loading}
            className="h-9 px-3 text-sm text-slate-700 border-slate-300 bg-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/projects/new">
            <Button className="h-9 px-4 text-sm bg-slate-900 hover:bg-slate-800 text-white">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by name, domain, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <Activity className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
          <p className="text-sm text-slate-500">Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center space-y-4 bg-slate-50/50">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-sm">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">
              {searchQuery ? "No matching projects found" : "No Projects Configured"}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? "Try a different search term."
                : "Create your first project container to begin mapping schemas."}
            </p>
          </div>
          {!searchQuery && (
            <Link href="/projects/new">
              <Button className="bg-slate-900 text-white text-sm h-9 px-4">
                <Plus className="w-4 h-4 mr-2" /> Create Project
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((proj) => {
            const isActive = proj.project_id === activeProjectId;
            return (
              <div
                key={proj.project_id}
                className={`flex flex-col rounded-xl border bg-white p-5 transition-all duration-200 shadow-sm hover:shadow-md ${
                  isActive ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-medium text-slate-400 truncate">
                        {proj.project_id}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white tracking-wider uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {proj.name}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-4 flex-1">
                  {proj.description || "No description provided."}
                </p>

                <div className="space-y-2 mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Domain
                    </span>
                    <span className="font-medium text-slate-800 truncate max-w-[160px]">
                      {proj.domain || "Enterprise"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5" /> Target
                    </span>
                    <span className="font-medium text-slate-800 truncate max-w-[160px]">
                      {proj.target_ecosystem || "Fabric OneLake"}
                    </span>
                  </div>
                  {proj.target_cutover_date && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Cutover
                      </span>
                      <span className="font-mono text-slate-700">
                        {proj.target_cutover_date}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-auto">
                  {isActive ? (
                    <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-slate-900" />
                      Currently Active
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleActivateProject(proj.project_id)}
                      className="text-xs font-medium px-3 py-1.5 h-8 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Set Active
                    </Button>
                  )}

                  <Button
                    onClick={() => {
                      setActiveProjectId(proj.project_id);
                      router.push("/dashboard");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 bg-transparent hover:bg-slate-100 px-3 py-1.5 h-8 rounded-lg transition-colors"
                  >
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}