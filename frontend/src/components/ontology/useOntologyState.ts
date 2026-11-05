"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  OntologyVersionItem,
  OntologyEntity,
  EntityAttribute,
  OntologyRelationship,
} from "@/lib/api-client";
import { useProject } from "@/context/ProjectContext";
import { AgentMessage, AgentSession, DEFAULT_MODEL } from "./types";

const DRAG_THRESHOLD = 4;
const CARD_W = 320;
const CARD_H = 200;

// ─────────────────────────────────────────────────────────────
// Session storage
// ─────────────────────────────────────────────────────────────
const SESSION_STORAGE_PREFIX = "data_bride_agent_sessions_v2";

function getStorageKey(projectId: string | null): string {
  return `${SESSION_STORAGE_PREFIX}_${projectId || "global"}`;
}

function loadSessionsFromStorage(projectId: string | null): AgentSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && typeof s === "object" && typeof s.id === "string")
      .map((s) => ({
        id: s.id,
        title: typeof s.title === "string" ? s.title : "Untitled Chat",
        created_at: typeof s.created_at === "number" ? s.created_at : Date.now(),
        updated_at: typeof s.updated_at === "number" ? s.updated_at : Date.now(),
        model: typeof s.model === "string" ? s.model : DEFAULT_MODEL,
        is_archived: Boolean(s.is_archived),
        messages: Array.isArray(s.messages)
          ? s.messages.filter(
              (m: any) =>
                m &&
                typeof m === "object" &&
                (m.role === "user" || m.role === "assistant" || m.role === "system") &&
                typeof m.content === "string"
            )
          : [],
      })) as AgentSession[];
  } catch {
    return [];
  }
}

function saveSessionsToStorage(projectId: string | null, sessions: AgentSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(sessions));
  } catch {}
}

function makeFreshSession(model: string = DEFAULT_MODEL): AgentSession {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "New Chat",
    created_at: Date.now(),
    updated_at: Date.now(),
    model,
    is_archived: false,
    messages: [],
  };
}

// ─────────────────────────────────────────────────────────────
// Canvas state persistence
// ─────────────────────────────────────────────────────────────
interface PersistedCanvasState {
  nodePositions?: Record<string, { x: number; y: number }>;
  collapsedEntityIds?: string[];
  zoomLevel?: number;
  panOffset?: { x: number; y: number };
}

function canvasStateKey(ontId: string): string {
  return `db_canvas_state:${ontId}`;
}

function loadCanvasState(ontId: string): PersistedCanvasState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(canvasStateKey(ontId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PersistedCanvasState;
  } catch {
    return null;
  }
}

function saveCanvasState(ontId: string, state: PersistedCanvasState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(canvasStateKey(ontId), JSON.stringify(state));
  } catch {}
}

function clearCanvasState(ontId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(canvasStateKey(ontId));
  } catch {}
}

function loadGlobalPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveGlobalPref<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export type CanvasTool = "select" | "pan";

interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  baseSelection: Set<string>;
}

