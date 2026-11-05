"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
  Save,
} from "lucide-react";
import { ColumnPicker, type ColumnOption } from "./ColumnPicker";
import { TransformPicker } from "./TransformPicker";
import type { ColumnRule, PairBlock } from "@/lib/pair-mapping-api";

const PAGE_SIZES = [10, 25, 50, 100] as const;

function columnStatusLabel(col: ColumnRule) {
  if (col.status === "MANUAL_OVERRIDE") {
    return {
      label: "Manual",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    };
  }
  if (col.matched_source_column) {
    return {
      label: "Matched",
      cls: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }
  return {
    label: "Unmatched",
    cls: "bg-white text-slate-400 border-slate-200",
  };
}

interface Props {
  pair: PairBlock;
  /** Already-filtered, already-sorted columns (parent applies filters globally). */
  visibleColumns: ColumnRule[];
  sourceColumns: ColumnOption[];
  readOnly: boolean;
  edits: Record<string, Partial<ColumnRule>>;
  onEdit: (ruleId: string, patch: Partial<ColumnRule>) => void;
  onSave: () => void;
  saving: boolean;
  hasEdits: boolean;
}

export function PaginatedColumnTable({
  pair,
  visibleColumns,
  sourceColumns,
  readOnly,
  edits,
  onEdit,
  onSave,
  saving,
  hasEdits,
}: Props) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  const total = visibleColumns.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(0);
  }, [pair.pair_id, total]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const pagedColumns = useMemo(() => {
    const start = page * pageSize;
    return visibleColumns.slice(start, start + pageSize);
  }, [visibleColumns, page, pageSize]);

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] min-w-[960px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 w-[40px]">#</th>
              <th className="text-left px-3 py-2">Target</th>
              <th className="text-left px-3 py-2 w-[220px]">Source</th>
              <th className="text-left px-3 py-2 w-[150px]">Transform</th>
              <th className="text-left px-3 py-2 w-[130px]">Default</th>
              <th className="text-left px-3 py-2 w-[100px]">Confidence</th>
              <th className="text-left px-3 py-2 w-[110px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedColumns.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[12px] text-slate-400"
                >
                  No columns match the current filters.
                </td>
              </tr>
            ) : (
              pagedColumns.map((col, i) => {
                const edit = edits[col.rule_id] || {};
                const displayCol: ColumnRule = { ...col, ...edit };
                const status = columnStatusLabel(displayCol);
                const cpt = Math.round(
                  (displayCol.confidence_score || 0) * 100
                );
                const barColor = !displayCol.matched_source_column
                  ? "bg-slate-200"
                  : cpt >= 85
                  ? "bg-slate-900"
                  : cpt >= 50
                  ? "bg-slate-600"
                  : "bg-slate-400";
                const rowIndex = page * pageSize + i + 1;
                const rowHasEdits = Object.keys(edit).length > 0;
                const editable = !readOnly;

                return (
                  <tr
                    key={col.rule_id}
                    className={
                      rowHasEdits
                        ? "bg-amber-50/40"
                        : "hover:bg-slate-50/60"
                    }
                  >
                    <td className="px-4 py-2 text-slate-400 font-mono text-[10px]">
                      {rowIndex}
                    </td>

                    <td className="px-3 py-2 font-mono text-[11.5px] font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{displayCol.target_column}</span>
                        <span className="text-[9.5px] font-normal text-slate-400">
                          {displayCol.target_datatype}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <ColumnPicker
                        value={displayCol.matched_source_column}
                        onChange={(name) =>
                          onEdit(col.rule_id, {
                            matched_source_column: name,
                            status: "MANUAL_OVERRIDE",
                          })
                        }
                        options={sourceColumns}
                        readOnly={!editable}
                        placeholder="Select source…"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <TransformPicker
                        value={
                          displayCol.transformation_rule || "direct_cast"
                        }
                        onChange={(val) =>
                          onEdit(col.rule_id, {
                            transformation_rule: val,
                            status: "MANUAL_OVERRIDE",
                          })
                        }
                        readOnly={!editable}
                      />
                    </td>

                    <td className="px-3 py-2">
                      {editable ? (
                        <input
                          type="text"
                          value={displayCol.default_value ?? ""}
                          onChange={(e) =>
                            onEdit(col.rule_id, {
                              default_value: e.target.value || null,
                            })
                          }
                          placeholder="—"
                          className="w-full h-7 px-2 rounded border border-slate-200 bg-white text-[10.5px] font-mono text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                        />
                      ) : (
                        <span className="font-mono text-[10.5px] text-slate-500">
                          {displayCol.default_value || "—"}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[60px]">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${cpt}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10.5px] font-semibold text-slate-700 tabular-nums">
                          {displayCol.matched_source_column
                            ? `${cpt}%`
                            : "—"}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      {editable ? (
                        <select
                          value={displayCol.status}
                          onChange={(e) =>
                            onEdit(col.rule_id, {
                              status: e.target
                                .value as ColumnRule["status"],
                            })
                          }
                          className={`w-full h-7 px-1.5 rounded border text-[9.5px] font-mono font-bold uppercase tracking-wider focus:outline-none focus:border-slate-900 ${status.cls}`}
                        >
                          <option value="UNMATCHED">Unmatched</option>
                          <option value="MATCHED">Matched</option>
                          <option value="MANUAL_OVERRIDE">Manual</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${status.cls}`}
                        >
                          {status.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="hidden sm:inline">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="text-[11px] px-1.5 py-0.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-900"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="font-mono text-[10.5px] text-slate-500 tabular-nums">
              {page * pageSize + 1}–
              {Math.min(total, (page + 1) * pageSize)} of {total}
            </span>

            <div className="flex items-center gap-0.5 ml-2">
              <PageBtn
                disabled={page === 0}
                onClick={() => setPage(0)}
                title="First"
              >
                <ChevronsLeft className="w-3 h-3" />
              </PageBtn>
              <PageBtn
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                title="Previous"
              >
                <ChevronLeft className="w-3 h-3" />
              </PageBtn>
              <span className="px-1.5 text-[10.5px] font-mono font-semibold text-slate-700 min-w-[48px] text-center tabular-nums">
                {page + 1}/{totalPages}
              </span>
              <PageBtn
                disabled={page >= totalPages - 1}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                title="Next"
              >
                <ChevronRight className="w-3 h-3" />
              </PageBtn>
              <PageBtn
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
                title="Last"
              >
                <ChevronsRight className="w-3 h-3" />
              </PageBtn>
            </div>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={onSave}
              disabled={!hasEdits || saving}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold transition ${
                hasEdits
                  ? "bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
              title={
                hasEdits
                  ? "Save pending column edits"
                  : "No pending edits to save"
              }
            >
              {saving ? (
                <>
                  <LoaderCircle className="w-3 h-3 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Save pair
                </>
              )}
            </button>
          )}

          {readOnly && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <Check className="w-3 h-3" />
              Read-only
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PageBtn({
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
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}