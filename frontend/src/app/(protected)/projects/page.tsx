"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProjectItem } from "@/lib/api-client";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  FolderOpen,
  ArrowUpRight,
  Search,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from "lucide-react";

type SortField = "name" | "domain" | "target_ecosystem" | "created_at";
type SortOrder = "asc" | "desc";

export default function ProjectsListPage() {
  const router = useRouter();
  const {
    projects,
    isLoadingProjects,
    activeProjectId,
    setActiveProjectId,
    refreshProjects,
  } = useProject();

  const [isSyncing, setIsSyncing] = useState(false);
  const loading = isLoadingProjects && projects.length === 0;

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
  const [targetFilter, setTargetFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [jumpInput, setJumpInput] = useState("");

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshProjects();
    } catch (err) {
      console.error("Failed to sync projects:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, domainFilter, targetFilter, pageSize, sortField, sortOrder]);

  const handleActivateAndOpen = (projectId: string) => {
    setActiveProjectId(projectId);
    router.push("/dashboard");
  };

  const handleSetActiveOnly = (projectId: string) => {
    setActiveProjectId(projectId);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const availableDomains = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.domain) set.add(p.domain);
    });
    return Array.from(set).sort();
  }, [projects]);

  const availableTargets = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.target_ecosystem) set.add(p.target_ecosystem);
    });
    return Array.from(set).sort();
  }, [projects]);

  const activeProject = useMemo(
    () => projects.find((p) => p.project_id === activeProjectId),
    [projects, activeProjectId]
  );

  const processedProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = projects.filter((p) => {
      if (domainFilter !== "ALL" && (p.domain || "Enterprise") !== domainFilter) {
        return false;
      }
      if (
        targetFilter !== "ALL" &&
        (p.target_ecosystem || "Fabric OneLake") !== targetFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.domain?.toLowerCase().includes(q) ||
        p.target_ecosystem?.toLowerCase().includes(q) ||
        p.methodology?.toLowerCase().includes(q) ||
        p.project_id?.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === "created_at") {
        comparison = (a.created_at || 0) - (b.created_at || 0);
      } else {
        const valA = (a[sortField] || "").toString().toLowerCase();
        const valB = (b[sortField] || "").toString().toLowerCase();
        comparison = valA.localeCompare(valB);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [projects, searchQuery, domainFilter, targetFilter, sortField, sortOrder]);

  const totalItems = processedProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedProjects = processedProjects.slice(startIndex, endIndex);

  const visiblePageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("ellipsis");
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      setCurrentPage(num);
      setJumpInput("");
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    domainFilter !== "ALL" ||
    targetFilter !== "ALL";

  const clearAllFilters = () => {
    setSearchQuery("");
    setDomainFilter("ALL");
    setTargetFilter("ALL");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-start">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Projects
            </h1>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100/80 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
              {projects.length.toLocaleString()} total
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            Browse, filter, and switch across project containers. Each project
            isolates its connectors, ontology versions, and migration runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing || loading}
            className="h-9 border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${
                isSyncing || loading ? "animate-spin text-slate-900" : "text-slate-500"
              }`}
            />
            Sync
          </Button>
          <Link href="/projects/new">
            <Button
              size="sm"
              className="h-9 bg-[#432DD7] px-3.5 text-xs font-medium text-white shadow-2xs hover:bg-[#3724B5]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Subtle Active Workspace Strip (Neutral surface, single accent indicator) */}
      {activeProject && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-2xs sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-[#432DD7]" />
                Current Workspace
              </span>
              <span className="break-all font-mono text-xs text-slate-400">
                {activeProject.project_id}
              </span>
            </div>
            <p className="break-words text-sm font-semibold text-slate-900">
              {activeProject.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="self-start shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-slate-800 sm:self-center"
          >
            <span>Open Dashboard</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search & Multi-Facet Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by name, description, ID, or ecosystem..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-[#432DD7]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#432DD7]/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {availableDomains.length > 0 && (
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              aria-label="Filter by domain"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 focus:border-slate-400 focus:outline-none"
            >
              <option value="ALL">All Domains</option>
              {availableDomains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {availableTargets.length > 0 && (
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              aria-label="Filter by destination"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 focus:border-slate-400 focus:outline-none"
            >
              <option value="ALL">All Destinations</option>
              {availableTargets.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Directory Container */}
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-80 max-w-full animate-pulse rounded bg-slate-50" />
                </div>
                <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        ) : paginatedProjects.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <FolderOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              {hasActiveFilters
                ? "No projects match your filters"
                : "No projects configured yet"}
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
              {hasActiveFilters
                ? "Adjust your search query or reset active filters to see all projects."
                : "Create your first project container to register connectors, define ontologies, and run migrations."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-9 border-slate-200 text-xs font-medium text-slate-700"
                >
                  Reset filters
                </Button>
              )}
              <Link href="/projects/new">
                <Button
                  size="sm"
                  className="h-9 bg-[#432DD7] px-4 text-xs font-medium text-white hover:bg-[#3724B5]"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Project
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* DESKTOP SCALABLE TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 pl-5 pr-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900"
                      >
                        <span>Project</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("domain")}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900"
                      >
                        <span>Domain</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("target_ecosystem")}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900"
                      >
                        <span>Destination</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3.5">Cutover / Mode</th>
                    <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedProjects.map((proj) => {
                    const isActive = proj.project_id === activeProjectId;
                    return (
                      <tr
                        key={proj.project_id}
                        className={`transition-colors ${
                          isActive ? "bg-slate-50/90" : "hover:bg-slate-50/60"
                        }`}
                      >
                        {/* Project Name, ID & Full Description */}
                        <td className="max-w-md py-4 pl-5 pr-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="break-words font-semibold text-slate-900">
                              {proj.name}
                            </span>
                            {isActive && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#432DD7]" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="mt-1 break-words text-xs leading-relaxed text-slate-500">
                            {proj.description || "No description provided."}
                          </p>
                          <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                            {proj.project_id}
                          </p>
                        </td>

                        {/* Domain */}
                        <td className="px-3 py-4 align-top">
                          <span className="inline-block break-words rounded-md border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {proj.domain || "Enterprise"}
                          </span>
                        </td>

                        {/* Destination */}
                        <td className="px-3 py-4 align-top">
                          <span className="inline-block break-words rounded-md border border-slate-200/80 bg-white px-2.5 py-1 text-xs font-medium text-slate-800">
                            {proj.target_ecosystem || "Fabric OneLake"}
                          </span>
                        </td>

                        {/* Cutover / Methodology */}
                        <td className="px-3 py-4 align-top text-xs text-slate-600">
                          <div className="space-y-1">
                            <span className="block break-words font-medium text-slate-800">
                              {proj.methodology || "Phased"}
                            </span>
                            <span className="block font-mono text-[11px] text-slate-400">
                              {proj.target_cutover_date || "Unscheduled"}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-3 pr-5 text-right align-top">
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                                <Check className="h-3.5 w-3.5 text-[#432DD7]" />
                                Selected
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetActiveOnly(proj.project_id)
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                Set active
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleActivateAndOpen(proj.project_id)
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                            >
                              <span>Open</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE COMPACT STACKED LIST VIEW */}
            <div className="divide-y divide-slate-100 md:hidden">
              {paginatedProjects.map((proj) => {
                const isActive = proj.project_id === activeProjectId;
                return (
                  <div
                    key={proj.project_id}
                    className={`space-y-3 p-4 ${
                      isActive ? "bg-slate-50/90" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-all font-mono text-[11px] text-slate-400">
                        {proj.project_id}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#432DD7]" />
                          Active
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="break-words text-base font-semibold text-slate-900">
                        {proj.name}
                      </h3>
                      <p className="break-words text-xs leading-relaxed text-slate-500">
                        {proj.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700">
                        {proj.domain || "Enterprise"}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700">
                        {proj.target_ecosystem || "Fabric OneLake"}
                      </span>
                      {proj.target_cutover_date && (
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-slate-600">
                          {proj.target_cutover_date}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                          <Check className="h-3.5 w-3.5 text-[#432DD7]" />
                          Selected workspace
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetActiveOnly(proj.project_id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Set active
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleActivateAndOpen(proj.project_id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white"
                      >
                        <span>Open console</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SCALABLE PAGINATION FOOTER */}
            <div className="flex flex-col justify-between gap-4 border-t border-slate-200/80 bg-slate-50/60 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  Showing{" "}
                  <strong className="font-semibold text-slate-900">
                    {startIndex + 1}
                  </strong>
                  –
                  <strong className="font-semibold text-slate-900">
                    {endIndex}
                  </strong>{" "}
                  of{" "}
                  <strong className="font-semibold text-slate-900">
                    {totalItems.toLocaleString()}
                  </strong>{" "}
                  projects
                </span>

                <div className="flex items-center gap-1.5">
                  <label htmlFor="projects-page-size" className="text-slate-500">
                    Rows:
                  </label>
                  <select
                    id="projects-page-size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-slate-400 focus:outline-none"
                  >
                    {[15, 30, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size} / page
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage === 1}
                    aria-label="First page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    aria-label="Previous page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  <div className="hidden sm:inline-flex items-center gap-1">
                    {visiblePageNumbers.map((page, idx) =>
                      page === "ellipsis" ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-1.5 text-xs text-slate-400"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-medium transition ${
                            safePage === page
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                  </div>

                  <span className="px-2 text-xs font-medium text-slate-700 sm:hidden">
                    Page {safePage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={safePage === totalPages}
                    aria-label="Next page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage === totalPages}
                    aria-label="Last page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {totalPages > 5 && (
                  <form
                    onSubmit={handleJumpSubmit}
                    className="flex items-center gap-1.5 pl-1"
                  >
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpInput}
                      onChange={(e) => setJumpInput(e.target.value)}
                      placeholder={`1–${totalPages}`}
                      aria-label="Jump to page"
                      className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-center font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Go
                    </button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}