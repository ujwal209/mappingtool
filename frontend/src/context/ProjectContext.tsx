"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, ProjectItem } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

interface ProjectContextType {
  projects: ProjectItem[];
  activeProject: ProjectItem | null;
  activeProjectId: string | null;
  setActiveProjectId: (id: string) => void;
  isLoadingProjects: boolean;
  hasProjects: boolean;
  refreshProjects: () => Promise<ProjectItem[]>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);

  const refreshProjects = useCallback(async (): Promise<ProjectItem[]> => {
    setIsLoadingProjects(true);
    try {
      const list = await api.getProjects().catch(() => []);
      setProjects(list);

      if (list.length > 0) {
        let savedId: string | null = null;
        if (typeof window !== "undefined") {
          savedId = localStorage.getItem("active_project_id");
        }

        const match = list.find((p) => p.project_id === savedId);
        if (match) {
          setActiveProjectIdState(match.project_id);
        } else {
          setActiveProjectIdState(list[0].project_id);
          if (typeof window !== "undefined") {
            localStorage.setItem("active_project_id", list[0].project_id);
          }
        }
      } else {
        setActiveProjectIdState(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("active_project_id");
        }
      }

      return list;
    } catch (err) {
      console.error("Failed to fetch projects in ProjectContext:", err);
      return [];
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_project_id", id);
    }
  };

  useEffect(() => {
    if (isAuthLoading) {
      setIsLoadingProjects(true);
      return;
    }
    refreshProjects();
  }, [isAuthLoading, isAuthenticated, refreshProjects]);

  const activeProject = projects.find((p) => p.project_id === activeProjectId) || (projects.length > 0 ? projects[0] : null);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId: activeProject ? activeProject.project_id : null,
        setActiveProjectId,
        isLoadingProjects,
        hasProjects: projects.length > 0,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
