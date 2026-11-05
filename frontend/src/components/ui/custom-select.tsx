"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  disabled = false,
  className,
  triggerClassName,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", isOpen ? "z-50" : "z-10", className)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium transition-all duration-150 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed",
          isOpen && "border-slate-800 ring-2 ring-slate-900/10",
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className={cn("truncate", !selectedOption && "text-slate-400 font-normal")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2",
            isOpen && "rotate-180 text-slate-700"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto py-1 animate-in fade-in-50 zoom-in-95 duration-100">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 text-center">
              No options available
            </div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition-colors hover:bg-slate-50",
                    isSelected && "bg-slate-100/70 font-semibold text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {option.icon && (
                      <span className="shrink-0">{option.icon}</span>
                    )}
                    <div className="truncate">
                      <div className="truncate text-slate-800">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-slate-400 truncate font-normal">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-slate-800 shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
