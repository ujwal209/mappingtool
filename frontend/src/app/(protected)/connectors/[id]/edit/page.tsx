"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  connectorsApi,
  SystemItem,
  getConnectorFields,
} from "@/lib/connectors-api";
import { TechIcon } from "@/components/tech-icons";
import { ProjectGuard } from "@/components/ProjectGuard";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  X,
  Info,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Code2,
  DownloadCloud,
  UploadCloud,
  Layers,
} from "lucide-react";

const ENV_OPTIONS = ["Production", "Staging", "UAT", "Development"];
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

const LOAD_TIMEOUT_MS = 15_000;

export default function EditConnectorPage() {
  return (
    <ProjectGuard featureName="Connectors">
      <EditForm />
    </ProjectGuard>
  );
}

type LoadStatus = "pending" | "loading" | "ready" | "error" | "no-route";

function EditForm() {
  const params = useParams();
  const router = useRouter();

  const rawId = (params as any)?.id;
  const systemId = Array.isArray(rawId)
    ? rawId[0]
    : (rawId as string | undefined) || "";

  const [status, setStatus] = useState<LoadStatus>("pending");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [system, setSystem] = useState<SystemItem | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState("SOURCE");
  const [environment, setEnvironment] = useState("Production");
  const [connectorType, setConnectorType] = useState("");
  const [purpose, setPurpose] = useState("");

  // Form values, keyed by CONNECTOR_FIELDS[*].key
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  // Whatever else exists in the config that isn't in the field-def set
  // (opaque / advanced keys).
  const [extraConfig, setExtraConfig] = useState<Record<string, any>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedText, setAdvancedText] = useState("{}");
  const [advancedError, setAdvancedError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load ────────────────────────────────────────────
  useEffect(() => {
    if (!systemId) {
      const t = setTimeout(() => {
        if (!mountedRef.current) return;
        if (!systemId) {
          setStatus((s) => (s === "pending" ? "no-route" : s));
        }
      }, 800);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    setStatus("loading");
    setLoadError(null);

    const timeout = setTimeout(() => {
      if (cancelled) return;
      setLoadError("Request timed out. Backend may be unreachable.");
      setStatus("error");
    }, LOAD_TIMEOUT_MS);

    (async () => {
      try {
        const s = await connectorsApi.getSystem(systemId);
        if (cancelled || !mountedRef.current) return;

        setSystem(s);
        setName(s.name || "");
        setKind((s.kind || "SOURCE").toUpperCase());
        setEnvironment(s.environment || "Production");
        const ct = s.connector_type || s.adapter_type || "memory";
        setConnectorType(ct);
        setPurpose(s.purpose || "");

        // Split config into "known" fields (rendered as inputs) and
        // "extra" fields (kept in state and merged back on save).
        const raw = (s.config_summary as Record<string, any> | undefined) || {};
        const fieldDefs = getConnectorFields(ct);
        const known = new Set(fieldDefs.map((f) => f.key));
        const values: Record<string, string> = {};
        const extras: Record<string, any> = {};
        Object.keys(raw).forEach((k) => {
          if (k === "endpoint_id") return;
          if (known.has(k)) {
            values[k] = raw[k] === null || raw[k] === undefined ? "" : String(raw[k]);
          } else {
            extras[k] = raw[k];
          }
        });
        setConfigValues(values);
        setExtraConfig(extras);
        setAdvancedText(JSON.stringify(extras, null, 2));

        setStatus("ready");
      } catch (e: any) {
        if (cancelled || !mountedRef.current) return;
        setLoadError(e?.message || "Failed to load connector");
        setStatus("error");
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [systemId]);

  // ── Derived ──────────────────────────────────────────
  const fieldDefs = useMemo(
    () => getConnectorFields(connectorType),
    [connectorType],
  );

  const originalConnectorType =
    system?.connector_type || system?.adapter_type || "";
  const isConnectorTypeChanged =
    !!connectorType && connectorType !== originalConnectorType;

  const setConfigField = (k: string, v: string) =>
    setConfigValues((p) => ({ ...p, [k]: v }));

  const requiredFieldsMissing = useMemo(() => {
    return fieldDefs.some(
      (f) => f.required && !String(configValues[f.key] ?? "").trim(),
    );
  }, [fieldDefs, configValues]);

  // ── Save ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!systemId) return;
    setSaving(true);
    setSaveError(null);
    setAdvancedError(null);

    try {
      // Merge visible fields
      const merged: Record<string, any> = { ...extraConfig };

      // If the advanced textarea was opened, prefer it as source of truth
      // for extra keys (user may have edited them).
      if (showAdvanced) {
        let parsedExtras: Record<string, any> = {};
        try {
          parsedExtras = JSON.parse(advancedText || "{}");
          if (
            parsedExtras === null ||
            typeof parsedExtras !== "object" ||
            Array.isArray(parsedExtras)
          ) {
            throw new Error("Advanced config must be a JSON object.");
          }
        } catch (err: any) {
          setAdvancedError(`Invalid JSON: ${err.message}`);
          setSaving(false);
          return;
        }
        // Strip masked values so we don't overwrite real secrets
        Object.keys(parsedExtras).forEach((k) => {
          if (k === "endpoint_id") {
            delete parsedExtras[k];
            return;
          }
          const v = String(parsedExtras[k] ?? "");
          if (v.includes("...") && v.length <= 24) {
            delete parsedExtras[k];
          }
        });
        Object.assign(merged, parsedExtras);
      }

      // Overlay visible field values (these always win)
      fieldDefs.forEach((f) => {
        const v = configValues[f.key];
        if (v !== undefined && v !== "") {
          merged[f.key] = v;
        }
      });

      await connectorsApi.updateSystem(systemId, {
        name: name.trim(),
        kind,
        environment,
        connector_type: connectorType,
        purpose: purpose.trim(),
        connection_config: merged,
      });

      router.push(`/connectors/${systemId}`);
    } catch (e: any) {
      setSaveError(e.message || "Failed to save changes");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!systemId) return;
    setDeleting(true);
    try {
      await connectorsApi.deleteSystem(systemId);
      router.push("/connectors");
    } catch (e: any) {
      setSaveError(e.message || "Failed to delete connector");
      setDeleting(false);
    }
  };

  // ── States ───────────────────────────────────────────
  if (status === "pending" || status === "loading") {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-xs">Loading connector…</span>
      </div>
    );
  }

  if (status === "no-route") {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 bg-white border border-amber-200 rounded-xl">
        <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold mb-2">
          <AlertCircle className="w-4 h-4" /> No connector selected
        </div>
        <p className="text-xs text-slate-600 mb-4">
          This page needs a connector ID in the URL.
        </p>
        <Link
          href="/connectors"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to connections
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 bg-white border border-red-200 rounded-xl">
        <div className="flex items-center gap-2 text-red-700 text-sm font-semibold mb-2">
          <AlertCircle className="w-4 h-4" /> Couldn't load connector
        </div>
        <p className="text-xs text-slate-600 mb-4 break-all">{loadError}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setStatus("pending");
              setLoadError(null);
              router.refresh();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
          <Link
            href="/connectors"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>
      </div>
    );
  }

  // ── Ready ────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/connectors/${systemId}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 mb-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to connector
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <TechIcon type={connectorType} className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 truncate">
                Edit {system?.name || "connector"}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
              {systemId}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/connectors/${systemId}`}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || requiredFieldsMissing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-all flex-1">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Identity */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">Identity</h2>
            <p className="text-[11px] text-slate-500">
              Name must be unique within this project.
            </p>
          </div>
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Connection kind
              </label>
              <div className="grid grid-cols-3 gap-2">
                {KIND_OPTIONS.map(({ value, label, desc, icon: Icon }) => {
                  const active = kind === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setKind(value)}
                      className={`flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition ${
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] font-semibold">
                        {label}
                      </span>
                      <span
                        className={`text-[10px] leading-tight ${
                          active ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {ENV_OPTIONS.map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Connector type
              </label>
              <input
                type="text"
                value={connectorType}
                onChange={(e) => setConnectorType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {isConnectorTypeChanged && (
              <div className="sm:col-span-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Changing the connector type will <strong>delete</strong> all
                  cached rows and datasets. The new plugin will re-discover
                  tables from scratch.
                </span>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Purpose
              </label>
              <textarea
                rows={2}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
        </section>

        {/* Connection settings — labelled inputs */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">
              Connection settings
            </h2>
            <p className="text-[11px] text-slate-500">
              {fieldDefs.length === 0
                ? "This connector type has no configuration fields."
                : "Fields required to reach the underlying system."}
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-4 text-xs">
            {fieldDefs.length === 0 ? (
              <p className="text-[11.5px] text-slate-500 italic">
                No form fields for this connector type. Use the advanced editor
                below if you need to edit raw config.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fieldDefs.map((f) => (
                  <div
                    key={f.key}
                    className={f.type === "textarea" ? "sm:col-span-2" : ""}
                  >
                    <label className="block font-semibold text-slate-700 mb-1">
                      {f.label}
                      {f.required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={configValues[f.key] || ""}
                        onChange={(e) => setConfigField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    ) : (
                      <input
                        type={f.type}
                        value={configValues[f.key] || ""}
                        onChange={(e) => setConfigField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    )}
                    {f.help && (
                      <p className="text-[10.5px] text-slate-500 mt-1">
                        {f.help}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Advanced JSON disclosure — for power users / unmapped keys */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-700 hover:text-slate-900"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <Code2 className="w-3.5 h-3.5" />
                Advanced: extra connection parameters (JSON)
              </button>

              {showAdvanced && (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    rows={8}
                    value={advancedText}
                    onChange={(e) => {
                      setAdvancedText(e.target.value);
                      setAdvancedError(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-[11.5px] font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    spellCheck={false}
                  />
                  {advancedError && (
                    <p className="text-[10.5px] text-red-700">
                      {advancedError}
                    </p>
                  )}
                  <p className="text-[10.5px] text-slate-500">
                    Holds fields not shown above (e.g. extra headers). Merged
                    with the form values on save — form values win. Masked
                    values like{" "}
                    <code className="px-1 py-0.5 bg-slate-100 rounded">
                      "gsk_...cdef"
                    </code>{" "}
                    are dropped so real secrets aren't overwritten.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-red-100 bg-red-50/60">
            <h2 className="text-sm font-semibold text-red-800">
              Danger zone
            </h2>
            <p className="text-[11px] text-red-700">
              Deleting removes all cached tables and rows.
            </p>
          </div>
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap text-xs">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete connector
              </button>
            ) : (
              <>
                <span className="text-red-800 font-medium">
                  Are you sure? This cannot be undone.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Confirm delete
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}