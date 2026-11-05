"use client";

import { Key } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomCheckbox } from "@/components/ui/custom-checkbox";
import { OntologyState } from "../useOntologyState";
import { ModalShell, Field, Footer, inputClass } from "./shared";

const DATATYPE_OPTIONS = [
  { value: "string", label: "string", description: "Varchar" },
  { value: "uuid", label: "uuid", description: "Unique identifier" },
  { value: "integer", label: "integer", description: "32-bit" },
  { value: "bigint", label: "bigint", description: "64-bit" },
  { value: "decimal", label: "decimal(18,2)", description: "Financial" },
  { value: "float", label: "float", description: "Double precision" },
  { value: "boolean", label: "boolean", description: "True/False" },
  { value: "timestamp", label: "timestamp", description: "UTC datetime" },
  { value: "date", label: "date", description: "YYYY-MM-DD" },
  { value: "json", label: "json", description: "Structured nested" },
  { value: "text", label: "text", description: "Unbounded string" },
];

export function AttributeModal({ s }: { s: OntologyState }) {
  if (!s.attrModalOpen) return null;
  return (
    <ModalShell
      onClose={() => s.setAttrModalOpen(false)}
      icon={Key}
      title={s.editingAttrId ? "Edit Attribute" : "Add Entity Attribute"}
    >
      <form onSubmit={s.saveAttribute} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
        {s.targetEntityForAttr && (
          <div className="text-[10px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100">
            Entity: <span className="font-mono font-semibold text-slate-800">{s.targetEntityForAttr.name}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Attribute Name *">
            <input type="text" required value={s.attrName} onChange={(e) => s.setAttrName(e.target.value)} placeholder="e.g. customer_id, email" className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Business Label">
            <input type="text" value={s.attrLabel} onChange={(e) => s.setAttrLabel(e.target.value)} placeholder="e.g. Email Address" className={inputClass} />
          </Field>
        </div>

        <Field label="Canonical Datatype">
          <CustomSelect value={s.attrDatatype} onChange={s.setAttrDatatype} options={DATATYPE_OPTIONS} />
        </Field>

        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <CustomCheckbox checked={s.attrIsPK} onChange={(v) => { s.setAttrIsPK(v); if (v) { s.setAttrIsNullable(false); s.setAttrIsIndex(true); } }} label="Primary Key" tone="amber" />
          <CustomCheckbox checked={s.attrIsFK} onChange={s.setAttrIsFK} label="Foreign Key" tone="sky" />
          <CustomCheckbox checked={s.attrIsIndex} onChange={s.setAttrIsIndex} label="Indexed" />
          <CustomCheckbox checked={s.attrIsNullable} onChange={s.setAttrIsNullable} label="Nullable" disabled={s.attrIsPK} />
          <div className="col-span-2">
            <CustomCheckbox checked={s.attrIsPII} onChange={s.setAttrIsPII} label="Contains PII" tone="red" hint="Sensitive / GDPR data" />
          </div>
        </div>

        {s.attrIsFK && (
          <Field label="Referenced Target (Entity.column)">
            <input type="text" value={s.attrFKTarget} onChange={(e) => s.setAttrFKTarget(e.target.value)} placeholder="e.g. Customer.customer_id" className={`${inputClass} font-mono`} />
          </Field>
        )}

        <Field label="Description">
          <textarea rows={2} value={s.attrDesc} onChange={(e) => s.setAttrDesc(e.target.value)} placeholder="Optional business context..." className={inputClass} />
        </Field>

        <Footer onCancel={() => s.setAttrModalOpen(false)} submitLabel={s.editingAttrId ? "Update Attribute" : "Save Attribute"} />
      </form>
    </ModalShell>
  );
}