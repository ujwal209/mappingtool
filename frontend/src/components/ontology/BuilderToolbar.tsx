"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Network, TableProperties, Share2, Plus, Save, PanelRightOpen,
  ZoomIn, ZoomOut, Maximize, RotateCcw, Trash2, CheckCircle2,
  ChevronsDownUp, ChevronsUpDown, MousePointer2, Hand, Search,
} from "lucide-react";
import { OntologyState } from "./useOntologyState";

export function FloatingToolbars({ s }: { s: OntologyState }) {
  const ont = s.selectedOntology;
  if (!ont) return null;

  return (
    <>
      <TopBar s={s} />
      {s.activeTab === "graph" && <BottomToolbar s={s} />}
      {s.activeTab === "graph" && s.selectedEntityIds.size > 0 && (
        <MobileDeleteBar s={s} />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Combined top bar: stacks on mobile, single row on desktop
// ────────────────────────────────────────────────────────────
function TopBar({ s }: { s: OntologyState }) {
  const ont = s.selectedOntology!;

  return (
    <div
      data-toolbar
      className="absolute top-2 sm:top-3 left-2 right-2 sm:left-3 sm:right-3 z-30 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-0 pointer-events-none"
    >
      {/* ── Left group (identity + tabs + search + add) ───── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 min-w-0 pointer-events-auto">
        {/* Row 1 on mobile: identity + save + copilot */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Identity pill */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg px-1.5 py-1 min-w-0">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
              title="Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={s.handleBackToRegistry}
              className="hidden sm:inline-block px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
              title="All Models"
            >
              Models
            </button>
            <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5 shrink-0" />
            <div className="flex items-center gap-1.5 px-1 min-w-0">
              <h2 className="text-[11px] font-bold text-slate-900 truncate max-w-[100px] sm:max-w-[140px]">
                {ont.name}
              </h2>
              <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200 shrink-0">
                v{ont.version_tag}
              </span>
            </div>
          </div>

          {/* Mobile-only compact save + copilot (right of name) */}
          <div className="sm:hidden flex items-center gap-1 ml-auto shrink-0">
            {s.saveSuccessMsg && (
              <span className="inline-flex items-center px-1.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
              </span>
            )}
            <button
              disabled={s.savingOntology}
              onClick={s.handleSaveFullOntology}
              className="p-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-lg"
              title="Save"
            >
              <Save className={`w-3.5 h-3.5 ${s.savingOntology ? "animate-spin" : ""}`} />
            </button>
            {!s.isAgentOpen && (
              <button
                onClick={() => s.setIsAgentOpen(true)}
                className="p-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-lg"
                title="Open Copilot"
              >
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={16}
                  height={16}
                  className="w-3.5 h-3.5 object-contain rounded"
                />
              </button>
            )}
          </div>
        </div>

        {/* Row 2 on mobile: tabs + search + add (horizontally scrollable) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-1 shrink-0">
            <TabBtn
              active={s.activeTab === "graph"}
              onClick={() => s.setActiveTab("graph")}
              icon={Network}
              label="Canvas"
              count={ont.entities?.length || 0}
            />
            <TabBtn
              active={s.activeTab === "table"}
              onClick={() => s.setActiveTab("table")}
              icon={TableProperties}
              label="Tables"
            />
            <TabBtn
              active={s.activeTab === "relationships"}
              onClick={() => s.setActiveTab("relationships")}
              icon={Share2}
              label="Relations"
              count={ont.relationships?.length || 0}
            />
          </div>

          {/* Search trigger */}
          <button
            onClick={() => s.setCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold shrink-0"
            title="Search everything (Ctrl/Cmd+K, or /)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden lg:inline-block text-[9px] font-mono px-1 py-0 rounded border border-slate-200 bg-slate-50 text-slate-500">
              ⌘K
            </kbd>
          </button>

          {/* Add buttons */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-1 shrink-0">
            <button
              onClick={s.openAddEntity}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
              title="Add Entity"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden md:inline">Entity</span>
            </button>
            <button
              onClick={s.openAddRelationship}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold"
              title="Add Relationship"
            >
              <Share2 className="w-3 h-3" />
              <span className="hidden md:inline">Relation</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Right group (desktop only: delete-selected + save + copilot) ── */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0 pointer-events-auto">
        {s.selectedEntityIds.size > 0 && (
          <button
            onClick={s.deleteSelectedEntities}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 shadow-lg"
            title="Delete selected"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete ({s.selectedEntityIds.size})</span>
          </button>
        )}

        <button
          disabled={s.savingOntology}
          onClick={s.handleSaveFullOntology}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-lg"
          title="Save Ontology"
        >
          <Save className={`w-3.5 h-3.5 ${s.savingOntology ? "animate-spin" : ""}`} />
          <span>{s.savingOntology ? "Saving" : "Save"}</span>
        </button>

        {s.saveSuccessMsg && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold shadow">
            <CheckCircle2 className="w-3 h-3" />
            <span>Saved</span>
          </span>
        )}

        {!s.isAgentOpen && (
          <button
            onClick={() => s.setIsAgentOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 shadow-lg"
            title="Open Copilot"
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={16}
              height={16}
              className="w-4 h-4 object-contain rounded"
            />
            <span>Copilot</span>
            <PanelRightOpen className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Bottom toolbar — compact on mobile
// ────────────────────────────────────────────────────────────
function BottomToolbar({ s }: { s: OntologyState }) {
  const entityCount = s.selectedOntology?.entities?.length || 0;
  const canToggleCollapse = entityCount > 0;

  return (
    <div
      data-toolbar
      className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 sm:gap-2 pointer-events-none"
    >
      {/* Tool toggle */}
      <div className="pointer-events-auto flex items-center gap-0.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-1">
        <button
          onClick={() => s.setActiveTool("select")}
          className={`p-1.5 rounded-lg transition ${
            s.activeTool === "select" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
          title="Select tool (V)"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => s.setActiveTool("pan")}
          className={`p-1.5 rounded-lg transition ${
            s.activeTool === "pan" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
          title="Hand tool (H)"
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom + layout */}
      <div className="pointer-events-auto flex items-center gap-0.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-1">
        <button
          onClick={() => s.setZoomLevel((z: number) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
          className="hidden xs:inline-flex sm:inline-flex p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          title="Zoom Out (Ctrl/Cmd -)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            s.setZoomLevel(1);
            s.setPanOffset({ x: 0, y: 0 });
          }}
          className="text-[10px] font-mono px-1 sm:px-1.5 min-w-[36px] sm:min-w-[42px] text-center text-slate-700 hover:bg-slate-100 rounded py-1"
          title="Reset Zoom (Ctrl/Cmd 0)"
        >
          {Math.round(s.zoomLevel * 100)}%
        </button>
        <button
          onClick={() => s.setZoomLevel((z: number) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
          className="hidden xs:inline-flex sm:inline-flex p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          title="Zoom In (Ctrl/Cmd +)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="hidden sm:block w-px h-4 bg-slate-200 mx-0.5" />
        <button
          onClick={s.focusViewOnAll}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          title="Fit all (F)"
        >
          <Maximize className="w-4 h-4" />
        </button>
        <button
          onClick={s.handleAutoLayout}
          className="hidden xs:inline-flex sm:inline-flex p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          title="Auto-layout"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={s.toggleCollapseAllEntities}
          disabled={!canToggleCollapse}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          title={
            canToggleCollapse
              ? s.allEntitiesCollapsed
                ? "Expand all (C)"
                : "Collapse all (C)"
              : "No entities"
          }
        >
          {s.allEntitiesCollapsed ? (
            <ChevronsUpDown className="w-4 h-4" />
          ) : (
            <ChevronsDownUp className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Mobile-only floating delete bar (above bottom toolbar)
// ────────────────────────────────────────────────────────────
function MobileDeleteBar({ s }: { s: OntologyState }) {
  if (s.selectedEntityIds.size === 0) return null;
  return (
    <div
      data-toolbar
      className="sm:hidden absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-2 py-1.5 rounded-full bg-slate-900 text-white shadow-xl pointer-events-auto"
    >
      <span className="text-[11px] font-semibold whitespace-nowrap pl-1">
        {s.selectedEntityIds.size} selected
      </span>
      <button
        onClick={s.deleteSelectedEntities}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700"
      >
        <Trash2 className="w-3 h-3" />
        Delete
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab button — icon-only on mobile, label on ≥sm
// ────────────────────────────────────────────────────────────
function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
        active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon className="w-3 h-3" />
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && (
        <span
          className={`text-[9px] px-1 py-0 rounded-full font-mono ${
            active ? "bg-white/20" : "bg-slate-100"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}