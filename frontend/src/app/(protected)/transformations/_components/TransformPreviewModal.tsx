"use client";

import { useEffect, useState } from "react";
import {
  X,
  Play,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Info,
} from "lucide-react";
import {
  transformationsApi,
  type Transformation,
} from "@/lib/transformations-api";

export function TransformPreviewModal({
  tx,
  onClose,
}: {
  tx: Transformation;
  onClose: () => void;
}) {
  // Pre-fill source values with up to arity_max inputs
  const [sourceValues, setSourceValues] = useState<string[]>(() =>
    Array.from({ length: Math.max(1, tx.arity_max) }, () => "")
  );
  const [paramValues, setParamValues] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const p of tx.params) {
        if (p.default !== undefined && p.default !== null) {
          init[p.name] = String(p.default);
        } else {
          init[p.name] = "";
        }
      }
      return init;
    }
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    results: any[] | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      // Parse param values into correct types
      const parsedParams: Record<string, any> = {};
      for (const p of tx.params) {
        const raw = paramValues[p.name] || "";
        if (!raw) continue;
        if (p.type === "int") {
          const n = parseInt(raw, 10);
          if (!isNaN(n)) parsedParams[p.name] = n;
        } else if (p.type === "float") {
          const n = parseFloat(raw);
          if (!isNaN(n)) parsedParams[p.name] = n;
        } else if (p.type === "boolean") {
          parsedParams[p.name] = raw.toLowerCase() === "true";
        } else if (p.type === "json") {
          try {
            parsedParams[p.name] = JSON.parse(raw);
          } catch {
            // keep raw string on parse failure
            parsedParams[p.name] = raw;
          }
        } else if (p.type === "list<string>") {
          parsedParams[p.name] = raw.split(",").map((s) => s.trim());
        } else {
          parsedParams[p.name] = raw;
        }
      }

      const sourceVals = sourceValues
        .slice(0, tx.arity_max)
        .map((v) => v || null);

      const res = await transformationsApi.execute({
        op: tx.key,
        source_values: sourceVals,
        params: parsedParams,
      });
      setResult(res);
    } catch (e: any) {
      setResult({
        valid: false,
        results: null,
        error: e?.message || "Run failed",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-[14px] font-semibold text-slate-900 truncate">
                  {tx.label}
                </h2>
                {tx.is_system && (
                  <span className="text-[8.5px] font-mono font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    SYS
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-500 truncate">
                {tx.key}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11.5px] text-slate-700 leading-relaxed">
            {tx.description || "No description."}
          </div>

          {tx.dsl_expression && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                DSL expression
              </label>
              <pre className="px-3 py-2 rounded-lg bg-slate-900 text-emerald-300 text-[11.5px] font-mono overflow-x-auto">
                {tx.dsl_expression}
              </pre>
            </div>
          )}

          {/* Source values */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
              Source values ({tx.arity_min}
              {tx.arity_max !== tx.arity_min ? `–${tx.arity_max}` : ""})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sourceValues.slice(0, tx.arity_max).map((v, i) => (
                <div key={i}>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">
                    source[{i}]
                    {i < tx.arity_min && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </label>
                  <input
                    value={v}
                    onChange={(e) => {
                      const next = [...sourceValues];
                      next[i] = e.target.value;
                      setSourceValues(next);
                    }}
                    placeholder={
                      tx.example
                        ? tx.example.split("→")[0]?.trim()
                        : "value…"
                    }
                    className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11.5px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Params */}
          {tx.params.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Parameters
              </label>
              <div className="space-y-2">
                {tx.params.map((p) => (
                  <div key={p.name}>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">
                      {p.name}
                      {p.required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                      {p.description && (
                        <span className="text-slate-400 font-sans ml-1.5">
                          {p.description}
                        </span>
                      )}
                    </label>
                    {p.type === "json" ? (
                      <textarea
                        rows={2}
                        value={paramValues[p.name] || ""}
                        onChange={(e) =>
                          setParamValues((prev) => ({
                            ...prev,
                            [p.name]: e.target.value,
                          }))
                        }
                        placeholder='{"A": "Active"}'
                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white text-[11px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 resize-none"
                      />
                    ) : (
                      <input
                        value={paramValues[p.name] || ""}
                        onChange={(e) =>
                          setParamValues((prev) => ({
                            ...prev,
                            [p.name]: e.target.value,
                          }))
                        }
                        placeholder={String(p.default ?? "")}
                        className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11.5px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={`p-3 rounded-lg border ${
                result.valid
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[11px] font-semibold ${
                      result.valid ? "text-emerald-800" : "text-red-800"
                    }`}
                  >
                    {result.valid ? "Output" : "Error"}
                  </p>
                  {result.valid ? (
                    <pre className="text-[11.5px] font-mono text-emerald-900 bg-white/60 px-2 py-1.5 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(result.results, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-[11.5px] text-red-800 mt-1 break-all">
                      {result.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tx.example && (
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="font-mono">{tx.example}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40"
          >
            {running ? (
              <>
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}