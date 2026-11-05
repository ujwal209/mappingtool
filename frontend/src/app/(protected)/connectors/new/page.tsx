"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  connectorsApi,
  PreConnectResponse,
  getConnectorFields,
} from "@/lib/connectors-api";
import { useProject } from "@/context/ProjectContext";
import { TechIcon } from "@/components/tech-icons";
import { ProjectGuard } from "@/components/ProjectGuard";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Table as TableIcon,
  Key,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Code2,
  Copy,
  Loader2,
  Check,
  ArrowRight,
  Server,
  Layers,
  Hash,
  DownloadCloud,
  UploadCloud,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────
interface ConnectorDefinition {
  id: string;
  name: string;
  category: "lakehouse" | "database" | "saas" | "storage" | "custom";
  description: string;
  available?: boolean;
}

const CONNECTOR_PRESETS: ConnectorDefinition[] = [
  {
    id: "memory",
    name: "In-Memory (Demo)",
    category: "custom",
    description: "In-process connector — perfect for demos without credentials.",
  },
  {
    id: "relational",
    name: "Relational (SQLite)",
    category: "database",
    description: "In-process SQLite. Real SQL, no external server.",
  },
  {
    id: "rest_api",
    name: "REST API",
    category: "custom",
    description: "Direct REST API schema discovery from any JSON endpoint.",
  },
  // ── MongoDB Atlas ────────────────────────────────────────
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    category: "database",
    description:
      "Live MongoDB Atlas cluster — real collections, nested-object flattening, idempotent upsert.",
  },
  {
    id: "fabric",
    name: "Microsoft Fabric",
    category: "lakehouse",
    description: "Fabric OneLake Lakehouses & Delta tables.",
  },
  {
    id: "d365",
    name: "Dynamics 365",
    category: "saas",
    description: "Dataverse CRM & ERP OData Web API.",
  },
  {
    id: "sheet",
    name: "Spreadsheet",
    category: "storage",
    description: "CSV / Excel uploads via intake-sheet endpoints.",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "lakehouse",
    description: "Snowflake Data Cloud (coming soon).",
    available: false,
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    category: "database",
    description: "Transactional PostgreSQL (coming soon).",
    available: true,
  },
];

const ENVIRONMENT_OPTIONS = [
  { value: "Production", label: "Production" },
  { value: "Staging", label: "Staging" },
  { value: "UAT", label: "UAT" },
  { value: "Development", label: "Development" },
];

const KIND_OPTIONS = [
  {
    value: "SOURCE",
    label: "Source",
    desc: "Data being read from",
    icon: DownloadCloud,
  },
  {
    value: "TARGET",
    label: "Target",
    desc: "Data being written to",
    icon: UploadCloud,
  },
  {
    value: "INTERMEDIATE",
    label: "Intermediate",
    desc: "Staging / lakehouse",
    icon: Layers,
  },
] as const;

const TABLES_PER_PAGE = 50;

