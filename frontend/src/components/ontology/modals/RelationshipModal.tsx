"use client";

import { Share2 } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomCheckbox } from "@/components/ui/custom-checkbox";
import { OntologyState } from "../useOntologyState";
import { ModalShell, Field, Footer, inputClass, SearchableSelect } from "./shared";

const CARDINALITY_OPTIONS = [
  { value: "ONE_TO_MANY", label: "1:N (One to Many)" },
  { value: "ONE_TO_ONE", label: "1:1 (One to One)" },
  { value: "MANY_TO_ONE", label: "N:1 (Many to One)" },
  { value: "MANY_TO_MANY", label: "N:M (Many to Many)" },
  { value: "INHERITANCE", label: "IS-A (Inheritance)" },
];

const RELATION_TYPE_OPTIONS = [
  { value: "ASSOCIATION", label: "ASSOCIATION" },
  { value: "COMPOSITION", label: "COMPOSITION" },
  { value: "AGGREGATION", label: "AGGREGATION" },
  { value: "INHERITANCE", label: "INHERITANCE" },
];

export function RelationshipModal({ s }: { s: OntologyState }) {
  if (!s.relModalOpen) return null;
  const entities = s.selectedOntology?.entities || [];

  const entityOptions = entities.map((e) => ({
    value: e.entity_id,
    label: e.name,
    description: e.label && e.label !== e.name ? e.label : e.category,
  }));

  return (
    <ModalShell
      onClose={() => s.setRelModalOpen(false)}
      icon={Share2}
      title={s.editingRelId ? "Edit Ontological Relationship" : "Add Ontological Relationship"}
    >
      <form onSubmit={s.saveRelationship} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Source Entity" hint="Type to search across all entities">
            <SearchableSelect
              value={s.relSourceId}
              onChange={s.setRelSourceId}
              options={entityOptions}
              placeholder="Search source entity..."
              emptyLabel="No matching entity"
            />
          </Field>
          <Field label="Target Entity" hint="Type to search across all entities">
            <SearchableSelect
              value={s.relTargetId}
              onChange={s.setRelTargetId}
              options={entityOptions}
              placeholder="Search target entity..."
              emptyLabel="No matching entity"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Relationship Verb (snake_case) *" hint="e.g. owns, operates, treats">
            <input
              type="text"
              required
              value={s.relName}
              onChange={(e) => s.setRelName(e.target.value)}
              placeholder="owns"
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Display Label">
            <input
              type="text"
              value={s.relLabel}
              onChange={(e) => s.setRelLabel(e.target.value)}
              placeholder="Owns"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Cardinality">
            <CustomSelect
              value={s.relCardinality}
              onChange={s.setRelCardinality}
              options={CARDINALITY_OPTIONS}
            />
          </Field>
          <Field label="Relation Type">
            <CustomSelect
              value={s.relType}
              onChange={s.setRelType}
              options={RELATION_TYPE_OPTIONS}
            />
          </Field>
        </div>

        <Field label="Business Meaning *">
          <textarea
            rows={3}
            required
            value={s.relDesc}
            onChange={(e) => s.setRelDesc(e.target.value)}
            placeholder="An owner controls one or more warehouses."
            className={inputClass}
          />
        </Field>

        <CustomCheckbox
          checked={s.relBidirectional}
          onChange={s.setRelBidirectional}
          label="Bidirectional"
          hint="Arrow on both ends"
        />

        <Footer
          onCancel={() => s.setRelModalOpen(false)}
          submitLabel={s.editingRelId ? "Update Relationship" : "Add Relationship"}
        />
      </form>
    </ModalShell>
  );
}