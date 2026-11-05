"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  X,
  Plus,
  RefreshCw,
  LoaderCircle,
  AlertTriangle,
  Lock,
  Sparkles,
  Check,
  Play,
  Layers,
  Hash,
  Code2,
  Filter,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  transformationsApi,
  type Transformation,
  type TransformCategory,
  type CategoryInfo,
} from "@/lib/transformations-api";
import { TransformPreviewModal } from "./_components/TransformPreviewModal";

const CATEGORY_COLORS: Record<TransformCategory, string> = {
  DIRECT: "bg-slate-100 text-slate-700 border-slate-200",
  STRING: "bg-blue-50 text-blue-700 border-blue-200",
  NUMERIC: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DATE: "bg-violet-50 text-violet-700 border-violet-200",
  SECURITY: "bg-red-50 text-red-700 border-red-200",
  VALIDATION: "bg-amber-50 text-amber-700 border-amber-200",
  LOOKUP: "bg-cyan-50 text-cyan-700 border-cyan-200",
  CONDITIONAL: "bg-orange-50 text-orange-700 border-orange-200",
  CUSTOM: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

export default function TransformationsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const [items, setItems] = useState<Transformation[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    TransformCategory | "ALL"
  >("ALL");
  const [previewTx, setPreviewTx] = useState<Transformation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, cats] = await Promise.all([
        transformationsApi.list({
          category:
            activeCategory !== "ALL" ? activeCategory : undefined,
          search: debouncedSearch || undefined,
        }),
        transformationsApi.categories().catch(() => []),
      ]);
      setItems(list);
      setCategories(cats);
    } catch (e: any) {
      setError(e?.message || "Failed to load transformations");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, debouncedSearch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grouped = useMemo(() => {
    const g: Record<string, Transformation[]> = {};
    for (const t of items) {
      if (!g[t.category]) g[t.category] = [];
      g[t.category].push(t);
    }
    return g;
  }, [items]);

  const categoryOrder: TransformCategory[] = [
    "DIRECT",
    "STRING",
    "NUMERIC",
    "DATE",
    "SECURITY",
    "VALIDATION",
    "LOOKUP",
    "CONDITIONAL",
    "CUSTOM",
  ];

  const handleDelete = (tx: Transformation) => {
    toast(`Delete "${tx.label}"?`, {
      description:
        "This custom transform will be removed. Existing mappings using it will fail.",
      duration: 10000,
      action: {
        label: "Delete",
        onClick: async () => {
          setDeletingId(tx.transform_id);
          const lid = toast.loading("Deleting…");
          try {
            await transformationsApi.delete(tx.transform_id);
            setItems((prev) =>
              prev.filter((t) => t.transform_id !== tx.transform_id)
            );
            toast.success("Deleted", { id: lid });
          } catch (e: any) {
            toast.error("Delete failed", {
              description: e?.message,
              id: lid,
            });
          } finally {
            setDeletingId(null);
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const total = items.length;
  const systemCount = items.filter((t) => t.is_system).length;
  const customCount = items.filter((t) => !t.is_system).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Transformations
              </span>
              {!loading && (
                <span className="text-[10.5px] font-mono text-slate-400">
                  {total} total · {systemCount} builtin · {customCount} custom
                </span>
              )}
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
              Transformation catalog
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">
              Every transformation available to your mappings. Built-in
              transforms can't be edited, but you can clone them or create
              custom ones with the safe DSL.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/transformations/new"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create custom</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, key, or description…"
              className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Category filter row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
          <button
            onClick={() => setActiveCategory("ALL")}
            className={`shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[11.5px] font-semibold transition ${
              activeCategory === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
            }`}
          >
            All
            <span
              className={`text-[9px] font-mono px-1 py-0 rounded ${
                activeCategory === "ALL"
                  ? "bg-white/20"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {categories.reduce((a, c) => a + c.count, 0) || total}
            </span>
          </button>
          {categories.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[11.5px] font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {cat.label}
                <span
                  className={`text-[9px] font-mono px-1 py-0 rounded ${
                    isActive
                      ? "bg-white/20"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => void refresh()}
              className="shrink-0 px-2 py-0.5 rounded border border-red-200 bg-white text-[11px] font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && items.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && total === 0 && (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Code2 className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              No transforms match
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Try clearing filters or search.
            </p>
          </div>
        )}

        {/* Grouped list */}
        {!loading && total > 0 && (
          <div className="space-y-6">
            {categoryOrder
              .filter((cat) => grouped[cat]?.length > 0)
              .map((cat) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${CATEGORY_COLORS[cat]}`}
                    >
                      {cat}
                    </span>
                    <span className="text-[10.5px] text-slate-400 font-mono">
                      {grouped[cat].length} transform
                      {grouped[cat].length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {grouped[cat].map((tx) => (
                      <TransformCard
                        key={tx.transform_id}
                        tx={tx}
                        isDeleting={deletingId === tx.transform_id}
                        onPreview={() => setPreviewTx(tx)}
                        onDelete={() => handleDelete(tx)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewTx && (
        <TransformPreviewModal
          tx={previewTx}
          onClose={() => setPreviewTx(null)}
        />
      )}
    </div>
  );
}

function TransformCard({
  tx,
  isDeleting,
  onPreview,
  onDelete,
}: {
  tx: Transformation;
  isDeleting: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group rounded-xl border bg-white shadow-sm hover:shadow-md transition-all flex flex-col ${
        isDeleting
          ? "opacity-50 pointer-events-none border-slate-200"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono text-[11px] font-semibold text-slate-900 truncate">
                {tx.key}
              </span>
              {tx.is_system ? (
                <span
                  className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                  title="Built-in system transform"
                >
                  <Lock className="w-2 h-2" />
                  SYS
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200"
                  title="Custom DSL transform"
                >
                  <Sparkles className="w-2 h-2" />
                  DSL
                </span>
              )}
              {tx.arity_min !== 1 || tx.arity_max !== 1 ? (
                <span className="text-[8.5px] font-mono text-slate-400 shrink-0">
                  {tx.arity_min === tx.arity_max
                    ? `${tx.arity_min}-arity`
                    : `${tx.arity_min}..${tx.arity_max}`}
                </span>
              ) : null}
            </div>
            <h3 className="font-semibold text-[13px] text-slate-900 truncate">
              {tx.label}
            </h3>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 min-h-[2.2em]">
          {tx.description || "No description."}
        </p>

        {tx.example && (
          <div className="mt-2 px-2 py-1 rounded bg-slate-50 border border-slate-100 font-mono text-[10px] text-slate-600 truncate">
            {tx.example}
          </div>
        )}

        {tx.dsl_expression && (
          <div className="mt-2 px-2 py-1 rounded bg-fuchsia-50 border border-fuchsia-100 font-mono text-[10px] text-fuchsia-700 truncate">
            {tx.dsl_expression}
          </div>
        )}

        {tx.params.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {tx.params.slice(0, 3).map((p) => (
              <span
                key={p.name}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
              >
                {p.name}
                {p.required && <span className="text-red-500 ml-0.5">*</span>}
              </span>
            ))}
            {tx.params.length > 3 && (
              <span className="text-[9px] text-slate-400">
                +{tx.params.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-2">
        <button
          onClick={onPreview}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 px-1.5 py-1 rounded hover:bg-white"
        >
          <Play className="w-3 h-3" />
          Preview
        </button>
        {!tx.is_system && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}