type Tab = "schema" | "data" | "raw";

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function NewConnectorPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedPreset, setSelectedPreset] =
    useState<ConnectorDefinition | null>(null);
  const [connectionName, setConnectionName] = useState("Enterprise Connection");
  const [purpose, setPurpose] = useState(
    "Primary accounts & transactional data replication",
  );
  const [environment, setEnvironment] = useState("Production");
  const [kind, setKind] = useState<"SOURCE" | "TARGET" | "INTERMEDIATE">(
    "SOURCE",
  );
  const [formData, setFormData] = useState<Record<string, any>>({});

  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PreConnectResponse | null>(null);
  const [selectedTableNames, setSelectedTableNames] = useState<
    Record<string, boolean>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (k: string, v: any) =>
    setFormData((p) => ({ ...p, [k]: v }));

  const fields = useMemo(
    () => (selectedPreset ? getConnectorFields(selectedPreset.id) : []),
    [selectedPreset],
  );

  const pickPreset = (preset: ConnectorDefinition) => {
    if (preset.available === false) return;
    setSelectedPreset(preset);
    setConnectionName(`${preset.name} - ${environment}`);
    setFormData({});
    setPingResult(null);
    setSelectedTableNames({});
    setError(null);
    setStep(1);
  };

  const requiredFieldsMissing = useMemo(() => {
    return fields.some(
      (f) => f.required && !String(formData[f.key] ?? "").trim(),
    );
  }, [fields, formData]);

  const pingAndDiscover = async () => {
    if (!selectedPreset) return;
    setPinging(true);
    setError(null);
    setPingResult(null);
    try {
      const res = await connectorsApi.testPreConnect({
        connector_type: selectedPreset.id,
        connection_config: formData,
        name: connectionName,
        purpose,
        environment,
      });
      setPingResult(res);
      const init: Record<string, boolean> = {};
      (res.discovered_tables || []).forEach((t) => {
        init[t.name] = true;
      });
      setSelectedTableNames(init);
    } catch (err: any) {
      setError(err.message || "Failed to ping the connection.");
    } finally {
      setPinging(false);
    }
  };

  const toggleTable = (name: string) =>
    setSelectedTableNames((p) => ({ ...p, [name]: !p[name] }));

  const selectedCount = useMemo(
    () => Object.values(selectedTableNames).filter(Boolean).length,
    [selectedTableNames],
  );

  const save = async () => {
    if (!pingResult || !selectedPreset) return;
    setSubmitting(true);
    setError(null);
    try {
      const tablesToRegister = (pingResult.discovered_tables || [])
        .filter((t) => selectedTableNames[t.name])
        .map((t) => ({
          name: t.name,
          columns: t.columns,
          sample_records: t.sample_records || [],
        }));

      const sys = await connectorsApi.registerSystem({
        project_id: activeProjectId || undefined,
        name: connectionName.trim(),
        kind,
        adapter_type: selectedPreset.id,
        connector_type: selectedPreset.id,
        classification: "CONFIDENTIAL",
        purpose: purpose.trim(),
        environment,
        connection_config: formData,
        initial_tables: tablesToRegister,
      });
      router.push(`/connectors/${sys.system_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to register the connection.");
      setSubmitting(false);
    }
  };

  return (
    <ProjectGuard featureName="Connectors">
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 bg-white shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            <Link
              href="/connectors"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 shrink-0"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </Link>
            <div className="h-4 w-px bg-slate-200 shrink-0" />
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
              New Connection
            </h1>
            <StepPills step={step} />
          </div>
        </div>

        {error && (
          <div className="px-4 py-1.5 bg-red-50 border-b border-red-200 text-red-800 text-[11px] flex items-start gap-1.5 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-all flex-1">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Step 0: pick connector technology */}
        {step === 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
              {CONNECTOR_PRESETS.map((p) => {
                const disabled = p.available === false;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickPreset(p)}
                    className={`group text-left rounded-lg border p-3 transition ${
                      disabled
                        ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                        : "border-slate-200 bg-white hover:border-slate-900 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <TechIcon type={p.id} className="w-5 h-5" />
                      </div>
                      {disabled ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                          Soon
                        </span>
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-900 transition" />
                      )}
                    </div>
                    <h3 className="font-semibold text-[12.5px] text-slate-900 truncate">
                      {p.name}
                    </h3>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                    <div className="mt-1.5 text-[9px] font-mono uppercase tracking-wider text-slate-400">
                      {p.category}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: config + discover */}
        {step === 1 && selectedPreset && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            {/* Left: config */}
            <div className="w-full lg:w-[380px] shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <TechIcon type={selectedPreset.id} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-900 truncate">
                    {selectedPreset.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {selectedPreset.description}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
                {/* Kind selector */}
                <div>
                  <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                    Connection kind
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {KIND_OPTIONS.map(({ value, label, icon: Icon }) => {
                      const active = kind === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setKind(value as any)}
                          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border text-[10px] font-semibold transition ${
                            active
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                          title={KIND_OPTIONS.find((k) => k.value === value)?.desc}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-medium text-slate-700 mb-0.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded border border-slate-300 focus:outline-none focus:border-slate-900"
                  />
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    Must be unique across this project.
                  </p>
                </div>

                <div>
                  <label className="block text-[10.5px] font-medium text-slate-700 mb-0.5">
                    Environment
                  </label>
                  <CustomDropdown
                    value={environment}
                    onChange={setEnvironment}
                    options={ENVIRONMENT_OPTIONS}
                    ariaLabel="Environment"
                    size="sm"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-medium text-slate-700 mb-0.5">
                    Purpose
                  </label>
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded border border-slate-300 focus:outline-none focus:border-slate-900"
                  />
                </div>

                {fields.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                      Credentials
                    </div>
                    {fields.map((f) => (
                      <div key={f.key}>
                        <label className="block text-[10.5px] font-medium text-slate-700 mb-0.5">
                          {f.label}
                          {f.required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </label>
                        {f.type === "textarea" ? (
                          <textarea
                            rows={2}
                            value={formData[f.key] || ""}
                            onChange={(e) => setField(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            className="w-full px-2 py-1 text-[10.5px] font-mono rounded border border-slate-300 focus:outline-none focus:border-slate-900"
                          />
                        ) : (
                          <input
                            type={f.type}
                            value={formData[f.key] || ""}
                            onChange={(e) => setField(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            className="w-full px-2 py-1 text-[10.5px] font-mono rounded border border-slate-300 focus:outline-none focus:border-slate-900"
                          />
                        )}
                        {f.help && (
                          <p className="text-[9.5px] text-slate-400 mt-0.5">
                            {f.help}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-2 border-t border-slate-200 bg-slate-50/60 flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setStep(0);
                    setPingResult(null);
                  }}
                  className="px-2 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-700 hover:bg-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={pingAndDiscover}
                  disabled={pinging || requiredFieldsMissing || !connectionName.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${pinging ? "animate-spin" : ""}`}
                  />
                  {pinging ? "Pinging…" : "Ping & discover"}
                </button>
              </div>
            </div>

            {/* Right: discovery */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
              {!pingResult ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-6">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Server className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-[12px] font-semibold text-slate-900">
                      No discovery yet
                    </h3>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 max-w-xs">
                      Fill in credentials on the left and click{" "}
                      <strong>Ping &amp; discover</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <DiscoveryPanel
                  pingResult={pingResult}
                  selectedTableNames={selectedTableNames}
                  toggleTable={toggleTable}
                />
              )}
            </div>
          </div>
        )}

        {/* Save bar */}
        {step === 1 && pingResult && (
          <div className="px-4 py-2 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
            <p className="text-[11px] text-slate-500">
              <strong className="text-slate-800">{selectedCount}</strong> of{" "}
              {pingResult.discovered_tables.length} table
              {pingResult.discovered_tables.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              disabled={selectedCount === 0 || submitting}
              onClick={save}
              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {submitting ? "Saving…" : "Save connection"}
            </button>
          </div>
        )}
      </div>
    </ProjectGuard>
  );
}

// ─────────────────────────────────────────────────────────────
// Step pills
// ─────────────────────────────────────────────────────────────
function StepPills({ step }: { step: 0 | 1 | 2 }) {
  const steps = ["Technology", "Configure", "Save"];
  return (
    <div className="flex items-center gap-1 shrink-0 ml-2">
      {steps.map((label, i) => {
        const active = step === i;
        const done = step > i;
        return (
          <React.Fragment key={label}>
            <div
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                active
                  ? "bg-slate-900 text-white"
                  : done
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  active
                    ? "bg-white text-slate-900"
                    : done
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? <Check className="w-2 h-2" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && <div className="w-2 h-px bg-slate-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Discovery panel
// ─────────────────────────────────────────────────────────────
function DiscoveryPanel({
  pingResult,
  selectedTableNames,
  toggleTable,
}: {
  pingResult: PreConnectResponse;
  selectedTableNames: Record<string, boolean>;
  toggleTable: (name: string) => void;
}) {
  const tables = pingResult.discovered_tables || [];
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [activeName, setActiveName] = useState<string | null>(
    tables[0]?.name ?? null,
  );
  const [tab, setTab] = useState<Tab>("schema");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [tables, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / TABLES_PER_PAGE));
  const visible = useMemo(
    () => filtered.slice(page * TABLES_PER_PAGE, (page + 1) * TABLES_PER_PAGE),
    [filtered, page],
  );

  React.useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  React.useEffect(() => {
    setPage(0);
  }, [search]);

  const active = useMemo(
    () => tables.find((t) => t.name === activeName) || tables[0] || null,
    [tables, activeName],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-1.5 border-b border-slate-100 bg-emerald-50/60 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-900 truncate">
              Verified · {pingResult.latency_ms} ms
            </span>
            <span className="text-[10px] text-emerald-700 truncate">
              {tables.length} table{tables.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-6">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <TableIcon className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-slate-900">
              No tables discovered
            </h3>
            <p className="text-[10.5px] text-slate-500 mt-0.5 max-w-xs">
              The endpoint responded but returned zero tables.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col min-h-0 shrink-0">
            <div className="px-2 py-1.5 border-b border-slate-100 flex items-center gap-1.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter…"
                  className="w-full pl-6 pr-6 py-1 text-[10.5px] border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <span className="text-[9.5px] font-mono text-slate-500 shrink-0 tabular-nums">
                {filtered.length.toLocaleString()}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {visible.length === 0 ? (
                <div className="p-3 text-center text-[10.5px] text-slate-400">
                  No matches
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {visible.map((t) => {
                    const isActive = active?.name === t.name;
                    const isChecked = Boolean(selectedTableNames[t.name]);
                    const child = t.name.includes(".");
                    return (
                      <div
                        key={t.name}
                        className={`flex items-center gap-1 px-1.5 py-1 transition ${
                          isActive ? "bg-slate-100" : "hover:bg-slate-50"
                        } ${child ? "pl-4" : ""}`}
                      >
                        {child ? (
                          <Layers className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTable(t.name)}
                            className="accent-slate-900 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <button
                          onClick={() => setActiveName(t.name)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="font-mono text-[10.5px] font-medium truncate text-slate-900 leading-tight">
                            {child
                              ? t.name.split(".").slice(1).join(".")
                              : t.name}
                          </div>
                          <div className="text-[9px] text-slate-500 leading-tight tabular-nums">
                            {t.columns.length}c ·{" "}
                            {t.row_count.toLocaleString()}r
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {filtered.length > 0 && (
              <div className="px-1.5 py-1 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-1 shrink-0">
                <span className="text-[9px] font-mono text-slate-500 tabular-nums pl-1">
                  {page * TABLES_PER_PAGE + 1}–
                  {Math.min(filtered.length, (page + 1) * TABLES_PER_PAGE)}
                  &nbsp;/ {filtered.length}
                </span>
                <div className="flex items-center gap-0.5">
                  <PagerBtn
                    disabled={page === 0}
                    onClick={() => setPage(0)}
                    title="First"
                  >
                    <ChevronsLeft className="w-3 h-3" />
                  </PagerBtn>
                  <PagerBtn
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    title="Previous"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </PagerBtn>
                  <span className="text-[9px] font-mono text-slate-700 px-1 tabular-nums min-w-[36px] text-center">
                    {page + 1}/{totalPages}
                  </span>
                  <PagerBtn
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    title="Next"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </PagerBtn>
                  <PagerBtn
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(totalPages - 1)}
                    title="Last"
                  >
                    <ChevronsRight className="w-3 h-3" />
                  </PagerBtn>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {active ? (
              <>
                <div className="px-3 pt-2 border-b border-slate-100 shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <div className="min-w-0 flex items-center gap-1.5">
                      {active.name.includes(".") && (
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <h2 className="font-mono text-[12px] font-semibold text-slate-900 truncate">
                        {active.name}
                      </h2>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                        <TableIcon className="w-2.5 h-2.5" />
                        {active.columns.length} fields
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                        <Hash className="w-2.5 h-2.5" />
                        {active.row_count.toLocaleString()} rows
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center -mb-px">
                    <TabBtn
                      active={tab === "schema"}
                      onClick={() => setTab("schema")}
                      icon={TableIcon}
                      label="Schema"
                    />
                    <TabBtn
                      active={tab === "data"}
                      onClick={() => setTab("data")}
                      icon={Database}
                      label={`Data (${active.sample_records.length})`}
                    />
                    <TabBtn
                      active={tab === "raw"}
                      onClick={() => setTab("raw")}
                      icon={Code2}
                      label="Raw"
                    />
                  </div>
                </div>

                {tab === "schema" && <SchemaTab columns={active.columns} />}
                {tab === "data" && <DataTab records={active.sample_records} />}
                {tab === "raw" && <RawTab records={active.sample_records} />}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1">
                <TableIcon className="w-5 h-5" />
                <span className="text-[11px]">Select a table</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="p-1 rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium border-b-2 -mb-px transition ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

function SchemaTab({ columns }: { columns: any[] }) {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left text-[11px] whitespace-nowrap border-collapse">
        <thead className="bg-slate-50 text-slate-500 text-[9.5px] font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
          <tr>
            <th className="py-1.5 px-2 w-8">#</th>
            <th className="py-1.5 px-2">Column</th>
            <th className="py-1.5 px-2">Datatype</th>
            <th className="py-1.5 px-2">Constraints</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {columns.map((c: any, idx: number) => {
            const isPk =
              c.is_pk === true || c.is_pk === "true" || c.is_pk === "True";
            return (
              <tr key={`${c.name}-${idx}`} className="hover:bg-slate-50/60">
                <td className="py-1 px-2 text-slate-400 font-mono text-[9.5px]">
                  {idx + 1}
                </td>
                <td className="py-1 px-2 font-mono text-[11.5px] font-medium text-slate-900">
                  {c.name}
                </td>
                <td className="py-1 px-2">
                  <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                    {c.datatype || "string"}
                  </span>
                </td>
                <td className="py-1 px-2">
                  {isPk ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-800">
                      <Key className="w-2.5 h-2.5" /> PK
                    </span>
                  ) : (
                    <span className="text-slate-300 text-[10px]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DataTab({ records }: { records: Record<string, any>[] }) {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    records.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1">
        <TableIcon className="w-5 h-5" />
        <span className="text-[11px]">No sample records</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left text-[11px] border-collapse">
        <thead className="bg-slate-50 text-slate-500 text-[9.5px] font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
          <tr>
            <th className="py-1.5 px-2 w-8 sticky left-0 bg-slate-50 z-20">
              #
            </th>
            {columns.map((c) => (
              <th key={c} className="py-1.5 px-2 font-mono whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/50 align-top">
              <td className="py-1 px-2 text-slate-400 font-mono text-[9.5px] sticky left-0 bg-white">
                {i + 1}
              </td>
              {columns.map((c) => {
                const val = r[c];
                let display: string;
                let tone = "text-slate-800";
                if (val === null || val === undefined) {
                  display = "∅";
                  tone = "text-slate-300";
                } else if (typeof val === "object") {
                  display = JSON.stringify(val);
                  tone = "text-slate-500 font-mono text-[9.5px]";
                } else {
                  display = String(val);
                  if (typeof val === "number")
                    tone = "text-blue-700 font-mono";
                  else if (typeof val === "boolean")
                    tone = val ? "text-emerald-700" : "text-red-700";
                }
                return (
                  <td
                    key={c}
                    className={`py-1 px-2 align-top whitespace-nowrap max-w-[240px] truncate ${tone}`}
                    title={display}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RawTab({ records }: { records: Record<string, any>[] }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(records, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="flex-1 overflow-auto p-2 min-h-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9.5px] font-mono text-slate-500">
          {records.length} row{records.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={copy}
          disabled={records.length === 0}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[9.5px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Copy className="w-2.5 h-2.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="text-[10px] font-mono text-slate-700 leading-relaxed whitespace-pre-wrap break-all bg-slate-50 border border-slate-200 rounded p-2">
        {JSON.stringify(records, null, 2)}
      </pre>
    </div>
  );
}