export function useOntologyState() {
  const { activeProject, activeProjectId } = useProject();

  const [viewMode, setViewMode] = useState<"registry" | "builder">("registry");
  const [activeTab, setActiveTabRaw] = useState<"graph" | "table" | "relationships">(() =>
    loadGlobalPref("db_canvas_tab", "graph")
  );
  const [ontologies, setOntologies] = useState<OntologyVersionItem[]>([]);
  const [selectedOntology, setSelectedOntology] = useState<OntologyVersionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOntology, setSavingOntology] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Canvas
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [zoomLevel, setZoomLevelRaw] = useState(1);
  const [panOffset, setPanOffsetRaw] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingEntityId, setDraggingEntityId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [collapsedEntityIds, setCollapsedEntityIdsRaw] = useState<Set<string>>(new Set());

  const [activeTool, setActiveToolRaw] = useState<CanvasTool>(() =>
    loadGlobalPref<CanvasTool>("db_canvas_tool", "select")
  );
  const [spaceHeld, setSpaceHeld] = useState(false);

  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const selectedEntityId = useMemo(
    () => (selectedEntityIds.size === 1 ? Array.from(selectedEntityIds)[0] : null),
    [selectedEntityIds]
  );

  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const allEntitiesCollapsed = useMemo(() => {
    const ids = selectedOntology?.entities?.map((e) => e.entity_id) || [];
    if (ids.length === 0) return false;
    return ids.every((id) => collapsedEntityIds.has(id));
  }, [selectedOntology?.entities, collapsedEntityIds]);

  // ── Refs ────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeToolRef = useRef<CanvasTool>("select");
  const spaceHeldRef = useRef(false);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const zoomLevelRef = useRef(1);
  const selectedEntityIdsRef = useRef<Set<string>>(new Set());
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const entitiesRef = useRef<OntologyEntity[]>([]);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const dragStartRef = useRef<{
    primaryId: string;
    entityIds: string[];
    startX: number;
    startY: number;
    offsets: Record<string, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { spaceHeldRef.current = spaceHeld; }, [spaceHeld]);
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);
  useEffect(() => { selectedEntityIdsRef.current = selectedEntityIds; }, [selectedEntityIds]);
  useEffect(() => { nodePositionsRef.current = nodePositions; }, [nodePositions]);
  useEffect(() => { entitiesRef.current = selectedOntology?.entities || []; }, [selectedOntology?.entities]);
  useEffect(() => { marqueeRef.current = marquee; }, [marquee]);

  // ── Proxy setters ──────────────────────────────────────────
  const setActiveTab = useCallback(
    (v: "graph" | "table" | "relationships") => {
      setActiveTabRaw(v);
      saveGlobalPref("db_canvas_tab", v);
    },
    []
  );

  const setActiveTool = useCallback((v: CanvasTool) => {
    setActiveToolRaw(v);
    saveGlobalPref("db_canvas_tool", v);
  }, []);

  const setZoomLevel = useCallback(
    (updater: number | ((z: number) => number)) => {
      setZoomLevelRaw((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    []
  );

  const setPanOffset = useCallback((v: { x: number; y: number }) => {
    setPanOffsetRaw(v);
  }, []);

  const setCollapsedEntityIds = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setCollapsedEntityIdsRaw((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    []
  );

  // ── Debounced canvas-state persistence ─────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedOntology) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCanvasState(selectedOntology.ontology_version_id, {
        nodePositions,
        collapsedEntityIds: Array.from(collapsedEntityIds),
        zoomLevel,
        panOffset,
      });
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [selectedOntology?.ontology_version_id, nodePositions, collapsedEntityIds, zoomLevel, panOffset, selectedOntology]);

  // ── Keyboard ───────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (isTyping) return;
      if (e.code === "Space" && !spaceHeldRef.current) {
        setSpaceHeld(true);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const p = panOffsetRef.current;
    const z = zoomLevelRef.current;
    return {
      x: (clientX - rect.left - p.x) / z,
      y: (clientY - rect.top - p.y) / z,
    };
  }, []);

  // ── Pointer loop ────────────────────────────────────────────
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-entity-card]")) return;
      if (target.closest("button, a, input, select, textarea")) return;
      if (target.closest("[data-minimap]")) return;
      if (target.closest("[data-toolbar]")) return;

      const canvas = canvasRef.current;
      if (!canvas || !canvas.contains(target)) return;

      const wantPan =
        e.button === 1 ||
        e.button === 2 ||
        spaceHeldRef.current ||
        activeToolRef.current === "pan";

      if (wantPan) {
        e.preventDefault();
        panningRef.current = true;
        panStartRef.current = {
          x: e.clientX - panOffsetRef.current.x,
          y: e.clientY - panOffsetRef.current.y,
        };
        setIsPanning(true);
        return;
      }

      if (e.button === 0) {
        const c = getCanvasCoords(e.clientX, e.clientY);
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        const base = additive ? new Set(selectedEntityIdsRef.current) : new Set<string>();
        const m: MarqueeState = {
          startX: c.x,
          startY: c.y,
          currentX: c.x,
          currentY: c.y,
          additive,
          baseSelection: base,
        };
        marqueeRef.current = m;
        setMarquee(m);
        setConnectingSourceId(null);
        if (!additive) setSelectedEntityIds(new Set());
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragStartRef.current;
      if (drag) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          drag.moved = true;
          setDraggingEntityId(drag.primaryId);
        }
        if (drag.moved) {
          const c = getCanvasCoords(e.clientX, e.clientY);
          setNodePositions((prev) => {
            const next = { ...prev };
            for (const id of drag.entityIds) {
              const off = drag.offsets[id];
              if (!off) continue;
              next[id] = {
                x: Math.round(c.x - off.x),
                y: Math.round(c.y - off.y),
              };
            }
            return next;
          });
        }
        return;
      }

      if (panningRef.current) {
        setPanOffset({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      const m = marqueeRef.current;
      if (m) {
        const c = getCanvasCoords(e.clientX, e.clientY);
        const nextMarquee: MarqueeState = { ...m, currentX: c.x, currentY: c.y };
        marqueeRef.current = nextMarquee;
        setMarquee(nextMarquee);

        const x1 = Math.min(m.startX, c.x);
        const y1 = Math.min(m.startY, c.y);
        const x2 = Math.max(m.startX, c.x);
        const y2 = Math.max(m.startY, c.y);

        const hits = new Set<string>(m.additive ? m.baseSelection : []);
        const positions = nodePositionsRef.current;
        for (const ent of entitiesRef.current) {
          const pos = positions[ent.entity_id];
          if (!pos) continue;
          const overlaps =
            pos.x < x2 && pos.x + CARD_W > x1 && pos.y < y2 && pos.y + CARD_H > y1;
          if (overlaps) hits.add(ent.entity_id);
        }
        setSelectedEntityIds(hits);
        return;
      }
    };

    const onPointerUp = () => {
      dragStartRef.current = null;
      setDraggingEntityId(null);
      if (panningRef.current) {
        panningRef.current = false;
        setIsPanning(false);
      }
      if (marqueeRef.current) {
        marqueeRef.current = null;
        setMarquee(null);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-entity-card]")) return;
      if (target.closest("button, a, input, select, textarea")) return;
      if (target.closest("[data-toolbar]")) return;
      const canvas = canvasRef.current;
      if (canvas && canvas.contains(target)) e.preventDefault();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [getCanvasCoords, setPanOffset]);

  // ── Default grid layout for entities with no saved positions ─
  const applyDefaultLayoutForMissing = useCallback(
    (
      entities: OntologyEntity[],
      existingPositions: Record<string, { x: number; y: number }>
    ): Record<string, { x: number; y: number }> => {
      const next = { ...existingPositions };
      const missing = entities.filter((e) => !next[e.entity_id]);
      if (missing.length === 0) return next;

      const cols = Math.max(1, Math.ceil(Math.sqrt(entities.length)));
      const baseIndex = Object.keys(next).length;
      missing.forEach((ent, idx) => {
        const absoluteIdx = baseIndex + idx;
        next[ent.entity_id] = {
          x: 80 + (absoluteIdx % cols) * 340,
          y: 80 + Math.floor(absoluteIdx / cols) * 300,
        };
      });
      return next;
    },
    []
  );

  // ─────────────────────────────────────────────────────────────
  // Load ontologies
  // ─────────────────────────────────────────────────────────────
  const hydrateCanvasFromStorage = useCallback(
    (ont: OntologyVersionItem) => {
      const saved = loadCanvasState(ont.ontology_version_id);
      const entityIds = new Set((ont.entities || []).map((e) => e.entity_id));

      const savedPositions: Record<string, { x: number; y: number }> = {};
      if (saved?.nodePositions) {
        for (const [id, pos] of Object.entries(saved.nodePositions)) {
          if (entityIds.has(id) && pos && typeof pos.x === "number" && typeof pos.y === "number") {
            savedPositions[id] = pos;
          }
        }
      }
      const fullPositions = applyDefaultLayoutForMissing(ont.entities || [], savedPositions);
      setNodePositions(fullPositions);

      const collapsed: string[] = (saved?.collapsedEntityIds || []).filter((id) =>
        entityIds.has(id)
      );
      setCollapsedEntityIdsRaw(new Set(collapsed));

      const z =
        typeof saved?.zoomLevel === "number" && saved.zoomLevel >= 0.4 && saved.zoomLevel <= 2.5
          ? saved.zoomLevel
          : 1;
      setZoomLevelRaw(z);
      const p =
        saved?.panOffset &&
        typeof saved.panOffset.x === "number" &&
        typeof saved.panOffset.y === "number"
          ? saved.panOffset
          : { x: 0, y: 0 };
      setPanOffsetRaw(p);
    },
    [applyDefaultLayoutForMissing]
  );

  const loadOntologies = useCallback(
    async (targetId?: string, forceBuilderOpen = false) => {
      setLoading(true);
      try {
        const list = await api.getOntologies(activeProjectId || undefined);
        setOntologies(list);

        let urlTargetId = targetId;
        if (!urlTargetId && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const v = params.get("version_id");
          if (v) urlTargetId = v;
        }

        if (list.length > 0) {
          const active = urlTargetId
            ? list.find((o) => o.ontology_version_id === urlTargetId)
            : undefined;

          if (active) {
            const full = await api.getOntology(active.ontology_version_id);
            const use = full || active;
            setSelectedOntology(use);
            hydrateCanvasFromStorage(use);
            setViewMode("builder");
          } else if (forceBuilderOpen) {
            const first = list[0];
            const full = await api.getOntology(first.ontology_version_id);
            const use = full || first;
            setSelectedOntology(use);
            hydrateCanvasFromStorage(use);
            setViewMode("builder");
          } else if (targetId) {
            setSelectedOntology(list[0]);
            hydrateCanvasFromStorage(list[0]);
          }
        } else {
          setSelectedOntology(null);
          setViewMode("registry");
        }
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProjectId]
  );

  useEffect(() => {
    loadOntologies();
  }, [loadOntologies]);

  // ── Bounds / fit ────────────────────────────────────────────
  const getContentBounds = useCallback(() => {
    const ids = Object.keys(nodePositions);
    if (ids.length === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = nodePositions[id];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + CARD_W);
      maxY = Math.max(maxY, p.y + CARD_H);
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [nodePositions]);

  const focusViewOnAll = useCallback(() => {
    if (!canvasRef.current) return;
    const bounds = getContentBounds();
    const vw = canvasRef.current.clientWidth;
    const vh = canvasRef.current.clientHeight;
    if (vw === 0 || vh === 0) return;
    const PAD = 60;
    const scaleX = (vw - PAD * 2) / bounds.width;
    const scaleY = (vh - PAD * 2) / bounds.height;
    const newZoom = Math.min(1.6, Math.max(0.4, Math.min(scaleX, scaleY)));
    const contentCX = bounds.minX + bounds.width / 2;
    const contentCY = bounds.minY + bounds.height / 2;
    setZoomLevel(newZoom);
    setPanOffset({
      x: Math.round(vw / 2 - contentCX * newZoom),
      y: Math.round(vh / 2 - contentCY * newZoom),
    });
  }, [getContentBounds, setZoomLevel, setPanOffset]);

  const handleAutoLayout = () => {
    if (!selectedOntology?.entities) return;
    const next: Record<string, { x: number; y: number }> = {};
    const cols = Math.max(1, Math.ceil(Math.sqrt(selectedOntology.entities.length)));
    selectedOntology.entities.forEach((ent, idx) => {
      next[ent.entity_id] = {
        x: 80 + (idx % cols) * 350,
        y: 80 + Math.floor(idx / cols) * 320,
      };
    });
    setNodePositions(next);
    setPanOffset({ x: 0, y: 0 });
    setZoomLevel(1);
  };

  // ── Search jump ─────────────────────────────────────────────
  const handleSearchJump = (entityId?: string, relationshipId?: string) => {
    if (!selectedOntology) return;
    setActiveTab("graph");

    if (entityId) {
      const pos = nodePositions[entityId];
      const canvas = canvasRef.current;
      if (pos && canvas) {
        const vw = canvas.clientWidth;
        const vh = canvas.clientHeight;
        const z = Math.max(0.6, Math.min(1.2, zoomLevelRef.current));
        setZoomLevel(z);
        setPanOffset({
          x: Math.round(vw / 2 - (pos.x + CARD_W / 2) * z),
          y: Math.round(vh / 2 - (pos.y + CARD_H / 2) * z),
        });
      }
      setSelectedEntityIds(new Set([entityId]));
      setConnectingSourceId(null);
      return;
    }

    if (relationshipId) {
      const rel = (selectedOntology.relationships || []).find(
        (r) => r.relationship_id === relationshipId
      );
      if (!rel) return;
      const srcPos = nodePositions[rel.source_entity_id];
      const canvas = canvasRef.current;
      if (srcPos && canvas) {
        const vw = canvas.clientWidth;
        const vh = canvas.clientHeight;
        const z = Math.max(0.6, Math.min(1.2, zoomLevelRef.current));
        setZoomLevel(z);
        setPanOffset({
          x: Math.round(vw / 2 - (srcPos.x + CARD_W / 2) * z),
          y: Math.round(vh / 2 - (srcPos.y + CARD_H / 2) * z),
        });
      }
      setSelectedEntityIds(new Set([rel.source_entity_id, rel.target_entity_id]));
      openEditRelationship(rel);
    }
  };

  // ── Node mousedown ──────────────────────────────────────────
  const handleNodeMouseDown = (e: React.MouseEvent, entityId: string) => {
    if ((e.target as HTMLElement).closest("button, a, input, select")) return;
    e.stopPropagation();

    if (spaceHeldRef.current) {
      panningRef.current = true;
      panStartRef.current = {
        x: e.clientX - panOffsetRef.current.x,
        y: e.clientY - panOffsetRef.current.y,
      };
      setIsPanning(true);
      return;
    }

    const shift = e.shiftKey || e.metaKey || e.ctrlKey;
    let nextSelection: Set<string>;
    if (shift) {
      nextSelection = new Set(selectedEntityIdsRef.current);
      if (nextSelection.has(entityId)) {
        nextSelection.delete(entityId);
        setSelectedEntityIds(nextSelection);
        return;
      }
      nextSelection.add(entityId);
    } else {
      nextSelection =
        selectedEntityIdsRef.current.has(entityId) &&
        selectedEntityIdsRef.current.size > 1
          ? new Set(selectedEntityIdsRef.current)
          : new Set([entityId]);
    }
    setSelectedEntityIds(nextSelection);

    if (connectingSourceId) {
      if (connectingSourceId !== entityId) {
        setRelSourceId(connectingSourceId);
        setRelTargetId(entityId);
        const src = selectedOntology?.entities?.find((x) => x.entity_id === connectingSourceId);
        const tgt = selectedOntology?.entities?.find((x) => x.entity_id === entityId);
        setRelName(`${src?.name.toLowerCase()}_to_${tgt?.name.toLowerCase()}`);
        setRelLabel(`${src?.name} connects to ${tgt?.name}`);
        setEditingRelId(null);
        setRelModalOpen(true);
      }
      setConnectingSourceId(null);
      return;
    }

    const c = getCanvasCoords(e.clientX, e.clientY);
    const offsets: Record<string, { x: number; y: number }> = {};
    const entityIds = Array.from(nextSelection);
    for (const id of entityIds) {
      const pos = nodePositionsRef.current[id] || { x: 80, y: 80 };
      offsets[id] = { x: c.x - pos.x, y: c.y - pos.y };
    }

    dragStartRef.current = {
      primaryId: entityId,
      entityIds,
      startX: e.clientX,
      startY: e.clientY,
      offsets,
      moved: false,
    };
  };

  const handleCanvasMouseDown = (_e: React.MouseEvent) => {};

  const handleOpenBuilderForOntology = (ont: OntologyVersionItem) => {
    setSelectedOntology(ont);
    hydrateCanvasFromStorage(ont);
    setViewMode("builder");
    setSelectedEntityIds(new Set());
    setActiveTool("select");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/ontology?version_id=${ont.ontology_version_id}`);
    }
  };

  const handleBackToRegistry = () => {
    setViewMode("registry");
    setSelectedEntityIds(new Set());
    if (typeof window !== "undefined") window.history.replaceState(null, "", `/ontology`);
  };

  const toggleEntityCollapsed = (id: string) => {
    setCollapsedEntityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAllEntities = () => {
    const ids = selectedOntology?.entities?.map((e) => e.entity_id) || [];
    setCollapsedEntityIds(new Set(ids));
  };

  const expandAllEntities = () => setCollapsedEntityIds(new Set());

  const toggleCollapseAllEntities = () => {
    const ids = selectedOntology?.entities?.map((e) => e.entity_id) || [];
    if (ids.length === 0) return;
    setCollapsedEntityIds((prev) => {
      const allCollapsed = ids.every((id) => prev.has(id));
      return allCollapsed ? new Set() : new Set(ids);
    });
  };

  // ─────────────────────────────────────────────────────────────
  // SESSION STATE — THE FIX LIVES HERE
  // ─────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // Track which project the *current in-memory sessions* belong to.
  // The persistence effect only writes when `sessionsProjectRef.current`
  // matches `activeProjectId`, which prevents cross-project leakage.
  const sessionsProjectRef = useRef<string | null>(null);
  const [sessionsHydrated, setSessionsHydrated] = useState(false);

  // ── HYDRATION: runs on EVERY project change, resets state first ──
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) Immediately detach from the previous project
    setSessionsHydrated(false);
    sessionsProjectRef.current = null;

    // 2) Clear sessions so nothing from the old project renders
    setSessions([]);
    setCurrentSessionId("");

    // 3) Load this project's sessions (or create a fresh one)
    const projectKey = activeProjectId || null;
    const stored = loadSessionsFromStorage(projectKey);

    let nextSessions: AgentSession[];
    let nextCurrentId: string;

    if (stored.length > 0) {
      const sorted = [...stored].sort((a, b) => {
        if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
        return b.updated_at - a.updated_at;
      });
      nextSessions = sorted;
      const active = sorted.find((s) => !s.is_archived) || sorted[0];
      nextCurrentId = active.id;
      if (active.model) setSelectedModel(active.model);
    } else {
      const fresh = makeFreshSession(selectedModel);
      nextSessions = [fresh];
      nextCurrentId = fresh.id;
    }

    setSessions(nextSessions);
    setCurrentSessionId(nextCurrentId);

    // 4) Mark hydrated — but only for THIS project
    sessionsProjectRef.current = projectKey;
    setSessionsHydrated(true);
  }, [activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PERSISTENCE: only write to the project the sessions belong to ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionsHydrated) return;
    if (sessions.length === 0) return;
    // Guard: only persist when the hydrated project matches the current one
    if (sessionsProjectRef.current !== (activeProjectId || null)) return;

    saveSessionsToStorage(activeProjectId, sessions);
  }, [sessions, activeProjectId, sessionsHydrated]);

  const activeSession = useMemo(() => {
    const found = sessions.find((s) => s.id === currentSessionId);
    if (found) return found;
    return sessions.find((s) => !s.is_archived) || sessions[0] || null;
  }, [sessions, currentSessionId]);

  useEffect(() => {
    if (!sessionsHydrated) return;
    if (sessions.length === 0) return;
    if (!sessions.find((s) => s.id === currentSessionId)) {
      const fallback = sessions.find((s) => !s.is_archived) || sessions[0];
      if (fallback) setCurrentSessionId(fallback.id);
    }
  }, [sessions, currentSessionId, sessionsHydrated]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages?.length]);

  // ── Modals / CRUD state ─────────────────────────────────────
  const [inspectingEntity, setInspectingEntity] = useState<OntologyEntity | null>(null);
  const [editingEntityDef, setEditingEntityDef] = useState("");
  const [savingEntityDef, setSavingEntityDef] = useState(false);

  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entName, setEntName] = useState("");
  const [entLabel, setEntLabel] = useState("");
  const [entCategory, setEntCategory] = useState("Master Data");
  const [entDesc, setEntDesc] = useState("");

  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [targetEntityForAttr, setTargetEntityForAttr] = useState<OntologyEntity | null>(null);
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [attrName, setAttrName] = useState("");
  const [attrLabel, setAttrLabel] = useState("");
  const [attrDatatype, setAttrDatatype] = useState("string");
  const [attrIsPK, setAttrIsPK] = useState(false);
  const [attrIsFK, setAttrIsFK] = useState(false);
  const [attrIsIndex, setAttrIsIndex] = useState(false);
  const [attrIsNullable, setAttrIsNullable] = useState(true);
  const [attrIsPII, setAttrIsPII] = useState(false);
  const [attrFKTarget, setAttrFKTarget] = useState("");
  const [attrDefaultVal, setAttrDefaultVal] = useState("");
  const [attrDesc, setAttrDesc] = useState("");

  const [relModalOpen, setRelModalOpen] = useState(false);
  const [editingRelId, setEditingRelId] = useState<string | null>(null);
  const [relName, setRelName] = useState("");
  const [relLabel, setRelLabel] = useState("");
  const [relSourceId, setRelSourceId] = useState("");
  const [relSourceAttr, setRelSourceAttr] = useState("");
  const [relTargetId, setRelTargetId] = useState("");
  const [relTargetAttr, setRelTargetAttr] = useState("");
  const [relType, setRelType] = useState("ASSOCIATION");
  const [relCardinality, setRelCardinality] = useState("ONE_TO_MANY");
  const [relCascade, setRelCascade] = useState("CASCADE");
  const [relDesc, setRelDesc] = useState("");
  const [relBidirectional, setRelBidirectional] = useState(false);

  const [editOntologyModal, setEditOntologyModal] = useState(false);
  const [editOntName, setEditOntName] = useState("");
  const [editOntDomain, setEditOntDomain] = useState("");
  const [editOntVersion, setEditOntVersion] = useState("");
  const [editOntDesc, setEditOntDesc] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [isAgentOpen, setIsAgentOpen] = useState(true);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentSteps, setAgentSteps] = useState<Array<{ stage: string; summary: string }>>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentSuccessMsg, setAgentSuccessMsg] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<"augment" | "new">("augment");
  const [executionMode, setExecutionMode] = useState<"action" | "plan">("action");
  const [applyingPlanId, setApplyingPlanId] = useState<string | null>(null);

  // ── Save + CRUD (unchanged) ─────────────────────────────────
  const handleSaveFullOntology = async () => {
    if (!selectedOntology) return;
    setSavingOntology(true);
    setSaveSuccessMsg(null);
    try {
      const updated = await api.updateOntology(selectedOntology.ontology_version_id, {
        name: selectedOntology.name,
        domain: selectedOntology.domain,
        description: selectedOntology.description,
        version_tag: selectedOntology.version_tag,
        status: "APPROVED",
        entities: selectedOntology.entities || [],
        relationships: selectedOntology.relationships || [],
      });
      setSelectedOntology(updated);
      setSaveSuccessMsg("Ontology saved!");
      setTimeout(() => setSaveSuccessMsg(null), 3500);
      await loadOntologies(updated.ontology_version_id);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSavingOntology(false);
    }
  };

  const openAddEntity = () => {
    setEditingEntityId(null);
    setEntName("");
    setEntLabel("");
    setEntCategory("Master Data");
    setEntDesc("");
    setEntityModalOpen(true);
  };

  const openEditEntity = (e: OntologyEntity) => {
    setEditingEntityId(e.entity_id);
    setEntName(e.name);
    setEntLabel(e.label || e.name);
    setEntCategory(e.category || "Master Data");
    setEntDesc(e.description || "");
    setEntityModalOpen(true);
  };

  const saveEntity = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOntology || !entName.trim()) return;
    const formattedName = entName.trim().replace(/\s+/g, "");
    const formattedLabel = entLabel.trim() || formattedName;
    try {
      if (editingEntityId) {
        const updated = await api.updateEntity(
          selectedOntology.ontology_version_id,
          editingEntityId,
          { name: formattedName, label: formattedLabel, category: entCategory, description: entDesc.trim() }
        );
        setSelectedOntology((p) =>
          p ? { ...p, entities: (p.entities || []).map((e) => e.entity_id === editingEntityId ? updated : e) } : null
        );
      } else {
        const pk: EntityAttribute = {
          attribute_id: `attr-${Math.random().toString(36).slice(2, 10)}`,
          name: `${formattedName.toLowerCase()}_id`,
          label: `${formattedLabel} Identifier`,
          datatype: "uuid",
          is_primary_key: true,
          is_foreign_key: false,
          is_indexed: true,
          is_nullable: false,
          is_unique: true,
          is_pii: false,
          description: "Primary surrogate identifier",
        };
        const created = await api.addEntity(selectedOntology.ontology_version_id, {
          name: formattedName, label: formattedLabel, category: entCategory,
          description: entDesc.trim(), attributes: [pk],
        });
        setSelectedOntology((p) => p ? { ...p, entities: [...(p.entities || []), created] } : null);
        setNodePositions((prev) => {
          const count = Object.keys(prev).length;
          const cols = Math.max(1, Math.ceil(Math.sqrt(count + 1)));
          return {
            ...prev,
            [created.entity_id]: {
              x: 80 + (count % cols) * 350,
              y: 80 + Math.floor(count / cols) * 320,
            },
          };
        });
      }
      setEntityModalOpen(false);
      setSaveSuccessMsg("Entity saved!");
      setTimeout(() => setSaveSuccessMsg(null), 2500);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    }
  };

  const deleteEntity = async (id: string) => {
    if (!selectedOntology) return;
    try {
      await api.deleteEntity(selectedOntology.ontology_version_id, id);
      setSelectedOntology((p) =>
        p ? {
          ...p,
          entities: (p.entities || []).filter((e) => e.entity_id !== id),
          relationships: (p.relationships || []).filter((r) => r.source_entity_id !== id && r.target_entity_id !== id),
        } : null
      );
      setSelectedEntityIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setCollapsedEntityIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setNodePositions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const deleteSelectedEntities = async () => {
    if (!selectedOntology || selectedEntityIds.size === 0) return;
    const ids = Array.from(selectedEntityIds);
    try {
      for (const id of ids) {
        await api.deleteEntity(selectedOntology.ontology_version_id, id);
      }
      setSelectedOntology((p) =>
        p ? {
          ...p,
          entities: (p.entities || []).filter((e) => !selectedEntityIds.has(e.entity_id)),
          relationships: (p.relationships || []).filter((r) => !selectedEntityIds.has(r.source_entity_id) && !selectedEntityIds.has(r.target_entity_id)),
        } : null
      );
      setSelectedEntityIds(new Set());
      setCollapsedEntityIds((prev) => {
        const n = new Set(prev);
        for (const id of ids) n.delete(id);
        return n;
      });
      setNodePositions((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
    } catch (e: any) {
      alert(`Bulk delete failed: ${e.message}`);
    }
  };

  const openAddAttribute = (entity: OntologyEntity) => {
    setTargetEntityForAttr(entity);
    setEditingAttrId(null);
    setAttrName("");
    setAttrLabel("");
    setAttrDatatype("string");
    setAttrIsPK(false);
    setAttrIsFK(false);
    setAttrIsIndex(false);
    setAttrIsNullable(true);
    setAttrIsPII(false);
    setAttrFKTarget("");
    setAttrDefaultVal("");
    setAttrDesc("");
    setAttrModalOpen(true);
  };

  const openEditAttribute = (entity: OntologyEntity, attr: EntityAttribute) => {
    setTargetEntityForAttr(entity);
    setEditingAttrId(attr.attribute_id);
    setAttrName(attr.name);
    setAttrLabel(attr.label);
    setAttrDatatype(attr.datatype || "string");
    setAttrIsPK(!!attr.is_primary_key);
    setAttrIsFK(!!attr.is_foreign_key);
    setAttrIsIndex(!!attr.is_indexed);
    setAttrIsNullable(!!attr.is_nullable);
    setAttrIsPII(!!attr.is_pii);
    setAttrFKTarget(attr.foreign_key_target || "");
    setAttrDefaultVal(attr.default_value || "");
    setAttrDesc(attr.description || "");
    setAttrModalOpen(true);
  };

  const saveAttribute = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOntology || !targetEntityForAttr || !attrName.trim()) return;
    const formattedName = attrName.trim().toLowerCase().replace(/\s+/g, "_");
    const formattedLabel = attrLabel.trim() || attrName.trim();
    const attr: EntityAttribute = {
      attribute_id: editingAttrId || `attr-${Math.random().toString(36).slice(2, 10)}`,
      name: formattedName, label: formattedLabel, datatype: attrDatatype,
      is_primary_key: attrIsPK, is_foreign_key: attrIsFK,
      is_indexed: attrIsIndex || attrIsPK || attrIsFK,
      is_nullable: attrIsPK ? false : attrIsNullable,
      is_unique: attrIsPK, is_pii: attrIsPII,
      foreign_key_target: attrIsFK ? attrFKTarget.trim() || undefined : undefined,
      default_value: attrDefaultVal.trim() || undefined,
      description: attrDesc.trim(),
    };
    const updated = editingAttrId
      ? targetEntityForAttr.attributes.map((a) => a.attribute_id === editingAttrId ? attr : a)
      : [...targetEntityForAttr.attributes, attr];
    try {
      const updatedEntity = await api.updateEntity(
        selectedOntology.ontology_version_id, targetEntityForAttr.entity_id, { attributes: updated }
      );
      setSelectedOntology((p) =>
        p ? { ...p, entities: (p.entities || []).map((e) => e.entity_id === targetEntityForAttr.entity_id ? updatedEntity : e) } : null
      );
      if (inspectingEntity?.entity_id === targetEntityForAttr.entity_id) setInspectingEntity(updatedEntity);
      setAttrModalOpen(false);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  const deleteAttribute = async (entity: OntologyEntity, attrId: string) => {
    if (!selectedOntology) return;
    try {
      const updatedEntity = await api.updateEntity(
        selectedOntology.ontology_version_id, entity.entity_id,
        { attributes: entity.attributes.filter((a) => a.attribute_id !== attrId) }
      );
      setSelectedOntology((p) =>
        p ? { ...p, entities: (p.entities || []).map((e) => e.entity_id === entity.entity_id ? updatedEntity : e) } : null
      );
      if (inspectingEntity?.entity_id === entity.entity_id) setInspectingEntity(updatedEntity);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  const openAddRelationship = () => {
    if (!selectedOntology?.entities || selectedOntology.entities.length < 2) {
      alert("Add at least 2 entities first.");
      return;
    }
    setEditingRelId(null);
    setRelSourceId(selectedOntology.entities[0].entity_id);
    setRelTargetId(selectedOntology.entities[1].entity_id);
    setRelSourceAttr("");
    setRelTargetAttr("");
    setRelName("associates_with");
    setRelLabel("Associates With");
    setRelType("ASSOCIATION");
    setRelCardinality("ONE_TO_MANY");
    setRelCascade("CASCADE");
    setRelDesc("");
    setRelBidirectional(false);
    setRelModalOpen(true);
  };

  const openEditRelationship = (rel: OntologyRelationship) => {
    setEditingRelId(rel.relationship_id);
    setRelSourceId(rel.source_entity_id);
    setRelTargetId(rel.target_entity_id);
    setRelSourceAttr(rel.source_attribute_name || "");
    setRelTargetAttr(rel.target_attribute_name || "");
    setRelName(rel.name);
    setRelLabel(rel.label || rel.name);
    setRelType(rel.relation_type || "ASSOCIATION");
    setRelCardinality(rel.cardinality || "ONE_TO_MANY");
    setRelCascade(rel.cascade_rule || "CASCADE");
    setRelDesc(rel.description || "");
    setRelBidirectional(!!rel.is_bidirectional);
    setRelModalOpen(true);
  };

  const saveRelationship = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOntology || !relSourceId || !relTargetId) return;
    try {
      if (editingRelId) {
        const updated = await api.updateRelationship(
          selectedOntology.ontology_version_id, editingRelId,
          { name: relName.trim(), label: relLabel.trim() || relName.trim(), relation_type: relType, cardinality: relCardinality, cascade_rule: relCascade, description: relDesc.trim(), is_bidirectional: relBidirectional }
        );
        setSelectedOntology((p) =>
          p ? { ...p, relationships: (p.relationships || []).map((r) => r.relationship_id === editingRelId ? updated : r) } : null
        );
      } else {
        const created = await api.addRelationship(selectedOntology.ontology_version_id, {
          name: relName.trim(), label: relLabel.trim() || relName.trim(), source_entity_id: relSourceId, target_entity_id: relTargetId, relation_type: relType, cardinality: relCardinality, description: relDesc.trim(), is_bidirectional: relBidirectional,
        });
        setSelectedOntology((p) => p ? { ...p, relationships: [...(p.relationships || []), created] } : null);
      }
      setRelModalOpen(false);
      setConnectingSourceId(null);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  const deleteRelationship = async (relId: string) => {
    if (!selectedOntology) return;
    try {
      await api.deleteRelationship(selectedOntology.ontology_version_id, relId);
      setSelectedOntology((p) =>
        p ? { ...p, relationships: (p.relationships || []).filter((r) => r.relationship_id !== relId) } : null
      );
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  const deleteOntology = async (ontId: string) => {
    try {
      await api.deleteOntology(ontId);
      clearCanvasState(ontId);
      await loadOntologies();
      if (selectedOntology?.ontology_version_id === ontId) {
        setViewMode("registry");
        setSelectedOntology(null);
        setNodePositions({});
        setCollapsedEntityIdsRaw(new Set());
      }
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    }
  };

  useEffect(() => {
    if (inspectingEntity) setEditingEntityDef(inspectingEntity.description || "");
  }, [inspectingEntity]);

  useEffect(() => {
    if (selectedOntology && inspectingEntity) {
      const match = (selectedOntology.entities || []).find((e) => e.entity_id === inspectingEntity.entity_id);
      if (match) setInspectingEntity(match);
    }
  }, [selectedOntology]);

  const saveEntityDefinition = async () => {
    if (!selectedOntology || !inspectingEntity) return;
    setSavingEntityDef(true);
    try {
      const updated = await api.updateEntity(
        selectedOntology.ontology_version_id, inspectingEntity.entity_id, { description: editingEntityDef.trim() }
      );
      setSelectedOntology((p) =>
        p ? { ...p, entities: (p.entities || []).map((e) => e.entity_id === inspectingEntity.entity_id ? updated : e) } : null
      );
      setInspectingEntity(updated);
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    } finally {
      setSavingEntityDef(false);
    }
  };

  const handleApplyPlan = async (msg: AgentMessage) => {
    if (!msg.plan_data || applyingPlanId) return;
    setApplyingPlanId(msg.id);
    setAgentError(null);
    try {
      const targetId = agentMode === "augment" && selectedOntology ? selectedOntology.ontology_version_id : undefined;
      const res = await api.applyAgentPlan({
        project_id: activeProjectId || "proj-default",
        target_ontology_id: targetId,
        plan_data: msg.plan_data,
      });
      setSessions((p) => p.map((s) => ({
        ...s, updated_at: Date.now(), messages: s.messages.map((m) => m.id === msg.id ? { ...m, plan_applied: true } : m)
      })));
      setAgentSuccessMsg(`Applied plan (${res.entity_count} entities, ${res.relationship_count} relationships)!`);
      if (res.ontology?.ontology_version_id) {
        await loadOntologies(res.ontology.ontology_version_id, true);
        setTimeout(() => loadOntologies(res.ontology.ontology_version_id, true), 250);
      } else if (selectedOntology?.ontology_version_id) {
        await loadOntologies(selectedOntology.ontology_version_id, true);
        setTimeout(() => loadOntologies(selectedOntology.ontology_version_id, true), 250);
      }
    } catch (e: any) {
      setAgentError(e.message);
    } finally {
      setApplyingPlanId(null);
    }
  };

  const handleSendMessage = async (text?: string) => {
    const q = (text || agentPrompt).trim();
    if (!q || agentRunning || !activeSession) return;

    let canvasContext = "";
    if (selectedOntology) {
      const ents = selectedOntology.entities || [];
      const rels = selectedOntology.relationships || [];
      if (ents.length > 0) {
        canvasContext = `\n\n[CURRENT CANVAS STATE]
Ontology: "${selectedOntology.name}" (${selectedOntology.domain || "General"})
Entities: ${ents.map((e) => e.name).join(", ")}
Relationships: ${rels.length}
${
  rels.length > 0 && rels.length <= 8
    ? "Sample relationships:\n" +
      rels.slice(0, 8).map((r) => `  ${r.source_entity_name} → ${r.name} → ${r.target_entity_name}`).join("\n")
    : ""
}
`;
      }
    }

    const trimmedHistory = activeSession.messages.slice(-4).map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));
    const userMsg: AgentMessage = { id: `user-${Date.now()}`, role: "user", content: q, timestamp: Date.now() };
    const updated = [...activeSession.messages, userMsg];

    setSessions((p) => p.map((s) => s.id === activeSession.id ? {
      ...s, updated_at: Date.now(),
      title: s.messages.length <= 1 ? q.slice(0, 28) + (q.length > 28 ? "..." : "") : s.title,
      messages: updated,
    } : s));

    setAgentPrompt("");
    setAgentRunning(true);
    setAgentError(null);
    setAgentSuccessMsg(null);
    setAgentSteps([{ stage: "Engine", summary: "Dispatching..." }]);

    try {
      const targetId = agentMode === "augment" && selectedOntology ? selectedOntology.ontology_version_id : undefined;
      const res = await api.generateOntologyWithAgent({
        prompt: q + canvasContext,
        project_id: activeProjectId || "proj-default",
        target_ontology_id: targetId,
        mode: executionMode,
        chat_history: trimmedHistory,
      });

      const assistantMsg: AgentMessage = {
        id: `agent-${Date.now()}`,
        role: "assistant",
        content: res.response_markdown || `Synthesized ${res.entity_count} entities and ${res.relationship_count} relationships.`,
        markdown: res.response_markdown,
        reasoning_steps: res.reasoning_steps || [],
        timestamp: Date.now(),
        is_plan: res.is_plan,
        plan_data: res.plan_data,
        plan_applied: false,
      };

      setSessions((p) => p.map((s) => s.id === activeSession.id ? { ...s, updated_at: Date.now(), messages: [...s.messages, assistantMsg] } : s));
      setAgentSteps(res.reasoning_steps || []);

      if (!res.is_plan) {
        const freshId = res.ontology?.ontology_version_id;
        setAgentSuccessMsg(`Synthesized ${res.entity_count} entities and ${res.relationship_count} relationships.`);
        if (freshId) {
          try {
            const fresh = await api.getOntology(freshId);
            if (fresh && fresh.entities && fresh.entities.length > 0) {
              setSelectedOntology(fresh);
              hydrateCanvasFromStorage(fresh);
              setViewMode("builder");
              setActiveTab("graph");
            } else {
              await new Promise((r) => setTimeout(r, 400));
              const retry = await api.getOntology(freshId);
              if (retry) {
                setSelectedOntology(retry);
                hydrateCanvasFromStorage(retry);
                setViewMode("builder");
                setActiveTab("graph");
              }
            }
          } catch (e) {
            console.error("Failed to load ontology after action:", e);
          }
        }
      } else {
        setAgentSuccessMsg("Blueprint ready — click Approve & Apply on the message.");
      }
    } catch (e: any) {
      setAgentError(e.message || "Agent execution failed.");
    } finally {
      setAgentRunning(false);
    }
  };

  const filteredEntities = useMemo(() => {
    if (!selectedOntology?.entities) return [];
    return selectedOntology.entities.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = e.name.toLowerCase().includes(q) || (e.label || "").toLowerCase().includes(q) || (e.description || "").toLowerCase().includes(q);
      const matchesCat = categoryFilter === "ALL" || e.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [selectedOntology, searchQuery, categoryFilter]);

  const handleNewChat = () => {
    const fresh = makeFreshSession(selectedModel);
    setSessions((prev) => [fresh, ...prev]);
    setCurrentSessionId(fresh.id);
    setAgentPrompt("");
    setAgentSteps([]);
    setAgentError(null);
    setAgentSuccessMsg(null);
  };

  const handleArchiveSession = (id: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, is_archived: !s.is_archived, updated_at: Date.now() } : s
      );
      if (id === currentSessionId) {
        const nextActive = updated.find((s) => !s.is_archived);
        if (nextActive) setCurrentSessionId(nextActive.id);
        else {
          const fresh = makeFreshSession(selectedModel);
          setCurrentSessionId(fresh.id);
          return [fresh, ...updated];
        }
      }
      return updated;
    });
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (updated.length === 0) {
        const fresh = makeFreshSession(selectedModel);
        setCurrentSessionId(fresh.id);
        return [fresh];
      }
      if (id === currentSessionId) {
        const nextActive = updated.find((s) => !s.is_archived) || updated[0];
        setCurrentSessionId(nextActive.id);
      }
      return updated;
    });
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    setAgentError(null);
    setAgentSuccessMsg(null);
    setAgentSteps([]);
  };

  return {
    activeProject, activeProjectId, viewMode, setViewMode, activeTab, setActiveTab,
    handleOpenBuilderForOntology, handleBackToRegistry, ontologies, selectedOntology, setSelectedOntology,
    loading, loadOntologies, savingOntology, saveSuccessMsg, handleSaveFullOntology, deleteOntology,
    nodePositions, zoomLevel, setZoomLevel, panOffset, setPanOffset, canvasRef,
    handleCanvasMouseDown, handleNodeMouseDown, connectingSourceId, setConnectingSourceId,
    collapsedEntityIds, toggleEntityCollapsed,
    collapseAllEntities, expandAllEntities, toggleCollapseAllEntities, allEntitiesCollapsed,
    selectedEntityIds, setSelectedEntityIds, selectedEntityId,
    deleteSelectedEntities, handleAutoLayout, getContentBounds, focusViewOnAll,
    inspectingEntity, setInspectingEntity, editingEntityDef, setEditingEntityDef, savingEntityDef, saveEntityDefinition,
    entityModalOpen, setEntityModalOpen, editingEntityId, entName, setEntName, entLabel, setEntLabel,
    entCategory, setEntCategory, entDesc, setEntDesc, openAddEntity, openEditEntity, saveEntity, deleteEntity,
    attrModalOpen, setAttrModalOpen, targetEntityForAttr, editingAttrId, attrName, setAttrName, attrLabel, setAttrLabel,
    attrDatatype, setAttrDatatype, attrIsPK, setAttrIsPK, attrIsFK, setAttrIsFK, attrIsIndex, setAttrIsIndex,
    attrIsNullable, setAttrIsNullable, attrIsPII, setAttrIsPII, attrFKTarget, setAttrFKTarget, attrDefaultVal, setAttrDefaultVal,
    attrDesc, setAttrDesc, openAddAttribute, openEditAttribute, saveAttribute, deleteAttribute,
    relModalOpen, setRelModalOpen, editingRelId, relName, setRelName, relLabel, setRelLabel,
    relSourceId, setRelSourceId, relTargetId, setRelTargetId, relSourceAttr, setRelSourceAttr, relTargetAttr, setRelTargetAttr,
    relType, setRelType, relCardinality, setRelCardinality, relCascade, setRelCascade, relDesc, setRelDesc,
    relBidirectional, setRelBidirectional, openAddRelationship, openEditRelationship, saveRelationship, deleteRelationship,
    editOntologyModal, setEditOntologyModal, editOntName, setEditOntName, editOntDomain, setEditOntDomain,
    editOntVersion, setEditOntVersion, editOntDesc, setEditOntDesc, searchQuery, setSearchQuery,
    categoryFilter, setCategoryFilter, filteredEntities,
    isAgentOpen, setIsAgentOpen, agentPrompt, setAgentPrompt, agentRunning, agentSteps, agentError, agentSuccessMsg,
    executionMode, setExecutionMode, agentMode, setAgentMode, applyingPlanId, selectedModel, setSelectedModel,
    sessions, currentSessionId, setCurrentSessionId, activeSession, chatScrollRef,
    handleNewChat, handleArchiveSession, handleDeleteSession, handleSelectSession,
    handleApplyPlan, handleSendMessage,
    activeTool, setActiveTool, spaceHeld, marquee, isPanning, draggingEntityId,
    commandPaletteOpen, setCommandPaletteOpen, handleSearchJump,
  };
}

export type OntologyState = ReturnType<typeof useOntologyState>;