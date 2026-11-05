"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  Play,
  Sparkles,
  Code2,
  Info,
  Plus,
  X,
  Hash,
  Type,
  Wand2,
  Lock,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  transformationsApi,
  type TransformCategory,
  type TransformParam,
} from "@/lib/transformations-api";

const CATEGORY_OPTIONS: Array<{
  value: TransformCategory;
  label: string;
  description: string;
}> = [
  { value: "CUSTOM", label: "Custom", description: "General-purpose custom transform" },
  { value: "STRING", label: "String", description: "Text manipulation" },
  { value: "NUMERIC", label: "Numeric", description: "Number formatting / math" },
  { value: "DATE", label: "Date", description: "Date formatting / parsing" },
  { value: "SECURITY", label: "Security", description: "Hashing / masking" },
  { value: "VALIDATION", label: "Validation", description: "Assertions" },
  { value: "LOOKUP", label: "Lookup", description: "Code dictionary lookups" },
  { value: "CONDITIONAL", label: "Conditional", description: "If/then, coalesce" },
];

const DSL_EXAMPLES = [
  { label: "Strip hyphens", expr: "replace(source[0], '-', '')" },
  {
    label: "Title case",
    expr: "concat(upper(substr(trim(source[0]), 0, 1)), lower(substr(trim(source[0]), 1, 999)))",
  },
  { label: "Fallback if null", expr: "if_null(source[0], 'N/A')" },
  { label: "Hash with prefix", expr: "concat('H_', hash(source[0]))" },
  { label: "Upper + trim", expr: "upper(trim(source[0]))" },
  { label: "Join two columns", expr: "concat(source[0], ' ', source[1])" },
];

const ALLOWED_FUNCTIONS = [
  { name: "upper", desc: "Uppercase string" },
  { name: "lower", desc: "Lowercase string" },
  { name: "trim", desc: "Strip whitespace" },
  { name: "concat", desc: "Join values" },
  { name: "if_null", desc: "Fallback if null" },
  { name: "replace", desc: "Substring replace" },
  { name: "substr", desc: "Extract substring" },
  { name: "round", desc: "Round number" },
  { name: "len", desc: "String length" },
  { name: "hash", desc: "SHA-256 hash" },
];

const PARAM_TYPES = [
  { value: "string", label: "String" },
  { value: "int", label: "Integer" },
  { value: "float", label: "Float" },
  { value: "boolean", label: "Boolean" },
  { value: "json", label: "JSON" },
  { value: "list<string>", label: "List of strings" },
];

