"use client";

import { Check } from "lucide-react";
import React from "react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  tone?: "slate" | "amber" | "sky" | "red";
}

const tones: Record<string, string> = {
  slate: "bg-slate-900 border-slate-900",
  amber: "bg-amber-500 border-amber-500",
  sky: "bg-sky-600 border-sky-600",
  red: "bg-red-600 border-red-600",
};

export function CustomCheckbox({
  checked,
  onChange,
  label,
  hint,
  disabled,
  tone = "slate",
}: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`inline-flex items-center gap-2 text-left text-xs transition ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer group"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-4 h-4 rounded border transition shrink-0 ${
          checked
            ? `${tones[tone]} text-white`
            : "bg-white border-slate-300 group-hover:border-slate-500"
        }`}
      >
        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
      <span className="flex flex-col">
        {label && (
          <span className="font-semibold text-slate-800 text-[11px]">{label}</span>
        )}
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}