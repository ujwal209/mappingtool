"use client";

import {
  Link2,
  SlidersHorizontal,
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { OntologyEntity } from "@/lib/api-client";
import { getCategoryStyle, NodePosition } from "./types";

interface Props {
  entity: OntologyEntity;
  pos: NodePosition;
  isSelected: boolean;
  isConnecting: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onConnect: () => void;
  onInspect: () => void;
  onAddAttribute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditAttribute: (attr: any) => void;
  onDeleteAttribute: (attrId: string) => void;
}

export function EntityCard({
  entity,
  pos,
  isSelected,
  isConnecting,
  isCollapsed,
  onToggleCollapse,
  onMouseDown,
  onConnect,
  onInspect,
  onAddAttribute,
  onEdit,
  onDelete,
  onEditAttribute,
  onDeleteAttribute,
}: Props) {
  const style = getCategoryStyle(entity.category);
  const attrCount = entity.attributes?.length || 0;

  const selectionRing = isSelected ? "ring-2 ring-blue-500 shadow-lg" : "";
  const connectRing = isConnecting ? "ring-2 ring-emerald-500" : "";

  // ==================================================================
  // COLLAPSED — compact pill, width fits content
  // ==================================================================
  if (isCollapsed) {
    return (
      <div
        data-entity-card
        data-entity-id={entity.entity_id}
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          width: "max-content",
        }}
        onMouseDown={onMouseDown}
        className={`absolute rounded-lg border bg-white shadow-sm z-10 select-none cursor-grab active:cursor-grabbing transition-shadow ${selectionRing} ${connectRing} ${
          !isSelected && !isConnecting ? `${style.border} hover:shadow-md` : ""
        }`}
      >
        <div className={`flex items-center gap-1 px-1.5 py-1 rounded-lg ${style.headerBg}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white/70 shrink-0"
            title="Expand"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.accentDot}`} />
          <span className="font-bold text-[11px] text-slate-900 whitespace-nowrap">
            {entity.name}
          </span>
          <span className="text-[9px] font-mono px-1 rounded bg-white/70 text-slate-600 border border-slate-200 shrink-0">
            {attrCount}
          </span>
        </div>
      </div>
    );
  }

  // ==================================================================
  // EXPANDED — full card
  // ==================================================================
  return (
    <div
      data-entity-card
      data-entity-id={entity.entity_id}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      onMouseDown={onMouseDown}
      className={`absolute w-80 rounded-xl border bg-white shadow-sm transition-shadow z-10 select-none cursor-grab active:cursor-grabbing ${selectionRing} ${connectRing} ${
        !isSelected && !isConnecting ? `${style.border} hover:shadow-md` : ""
      }`}
    >
      {/* Header */}
      <div
        className={`px-3 py-2 rounded-t-xl border-b flex items-center justify-between gap-2 ${style.headerBg}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white/70 transition shrink-0"
            title="Collapse"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className={`w-2 h-2 rounded-full shrink-0 ${style.accentDot}`} />
          <div className="truncate min-w-0">
            <span
              className={`text-[9px] font-bold uppercase tracking-wider block ${style.badgeText}`}
            >
              {entity.category || "Master Data"}
            </span>
            <h4 className="font-bold text-xs text-slate-900 truncate">
              {entity.name}
            </h4>
          </div>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <IconBtn onClick={onConnect} active={isConnecting} title="Connect to entity">
            <Link2 className="w-3 h-3" />
          </IconBtn>
          <IconBtn onClick={onInspect} title="Inspect">
            <SlidersHorizontal className="w-3 h-3" />
          </IconBtn>
          <IconBtn onClick={onAddAttribute} title="Add Attribute">
            <Plus className="w-3 h-3" />
          </IconBtn>
          <IconBtn onClick={onEdit} title="Edit Entity">
            <Edit2 className="w-3 h-3" />
          </IconBtn>
          <IconBtn onClick={onDelete} title="Delete" danger>
            <Trash2 className="w-3 h-3" />
          </IconBtn>
        </div>
      </div>

      {/* Description */}
      {entity.description && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          className="px-3 py-1.5 bg-slate-50/70 border-b border-slate-100 text-[10px] text-slate-600 hover:bg-slate-100/70 cursor-pointer flex items-start gap-1"
        >
          <Sparkles className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
          <span className="line-clamp-2 leading-snug">{entity.description}</span>
        </div>
      )}

      {/* Attributes */}
      <div className="p-2 space-y-0.5 text-xs max-h-56 overflow-y-auto">
        {attrCount === 0 ? (
          <div className="py-3 text-center text-[10px] text-slate-400">
            No attributes yet. Click + to add.
          </div>
        ) : (
          entity.attributes.map((attr) => (
            <div
              key={attr.attribute_id}
              onClick={(e) => {
                e.stopPropagation();
                onEditAttribute(attr);
              }}
              className="group flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                <span className="font-mono text-slate-800 font-medium truncate">
                  {attr.name}
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="font-mono text-[10px] text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded">
                  {attr.datatype || "string"}
                </span>
                {!attr.is_nullable && (
                  <span
                    className="text-[9px] font-bold text-slate-500"
                    title="Not Nullable"
                  >
                    NN
                  </span>
                )}
                <button
                  onClick={() => onDeleteAttribute(attr.attribute_id)}
                  className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-0.5"
                  title="Delete attribute"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-1.5 border-t border-slate-100 bg-slate-50/60 rounded-b-xl flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddAttribute();
          }}
          className="flex-1 py-1 px-2 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-white border border-dashed border-slate-200 flex items-center justify-center gap-1"
        >
          <Plus className="w-3 h-3" /> <span>+ Field</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          className="py-1 px-2 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200"
        >
          Inspect
        </button>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, active, danger }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded text-slate-500 transition ${
        active
          ? "bg-emerald-600 text-white"
          : danger
          ? "hover:text-red-600 hover:bg-white/80"
          : "hover:text-slate-900 hover:bg-white/80"
      }`}
    >
      {children}
    </button>
  );
}