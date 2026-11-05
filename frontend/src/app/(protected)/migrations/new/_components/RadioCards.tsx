"use client";

import { Check } from "lucide-react";

export interface RadioCardOption {
  value: string;
  label: string;
  description: string;
}

interface Props {
  options: RadioCardOption[];
  value: string;
  onChange: (v: string) => void;
  columns?: 2 | 3;
  disabled?: boolean;
}

export function RadioCards({
  options,
  value,
  onChange,
  columns = 3,
  disabled,
}: Props) {
  const cols =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-3";

  return (
    <div className={`grid ${cols} gap-2`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`relative text-left rounded-lg border p-3 transition disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "border-slate-900 bg-slate-50/70 ring-1 ring-slate-900/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-slate-900">
                {opt.label}
              </span>
              <span
                className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition ${
                  active
                    ? "bg-slate-900 border-slate-900"
                    : "border-slate-300 bg-white"
                }`}
              >
                {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-1 pr-5">
              {opt.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}