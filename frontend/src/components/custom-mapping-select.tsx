"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ColumnOption {
  name: string;
  data_type: string;
  is_metadata?: boolean;
}

export interface CandidateScore {
  source_column: string;
  score: number;
  confidence_pct: number;
}

interface CustomMappingSelectProps {
  value: string | null;
  onChange: (val: string | null) => void;
  options: ColumnOption[];
  candidates?: CandidateScore[];
  placeholder?: string;
  disabled?: boolean;
}

export function CustomMappingSelect({
  value,
  onChange,
  options,
  candidates = [],
  placeholder = "Select source column...",
  disabled = false,
}: CustomMappingSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const candidateMap = new Map<string, number>();
  candidates.forEach((c) => candidateMap.set(c.source_column, c.confidence_pct));

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find((o) => o.name === value);

  return (
    <div className="relative w-full max-w-sm" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 px-2.5 bg-card hover:bg-muted/50 border border-input rounded-md flex items-center justify-between text-xs text-foreground transition-colors outline-none focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              <span className="font-medium text-foreground truncate">
                {selectedOption.name}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ({selectedOption.data_type})
              </span>
              {selectedOption.is_metadata && (
                <span className="px-1 py-0.2 bg-muted text-muted-foreground rounded text-[9px]">
                  META
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground italic truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear selection"
            >
              <X className="size-3" />
            </span>
          )}
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Custom Popup Menu */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden py-1 max-h-72 flex flex-col">
          {/* Search Box */}
          <div className="px-2 py-1.5 border-b border-border flex items-center gap-1.5 bg-muted/20">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter attributes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {/* List of Options */}
          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-56">
            {/* Unmap Option */}
            <div
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`px-2 py-1.5 rounded text-xs flex items-center justify-between cursor-pointer transition-colors ${
                !value
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <span>— Unmapped (Use Default Value) —</span>
              {!value && <Check className="size-3 text-foreground" />}
            </div>

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No matching columns found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.name;
                const confScore = candidateMap.get(opt.name);

                return (
                  <div
                    key={opt.name}
                    onClick={() => {
                      onChange(opt.name);
                      setIsOpen(false);
                    }}
                    className={`px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{opt.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({opt.data_type})
                      </span>
                      {opt.is_metadata && (
                        <span className="px-1 py-0.2 bg-muted text-muted-foreground rounded text-[9px]">
                          META
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {confScore !== undefined && confScore > 50 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded text-muted-foreground flex items-center gap-1">
                          <Sparkles className="size-2.5" />
                          {confScore}%
                        </span>
                      )}
                      {isSelected && <Check className="size-3 text-foreground" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
