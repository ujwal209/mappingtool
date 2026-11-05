"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/context/ProjectContext";
import { FolderPlus, FolderKanban, ArrowRight, Loader2 } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";

interface ProjectGuardProps {
  children: React.ReactNode;
  featureName?: string;
}

export function ProjectGuard({ children, featureName = "this workspace" }: ProjectGuardProps) {
  const { activeProject, activeProjectId, projects, setActiveProjectId, isLoadingProjects } = useProject();

  if (isLoadingProjects) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="text-xs text-slate-500 font-medium tracking-wide">
          Verifying project scope...
        </span>
      </div>
    );
  }

  if (!activeProjectId || !activeProject) {
    return (
      <div className="max-w-2xl mx-auto my-16 px-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xs text-center space-y-6">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-800">
            <FolderKanban className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Active Project Required
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              To access {featureName}, you must have an active project selected. All connectors, ontologies, mappings, and sync operations are organized inside project scopes.
            </p>
          </div>

          {projects.length > 0 ? (
            <div className="max-w-md mx-auto space-y-4 pt-2">
              <div className="text-left space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Select an Existing Project
                </label>
                <CustomSelect
                  options={projects.map((p) => ({
                    value: p.project_id,
                    label: p.name,
                    description: p.description || `Created ${p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}`,
                  }))}
                  value=""
                  onChange={(val) => setActiveProjectId(val)}
                  placeholder="Choose a project to activate..."
                />
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <span className="text-xs text-slate-400">or</span>
              </div>

              <div>
                <Link
                  href="/projects/new"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create New Project
                  <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <Link
                href="/projects/new"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors shadow-xs"
              >
                <FolderPlus className="w-4 h-4" />
                Create Your First Project
                <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
