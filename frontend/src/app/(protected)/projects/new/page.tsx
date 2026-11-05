"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  ArrowLeft,
  FolderPlus,
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { setActiveProjectId, refreshProjects } = useProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owners, setOwners] = useState(user?.email || "architect@enterprise.internal");
  const [domain, setDomain] = useState("Banking & Financial Services");
  const [methodology, setMethodology] = useState("Phased Wave Replication");
  const [estimatedVolume, setEstimatedVolume] = useState("10M - 50M Records (100 GB - 500 GB)");
  const [targetCutoverDate, setTargetCutoverDate] = useState("2026-12-31");
  const [plannedWaves, setPlannedWaves] = useState(3);
  const [complianceFramework, setComplianceFramework] = useState("SOC2 Type II / GDPR");
  const [dataClassification, setDataClassification] = useState("CONFIDENTIAL");
  const [rehearsalStrategy, setRehearsalStrategy] = useState("Dual-Run Rehearsal with Automated Reconciliation");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const ownerList = owners.split(",").map((o) => o.trim()).filter(Boolean);
      const createdProject = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        owners: ownerList.length > 0 ? ownerList : [user?.email || "lead-architect@company.com"],
        domain,
        methodology,
        source_ecosystem: "Pending Connector Setup",
        target_ecosystem: "Pending Connector Setup",
        estimated_volume: estimatedVolume,
        target_cutover_date: targetCutoverDate,
        planned_waves: Number(plannedWaves) || 3,
        compliance_framework: complianceFramework,
        data_classification: dataClassification,
        rehearsal_strategy: rehearsalStrategy,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("active_project_id", createdProject.project_id);
      }
      setActiveProjectId(createdProject.project_id);
      await refreshProjects();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to initialize migration project");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Initialize Migration Project
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Establish the primary root project container for connections, ontologies, and pipelines.
          </p>
        </div>
        <Link href="/projects">
          <Button variant="outline" className="text-sm border-slate-300 h-9">
            Cancel
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Section 1: Identity */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">1. Project Identity</h2>
              <p className="text-xs text-slate-500">Executive naming and business deliverables</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Enterprise ERP to Fabric OneLake Migration"
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Strategic Objectives & Scope
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the migration goals, cutover strategy, and scope boundaries..."
                className="w-full text-sm p-3.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Project Stakeholders (Comma-separated emails)
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={owners}
                  onChange={(e) => setOwners(e.target.value)}
                  placeholder="lead@company.com, director@company.com"
                  className="w-full text-sm pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-mono"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Architecture */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">2. Domain & Delivery</h2>
              <p className="text-xs text-slate-500">Industry model and cutover methodology</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Business Domain
              </label>
              <CustomSelect
                value={domain}
                onChange={setDomain}
                options={[
                  { value: "Banking & Financial Services", label: "Banking & Capital Markets" },
                  { value: "Healthcare & Life Sciences", label: "Healthcare & Life Sciences" },
                  { value: "Retail, FMCG & E-Commerce", label: "Retail & E-Commerce" },
                  { value: "Supply Chain, Logistics & Manufacturing", label: "Supply Chain & Manufacturing" },
                  { value: "Telecommunications & Media", label: "Telecom & Media" },
                  { value: "Public Sector & Government", label: "Public Sector" },
                  { value: "Insurance & Underwriting", label: "Insurance" },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Migration Pattern
              </label>
              <CustomSelect
                value={methodology}
                onChange={setMethodology}
                options={[
                  { value: "Phased Wave Replication", label: "Phased Wave Replication" },
                  { value: "Continuous CDC Shadowing & Dual-Run", label: "Continuous CDC Dual-Run" },
                  { value: "Big-Bang Single Cutover", label: "Big-Bang Direct Cutover" },
                  { value: "Event-Driven Lakehouse Staging", label: "Event-Driven Lakehouse" },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Governance */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">3. Governance & Compliance</h2>
              <p className="text-xs text-slate-500">Execution timeline, volume, and regulatory scope</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Estimated Volume
              </label>
              <CustomSelect
                value={estimatedVolume}
                onChange={setEstimatedVolume}
                options={[
                  { value: "Sub-1M Records (< 10 GB)", label: "Sub-1M Records (< 10 GB)" },
                  { value: "1M - 10M Records (10 GB - 100 GB)", label: "1M - 10M Records (10-100 GB)" },
                  { value: "10M - 50M Records (100 GB - 500 GB)", label: "10M - 50M Records (100-500 GB)" },
                  { value: "50M - 500M Records (500 GB - 5 TB)", label: "50M - 500M Records (500GB-5TB)" },
                  { value: "500M+ Records (> 5 TB)", label: "500M+ Records (> 5 TB)" },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Target Cutover Date
              </label>
              <input
                type="date"
                value={targetCutoverDate}
                onChange={(e) => setTargetCutoverDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Compliance Framework
              </label>
              <CustomSelect
                value={complianceFramework}
                onChange={setComplianceFramework}
                options={[
                  { value: "SOC2 Type II / GDPR", label: "SOC2 Type II / GDPR" },
                  { value: "HIPAA Security Rule", label: "HIPAA Security Rule" },
                  { value: "PCI-DSS Level 1", label: "PCI-DSS Level 1" },
                  { value: "SOX 404 Financial Governance", label: "SOX 404 Financial Governance" },
                  { value: "ISO 27001 ISMS", label: "ISO 27001 ISMS" },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                DLP Classification
              </label>
              <CustomSelect
                value={dataClassification}
                onChange={setDataClassification}
                options={[
                  { value: "CONFIDENTIAL", label: "CONFIDENTIAL" },
                  { value: "RESTRICTED", label: "RESTRICTED (PII / High Regulatory)" },
                  { value: "INTERNAL", label: "INTERNAL" },
                  { value: "PUBLIC", label: "PUBLIC" },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Planned Cutover Waves
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={plannedWaves}
                onChange={(e) => setPlannedWaves(Number(e.target.value))}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Rehearsal Strategy
              </label>
              <CustomSelect
                value={rehearsalStrategy}
                onChange={setRehearsalStrategy}
                options={[
                  { value: "Dual-Run Rehearsal with Automated Reconciliation", label: "Dual-Run with Reconciliation" },
                  { value: "Synthetic Mock Cutover & Golden Schema Diff", label: "Synthetic Mock Cutover" },
                  { value: "Shadow Pipeline Replication", label: "Shadow Pipeline Replication" },
                  { value: "Staged Rollout by Account Partition", label: "Staged Rollout" },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Environments (DEV, TEST, PROD) will be auto-provisioned.</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/projects" className="flex-1 sm:flex-none">
              <Button type="button" variant="outline" className="w-full text-sm h-10 border-slate-300">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white text-sm h-10 px-6 shadow-sm"
            >
              {submitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}