export default function NewCustomTransformPage() {
  const router = useRouter();

  // ── Identity ─────────────────────────────────────────────
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransformCategory>("CUSTOM");
  const [example, setExample] = useState("");

  // ── Arity ────────────────────────────────────────────────
  const [arityMin, setArityMin] = useState(1);
  const [arityMax, setArityMax] = useState(1);

  // ── DSL ──────────────────────────────────────────────────
  const [dsl, setDsl] = useState("");

  // ── Params ───────────────────────────────────────────────
  const [params, setParams] = useState<TransformParam[]>([]);

  // ── Test ─────────────────────────────────────────────────
  const [testValues, setTestValues] = useState<string[]>(["", "", ""]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    result: any;
    error: string | null;
  } | null>(null);

  // ── Submit ───────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-clean key
  useEffect(() => {
    const cleaned = key
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 64);
    if (cleaned !== key) setKey(cleaned);
  }, [key]);

  // Auto-suggest label from key
  useEffect(() => {
    if (!label && key) {
      const suggested = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setLabel(suggested);
    }
    // eslint-disable-next-line
  }, [key]);

  const canSubmit = useMemo(() => {
    return (
      key.trim().length >= 2 &&
      label.trim().length >= 1 &&
      dsl.trim().length > 0 &&
      !saving
    );
  }, [key, label, dsl, saving]);

  const handleTest = async () => {
    if (!dsl.trim()) {
      setError("Enter a DSL expression first.");
      return;
    }
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const sourceVals = testValues
        .slice(0, Math.max(1, arityMax))
        .map((v) => v || null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
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
        arity_min: arityMin,
        arity_max: arityMax,
        params,
      });
      toast.success(`Created "${label.trim()}"`);
      router.push("/transformations");
    } catch (e: any) {
      setError(e?.message || "Create failed");
      setSaving(false);
    }
  };

  const addParam = () => {
    setParams((prev) => [
      ...prev,
      {
        name: "",
        label: "",
        type: "string",
        required: false,
        default: undefined,
        description: "",
      },
    ]);
  };

  const updateParam = (idx: number, patch: Partial<TransformParam>) => {
    setParams((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  };

  const removeParam = (idx: number) => {
    setParams((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
        <Link
          href="/transformations"
          className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to catalog
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Transformations
            </span>
            <span className="text-[10px] text-slate-300">/</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">
              New custom
            </span>
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
            Create custom transformation
          </h1>
          <p className="text-[13px] text-slate-500 mt-1.5 max-w-2xl">
            Define a reusable transform with a safe DSL expression. Test
            against live values before saving — the expression is compiled
            in an isolated sandbox and can never execute arbitrary code.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
            {/* ── LEFT COLUMN ──────────────────────────── */}
            <div className="space-y-4">
              {/* Identity card */}
              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-semibold text-slate-900">
                      Identity
                    </h2>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">
                      How this transform will appear in the catalog
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                        Key <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="strip_hyphens"
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Machine identifier. lowercase + underscores only.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
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
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
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
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
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
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
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
                </div>
              </section>

              {/* Arity card */}
              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Type className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-semibold text-slate-900">
                      Arity
                    </h2>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">
                      How many source columns this transform accepts
                    </p>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Minimum columns
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={arityMin}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(20, Number(e.target.value)));
                        setArityMin(v);
                        if (v > arityMax) setArityMax(v);
                      }}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Maximum columns
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={arityMax}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(20, Number(e.target.value)));
                        setArityMax(v);
                        if (v < arityMin) setArityMin(v);
                      }}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div className="col-span-2 text-[10.5px] text-slate-500">
                    {arityMin === arityMax ? (
                      <>
                        Takes exactly <strong>{arityMin}</strong> source
                        column{arityMin === 1 ? "" : "s"}
                      </>
                    ) : (
                      <>
                        Takes between <strong>{arityMin}</strong> and{" "}
                        <strong>{arityMax}</strong> source columns
                      </>
                    )}
                    . Reference them in the DSL as{" "}
                    <code className="font-mono bg-slate-100 px-1 rounded">
                      source[0]
                    </code>
                    ,{" "}
                    <code className="font-mono bg-slate-100 px-1 rounded">
                      source[1]
                    </code>
                    , etc.
                  </div>
                </div>
              </section>

              {/* DSL card */}
              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Code2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h2 className="text-[13px] font-semibold text-slate-900">
                        DSL expression
                      </h2>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">
                        Compiled in a safe sandbox
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Lock className="w-2.5 h-2.5" />
                    Sandboxed
                  </span>
                </div>

                <div className="p-5 space-y-3">
                  <textarea
                    value={dsl}
                    onChange={(e) => {
                      setDsl(e.target.value);
                      setTestResult(null);
                    }}
                    rows={4}
                    placeholder="replace(source[0], '-', '')"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-800 bg-slate-900 text-emerald-300 text-[12px] font-mono placeholder:text-slate-500 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    spellCheck={false}
                  />

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Quick examples
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DSL_EXAMPLES.map((ex) => (
                        <button
                          key={ex.label}
                          type="button"
                          onClick={() => setDsl(ex.expr)}
                          className="text-[10.5px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                        >
                          {ex.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Allowed functions */}
                  <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3">
                    <div className="flex items-start gap-1.5 mb-2">
                      <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-[10.5px] text-blue-800 font-semibold">
                        Allowed functions
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {ALLOWED_FUNCTIONS.map((fn) => (
                        <div
                          key={fn.name}
                          className="flex items-baseline gap-1 text-[10px]"
                        >
                          <code className="font-mono text-blue-900 font-semibold">
                            {fn.name}
                          </code>
                          <span className="text-blue-600/70 truncate">
                            {fn.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Params card */}
              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Wand2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h2 className="text-[13px] font-semibold text-slate-900">
                        Parameters
                      </h2>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">
                        Optional inputs the transform accepts at runtime
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addParam}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
                  >
                    <Plus className="w-3 h-3" />
                    Add param
                  </button>
                </div>

                <div className="p-5">
                  {params.length === 0 ? (
                    <div className="py-6 text-center text-[11.5px] text-slate-400">
                      No parameters. The transform only accepts source values.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {params.map((p, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Param #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeParam(idx)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Remove"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Name
                              </label>
                              <input
                                value={p.name}
                                onChange={(e) =>
                                  updateParam(idx, {
                                    name: e.target.value
                                      .toLowerCase()
                                      .replace(/[^a-z0-9_]/g, "_"),
                                  })
                                }
                                placeholder="separator"
                                className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Label
                              </label>
                              <input
                                value={p.label}
                                onChange={(e) =>
                                  updateParam(idx, { label: e.target.value })
                                }
                                placeholder="Separator"
                                className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Type
                              </label>
                              <select
                                value={p.type}
                                onChange={(e) =>
                                  updateParam(idx, {
                                    type: e.target.value,
                                  })
                                }
                                className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11px] text-slate-900 focus:outline-none focus:border-slate-900"
                              >
                                {PARAM_TYPES.map((pt) => (
                                  <option key={pt.value} value={pt.value}>
                                    {pt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Default value
                              </label>
                              <input
                                value={p.default ?? ""}
                                onChange={(e) =>
                                  updateParam(idx, {
                                    default: e.target.value || undefined,
                                  })
                                }
                                placeholder="optional"
                                className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div className="flex items-end">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={p.required}
                                  onChange={(e) =>
                                    updateParam(idx, {
                                      required: e.target.checked,
                                    })
                                  }
                                  className="rounded border-slate-300 text-slate-900"
                                />
                                <span className="text-[11px] text-slate-700">
                                  Required
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── RIGHT COLUMN ─────────────────────────── */}
            <aside className="space-y-4 lg:sticky lg:top-4 self-start">
              {/* Live test card */}
              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <h2 className="text-[12.5px] font-semibold text-slate-900">
                    Live test
                  </h2>
                </div>

                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    {Array.from({
                      length: Math.max(1, arityMax),
                    })
                      .slice(0, Math.max(arityMin, 1))
                      .map((_, i) => (
                        <div key={i}>
                          <label className="block text-[10px] font-mono text-slate-500 mb-1">
                            source[{i}]
                            {i < arityMin && (
                              <span className="text-red-500 ml-0.5">*</span>
                            )}
                          </label>
                          <input
                            value={testValues[i] || ""}
                            onChange={(e) => {
                              const next = [...testValues];
                              next[i] = e.target.value;
                              setTestValues(next);
                            }}
                            placeholder={
                              i === 0 ? "hello-world" : "(optional)"
                            }
                            className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[11.5px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || !dsl.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {testing ? (
                      <>
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                        Testing…
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Run test
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] ${
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
                              <p className="font-semibold mb-1">Output:</p>
                              <pre className="font-mono text-[10.5px] bg-white/60 px-2 py-1 rounded overflow-x-auto whitespace-pre-wrap break-all">
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
              </section>

              {/* Summary card */}
              <section className="rounded-xl border border-slate-900 bg-slate-900 text-white overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <h2 className="text-[12.5px] font-semibold">Preview</h2>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Key
                    </p>
                    <p className="text-[12px] font-mono text-white truncate mt-0.5">
                      {key || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Label
                    </p>
                    <p className="text-[12.5px] text-white truncate mt-0.5">
                      {label || "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Category
                      </p>
                      <p className="text-[12px] text-white mt-0.5 truncate">
                        {category}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Arity
                      </p>
                      <p className="text-[12px] font-mono text-white mt-0.5">
                        {arityMin === arityMax
                          ? arityMin
                          : `${arityMin}..${arityMax}`}
                      </p>
                    </div>
                  </div>

                  {params.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Params
                      </p>
                      <p className="text-[11px] text-white mt-0.5">
                        {params
                          .map((p) => p.name || "unnamed")
                          .join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-slate-900 text-white text-[12.5px] font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
                <Link
                  href="/transformations"
                  className="w-full inline-flex items-center justify-center h-9 px-4 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </Link>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}