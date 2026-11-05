"use client";

import { Layers } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { OntologyState } from "../useOntologyState";
import { ModalShell, Field, Footer, inputClass } from "./shared";

const CATEGORY_OPTIONS = [
  { value: "Master Data", label: "Master Data", description: "Core entities: Customer, Product" },
  { value: "Transactional", label: "Transactional", description: "Events: Order, Payment" },
  { value: "Reference", label: "Reference", description: "Lookups: Currency, Status" },
  { value: "Associative", label: "Associative", description: "Junctions: OrderItem" },
  { value: "Operational", label: "Operational", description: "Audit, Logs" },
];

export function EntityModal({ s }: { s: OntologyState }) {
  if (!s.entityModalOpen) return null;
  return (
    <ModalShell
      onClose={() => s.setEntityModalOpen(false)}
      icon={Layers}
      title={s.editingEntityId ? "Edit Business Entity" : "Create New Business Entity"}
    >
      <form onSubmit={s.saveEntity} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
        <Field label="Entity Name (PascalCase) *">
          <input
            type="text"
            required
            value={s.entName}
            onChange={(e) => s.setEntName(e.target.value)}
            placeholder="e.g. Customer, Account, Invoice"
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="Business Label">
          <input
            type="text"
            value={s.entLabel}
            onChange={(e) => s.setEntLabel(e.target.value)}
            placeholder="e.g. Customer Master Record"
            className={inputClass}
          />
        </Field>

        <Field label="Category Archetype">
          <CustomSelect
            value={s.entCategory}
            onChange={s.setEntCategory}
            options={CATEGORY_OPTIONS}
          />
        </Field>

        <Field label="Semantic Description">
          <textarea
            rows={3}
            value={s.entDesc}
            onChange={(e) => s.setEntDesc(e.target.value)}
            placeholder="Formal ontological definition and business usage rules..."
            className={inputClass}
          />
        </Field>

        <Footer
          onCancel={() => s.setEntityModalOpen(false)}
          submitLabel={s.editingEntityId ? "Update Entity" : "Create Entity"}
        />
      </form>
    </ModalShell>
  );
}