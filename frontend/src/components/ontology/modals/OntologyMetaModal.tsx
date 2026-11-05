"use client";

import { useEffect, useState } from "react";
import {
  Edit2, Save, X, Trash2, Layers, Share2, Hash, Globe2,
  Clock, AlertTriangle, Loader2, Sparkles, FileText,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { OntologyState } from "../useOntologyState";
import { inputClass } from "./shared";

export function OntologyMetaModal({ s }: { s: OntologyState }) {
  const ont = s.selectedOntology;

  // Local form state — decoupled from the hook so typing feels instant,
  // and closing without saving leaves the hook untouched.
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [version, setVersion] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sync local form when the modal opens for a (new) ontology
  useEffect(() => {
    if (s.editOntologyModal && ont) {
      setName(ont.name || "");
      setDomain(ont.domain || "");
      setVersion(ont.version_tag || "1.0.0");
      setDesc(ont.description || "");
      setErr(null);
      setConfirmDelete(false);
    }
  }, [s.editOntologyModal, ont?.ontology_version_id]); // eslint-disable-line

  if (!s.editOntologyModal || !ont) return null;

  const dirty =
    name !== (ont.name || "") ||
    domain !== (ont.domain || "") ||
    version !== (ont.version_tag || "1.0.0") ||
    desc !== (ont.description || "");

  const fieldCount =
    ont.entities?.reduce((a: number, e: any) => a + (e.attributes?.length || 0), 0) || 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Title is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const updated = await api.updateOntology(ont.ontology_version_id, {
        name: name.trim(),
        domain: domain.trim(),
        version_tag: version.trim() || "1.0.0",
        description: desc.trim(),
      });
      s.setSelectedOntology(updated);
      s.setEditOntologyModal(false);
      await s.loadOntologies(updated.ontology_version_id);
    } catch (err: any) {
      setErr(err?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await s.deleteOntology(ont.ontology_version_id);
      s.setEditOntologyModal(false);
    } catch (err: any) {
      setErr(err?.message || "Delete failed.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col my-4 sm:my-0 max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Edit2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 truncate">Edit Ontology</h3>
              <p className="text-[10.5px] text-slate-500 truncate">
                {ont.name} · v{ont.version_tag}
              </p>
            </div>
          </div>
          <button
            onClick={() => s.setEditOntologyModal(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — 2 columns on md+ */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-0 md:gap-0">
            {/* ── Left: form ──────────────────────────────── */}
            <form
              onSubmit={handleSave}
              className="p-5 sm:p-6 space-y-4 text-xs min-w-0"
            >
              {err && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 text-[11px] block">
                  Ontology Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Core Banking Ledger"
                  className={`${inputClass} text-sm font-semibold`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 text-[11px] block">Domain</label>
                  <div className="relative">
                    <Globe2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. Banking & Financial Services"
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 text-[11px] block">Version Tag</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 text-[11px] block flex items-center justify-between">
                  <span>Description & Scope</span>
                  <span className="text-[10px] text-slate-400 font-mono">{desc.length}/2000</span>
                </label>
                <textarea
                  rows={8}
                  maxLength={2000}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Describe what this ontology covers, the business rules it encodes, and any dependencies downstream systems rely on."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-[10.5px] text-slate-500 flex items-center gap-1.5">
                  {dirty ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Unsaved changes
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      No changes
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => s.setEditOntologyModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !dirty}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{saving ? "Saving..." : "Save changes"}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* ── Right: summary + danger zone ─────────────── */}
            <aside className="bg-slate-50/60 border-t md:border-t-0 md:border-l border-slate-100 p-5 sm:p-6 space-y-4 min-w-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  At a glance
                </span>
                <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
                  <SummaryRow icon={Layers} label="Entities" value={ont.entities?.length || 0} />
                  <SummaryRow icon={Share2} label="Relationships" value={ont.relationships?.length || 0} />
                  <SummaryRow icon={Hash} label="Fields" value={fieldCount} />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Identity
                </span>
                <dl className="space-y-1.5 text-[11px]">
                  <MetaRow label="ID" value={ont.ontology_version_id} mono />
                  <MetaRow label="Created" value={fmtDate((ont as any).created_at)} />
                  <MetaRow label="Updated" value={fmtDate((ont as any).updated_at)} />
                </dl>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Danger zone
                </span>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-[11.5px] font-semibold hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete ontology
                  </button>
                ) : (
                  <div className="space-y-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-[11px] text-red-800 font-medium">
                      Delete <span className="font-bold">{ont.name}</span> and all its
                      entities, relationships, and layout? This cannot be undone.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 flex items-center gap-2 md:justify-between md:flex-row">
      <span className="text-[10.5px] text-slate-500 flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span className="font-mono font-bold text-xs text-slate-900">{value}</span>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd
        className={`text-slate-800 text-right truncate ${mono ? "font-mono text-[10px]" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function fmtDate(ts?: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleString([], {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}