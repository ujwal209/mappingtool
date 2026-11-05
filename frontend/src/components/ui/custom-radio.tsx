"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CustomRadioOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomRadioGroupProps {
  options: CustomRadioOption[];
  value?: string;
  onChange: (value: string) => void;
  orientation?: "vertical" | "horizontal";
  className?: string;
  itemClassName?: string;
}

export function CustomRadioGroup({
  options,
  value,
  onChange,
  orientation = "vertical",
  className,
  itemClassName,
}: CustomRadioGroupProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-2.5"
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <div
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 select-none",
              isSelected
                ? "border-slate-800 bg-slate-50/60 shadow-xs ring-1 ring-slate-800/10"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/30",
              itemClassName
            )}
          >
            {/* Custom sleek indicator */}
            <div
              className={cn(
                "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                isSelected
                  ? "border-slate-900 bg-slate-900"
                  : "border-slate-300 bg-white"
              )}
            >
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {option.icon && <span>{option.icon}</span>}
                <span
                  className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-slate-900 font-semibold" : "text-slate-700"
                  )}
                >
                  {option.label}
                </span>
              </div>
              {option.description && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {option.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
