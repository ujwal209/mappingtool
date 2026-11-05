"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  Search,
  Check,
  X,
  Loader2,
  Database,
  ArrowRight,
} from "lucide-react";

export interface DropdownItem {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface CustomSearchDropdownProps {
  items: DropdownItem[];
  selectedId: string;
  onSelect: (item: DropdownItem | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onSearchChange?: (query: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

export function CustomSearchDropdown({
  items,
  selectedId,
  onSelect,
  placeholder = "Select an option...",
  searchPlaceholder = "Search thousands of items...",
  label,
  loading = false,
  disabled = false,
  onSearchChange,
  hasMore = false,
  onLoadMore,
  className = "",
}: CustomSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected item object
  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId]
  );

  // Close when clicking outside
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

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  // Internal filtering if onSearchChange is not driving external pagination
  const filteredItems = useMemo(() => {
    if (onSearchChange) return items;
    if (!search.trim()) return items;
    const lower = search.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(lower))
    );
  }, [items, search, onSearchChange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom =
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
      e.currentTarget.clientHeight + 50;
    if (bottom && hasMore && onLoadMore && !loading) {
      onLoadMore();
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-12 px-4 rounded-2xl bg-white/5 border text-left flex items-center justify-between transition-all duration-200 ${
          isOpen
            ? "border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg shadow-emerald-950/20"
            : "border-slate-800 hover:border-slate-700 bg-slate-900/60"
        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-3 truncate">
          {selectedItem?.icon || (
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="truncate">
            {selectedItem ? (
              <div className="flex items-center gap-2 truncate">
                <span className="text-[13.5px] font-medium text-white truncate">
                  {selectedItem.label}
                </span>
                {selectedItem.badge && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
                    {selectedItem.badge}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 text-[13px]">{placeholder}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedItem && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
            >
              <X className="w-3.5 h-3.5" />
            </div>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-emerald-400" : ""
            }`}
          />
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={handleSearchInput}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-9 pr-8 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    if (onSearchChange) onSearchChange("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* List Area */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-64 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/20"
          >
            {filteredItems.length === 0 && !loading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching results found
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelect(item);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between text-xs transition group ${
                      isSelected
                        ? "bg-emerald-500/10 text-white font-medium border border-emerald-500/20"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.icon || (
                        <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/40 flex items-center justify-center text-slate-400 shrink-0">
                          <Database className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700/40">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.sublabel && (
                          <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                            {item.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}

            {loading && (
              <div className="py-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Loading more items...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}