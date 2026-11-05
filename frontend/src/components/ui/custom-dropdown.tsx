"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable = true,
  className = "",
  buttonClassName = "",
  disabled = false,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = !query.trim()
    ? options
    : options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.value.toLowerCase().includes(query.toLowerCase()) ||
          (o.description || "").toLowerCase().includes(query.toLowerCase())
      );

  // Group filtered options
  const grouped: Record<string, DropdownOption[]> = {};
  filtered.forEach((o) => {
    const key = o.group || "";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  });

  // Flat list for keyboard navigation
  const flat: DropdownOption[] = Object.values(grouped).flat();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(flat.length - 1, h + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      }
      if (e.key === "Enter" && flat[highlight]) {
        e.preventDefault();
        onChange(flat[highlight].value);
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, flat, highlight, onChange]);

  useEffect(() => {
    if (open && searchable) {
      // Focus the search input on open
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
    if (!open) {
      setQuery("");
      setHighlight(0);
    }
  }, [open, searchable]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${highlight}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full h-11 px-3.5 flex items-center justify-between gap-2 text-[13px] text-slate-900 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06] transition disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className="truncate text-left">
          {selected ? (
            selected.label
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1">
          {searchable && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlight(0);
                  }}
                  placeholder="Search…"
                  className="w-full h-8 pl-8 pr-2.5 text-[12px] text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-slate-900 focus:bg-white transition placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto p-1.5"
          >
            {flat.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-slate-400">
                No options match &ldquo;{query}&rdquo;
              </div>
            ) : (
              Object.entries(grouped).map(([groupName, groupOpts]) => (
                <div key={groupName || "_default"} className="mb-1">
                  {groupName && (
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      {groupName}
                    </div>
                  )}
                  {groupOpts.map((opt) => {
                    const idx = flat.indexOf(opt);
                    const isSel = opt.value === value;
                    const isHigh = idx === highlight;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        data-option-index={idx}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-md flex items-start justify-between gap-2 transition ${
                          isHigh ? "bg-slate-100" : "hover:bg-slate-50"
                        } ${isSel ? "bg-slate-50" : ""}`}
                      >
                        <div className="min-w-0">
                          <div
                            className={`text-[13px] truncate ${
                              isSel
                                ? "font-semibold text-slate-900"
                                : "font-medium text-slate-800"
                            }`}
                          >
                            {opt.label}
                          </div>
                          {opt.description && (
                            <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              {opt.description}
                            </div>
                          )}
                        </div>
                        {isSel && (
                          <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}