"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { api, DatasetItem, ProfileSnapshot } from "@/lib/api-client";
import { useProject } from "@/context/ProjectContext";
import { ProjectGuard } from "@/components/ProjectGuard";
import {
  Table as TableIcon,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DatasetsPage() {
  const { activeProject, activeProjectId } = useProject();
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [driftReport, setDriftReport] = useState<any | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const [list, sysList] = await Promise.all([
        api.getDatasets().catch(() => []),
        api.getSystems().catch(() => []),
      ]);

      const projectSystems = activeProjectId
        ? sysList.filter((s) => s.project_id === activeProjectId || s.project_id === "proj-default")
        : sysList;
      const validSysIds = new Set(projectSystems.map((s) => s.system_id));

      const filtered = validSysIds.size > 0
        ? list.filter((d) => validSysIds.has(d.system_id))
        : list;

      setDatasets(filtered);
      if (filtered.length > 0) {
        setSelectedDataset(filtered[0]);
      } else {
        setSelectedDataset(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, [activeProjectId]);

  useEffect(() => {
    if (selectedDataset) {
      setProfileLoading(true);
      setDriftReport(null);
      api
        .getProfile(selectedDataset.dataset_id)
        .then((p) => setProfile(p))
        .catch(() => setProfile(null))
        .finally(() => setProfileLoading(false));
    }
  }, [selectedDataset]);

  const handleTestDrift = async () => {
    if (!selectedDataset) return;
    setDriftLoading(true);
    try {
      const testFields = selectedDataset.fields.map((f) => ({
        ...f,
        datatype: f.datatype === "string" ? "integer" : f.datatype,
      }));
      const res = await api.detectDrift(selectedDataset.dataset_id, testFields);
      setDriftReport(res);
    } catch (err: any) {
      alert(`Drift check error: ${err.message}`);
    } finally {
      setDriftLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <ProjectGuard featureName="Datasets & Profiling">
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                DATASETS & PROFILING
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Dataset Profiling & Schema Drift
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect physical columns, statistical null distributions, unique cardinalities, and pre-flight schema drift.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadDatasets}
            className="text-xs h-9 border-slate-200 text-slate-700 bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Datasets
          </Button>
        </div>

        {/* How To Use Guide */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">How To Use Dataset Profiling</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">1. Discovered Schema</span>
              Select any dataset on the left to examine all columns, data types, and nullability constraints inferred from the source system.
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">2. Statistical Baseline</span>
              Review row counts, percentage of null values, and distinct value counts sampled from the live repository.
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">3. Schema Drift Protection</span>
              Click &quot;Check Schema Drift&quot; to test whether the physical schema has changed since the baseline was approved.
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Datasets Sidebar */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Discovered Datasets ({datasets.length})
            </h2>

            {datasets.length === 0 ? (
              <Card className="p-6 text-center bg-white border-slate-200 text-xs text-slate-500">
                No datasets discovered yet.
              </Card>
            ) : (
              <div className="space-y-2">
                {datasets.map((ds) => (
                  <button
                    key={ds.dataset_id}
                    onClick={() => setSelectedDataset(ds)}
                    className={`w-full text-left p-3.5 rounded-lg border transition flex items-center justify-between ${
                      selectedDataset?.dataset_id === ds.dataset_id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold block">{ds.name}</span>
                      <span className={`text-[10px] font-mono ${selectedDataset?.dataset_id === ds.dataset_id ? "text-slate-300" : "text-slate-500"}`}>
                        {ds.dataset_id}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        selectedDataset?.dataset_id === ds.dataset_id
                          ? "border-slate-700 bg-slate-800 text-slate-200"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      {ds.fields?.length || 0} cols
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dataset Details & Schema Viewer */}
          <div className="lg:col-span-2 space-y-6">
            {selectedDataset ? (
              <>
                <Card className="bg-white border-slate-200 shadow-xs">
                  <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">{selectedDataset.name}</CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-mono mt-0.5">
                        Dataset: {selectedDataset.dataset_id} • System: {selectedDataset.system_id}
                      </CardDescription>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestDrift}
                      disabled={driftLoading}
                      className="text-xs h-8 gap-1.5 border-slate-200 text-slate-700 bg-white"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
                      {driftLoading ? "Verifying..." : "Check Schema Drift"}
                    </Button>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600 font-mono text-[11px] bg-slate-50">
                            <th className="py-2.5 px-4 font-semibold">Field Name</th>
                            <th className="py-2.5 px-4 font-semibold">Data Type</th>
                            <th className="py-2.5 px-4 font-semibold">Nullable</th>
                            <th className="py-2.5 px-4 font-semibold">Profile Null %</th>
                            <th className="py-2.5 px-4 font-semibold">Cardinality</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                          {selectedDataset.fields.map((f, i) => {
                            const fieldProf = profile?.field_profiles?.[f.name];
                            return (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-semibold text-slate-900">{f.name}</td>
                                <td className="py-2.5 px-4">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                    {f.datatype}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-500">{f.nullable ? "YES" : "NO"}</td>
                                <td className="py-2.5 px-4 text-slate-700">
                                  {fieldProf ? `${(fieldProf.null_percentage * 100).toFixed(1)}%` : "0.0%"}
                                </td>
                                <td className="py-2.5 px-4 text-slate-700">
                                  {fieldProf ? fieldProf.distinct_count : "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Schema Drift Results Alert */}
                {driftReport && (
                  <Card className="border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex items-start gap-3">
                      {driftReport.has_drift ? (
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-slate-900 block">
                          {driftReport.has_drift ? "Schema Drift Detected (Execution Gate Triggered)" : "Schema In Sync (No Drift)"}
                        </span>
                        <p className="leading-relaxed text-[11px] text-slate-600">
                          {driftReport.summary ||
                            (driftReport.has_drift
                              ? "Field type differences detected against baseline snapshot. Pipeline execution is protected until reviewed."
                              : "All physical attributes match the pinned schema baseline.")}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-8 text-center bg-white border-slate-200 text-xs text-slate-500">
                Select a dataset from the list to view its schema and profile metrics.
              </Card>
            )}
          </div>
        </div>
        </div>
      </ProjectGuard>
    </ProtectedRoute>
  );
}
