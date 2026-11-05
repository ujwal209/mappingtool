"use client";

import { useEffect, useState } from "react";
import {
  X,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  Play,
  Sparkles,
  Code2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  transformationsApi,
  type TransformCategory,
} from "@/lib/transformations-api";

const CATEGORY_OPTIONS: Array<{
  value: TransformCategory;
  label: string;
}> = [
  { value: "CUSTOM", label: "Custom" },
  { value: "STRING", label: "String" },
  { value: "NUMERIC", label: "Numeric" },
  { value: "DATE", label: "Date" },
  { value: "SECURITY", label: "Security" },
  { value: "VALIDATION", label: "Validation" },
  { value: "LOOKUP", label: "Lookup" },
  { value: "CONDITIONAL", label: "Conditional" },
];

const DSL_EXAMPLES = [
  {
    label: "Strip hyphens",
    expr: "replace(source[0], '-', '')",
  },
  {
    label: "Title case + trim",
    expr: "concat(upper(substr(trim(source[0]), 0, 1)), lower(substr(trim(source[0]), 1, 999)))",
  },
  {
    label: "Fallback if null",
    expr: "if_null(source[0], 'N/A')",
  },
  {
    label: "Hash with prefix",
    expr: "concat('H_', hash(source[0]))",
  },
];

export function CustomTransformModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransformCategory>("CUSTOM");
  const [dsl, setDsl] = useState("");
  const [example, setExample] = useState("");

  // Test sample values (up to 3)
  const [testValues, setTestValues] = useState<string[]>(["", "", ""]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    result: any;
    error: string | null;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, saving]);

  const handleTest = async () => {
    if (!dsl.trim()) {
      setError("Enter a DSL expression first.");
      return;
    }
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const sourceVals = testValues.map((v) => v || null);
      const res = await transformationsApi.testDsl({
        dsl_expression: dsl.trim(),
        source_values: sourceVals,
      });
      setTestResult(res);
    } catch (e: any) {
      setError(e?.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!key.trim()) {
      setError("Key is required.");
      return;
    }
    if (!label.trim()) {
      setError("Label is required.");
      return;
    }
    if (!dsl.trim()) {
      setError("DSL expression is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await transformationsApi.create({
        key: key.trim(),
        label: label.trim(),
        description: description.trim(),
        category,
        dsl_expression: dsl.trim(),
        example: example.trim() || undefined,
      });
      toast.success(`Created "${label.trim()}"`);
      onCreated();
    } catch (e: any) {
      setError(e?.message || "Create failed");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-0"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-slate-900">
                Create custom transform
              </h2>
              <p className="text-[11px] text-slate-500">
                Define with a safe DSL expression. No arbitrary code.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Key <span className="text-red-500">*</span>
              </label>
              <input
                value={key}
                onChange={(e) =>
                  setKey(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, "_")
                      .slice(0, 64)
                  )
                }
                placeholder="strip_hyphens"
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Machine identifier. lowercase + underscores only.
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Label <span className="text-red-500">*</span>
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Strip hyphens"
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this transform do?"
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as TransformCategory)
                }
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Example
              </label>
              <input
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder='"1-23-456" → "123456"'
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          {/* DSL expression */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                DSL Expression <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Code2 className="w-3 h-3" />
                <span>Safe sandbox</span>
              </div>
            </div>
            <textarea
              value={dsl}
              onChange={(e) => setDsl(e.target.value)}
              rows={3}
              placeholder="replace(source[0], '-', '')"
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-900 text-emerald-300 text-[12px] font-mono placeholder:text-slate-500 focus:outline-none focus:border-slate-900 resize-none"
            />
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500">Try:</span>
              {DSL_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                                    onClick={() => setDsl(ex.expr)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            {/* Allowed functions reference */}
            <div className="mt-2 p-2 rounded-lg bg-blue-50/60 border border-blue-100">
              <div className="flex items-start gap-1.5">
                <Info className="w-3 h-3 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-[10px] text-blue-800 leading-relaxed">
                  <span className="font-semibold">Allowed functions:</span>{" "}
                  <span className="font-mono">
                    upper, lower, trim, concat, if_null, replace, substr,
                    round, len, hash
                  </span>
                  . Reference source columns as{" "}
                  <span className="font-mono">source[0]</span>,{" "}
                  <span className="font-mono">source[1]</span>, etc.
                </div>
              </div>
            </div>
          </div>

          {/* Live test */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Play className="w-3 h-3 text-slate-600" />
                <span className="text-[11px] font-semibold text-slate-900">
                  Test with sample values
                </span>
              </div>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !dsl.trim()}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800 disabled:opacity-40"
              >
                {testing ? (
                  <>
                    <LoaderCircle className="w-3 h-3 animate-spin" />
                    Testing…
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Run test
                  </>
                )}
              </button>
            </div>

            <div className="p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">
                      source[{i}]
                    </label>
                    <input
                      value={testValues[i] || ""}
                      onChange={(e) => {
                        const next = [...testValues];
                        next[i] = e.target.value;
                        setTestValues(next);
                      }}
                      placeholder={i === 0 ? "hello-world" : "(optional)"}
                      className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                ))}
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg border text-[11.5px] ${
                    testResult.valid
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    {testResult.valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      {testResult.valid ? (
                        <>
                          <p className="font-semibold">Result:</p>
                          <pre className="font-mono text-[11px] bg-white/60 px-2 py-1 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(testResult.result, null, 2)}
                          </pre>
                        </>
                      ) : (
                        <p className="break-all">{testResult.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
          <p className="text-[10.5px] text-slate-500">
            Custom transforms are scoped to your tenant.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 px-3.5 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !key.trim() || !label.trim() || !dsl.trim()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? (
                <>
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Create transform
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}