"use client";

import { useEffect, useRef, useState } from "react";
import { Network, Plus, Trash2, X } from "lucide-react";
import { EntityCard } from "./EntityCard";
import { OntologyState } from "./useOntologyState";

const CARD_W_EXPANDED = 320;
const CARD_HEADER_H = 52;

function collapsedCardWidth(name: string): number {
  return Math.max(120, Math.min(220, 20 + name.length * 7 + 50));
}

function getCardWidth(entity: any, collapsed: boolean): number {
  if (!entity) return CARD_W_EXPANDED;
  return collapsed ? collapsedCardWidth(entity.name) : CARD_W_EXPANDED;
}

export function CanvasView({ s }: { s: OntologyState }) {
  const ont = s.selectedOntology;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Wheel zoom + keyboard shortcuts
  useEffect(() => {
    const canvas = s.canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      s.setZoomLevel((z: number) =>
        Math.min(2.5, Math.max(0.4, +(z + delta).toFixed(2)))
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (!(e.ctrlKey || e.metaKey)) {
        if (e.key === "v" || e.key === "V") {
          s.setActiveTool("select");
          return;
        }
        if (e.key === "h" || e.key === "H") {
          s.setActiveTool("pan");
          return;
        }
        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          s.toggleCollapseAllEntities();
          return;
        }
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        s.setZoomLevel((z: number) => Math.min(2.5, +(z + 0.1).toFixed(2)));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        s.setZoomLevel((z: number) => Math.max(0.4, +(z - 0.1).toFixed(2)));
      } else if (e.key === "0") {
        e.preventDefault();
        s.setZoomLevel(1);
        s.setPanOffset({ x: 0, y: 0 });
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        s.focusViewOnAll();
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [s.canvasRef, s.setZoomLevel, s.setPanOffset, s.focusViewOnAll, s.toggleCollapseAllEntities, s.setActiveTool]);

  if (!ont) return null;
  const entityById = new Map(ont.entities?.map((e) => [e.entity_id, e]) || []);

  // Marquee rect in world coords — render it inside the transform wrapper so
  // it automatically scales/translates with the canvas.
  const marqueeWorld = s.marquee
    ? {
      left: Math.min(s.marquee.startX, s.marquee.currentX),
      top: Math.min(s.marquee.startY, s.marquee.currentY),
      width: Math.abs(s.marquee.currentX - s.marquee.startX),
      height: Math.abs(s.marquee.currentY - s.marquee.startY),
    }
    : null;

  // Cursor rules
  const cursor = s.isPanning
    ? "grabbing"
    : s.spaceHeld
      ? "grab"
      : s.activeTool === "pan"
        ? "grab"
        : s.marquee
          ? "crosshair"
          : "default";

  return (
    <div
      ref={(el) => {
        (containerRef as any).current = el;
        (s.canvasRef as any).current = el;
      }}
      onMouseDown={s.handleCanvasMouseDown}
      className="absolute inset-0 overflow-hidden select-none bg-[#f8fafc]"
      style={{
        backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
        backgroundSize: `${24 * s.zoomLevel}px ${24 * s.zoomLevel}px`,
        backgroundPosition: `${s.panOffset.x}px ${s.panOffset.y}px`,
        cursor,
      }}
    >
      {s.selectedEntityIds.size > 1 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-lg">
          <span className="whitespace-nowrap">
            {s.selectedEntityIds.size} selected
          </span>
          <button
            onClick={s.deleteSelectedEntities}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-[11px]"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <button
            onClick={() => s.setSelectedEntityIds(new Set())}
            className="p-0.5 text-slate-300 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!ont.entities || ont.entities.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
            <Network className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Visual Schema Graph is Empty
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Add entities manually or prompt the AI Architect to synthesize an ontology.
            </p>
          </div>
          <button
            onClick={s.openAddEntity}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Entity
          </button>
        </div>
      ) : (
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${s.panOffset.x}px, ${s.panOffset.y}px) scale(${s.zoomLevel})`,
            willChange: "transform",
          }}
        >
          <div className="relative" style={{ width: 8000, height: 8000 }}>
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              style={{ overflow: "visible" }}
            >
              <defs>
                <marker id="rel-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 8 5 L 0 10 Z" fill="#475569" />
                </marker>
                <marker id="rel-arrow-end" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M 0 0 L 8 5 L 0 10 Z" fill="#475569" />
                </marker>
              </defs>

              {ont.relationships?.map((rel) => {
                const srcEnt = entityById.get(rel.source_entity_id);
                const tgtEnt = entityById.get(rel.target_entity_id);
                if (!srcEnt || !tgtEnt) return null;

                const srcPos = s.nodePositions[rel.source_entity_id] || { x: 80, y: 80 };
                const tgtPos = s.nodePositions[rel.target_entity_id] || { x: 420, y: 80 };
                const srcCollapsed = s.collapsedEntityIds.has(rel.source_entity_id);
                const tgtCollapsed = s.collapsedEntityIds.has(rel.target_entity_id);

                return (
                  <RelationshipEdge
                    key={`${rel.relationship_id}-${containerSize.w}-${containerSize.h}`}
                    rel={rel}
                    srcPos={srcPos}
                    srcWidth={getCardWidth(srcEnt, srcCollapsed)}
                    srcHeight={srcCollapsed ? 36 : estimateCardHeight(srcEnt)}
                    tgtPos={tgtPos}
                    tgtWidth={getCardWidth(tgtEnt, tgtCollapsed)}
                    tgtHeight={tgtCollapsed ? 36 : estimateCardHeight(tgtEnt)}
                    onEdit={() => s.openEditRelationship(rel)}
                    onDelete={() => s.deleteRelationship(rel.relationship_id)}
                  />
                );
              })}
            </svg>

            {ont.entities.map((entity) => {
              // In pan tool (or with space held), disable card drag so the
              // canvas pans instead. Buttons inside the card still work.
              const disableCardDrag = s.activeTool === "pan" || s.spaceHeld;
              return (
                <EntityCard
                  key={entity.entity_id}
                  entity={entity}
                  pos={s.nodePositions[entity.entity_id] || { x: 80, y: 80 }}
                  isSelected={s.selectedEntityIds.has(entity.entity_id)}
                  isConnecting={s.connectingSourceId === entity.entity_id}
                  isCollapsed={s.collapsedEntityIds.has(entity.entity_id)}
                  onToggleCollapse={() => s.toggleEntityCollapsed(entity.entity_id)}
                  onMouseDown={(e) =>
                    disableCardDrag ? undefined : s.handleNodeMouseDown(e, entity.entity_id)
                  }
                  onConnect={() => s.setConnectingSourceId(entity.entity_id)}
                  onInspect={() => s.setInspectingEntity(entity)}
                  onAddAttribute={() => s.openAddAttribute(entity)}
                  onEdit={() => s.openEditEntity(entity)}
                  onDelete={() => s.deleteEntity(entity.entity_id)}
                  onEditAttribute={(attr) => s.openEditAttribute(entity, attr)}
                  onDeleteAttribute={(id) => s.deleteAttribute(entity, id)}
                />
              );
            })}
            {/* Marquee rectangle — inside the transform wrapper */}
            {marqueeWorld && (
              <div
                className="absolute pointer-events-none z-30 border-2 border-blue-500 bg-blue-500/10 rounded-sm shadow-sm"
                style={{
                  left: marqueeWorld.left,
                  top: marqueeWorld.top,
                  width: marqueeWorld.width,
                  height: marqueeWorld.height,
                  // Compensate for zoom so border stays crisp
                  borderWidth: `${2 / s.zoomLevel}px`,
                }}
              />
            )}
          </div>
        </div>
      )}

      {ont.entities && ont.entities.length > 0 && <MiniMap s={s} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MiniMap (unchanged)
// ─────────────────────────────────────────────────────────────
function MiniMap({ s }: { s: OntologyState }) {
  const MAP_W = 200;
  const MAP_H = 140;
  const PAD = 8;
  const mapRef = useRef<HTMLDivElement>(null);

  const bounds = s.getContentBounds();
  const canvasEl = s.canvasRef.current;
  const viewportW = canvasEl?.clientWidth || 800;
  const viewportH = canvasEl?.clientHeight || 600;

  const viewLeftWorld = -s.panOffset.x / s.zoomLevel;
  const viewTopWorld = -s.panOffset.y / s.zoomLevel;
  const viewRightWorld = viewLeftWorld + viewportW / s.zoomLevel;
  const viewBottomWorld = viewTopWorld + viewportH / s.zoomLevel;

  const ext = {
    minX: Math.min(bounds.minX, viewLeftWorld),
    minY: Math.min(bounds.minY, viewTopWorld),
    maxX: Math.max(bounds.maxX, viewRightWorld),
    maxY: Math.max(bounds.maxY, viewBottomWorld),
  };
  const extW = Math.max(ext.maxX - ext.minX, 1);
  const extH = Math.max(ext.maxY - ext.minY, 1);
  const scale = Math.min((MAP_W - PAD * 2) / extW, (MAP_H - PAD * 2) / extH);
  const offsetX = (MAP_W - extW * scale) / 2 - ext.minX * scale;
  const offsetY = (MAP_H - extH * scale) / 2 - ext.minY * scale;

  const jumpTo = (clientX: number, clientY: number) => {
    const el = mapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const worldX = (clientX - rect.left - offsetX) / scale;
    const worldY = (clientY - rect.top - offsetY) / scale;
    s.setPanOffset({
      x: Math.round(viewportW / 2 - worldX * s.zoomLevel),
      y: Math.round(viewportH / 2 - worldY * s.zoomLevel),
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    jumpTo(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => jumpTo(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      data-minimap
      onMouseDown={onMouseDown}
      className="absolute bottom-20 right-3 z-20 rounded-lg border border-slate-300 bg-white/95 backdrop-blur shadow-lg cursor-pointer overflow-hidden"
      style={{ width: MAP_W, height: MAP_H }}
      title="Mini-map · click or drag to pan"
    >
      <div
        ref={mapRef}
        className="relative w-full h-full"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 0.5px, transparent 0.5px)",
          backgroundSize: "8px 8px",
        }}
      >
        {Object.entries(s.nodePositions).map(([id, pos]) => {
          const isSel = s.selectedEntityIds.has(id);
          return (
            <div
              key={id}
              className={`absolute rounded-sm ${isSel ? "bg-blue-600" : "bg-slate-500"}`}
              style={{
                left: pos.x * scale + offsetX,
                top: pos.y * scale + offsetY,
                width: Math.max(6, 320 * scale * 0.6),
                height: Math.max(4, 60 * scale),
              }}
            />
          );
        })}
        <div
          className="absolute border-2 border-blue-600 bg-blue-500/10 pointer-events-none"
          style={{
            left: viewLeftWorld * scale + offsetX,
            top: viewTopWorld * scale + offsetY,
            width: (viewRightWorld - viewLeftWorld) * scale,
            height: (viewBottomWorld - viewTopWorld) * scale,
          }}
        />
      </div>
    </div>
  );
}

function estimateCardHeight(entity?: any): number {
  if (!entity) return 180;
  const attrCount = entity.attributes?.length || 0;
  const attrRows = Math.min(attrCount, 6) * 26;
  const descH = entity.description ? 26 : 0;
  return CARD_HEADER_H + descH + attrRows + 44;
}

// ─────────────────────────────────────────────────────────────
// Relationship edge (unchanged)
// ─────────────────────────────────────────────────────────────
function RelationshipEdge({
  rel, srcPos, srcWidth, srcHeight, tgtPos, tgtWidth, tgtHeight, onEdit, onDelete,
}: {
  rel: any;
  srcPos: { x: number; y: number };
  srcWidth: number;
  srcHeight: number;
  tgtPos: { x: number; y: number };
  tgtWidth: number;
  tgtHeight: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isSelf = srcPos.x === tgtPos.x && srcPos.y === tgtPos.y;
  const cardinality = formatCardinality(rel.cardinality);

  if (isSelf) {
    const cx = srcPos.x + srcWidth / 2;
    const top = srcPos.y;
    const loopR = 90;
    const path = `M ${cx} ${top} C ${cx + loopR} ${top - loopR * 1.6}, ${cx - loopR} ${top - loopR * 1.6}, ${cx} ${top}`;
    return (
      <g className="pointer-events-auto">
        <path d={path} stroke="#475569" strokeWidth="2" fill="none" strokeDasharray={rel.relation_type === "ASSOCIATION" ? "5 4" : "0"} markerEnd="url(#rel-arrow-end)" />
        <foreignObject x={cx - 85} y={top - loopR * 1.6 - 14} width="170" height="28">
          <RelationshipLabel rel={rel} cardinality={cardinality} onEdit={onEdit} onDelete={onDelete} />
        </foreignObject>
      </g>
    );
  }

  const anchors = computeAnchors(srcPos, srcWidth, srcHeight, tgtPos, tgtWidth, tgtHeight);
  const path = `M ${anchors.x1} ${anchors.y1} C ${anchors.cx1} ${anchors.cy1}, ${anchors.cx2} ${anchors.cy2}, ${anchors.x2} ${anchors.y2}`;
  const mid = bezierMidpoint(anchors.x1, anchors.y1, anchors.cx1, anchors.cy1, anchors.cx2, anchors.cy2, anchors.x2, anchors.y2);

  return (
    <g className="pointer-events-auto">
      <path d={path} stroke="#475569" strokeWidth="2" fill="none" strokeDasharray={rel.relation_type === "ASSOCIATION" ? "5 4" : "0"} markerEnd="url(#rel-arrow-end)" markerStart={rel.is_bidirectional ? "url(#rel-arrow)" : undefined} />
      <foreignObject x={mid.x - 85} y={mid.y - 14} width="170" height="28">
        <RelationshipLabel rel={rel} cardinality={cardinality} onEdit={onEdit} onDelete={onDelete} />
      </foreignObject>
    </g>
  );
}

function computeAnchors(srcPos: { x: number; y: number }, srcWidth: number, srcHeight: number, tgtPos: { x: number; y: number }, tgtWidth: number, tgtHeight: number) {
  const srcCX = srcPos.x + srcWidth / 2;
  const srcCY = srcPos.y + srcHeight / 2;
  const tgtCX = tgtPos.x + tgtWidth / 2;
  const tgtCY = tgtPos.y + tgtHeight / 2;
  const dx = tgtCX - srcCX;
  const dy = tgtCY - srcCY;
  let x1: number, y1: number, x2: number, y2: number;
  let dir: "right" | "left" | "down" | "up";
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) { x1 = srcPos.x + srcWidth; y1 = srcCY; x2 = tgtPos.x; y2 = tgtCY; dir = "right"; }
    else { x1 = srcPos.x; y1 = srcCY; x2 = tgtPos.x + tgtWidth; y2 = tgtCY; dir = "left"; }
  } else {
    if (dy >= 0) { x1 = srcCX; y1 = srcPos.y + srcHeight; x2 = tgtCX; y2 = tgtPos.y; dir = "down"; }
    else { x1 = srcCX; y1 = srcPos.y; x2 = tgtCX; y2 = tgtPos.y + tgtHeight; dir = "up"; }
  }
  const offset = Math.max(60, Math.min(220, (Math.abs(dx) + Math.abs(dy)) * 0.35));
  let cx1: number, cy1: number, cx2: number, cy2: number;
  switch (dir) {
    case "right": cx1 = x1 + offset; cy1 = y1; cx2 = x2 - offset; cy2 = y2; break;
    case "left": cx1 = x1 - offset; cy1 = y1; cx2 = x2 + offset; cy2 = y2; break;
    case "down": cx1 = x1; cy1 = y1 + offset; cx2 = x2; cy2 = y2 - offset; break;
    default: cx1 = x1; cy1 = y1 - offset; cx2 = x2; cy2 = y2 + offset;
  }
  return { x1, y1, x2, y2, cx1, cy1, cx2, cy2, dir };
}

function bezierMidpoint(x1: number, y1: number, cx1: number, cy1: number, cx2: number, cy2: number, x2: number, y2: number) {
  const t = 0.5, mt = 1 - t;
  return {
    x: mt * mt * mt * x1 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x2,
    y: mt * mt * mt * y1 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y2,
  };
}

function formatCardinality(c?: string): string {
  if (!c) return "1:N";
  if (c.includes("MANY_TO_MANY")) return "N:M";
  if (c.includes("MANY_TO_ONE")) return "N:1";
  if (c.includes("ONE_TO_MANY")) return "1:N";
  if (c.includes("ONE_TO_ONE")) return "1:1";
  return "IS-A";
}

function RelationshipLabel({ rel, cardinality, onEdit, onDelete }: { rel: any; cardinality: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onEdit}
      title={rel.description || rel.name}
      className="group flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-full bg-white border border-slate-300 text-[10px] font-mono text-slate-700 shadow-sm cursor-pointer hover:border-slate-800 hover:shadow-md transition w-full h-full"
    >
      <span className="font-bold truncate text-slate-900">{rel.name}</span>
      <span className="text-[9px] px-1 py-0 rounded bg-slate-100 text-slate-600 font-bold shrink-0 whitespace-nowrap">{cardinality}</span>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 shrink-0" title="Delete relationship">✕</button>
    </div>
  );
}