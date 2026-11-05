"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Key,
  Shield,
} from "lucide-react";
import { PickerDropdown } from "./PickerDropdown";
import { RadioCards } from "./RadioCards";

export interface TableConfig {
  source_table: string;
  target_table: string;
  load_mode: "REPLACE" | "APPEND" | "UPSERT";
  primary_key_columns: string[];
  masking_columns: string[];
  requires_masking: boolean;
  /** Target columns that will actually be written — i.e. the mapped ones. */
  mapped_target_columns: string[];
  /** Number of mapped columns (mirrors mapped_target_columns.length). */
  mapped_count: number;
}

interface Props {
  config: TableConfig;
  targetRowCount?: number;
  onChange: (patch: Partial<TableConfig>) => void;
}

const LOAD_MODES = [
  {
    value: "APPEND",
    label: "Append",
    description: "Insert all rows. Duplicates possible.",
  },
  {
    value: "UPSERT",
    label: "Upsert",
    description: "Update on PK match, insert otherwise.",
  },
  {
    value: "REPLACE",
    label: "Replace",
    description: "Truncate the target table first.",
  },
];

export function TableConfigRow({ config, targetRowCount, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  // ── The fix: never assume the field exists. ─────────────
  // Old seeds (or stale state) may lack mapped_target_columns.
  const mappedTargets = config.mapped_target_columns ?? [];
  const mappedOptions = mappedTargets.map((c) => ({
    value: c,
    label: c,
  }));

  const destructive =
    config.load_mode === "REPLACE" && (targetRowCount || 0) > 0;

  return (
    <div
      className={`rounded-lg border bg-white overflow-hidden transition ${
        destructive ? "border-amber-300" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[12px] font-semibold text-slate-900 truncate max-w-[240px]">
              {config.source_table}
            </span>
            <span className="text-slate-300">→</span>
            <span className="font-mono text-[12px] font-semibold text-slate-900 truncate max-w-[240px]">
              {config.target_table}
            </span>
            <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {config.load_mode}
            </span>
            <span className="text-[9.5px] font-mono text-slate-400">
              {mappedTargets.length} mapped
            </span>
            {config.requires_masking && (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                <Shield className="w-2.5 h-2.5" />
                Mask
              </span>
            )}
          </div>
          {destructive && (
            <p className="text-[10.5px] text-amber-700 mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              REPLACE will delete {targetRowCount?.toLocaleString()} existing
              rows.
            </p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-3 space-y-3">
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Load mode
            </label>
            <RadioCards
              options={LOAD_MODES}
              value={config.load_mode}
              onChange={(v) =>
                onChange({ load_mode: v as TableConfig["load_mode"] })
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Primary key column{" "}
                <span className="text-slate-400 font-normal normal-case">
                  (mapped only)
                </span>
              </label>
              {mappedOptions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-[11px] text-slate-400 italic">
                  No mapped columns.
                </div>
              ) : (
                <PickerDropdown
                  value={config.primary_key_columns[0] || ""}
                  onChange={(v) =>
                    onChange({ primary_key_columns: v ? [v] : [] })
                  }
                  options={mappedOptions}
                  placeholder="None (append-only)"
                  pageSize={15}
                  footer={
                    <button
                      type="button"
                      onClick={() => onChange({ primary_key_columns: [] })}
                      className="w-full text-left px-3 py-2 text-[11.5px] text-slate-600 hover:bg-slate-100"
                    >
                      Clear selection
                    </button>
                  }
                />
              )}
            </div>

            <div>
              <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Masking
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange({ requires_masking: !config.requires_masking })
                }
                className={`w-full h-10 px-3 rounded-lg border text-[12px] font-medium transition flex items-center justify-between ${
                  config.requires_masking
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  {config.requires_masking
                    ? "Masking enabled"
                    : "Enable masking"}
                </span>
                <span
                  className={`w-9 h-5 rounded-full border transition-colors flex items-center ${
                    config.requires_masking
                      ? "bg-amber-600 border-amber-600"
                      : "bg-slate-200 border-slate-300"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
                      config.requires_masking
                        ? "translate-x-[18px]"
                        : "translate-x-[2px]"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          {config.requires_masking && (
            <div>
              <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Columns to mask{" "}
                <span className="text-slate-400 font-normal normal-case">
                  (mapped only)
                </span>
              </label>
              {mappedOptions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-[11px] text-slate-400 italic">
                  No mapped columns.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {mappedOptions.map((c) => {
                    const on = config.masking_columns.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() =>
                          onChange({
                            masking_columns: on
                              ? config.masking_columns.filter(
                                  (x) => x !== c.value,
                                )
                              : [...config.masking_columns, c.value],
                          })
                        }
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] transition ${
                          on ? "bg-amber-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            on
                              ? "bg-amber-600 border-amber-600"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {on && (
                            <Key
                              className="w-2.5 h-2.5 text-white"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <span className="font-mono text-slate-800 truncate">
                          {c.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}