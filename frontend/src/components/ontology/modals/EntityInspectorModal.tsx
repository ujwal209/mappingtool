"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Layers, X, Save, Plus, Edit2, Trash2, Search, XCircle,
} from "lucide-react";
import { OntologyState } from "../useOntologyState";
import { inputClass } from "./shared";

export function EntityInspectorModal({ s }: { s: OntologyState }) {
  const entity = s.inspectingEntity;

  // ─── All hooks FIRST, before any early return ────────────
  const [attrQuery, setAttrQuery] = useState("");

  // Reset the local search when the modal switches to a different entity
  useEffect(() => {
    setAttrQuery("");
  }, [entity?.entity_id]);

  const connectedRels = useMemo(() => {
    if (!entity) return [];
    return (
      (s.selectedOntology?.relationships || []).filter(
        (r) =>
          r.source_entity_id === entity.entity_id ||
          r.target_entity_id === entity.entity_id
      )
    );
  }, [entity, s.selectedOntology?.relationships]);

  const filteredAttrs = useMemo(() => {
    const list = entity?.attributes || [];
    const q = attrQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.label || "").toLowerCase().includes(q) ||
        (a.datatype || "").toLowerCase().includes(q)
    );
  }, [entity?.attributes, attrQuery]);

  // ─── Now the early return is safe ────────────────────────
  if (!entity) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm truncate">{entity.name}</h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                  {entity.category || "Master Data"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate block">
                {entity.label || entity.name}
              </span>
            </div>
          </div>
          <button
            onClick={() => s.setInspectingEntity(null)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
          {/* Definition */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Ontological Definition
              </label>
              <button
                type="button"
                disabled={s.savingEntityDef}
                onClick={s.saveEntityDefinition}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold disabled:opacity-50 flex items-center gap-1"
              >
                <Save className={`w-3 h-3 ${s.savingEntityDef ? "animate-spin" : ""}`} />
                <span>{s.savingEntityDef ? "Saving..." : "Save"}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={s.editingEntityDef}
              onChange={(e) => s.setEditingEntityDef(e.target.value)}
              placeholder="Formal definition, business rules, semantic context..."
              className={inputClass}
            />
          </div>

          {/* Attributes */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Attributes ({filteredAttrs.length}
                {attrQuery && ` / ${entity.attributes?.length || 0}`})
              </label>
              <button
                type="button"
                onClick={() => s.openAddAttribute(entity)}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {(entity.attributes?.length || 0) > 6 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                <input
                  value={attrQuery}
                  onChange={(e) => setAttrQuery(e.target.value)}
                  placeholder="Filter attributes by name, label or datatype..."
                  className={`${inputClass} pl-8 pr-8`}
                />
                {attrQuery && (
                  <button
                    onClick={() => setAttrQuery("")}
                    className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-700 rounded"
                    title="Clear"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {filteredAttrs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  {attrQuery
                    ? `No attributes match "${attrQuery}".`
                    : "No attributes defined yet."}
                </div>
              ) : (
                filteredAttrs.map((attr) => (
                  <div
                    key={attr.attribute_id}
                    className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {attr.is_primary_key ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold font-mono text-[9px] border border-amber-200">
                          PK
                        </span>
                      ) : attr.is_foreign_key ? (
                        <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold font-mono text-[9px] border border-sky-200">
                          FK
                        </span>
                      ) : attr.is_indexed ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold font-mono text-[9px] border border-slate-200">
                          IDX
                        </span>
                      ) : (
                        <span className="w-5" />
                      )}
                      <div className="truncate min-w-0">
                        <span className="font-mono font-semibold text-slate-900 block truncate">
                          {attr.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {attr.label || attr.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                        {attr.datatype || "string"}
                      </span>
                      {attr.foreign_key_target && (
                        <span
                          className="text-[9px] font-mono text-blue-600 truncate max-w-[100px] hidden sm:inline"
                          title={attr.foreign_key_target}
                        >
                          → {attr.foreign_key_target}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => s.openEditAttribute(entity, attr)}
                        className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => s.deleteAttribute(entity, attr.attribute_id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Connected relationships */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
              Connected Relationships ({connectedRels.length})
            </label>
            <div className="space-y-1.5">
              {connectedRels.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">
                  No relationships linked yet.
                </p>
              ) : (
                connectedRels.map((rel) => {
                  const isSrc = rel.source_entity_id === entity.entity_id;
                  const other = s.selectedOntology?.entities?.find(
                    (e) =>
                      e.entity_id ===
                      (isSrc ? rel.target_entity_id : rel.source_entity_id)
                  );
                  return (
                    <div
                      key={rel.relationship_id}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-slate-900 shrink-0">
                          {rel.name}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">
                          {isSrc ? "→" : "←"}{" "}
                          <strong className="text-slate-800">
                            {other?.name || "Entity"}
                          </strong>
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-white text-slate-600 rounded border border-slate-200 font-mono shrink-0">
                          {rel.cardinality || "1:N"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => s.openEditRelationship(rel)}
                        className="text-[10px] text-blue-600 hover:underline font-semibold shrink-0"
                      >
                        Configure
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              s.openEditEntity(entity);
              s.setInspectingEntity(null);
            }}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit Metadata</span>
          </button>
          <button
            type="button"
            onClick={() => s.setInspectingEntity(null)}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800"
          >
            Done
          </button>
        </div>
        
      </div>
    </div>
  );
}