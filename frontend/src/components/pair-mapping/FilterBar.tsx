"use client";

import {
  Search,
  X,
  Filter,
  ArrowUpDown,
  Layers,
  CircleCheck,
  CircleSlash,
  Sparkles,
} from "lucide-react";
import { CustomFilterDropdown } from "./CustomFilterDropdown";

export type ColumnStatusFilter =
  | "ALL"
  | "MATCHED"
  | "UNMATCHED"
  | "MANUAL_OVERRIDE";

export type ColumnSortMode =
  | "default"
  | "target-asc"
  | "target-desc"
  | "confidence-desc"
  | "confidence-asc"
  | "status";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: ColumnStatusFilter;
  onStatusChange: (v: ColumnStatusFilter) => void;
  sortMode: ColumnSortMode;
  onSortChange: (v: ColumnSortMode) => void;
  pairs: Array<{ pair_id: string; label: string; columnCount: number }>;
  pairFilter: string;
  onPairFilterChange: (v: string) => void;
  counts: {
    total: number;
    matched: number;
    unmatched: number;
    manual: number;
    /** Number of columns that pass the current search + status + pair filters. */
    visible: number;
  };
  onClear: () => void;
  hasActiveFilters: boolean;
}

// ─────────────────────────────────────────────────────────────
// Static option lists
// ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = (counts: Props["counts"]) => [
  {
    value: "ALL",
    label: "All columns",
    hint: `${counts.total}`,
  },
  {
    value: "MATCHED",
    label: "Matched",
    hint: `${counts.matched}`,
    icon: <CircleCheck className="w-3 h-3 text-slate-900" />,
  },
  {
    value: "UNMATCHED",
    label: "Unmatched",
    hint: `${counts.unmatched}`,
    icon: <CircleSlash className="w-3 h-3 text-slate-400" />,
  },
  {
    value: "MANUAL_OVERRIDE",
    label: "Manual override",
    hint: `${counts.manual}`,
    icon: <Sparkles className="w-3 h-3 text-amber-600" />,
  },
];

const SORT_OPTIONS = [
  { value: "default", label: "Default order" },
  { value: "target-asc", label: "Target A → Z" },
  { value: "target-desc", label: "Target Z → A" },
  { value: "confidence-desc", label: "Confidence ↓ (high first)" },
  { value: "confidence-asc", label: "Confidence ↑ (low first)" },
  { value: "status", label: "Status (manual first)" },
];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function FilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortMode,
  onSortChange,
  pairs,
  pairFilter,
  onPairFilterChange,
  counts,
  onClear,
  hasActiveFilters,
}: Props) {
  const pairOptions = [
    { value: "ALL", label: "All pairs", hint: `${pairs.length}` },
    ...pairs.map((p) => ({
      value: p.pair_id,
      label: p.label,
      hint: `${p.columnCount}`,
    })),
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
      {/* Row 1 — search + filters */}
      <div className="p-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
        {/* Universal search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search anything — target, source, transform, concept, rationale… (try  source:email)"
            className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Pair filter — custom */}
        <CustomFilterDropdown
          value={pairFilter}
          onChange={onPairFilterChange}
          options={pairOptions}
          icon={<Layers className="w-3 h-3" />}
          title="Filter by pair"
          placeholder="All pairs"
          minWidth={200}
          ariaLabel="Filter by pair"
        />

        {/* Status filter — custom */}
        <CustomFilterDropdown
          value={statusFilter}
          onChange={(v) => onStatusChange(v as ColumnStatusFilter)}
          options={STATUS_OPTIONS(counts)}
          icon={<Filter className="w-3 h-3" />}
          title="Filter by status"
          placeholder="All status"
          minWidth={170}
          ariaLabel="Filter by status"
        />

        {/* Sort — custom */}
        <CustomFilterDropdown
          value={sortMode}
          onChange={(v) => onSortChange(v as ColumnSortMode)}
          options={SORT_OPTIONS}
          icon={<ArrowUpDown className="w-3 h-3" />}
          title="Sort columns"
          placeholder="Sort"
          searchable={false}
          minWidth={180}
          ariaLabel="Sort columns"
        />

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="shrink-0 inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11.5px] font-medium hover:bg-slate-50"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Row 2 — live counts */}
      <div className="px-3 pb-2 flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="font-mono font-semibold text-slate-700">
            {counts.visible}
          </span>
          <span>of</span>
          <span className="font-mono font-semibold text-slate-700">
            {counts.total}
          </span>
          <span>columns</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
          <span className="font-mono text-slate-700">{counts.matched}</span>
          matched
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="font-mono text-slate-700">{counts.manual}</span>
          manual
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          <span className="font-mono text-slate-700">{counts.unmatched}</span>
          unmatched
        </span>
        {hasActiveFilters && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-blue-700 font-medium text-[10.5px]">
              Filters active
            </span>
          </>
        )}
      </div>
    </div>
  );
}