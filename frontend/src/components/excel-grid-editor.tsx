"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Search,
  Check,
  Sparkles,
  Layers,
  Database,
  Download,
  FileCheck2,
  SlidersHorizontal,
  X,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowDownAZ,
  ArrowUpAZ,
  Copy,
  Scissors,
  ClipboardPaste,
  Undo2,
  Redo2,
  FileSpreadsheet,
  Home,
  Sliders,
  DollarSign,
  Percent,
  FolderOpen,
  FileText,
  HelpCircle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CustomMappingSelect } from "@/components/custom-mapping-select";
import { AIConfigModal } from "@/components/ai-config-modal";
import { type ColumnMapping, type TransformResponse } from "@/lib/mapping-api";
import { useMapping } from "@/context/MappingContext";

export interface ColumnDef {
  name: string;
  data_type: string;
  is_metadata?: boolean;
}

interface Excel3SheetStudioProps {
  sourceFilename: string;
  sourceColumns: ColumnDef[];
  sourceRows: Record<string, any>[];
  onSourceChange: (cols: ColumnDef[], rows: Record<string, any>[]) => void;

  targetFilename: string;
  targetColumns: ColumnDef[];
  targetRows: Record<string, any>[];
  onTargetChange: (cols: ColumnDef[], rows: Record<string, any>[]) => void;

  replicaData: TransformResponse | null;
  transformLoading: boolean;

  mappings: ColumnMapping[];
  userOverrides: Record<string, string | null>;
  defaultValues: Record<string, string>;
  onMappingChange: (targetCol: string, sourceCol: string | null) => void;
  onDefaultValueChange: (targetCol: string, val: string) => void;

  onRunAIMapping: () => Promise<void>;
  aiLoading: boolean;
  aiReasoningSummary: string | null;

  onExportExcel: () => Promise<void>;
  exportLoading: boolean;
  mappingStats: {
    total: number;
    mapped: number;
    unmapped: number;
    percentage: number;
    metadataCount: number;
  };
}

export function Excel3SheetStudio({
  sourceFilename,
  sourceColumns,
  sourceRows,
  onSourceChange,
  targetFilename,
  targetColumns,
  targetRows,
  onTargetChange,
  replicaData,
  transformLoading,
  mappings,
  userOverrides,
  defaultValues,
  onMappingChange,
  onDefaultValueChange,
  onRunAIMapping,
  aiLoading,
  aiReasoningSummary,
  onExportExcel,
  exportLoading,
  mappingStats,
}: Excel3SheetStudioProps) {
  const {
    mockSummaries,
    selectedMockId,
    handleLoadMock,
    isLoading,
    groqApiKeys,
    setGroqApiKeys,
    selectedModel,
    setSelectedModel,
    handleUpload,
    errorMessage,
    aiCustomPrompt,
    setAiCustomPrompt,
  } = useMapping();

  // Active Sheet: "source" (Sheet 1) | "target" (Sheet 2) | "result" (Sheet 3)
  const [activeSheet, setActiveSheet] = useState<"source" | "target" | "result">("source");

  // Top Menu Dropdown State ('file' | 'edit' | 'view' | 'insert' | 'format' | 'data' | 'ai' | 'export' | null)
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Mapping Panel Drawer Toggle
  const [isMappingDrawerOpen, setIsMappingDrawerOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState("");

  // Selected Cell Coordinate: { rowIndex, colIndex }
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    colIndex: number;
  }>({ rowIndex: 0, colIndex: 0 });

  // In-Cell Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [aiSuccessBanner, setAiSuccessBanner] = useState(false);

  // Formatting state (Bold, Italic, Alignment)
  const [cellAlignment, setCellAlignment] = useState<"left" | "center" | "right">("left");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // History state for Undo / Redo
  const [undoStack, setUndoStack] = useState<{ sheet: string; rows: Record<string, any>[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ sheet: string; rows: Record<string, any>[] }[]>([]);

  // Internal Clipboard
  const [clipboardValue, setClipboardValue] = useState<any>(null);

  // Upload Excel Pair Dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadSourceFile, setUploadSourceFile] = useState<File | null>(null);
  const [uploadTargetFile, setUploadTargetFile] = useState<File | null>(null);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  // Add Column Dialog
  const [isColDialogOpen, setIsColDialogOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("string");
  const [newColIsMeta, setNewColIsMeta] = useState(false);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine current active sheet data
  const currentFilename =
    activeSheet === "source"
      ? sourceFilename
      : activeSheet === "target"
      ? targetFilename
      : `Replicated_${targetFilename}`;

  const currentColumns: ColumnDef[] =
    activeSheet === "source"
      ? sourceColumns
      : activeSheet === "target"
      ? targetColumns
      : targetColumns;

  const currentRows: Record<string, any>[] =
    activeSheet === "source"
      ? sourceRows
      : activeSheet === "target"
      ? targetRows
      : replicaData?.data || [];

  const isReadOnly = activeSheet === "result";

  // Active cell details
  const activeColName = currentColumns[selectedCell.colIndex]?.name || "";
  const activeCellRawValue =
    currentRows[selectedCell.rowIndex] && activeColName
      ? currentRows[selectedCell.rowIndex][activeColName]
      : "";

  const activeDisplayValue =
    activeCellRawValue !== null && activeCellRawValue !== undefined
      ? String(activeCellRawValue)
      : "";

  // Column letters helper (A, B, C, ..., Z, AA, AB, ...)
  const getColLetter = (index: number) => {
    let letter = "";
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode((n % 26) + 65) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  };

  const activeCellCoord = `${getColLetter(selectedCell.colIndex)}${
    selectedCell.rowIndex + 1
  }`;

  // Keep edit value in sync when selection changes and not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(activeDisplayValue);
    }
  }, [selectedCell, activeDisplayValue, isEditing, activeSheet]);

  // Focus cell input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      cellInputRef.current?.focus();
      cellInputRef.current?.select();
    }
  }, [isEditing]);

  // Reset selected cell when switching sheets if out of bounds
  useEffect(() => {
    setSelectedCell((prev) => ({
      rowIndex: Math.min(prev.rowIndex, Math.max(0, currentRows.length - 1)),
      colIndex: Math.min(prev.colIndex, Math.max(0, currentColumns.length - 1)),
    }));
    setIsEditing(false);
  }, [activeSheet]);

  const handleTriggerAI = async () => {
    setAiSuccessBanner(false);
    await onRunAIMapping();
    setAiSuccessBanner(true);
    setTimeout(() => setAiSuccessBanner(false), 6000);
  };

  // Simple formula evaluation engine
  const evaluateFormula = (input: string): any => {
    const trimmed = input.trim();
    if (!trimmed.startsWith("=")) return trimmed;

    try {
      const expr = trimmed.slice(1).trim().toUpperCase();

      // =SUM(...)
      if (expr.startsWith("SUM(") && expr.endsWith(")")) {
        const inner = expr.slice(4, -1);
        if (inner.includes(":")) {
          const sum = currentRows.reduce((acc, row) => {
            const val = Number(row[activeColName]);
            return acc + (isNaN(val) ? 0 : val);
          }, 0);
          return sum;
        }
      }

      // =UPPER(...)
      if (expr.startsWith("UPPER(") && expr.endsWith(")")) {
        const inner = expr.slice(6, -1);
        return inner.toUpperCase();
      }

      // =LOWER(...)
      if (expr.startsWith("LOWER(") && expr.endsWith(")")) {
        const inner = expr.slice(6, -1);
        return inner.toLowerCase();
      }

      // Math arithmetic evaluation
      const sanitized = expr.replace(/[^0-9+\-*/().]/g, "");
      if (sanitized) {
        return Function(`'use strict'; return (${sanitized})`)();
      }
    } catch {
      return "#ERROR!";
    }
    return input;
  };

  // Commit value change to dataset
  const commitValue = (valueToCommit: string) => {
    if (isReadOnly || !activeColName || !currentRows[selectedCell.rowIndex]) return;

    let evaluated = evaluateFormula(valueToCommit);

    if (evaluated === "") {
      evaluated = null;
    } else if (!isNaN(Number(evaluated)) && evaluated !== null && evaluated !== "") {
      evaluated = Number(evaluated);
    }

    // Push to undo stack
    setUndoStack((prev) => [...prev.slice(-20), { sheet: activeSheet, rows: currentRows }]);
    setRedoStack([]);

    const updatedRows = [...currentRows];
    updatedRows[selectedCell.rowIndex] = {
      ...updatedRows[selectedCell.rowIndex],
      [activeColName]: evaluated,
    };

    if (activeSheet === "source") {
      onSourceChange(sourceColumns, updatedRows);
    } else if (activeSheet === "target") {
      onTargetChange(targetColumns, updatedRows);
    }
  };

  // Undo Handler
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, { sheet: activeSheet, rows: currentRows }]);

    if (last.sheet === "source") onSourceChange(sourceColumns, last.rows);
    if (last.sheet === "target") onTargetChange(targetColumns, last.rows);
  };

  // Redo Handler
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, { sheet: activeSheet, rows: currentRows }]);

    if (next.sheet === "source") onSourceChange(sourceColumns, next.rows);
    if (next.sheet === "target") onTargetChange(targetColumns, next.rows);
  };

  // Clipboard operations
  const handleCopy = () => {
    if (!activeCellRawValue && activeCellRawValue !== 0) return;
    setClipboardValue(activeCellRawValue);
    navigator.clipboard?.writeText(String(activeCellRawValue)).catch(() => {});
  };

  const handleCut = () => {
    if (isReadOnly) return;
    handleCopy();
    commitValue("");
    setEditValue("");
  };

  const handlePaste = async () => {
    if (isReadOnly) return;
    try {
      const text = await navigator.clipboard?.readText();
      if (text) {
        commitValue(text);
        setEditValue(text);
        return;
      }
    } catch {}
    if (clipboardValue !== null) {
      commitValue(String(clipboardValue));
      setEditValue(String(clipboardValue));
    }
  };

  // Format active cell as currency or percent
  const handleFormatValue = (type: "currency" | "percent" | "upper" | "lower") => {
    if (isReadOnly || !activeCellRawValue) return;
    const val = String(activeCellRawValue);
    if (type === "currency") {
      const num = Number(val.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(num)) commitValue(`$${num.toFixed(2)}`);
    } else if (type === "percent") {
      const num = Number(val.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(num)) commitValue(`${(num * 100).toFixed(1)}%`);
    } else if (type === "upper") {
      commitValue(val.toUpperCase());
    } else if (type === "lower") {
      commitValue(val.toLowerCase());
    }
  };

  // Keyboard navigation across the Excel spreadsheet
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitValue(editValue);
        setIsEditing(false);
        if (selectedCell.rowIndex < currentRows.length - 1) {
          setSelectedCell((prev) => ({ ...prev, rowIndex: prev.rowIndex + 1 }));
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitValue(editValue);
        setIsEditing(false);
        if (selectedCell.colIndex < currentColumns.length - 1) {
          setSelectedCell((prev) => ({ ...prev, colIndex: prev.colIndex + 1 }));
        }
      } else if (e.key === "Escape") {
        setIsEditing(false);
        setEditValue(activeDisplayValue);
      }
      return;
    }

    // Ctrl+Z Undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Ctrl+Y Redo
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Ctrl+C Copy
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      e.preventDefault();
      handleCopy();
      return;
    }

    // Ctrl+X Cut
    if ((e.ctrlKey || e.metaKey) && e.key === "x") {
      e.preventDefault();
      handleCut();
      return;
    }

    // Ctrl+V Paste
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      handlePaste();
      return;
    }

    // Navigation mode
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (selectedCell.rowIndex > 0) {
        setSelectedCell((prev) => ({ ...prev, rowIndex: prev.rowIndex - 1 }));
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedCell.rowIndex < currentRows.length - 1) {
        setSelectedCell((prev) => ({ ...prev, rowIndex: prev.rowIndex + 1 }));
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (selectedCell.colIndex > 0) {
        setSelectedCell((prev) => ({ ...prev, colIndex: prev.colIndex - 1 }));
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (selectedCell.colIndex < currentColumns.length - 1) {
        setSelectedCell((prev) => ({ ...prev, colIndex: prev.colIndex + 1 }));
      }
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (!isReadOnly) {
        setIsEditing(true);
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (!isReadOnly) {
        commitValue("");
        setEditValue("");
      }
    }
  };

  // Add Row
  const handleAddRow = () => {
    if (isReadOnly) return;
    const newRow: Record<string, any> = {};
    currentColumns.forEach((c) => {
      newRow[c.name] = c.data_type === "number" ? 0 : "";
    });

    if (activeSheet === "source") {
      onSourceChange(sourceColumns, [...sourceRows, newRow]);
    } else if (activeSheet === "target") {
      onTargetChange(targetColumns, [...targetRows, newRow]);
    }

    setSelectedCell({ rowIndex: currentRows.length, colIndex: selectedCell.colIndex });
  };

  // Delete Current Row
  const handleDeleteCurrentRow = () => {
    if (isReadOnly || currentRows.length === 0) return;
    const updated = currentRows.filter((_, i) => i !== selectedCell.rowIndex);

    if (activeSheet === "source") {
      onSourceChange(sourceColumns, updated);
    } else if (activeSheet === "target") {
      onTargetChange(targetColumns, updated);
    }

    setSelectedCell((prev) => ({
      ...prev,
      rowIndex: Math.max(0, Math.min(prev.rowIndex, updated.length - 1)),
    }));
  };

  // Add Column
  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newColName.trim()) return;

    const colName = newColName.trim();
    if (currentColumns.some((c) => c.name.toLowerCase() === colName.toLowerCase())) {
      alert("Column already exists");
      return;
    }

    const updatedCols: ColumnDef[] = [
      ...currentColumns,
      {
        name: colName,
        data_type: newColType,
        is_metadata: newColIsMeta,
      },
    ];

    const updatedRows = currentRows.map((r) => ({
      ...r,
      [colName]: newColType === "number" ? 0 : "",
    }));

    if (activeSheet === "source") {
      onSourceChange(updatedCols, updatedRows);
    } else if (activeSheet === "target") {
      onTargetChange(updatedCols, updatedRows);
    }

    setNewColName("");
    setIsColDialogOpen(false);
  };

  // Sort Current Column
  const handleSortColumn = (direction: "asc" | "desc") => {
    if (isReadOnly || !activeColName) return;
    const sorted = [...currentRows].sort((a, b) => {
      const valA = a[activeColName];
      const valB = b[activeColName];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (direction === "asc") {
        return valA > valB ? 1 : -1;
      }
      return valA < valB ? 1 : -1;
    });

    if (activeSheet === "source") onSourceChange(sourceColumns, sorted);
    if (activeSheet === "target") onTargetChange(targetColumns, sorted);
  };

  // Upload Excel Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadSourceFile || !uploadTargetFile) return;
    setUploadSubmitting(true);
    try {
      await handleUpload(uploadSourceFile, uploadTargetFile);
      setUploadDialogOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploadSubmitting(false);
    }
  };

  // Dynamic statistics for active column
  const columnStats = useMemo(() => {
    if (!activeColName) return { count: 0, sum: 0, avg: 0, isNumeric: false };
    let count = 0;
    let sum = 0;
    let numCount = 0;

    currentRows.forEach((r) => {
      const val = r[activeColName];
      if (val !== null && val !== undefined && val !== "") {
        count++;
        const num = Number(val);
        if (!isNaN(num)) {
          sum += num;
          numCount++;
        }
      }
    });

    const isNumeric = numCount > 0 && numCount === count;
    const avg = numCount > 0 ? (sum / numCount).toFixed(2) : 0;
    return { count, sum: Math.round(sum * 100) / 100, avg, isNumeric };
  }, [currentRows, activeColName]);

  // Filter rows
  const filteredRows = currentRows.filter((row) => {
    if (!filterQuery.trim()) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  const filteredMappings = mappings.filter((m) =>
    m.target_column.toLowerCase().includes(drawerSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background select-none">
      {/* 1. EXCEL TOP TITLE & FULLY INTERACTIVE MENU BAR */}
      <div className="h-9 px-3 bg-muted/60 border-b border-border flex items-center justify-between gap-3 shrink-0 relative" ref={menuRef}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group font-medium">
            <Home className="size-3.5" />
            <span className="hidden sm:inline">Launchpad</span>
          </Link>

          <Separator orientation="vertical" className="h-4" />

          {/* Workbook Title */}
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="size-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-xs text-foreground tracking-tight truncate max-w-[200px]">
              {currentFilename}
            </span>
            <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono uppercase text-muted-foreground hidden sm:inline-block">
              {activeSheet === "result" ? "Output Sheet" : "Live Sheet"}
            </Badge>
          </div>

          {/* FULLY FUNCTIONAL EXCEL MENU ITEMS WITH DROPDOWNS */}
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground font-medium ml-1">
            {/* FILE MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "file" ? null : "file")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "file" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                File
              </button>
              {openMenu === "file" && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      setUploadDialogOpen(true);
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Open / Upload Excel Pair...</span>
                    <FolderOpen className="size-3.5 text-muted-foreground" />
                  </div>
                  <div
                    onClick={() => {
                      handleLoadMock("crm_contacts");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    Load Sample: CRM & Metadata
                  </div>
                  <div
                    onClick={() => {
                      handleLoadMock("ecommerce_catalog");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    Load Sample: E-Commerce Sync
                  </div>
                  <Separator className="my-1" />
                  <div
                    onClick={() => {
                      onExportExcel();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between font-medium"
                  >
                    <span>Export / Download .xlsx</span>
                    <Download className="size-3.5 text-emerald-400" />
                  </div>
                </div>
              )}
            </div>

            {/* EDIT MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "edit" ? null : "edit")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "edit" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                Edit
              </button>
              {openMenu === "edit" && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      handleUndo();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Undo</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Ctrl+Z</span>
                  </div>
                  <div
                    onClick={() => {
                      handleRedo();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Redo</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Ctrl+Y</span>
                  </div>
                  <Separator className="my-1" />
                  <div
                    onClick={() => {
                      handleCut();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Cut</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Ctrl+X</span>
                  </div>
                  <div
                    onClick={() => {
                      handleCopy();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Copy</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Ctrl+C</span>
                  </div>
                  <div
                    onClick={() => {
                      handlePaste();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Paste</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Ctrl+V</span>
                  </div>
                  <Separator className="my-1" />
                  <div
                    onClick={() => {
                      commitValue("");
                      setEditValue("");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between text-destructive"
                  >
                    <span>Clear Cell</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Del</span>
                  </div>
                  <div
                    onClick={() => {
                      handleDeleteCurrentRow();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer text-destructive"
                  >
                    Delete Row
                  </div>
                </div>
              )}
            </div>

            {/* VIEW MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "view" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                View
              </button>
              {openMenu === "view" && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      setActiveSheet("source");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Sheet 1: Source Data</span>
                    {activeSheet === "source" && <Check className="size-3 text-foreground" />}
                  </div>
                  <div
                    onClick={() => {
                      setActiveSheet("target");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Sheet 2: Target Template</span>
                    {activeSheet === "target" && <Check className="size-3 text-foreground" />}
                  </div>
                  <div
                    onClick={() => {
                      setActiveSheet("result");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between font-medium text-emerald-400"
                  >
                    <span>Sheet 3: Mapped Result</span>
                    {activeSheet === "result" && <Check className="size-3 text-emerald-400" />}
                  </div>
                  <Separator className="my-1" />
                  <div
                    onClick={() => {
                      setIsMappingDrawerOpen(!isMappingDrawerOpen);
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Toggle Mapping Drawer</span>
                    <SlidersHorizontal className="size-3 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* INSERT MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "insert" ? null : "insert")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "insert" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                Insert
              </button>
              {openMenu === "insert" && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      handleAddRow();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Insert Row Below</span>
                    <Plus className="size-3 text-muted-foreground" />
                  </div>
                  <div
                    onClick={() => {
                      setIsColDialogOpen(true);
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Insert Column Attribute...</span>
                    <Plus className="size-3 text-muted-foreground" />
                  </div>
                  <Separator className="my-1" />
                  <div
                    onClick={() => {
                      commitValue("=SUM(A1:A10)");
                      setEditValue("=SUM(A1:A10)");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    Insert =SUM(...) Formula
                  </div>
                </div>
              )}
            </div>

            {/* FORMAT MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "format" ? null : "format")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "format" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                Format
              </button>
              {openMenu === "format" && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      setIsBold(!isBold);
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Bold</span>
                    {isBold && <Check className="size-3" />}
                  </div>
                  <div
                    onClick={() => {
                      setIsItalic(!isItalic);
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Italic</span>
                    {isItalic && <Check className="size-3" />}
                  </div>
                  <Separator className="my-1" />
                  <div
                    onClick={() => {
                      handleFormatValue("currency");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    Format as Currency ($)
                  </div>
                  <div
                    onClick={() => {
                      handleFormatValue("percent");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    Format as Percentage (%)
                  </div>
                  <div
                    onClick={() => {
                      handleFormatValue("upper");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    Uppercase (UPPER)
                  </div>
                </div>
              )}
            </div>

            {/* DATA MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "data" ? null : "data")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "data" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                Data
              </button>
              {openMenu === "data" && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      handleSortColumn("asc");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Sort Column A to Z</span>
                    <ArrowDownAZ className="size-3 text-muted-foreground" />
                  </div>
                  <div
                    onClick={() => {
                      handleSortColumn("desc");
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Sort Column Z to A</span>
                    <ArrowUpAZ className="size-3 text-muted-foreground" />
                  </div>
                  <Separator className="my-1" />
                  <div
                    onClick={() => {
                      searchInputRef.current?.focus();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Search / Filter Sheet</span>
                    <Search className="size-3 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* AI MAPPING MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "ai" ? null : "ai")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "ai" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                AI Mapping
              </button>
              {openMenu === "ai" && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      handleTriggerAI();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between font-semibold"
                  >
                    <span>Auto-Match with AI</span>
                    <Sparkles className="size-3 text-amber-300" />
                  </div>
                  <div
                    onClick={() => {
                      setIsMappingDrawerOpen(true);
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between"
                  >
                    <span>Open Mapping Matrix</span>
                    <SlidersHorizontal className="size-3 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* EXPORT MENU */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "export" ? null : "export")}
                className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  openMenu === "export" ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-card hover:text-foreground"
                }`}
              >
                Export
              </button>
              {openMenu === "export" && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-xl py-1 z-50 text-xs text-foreground animate-in fade-in-50">
                  <div
                    onClick={() => {
                      onExportExcel();
                      setOpenMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-muted cursor-pointer flex items-center justify-between font-semibold text-emerald-400"
                  >
                    <span>Download Excel (.xlsx)</span>
                    <Download className="size-3.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Quick Dataset Switcher */}
          <div className="hidden xl:flex items-center gap-1 bg-card border border-border rounded p-0.5 text-[11px]">
            <span className="text-muted-foreground px-1.5 font-medium">Sample:</span>
            {mockSummaries.map((m) => (
              <Button
                key={m.id}
                variant={selectedMockId === m.id ? "default" : "ghost"}
                size="xs"
                onClick={() => handleLoadMock(m.id)}
                disabled={isLoading}
                className="text-[10px] h-5 px-1.5"
              >
                {m.id === "crm_contacts" ? "CRM" : "E-Com"}
              </Button>
            ))}
          </div>

          <AIConfigModal
            apiKeys={groqApiKeys}
            onSaveKeys={setGroqApiKeys}
            selectedModel={selectedModel}
            onSaveModel={setSelectedModel}
          />

          <Button
            size="xs"
            onClick={onExportExcel}
            disabled={exportLoading || !replicaData}
            className="gap-1.5 text-xs h-7 font-medium shadow-xs"
          >
            <Download className="size-3" />
            <span>Export (.xlsx)</span>
          </Button>
        </div>
      </div>

      {/* 2. EXCEL RIBBON & ACTION TOOLBAR (FULL EXCEL TOOLS) */}
      <div className="h-10 px-3 bg-card border-b border-border flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1">
          {/* PROMINENT AI MATCH BUTTON */}
          <Button
            size="xs"
            onClick={handleTriggerAI}
            disabled={aiLoading || sourceColumns.length === 0}
            className="gap-1.5 text-xs h-7.5 font-semibold shadow-xs bg-foreground text-background hover:bg-foreground/90 shrink-0"
          >
            <Sparkles className={`size-3 ${aiLoading ? "animate-spin text-foreground" : "text-amber-300"}`} />
            <span>{aiLoading ? "AI Analyzing..." : "Auto-Match with AI"}</span>
          </Button>

          {/* MAPPING SETTINGS DRAWER BUTTON */}
          <Button
            variant={isMappingDrawerOpen ? "default" : "outline"}
            size="xs"
            onClick={() => setIsMappingDrawerOpen(!isMappingDrawerOpen)}
            className="gap-1.5 text-xs h-7.5 shrink-0 font-medium"
          >
            <SlidersHorizontal className="size-3" />
            <span>Mapping Settings</span>
            <span className="text-[9px] px-1 py-0.2 bg-muted text-muted-foreground rounded font-mono font-semibold">
              {mappingStats.mapped}/{mappingStats.total}
            </span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="size-3" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="size-3" />
            </button>
          </div>

          {/* Cut / Copy / Paste */}
          <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
            <button
              type="button"
              onClick={handleCut}
              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              title="Cut (Ctrl+X)"
            >
              <Scissors className="size-3" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              title="Copy (Ctrl+C)"
            >
              <Copy className="size-3" />
            </button>
            <button
              type="button"
              onClick={handlePaste}
              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              title="Paste (Ctrl+V)"
            >
              <ClipboardPaste className="size-3" />
            </button>
          </div>

          {/* Formatting Controls */}
          <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
            <button
              type="button"
              onClick={() => setIsBold(!isBold)}
              className={`size-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                isBold ? "bg-accent text-accent-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Bold (Ctrl+B)"
            >
              <Bold className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsItalic(!isItalic)}
              className={`size-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                isItalic ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Italic (Ctrl+I)"
            >
              <Italic className="size-3" />
            </button>
          </div>

          {/* Alignment Controls */}
          <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded border border-border">
            <button
              type="button"
              onClick={() => setCellAlignment("left")}
              className={`size-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                cellAlignment === "left" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Align Left"
            >
              <AlignLeft className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setCellAlignment("center")}
              className={`size-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                cellAlignment === "center" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Align Center"
            >
              <AlignCenter className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setCellAlignment("right")}
              className={`size-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                cellAlignment === "right" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Align Right"
            >
              <AlignRight className="size-3" />
            </button>
          </div>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Sheet Row / Column Actions */}
          {!isReadOnly && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={handleAddRow}
                className="gap-1 text-xs h-7.5 hover:bg-muted"
                title="Add new data row"
              >
                <Plus className="size-3" />
                <span>+ Row</span>
              </Button>

              <Dialog open={isColDialogOpen} onOpenChange={setIsColDialogOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="xs"
                      className="gap-1 text-xs h-7.5 hover:bg-muted"
                      title="Add new attribute column"
                    >
                      <Plus className="size-3" />
                      <span>+ Column</span>
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Column Attribute</DialogTitle>
                    <DialogDescription>
                      Define a new data or metadata column in {activeSheet === "source" ? "Source" : "Target"} sheet.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleAddColumn} className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ribbon-col-name">Attribute Name</Label>
                      <Input
                        id="ribbon-col-name"
                        placeholder="e.g. meta_sync_status or revenue"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ribbon-col-type">Data Type</Label>
                      <select
                        id="ribbon-col-type"
                        value={newColType}
                        onChange={(e) => setNewColType(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none"
                      >
                        <option value="string">String (Text)</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="ribbon-col-meta"
                        type="checkbox"
                        checked={newColIsMeta}
                        onChange={(e) => setNewColIsMeta(e.target.checked)}
                        className="rounded border-input text-foreground size-4 cursor-pointer"
                      />
                      <Label htmlFor="ribbon-col-meta" className="text-xs cursor-pointer">
                        Mark as Metadata Attribute (Governance / Audit tag)
                      </Label>
                    </div>

                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" type="button">Cancel</Button>} />
                      <Button type="submit">Create Attribute</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Button
                variant="ghost"
                size="xs"
                onClick={handleDeleteCurrentRow}
                disabled={currentRows.length === 0}
                className="gap-1 text-xs h-7.5 text-destructive hover:bg-destructive/10"
                title="Delete active row"
              >
                <Trash2 className="size-3" />
                <span>Delete Row</span>
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleSortColumn("asc")}
                className="gap-1 text-xs h-7.5 hover:bg-muted"
                title="Sort Column A to Z"
              >
                <ArrowDownAZ className="size-3" />
                <span>Sort A-Z</span>
              </Button>
            </div>
          )}
        </div>

        {/* Search Field */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search sheet..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-7.5 w-36 pl-7 pr-2 bg-muted/40 border border-input rounded text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
            />
          </div>
        </div>
      </div>

      {/* AI Success Notification Banner */}
      {aiSuccessBanner && (
        <div className="bg-foreground text-background px-4 py-1.5 text-xs flex items-center justify-between gap-2 shadow-md animate-in slide-in-from-top-1 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold">AI Schema Mapping Complete!</span>
            <span className="opacity-80">Matched {mappingStats.mapped} of {mappingStats.total} attributes.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveSheet("result");
              setAiSuccessBanner(false);
            }}
            className="underline text-xs font-semibold cursor-pointer"
          >
            View Mapped Result (Sheet 3) →
          </button>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="bg-destructive/15 text-destructive border-b border-destructive/20 px-4 py-1.5 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <X className="size-3.5 shrink-0" />
            <span className="font-semibold">Notice:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* 3. EXCEL FORMULA BAR & NAME BOX */}
      <div className="h-8 px-3 bg-muted/20 border-b border-border flex items-center gap-2 shrink-0">
        {/* Name Box (e.g. A1, B3) */}
        <div className="w-16 h-6 px-2 bg-card border border-border rounded flex items-center justify-center font-mono text-xs text-foreground font-semibold shrink-0 select-none shadow-2xs">
          {activeCellCoord}
        </div>

        {/* Function Icon */}
        <span className="font-serif italic font-bold text-muted-foreground text-xs select-none px-1">
          fx
        </span>

        <Separator orientation="vertical" className="h-4" />

        {/* Live Formula / Cell Input */}
        <input
          type="text"
          disabled={isReadOnly}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            commitValue(e.target.value);
          }}
          placeholder={isReadOnly ? "Read-only replicated output cell" : "Enter value or formula (e.g. =SUM(A1:A5))..."}
          className="flex-1 h-6 px-2 bg-transparent text-xs text-foreground font-mono outline-none placeholder:text-muted-foreground/50 disabled:opacity-75"
        />
      </div>

      {/* 4. EXCEL SPREADSHEET GRID (100% REMAINING VIEWPORT SPACE) */}
      <div
        className="flex-1 overflow-auto bg-card relative select-none focus:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        ref={gridContainerRef}
      >
        {transformLoading && activeSheet === "result" ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            <RefreshCw className="size-4 animate-spin mr-2 text-foreground" />
            <span>Recalculating mapped dataset with transformation engine...</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-left font-mono text-xs">
            {/* Sticky Column Headers Row */}
            <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-md shadow-xs">
              <tr className="border-b border-border">
                {/* Row Index Top-Left Corner */}
                <th className="sticky left-0 z-30 w-12 px-2 py-2 border-r border-b border-border text-center text-[10px] text-muted-foreground font-semibold bg-muted/95 select-none">
                  #
                </th>
                {currentColumns.map((col, cIdx) => {
                  const isColSelected = selectedCell.colIndex === cIdx;
                  const matchedSrc = activeSheet === "result" ? userOverrides[col.name] : null;

                  return (
                    <th
                      key={col.name}
                      onClick={() =>
                        setSelectedCell({ rowIndex: selectedCell.rowIndex, colIndex: cIdx })
                      }
                      className={`px-3 py-1.5 border-r border-border min-w-[160px] cursor-pointer transition-colors ${
                        isColSelected ? "bg-accent/70 text-accent-foreground" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-bold font-mono">
                            {getColLetter(cIdx)}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-sans font-semibold text-xs text-foreground truncate max-w-[130px]">
                              {col.name}
                            </span>
                            {activeSheet === "result" && (
                              <span className="text-[9px] text-muted-foreground font-sans font-normal truncate max-w-[130px]">
                                {matchedSrc ? `← ${matchedSrc}` : `[Default: ${defaultValues[col.name] || "None"}]`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {col.is_metadata && (
                            <span className="px-1 py-0.2 bg-muted text-muted-foreground text-[9px] rounded font-sans">
                              META
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground font-mono font-normal">
                            ({col.data_type})
                          </span>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Data Rows */}
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={currentColumns.length + 1}
                    className="py-32 text-center text-xs text-muted-foreground font-sans"
                  >
                    {activeSheet === "result"
                      ? "No mapped records generated yet. Configure column mappings in Mapping Settings."
                      : "No records in this sheet. Click '+ Row' in the toolbar to add data."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rIdx) => {
                  const isRowSelected = selectedCell.rowIndex === rIdx;
                  return (
                    <tr
                      key={rIdx}
                      className={`border-b border-border/70 h-8.5 transition-colors ${
                        isRowSelected ? "bg-muted/10" : "hover:bg-muted/20"
                      }`}
                    >
                      {/* Sticky Row Index Column */}
                      <td
                        onClick={() =>
                          setSelectedCell({ rowIndex: rIdx, colIndex: selectedCell.colIndex })
                        }
                        className={`sticky left-0 z-10 w-12 px-2 py-1 border-r border-border text-center text-[10px] select-none cursor-pointer transition-colors ${
                          isRowSelected
                            ? "bg-accent text-accent-foreground font-bold"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {rIdx + 1}
                      </td>

                      {/* Data Cells */}
                      {currentColumns.map((col, cIdx) => {
                        const isCellSelected =
                          selectedCell.rowIndex === rIdx &&
                          selectedCell.colIndex === cIdx;
                        const cellVal = row[col.name];

                        return (
                          <td
                            key={col.name}
                            onClick={() => {
                              setSelectedCell({ rowIndex: rIdx, colIndex: cIdx });
                              if (isCellSelected && !isReadOnly) {
                                setIsEditing(true);
                              }
                            }}
                            onDoubleClick={() => {
                              if (!isReadOnly) {
                                setSelectedCell({ rowIndex: rIdx, colIndex: cIdx });
                                setIsEditing(true);
                              }
                            }}
                            className={`relative px-3 py-1 border-r border-border/70 whitespace-nowrap cursor-cell transition-all h-8.5 ${
                              cellAlignment === "center"
                                ? "text-center"
                                : cellAlignment === "right"
                                ? "text-right"
                                : "text-left"
                            } ${isBold ? "font-bold" : ""} ${isItalic ? "italic" : ""} ${
                              isCellSelected
                                ? "outline-2 outline-foreground outline-offset-[-2px] bg-accent/20 z-10"
                                : "hover:bg-muted/30"
                            }`}
                          >
                            {isCellSelected && isEditing && !isReadOnly ? (
                              <input
                                ref={cellInputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => {
                                  commitValue(editValue);
                                  setIsEditing(false);
                                }}
                                className="absolute inset-0 w-full h-full px-3 py-1 bg-background text-xs text-foreground font-mono outline-2 outline-foreground z-20"
                              />
                            ) : cellVal !== null && cellVal !== undefined && cellVal !== "" ? (
                              <span className="text-foreground">{String(cellVal)}</span>
                            ) : (
                              <span className="text-muted-foreground/30 italic">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. BOTTOM 3-SHEET TABS & STATUS BAR (EXTREME BOTTOM OF WINDOW) */}
      <div className="h-9 px-3 bg-muted/80 border-t border-border flex items-center justify-between gap-3 shrink-0 w-full z-20">
        {/* Real Excel 3-Sheet Tabs Bar */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Sheet 1 Button */}
          <button
            type="button"
            onClick={() => setActiveSheet("source")}
            className={`px-3 py-1 rounded-t text-xs font-medium flex items-center gap-1.5 border-t-2 transition-colors cursor-pointer shrink-0 ${
              activeSheet === "source"
                ? "bg-card text-foreground border-foreground shadow-xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
            }`}
          >
            <Database className="size-3 text-muted-foreground" />
            <span>Sheet 1: Source Data (File 1)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-muted rounded text-muted-foreground">
              {sourceRows.length} rows
            </span>
          </button>

          {/* Sheet 2 Button */}
          <button
            type="button"
            onClick={() => setActiveSheet("target")}
            className={`px-3 py-1 rounded-t text-xs font-medium flex items-center gap-1.5 border-t-2 transition-colors cursor-pointer shrink-0 ${
              activeSheet === "target"
                ? "bg-card text-foreground border-foreground shadow-xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
            }`}
          >
            <Layers className="size-3 text-muted-foreground" />
            <span>Sheet 2: Target Template (File 2)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-muted rounded text-muted-foreground">
              {targetColumns.length} cols
            </span>
          </button>

          {/* Sheet 3 Button: Mapped Output Result */}
          <button
            type="button"
            onClick={() => setActiveSheet("result")}
            className={`px-3 py-1 rounded-t text-xs font-medium flex items-center gap-1.5 border-t-2 transition-colors cursor-pointer shrink-0 ${
              activeSheet === "result"
                ? "bg-card text-foreground border-emerald-400 shadow-xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
            }`}
          >
            <FileCheck2 className="size-3 text-emerald-400" />
            <span className="font-semibold text-emerald-300">Sheet 3: Mapped Result</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
              {replicaData ? `${replicaData.row_count} rows` : "Ready"}
            </span>
          </button>
        </div>

        {/* Excel Status Bar (Right Dynamic Metrics) */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>READY</span>
          </div>

          {columnStats.isNumeric && (
            <>
              <span>Sum: {columnStats.sum}</span>
              <span>Avg: {columnStats.avg}</span>
            </>
          )}
          <span>Count: {columnStats.count}</span>
          <span>Cell: {activeCellCoord}</span>
          <span>100%</span>
        </div>
      </div>

      {/* 6. SLIDE-OVER MAPPING SETTINGS DRAWER WITH BACKDROP */}
      {isMappingDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMappingDrawerOpen(false)}
          />

          {/* Slide-Over Side Drawer */}
          <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between gap-2 bg-muted/20">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-foreground" />
                  <h3 className="font-semibold text-sm text-foreground">
                    Attribute Mapping Settings
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Review AI mappings, confidence scores, and fine-tune source attributes.
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsMappingDrawerOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Custom AI Prompt / Special Instructions Section */}
            <div className="p-3.5 bg-muted/30 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Sparkles className="size-3.5 text-amber-300" />
                  <span>Special Instructions & AI Prompt</span>
                </div>
                {aiCustomPrompt && (
                  <button
                    type="button"
                    onClick={() => setAiCustomPrompt("")}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Clear prompt
                  </button>
                )}
              </div>

              <textarea
                value={aiCustomPrompt}
                onChange={(e) => setAiCustomPrompt(e.target.value)}
                placeholder="e.g. Map 'Phone' to 'Mobile_Num', treat 'Status' as 'Active', prioritize metadata fields with prefix 'meta_'..."
                rows={2}
                className="w-full text-xs p-2 rounded-md bg-card border border-input text-foreground placeholder:text-muted-foreground outline-none focus:border-ring resize-none font-sans"
              />

              {/* Quick Prompt Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    const addition = "Map audit and metadata attributes strictly.";
                    setAiCustomPrompt(aiCustomPrompt ? `${aiCustomPrompt} ${addition}` : addition);
                  }}
                  className="text-[10px] px-2 py-0.5 bg-card hover:bg-muted border border-border rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  Strict Metadata
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const addition = "Set default fallback value for status to 'Active'.";
                    setAiCustomPrompt(aiCustomPrompt ? `${aiCustomPrompt} ${addition}` : addition);
                  }}
                  className="text-[10px] px-2 py-0.5 bg-card hover:bg-muted border border-border rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  Status: Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const addition = "Format currency columns as USD.";
                    setAiCustomPrompt(aiCustomPrompt ? `${aiCustomPrompt} ${addition}` : addition);
                  }}
                  className="text-[10px] px-2 py-0.5 bg-card hover:bg-muted border border-border rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  Currency: USD
                </button>
              </div>

              <Button
                size="xs"
                onClick={handleTriggerAI}
                disabled={aiLoading || sourceColumns.length === 0}
                className="w-full gap-1.5 text-xs h-7.5 font-medium shadow-xs mt-1"
              >
                <Sparkles className={`size-3 ${aiLoading ? "animate-spin" : "text-amber-300"}`} />
                <span>{aiLoading ? "Analyzing with Instructions..." : "Run AI Match with Instructions"}</span>
              </Button>
            </div>

            {/* Quick Summary Stats */}
            <div className="p-3 bg-muted/20 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {mappingStats.mapped} / {mappingStats.total} Mapped
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  ({mappingStats.percentage}% coverage)
                </span>
              </div>

              <span className="text-[11px] text-muted-foreground font-mono">
                {mappingStats.metadataCount} Metadata fields
              </span>
            </div>

            {/* AI Reasoning Summary */}
            {aiReasoningSummary && (
              <div className="p-3 bg-muted/20 border-b border-border text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="size-3 text-foreground" />
                  <span>AI Reasoning Summary</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {aiReasoningSummary}
                </p>
              </div>
            )}

            {/* Search Filter in Drawer */}
            <div className="p-3 border-b border-border bg-card">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter target attributes..."
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  className="h-8 w-full pl-8 pr-2.5 bg-muted/30 border border-input rounded text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
                />
              </div>
            </div>

            {/* Mappings List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {filteredMappings.map((m) => {
                const currentSource = userOverrides[m.target_column];
                const isHigh = m.confidence_pct >= 85;
                const targetColMeta = targetColumns.find(
                  (tc) => tc.name === m.target_column
                );

                return (
                  <div
                    key={m.target_column}
                    className="p-3 bg-muted/20 hover:bg-muted/35 border border-border rounded-lg space-y-2.5 transition-colors shadow-2xs"
                  >
                    {/* Target Column Info */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {m.target_column}
                        </span>
                        {targetColMeta?.is_metadata && (
                          <span className="px-1.5 py-0.2 bg-muted text-muted-foreground text-[9px] rounded font-mono font-medium">
                            META
                          </span>
                        )}
                      </div>

                      {currentSource ? (
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-muted rounded text-muted-foreground shrink-0 flex items-center gap-1">
                          {isHigh && <CheckCircle2 className="size-3 text-emerald-400" />}
                          {m.confidence_pct}% Match
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-muted text-muted-foreground rounded shrink-0">
                          Unmapped
                        </span>
                      )}
                    </div>

                    {/* AI Reasoning snippet if available */}
                    {m.ai_reasoning && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                        {m.ai_reasoning}
                      </p>
                    )}

                    {/* Dropdown Selector */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                        Source Attribute (File 1)
                      </Label>
                      <CustomMappingSelect
                        value={currentSource}
                        onChange={(val) => onMappingChange(m.target_column, val)}
                        options={sourceColumns}
                        candidates={m.candidates}
                      />
                    </div>

                    {/* Default Fallback Value */}
                    {!currentSource && (
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                          Default Fallback Value
                        </Label>
                        <Input
                          placeholder="e.g. Active / USD / N/A"
                          value={defaultValues[m.target_column] || ""}
                          onChange={(e) =>
                            onDefaultValueChange(m.target_column, e.target.value)
                          }
                          className="text-xs h-8 bg-card"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMappingDrawerOpen(false)}
                className="text-xs h-8"
              >
                Close
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setActiveSheet("result");
                  setIsMappingDrawerOpen(false);
                }}
                className="gap-1.5 text-xs h-8 font-medium shadow-xs"
              >
                <FileCheck2 className="size-3.5 text-emerald-400" />
                <span>View Sheet 3 (Mapped Result)</span>
              </Button>
            </div>
          </aside>
        </>
      )}

      {/* UPLOAD MODAL TRIGGERED FROM FILE MENU */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Open & Upload Two Excel Files</DialogTitle>
            <DialogDescription>
              Upload File 1 (Source Dataset) and File 2 (Target Template Schema).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4 py-3">
            <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-2">
              <Label htmlFor="menu-source-file" className="text-xs font-semibold">
                File 1: Source Dataset (.xlsx, .xls, .csv)
              </Label>
              <Input
                id="menu-source-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
                onChange={(e) => setUploadSourceFile(e.target.files?.[0] || null)}
                className="text-xs bg-card cursor-pointer"
              />
            </div>

            <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-2">
              <Label htmlFor="menu-target-file" className="text-xs font-semibold">
                File 2: Target Template Schema (.xlsx, .xls, .csv)
              </Label>
              <Input
                id="menu-target-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
                onChange={(e) => setUploadTargetFile(e.target.files?.[0] || null)}
                className="text-xs bg-card cursor-pointer"
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button">Cancel</Button>} />
              <Button type="submit" disabled={uploadSubmitting || !uploadSourceFile || !uploadTargetFile}>
                {uploadSubmitting ? "Loading Files..." : "Load into Studio"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
