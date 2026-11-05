/**
 * All RAG-related constants live here so the UI has no magic strings/numbers.
 * When the backend exposes `/rag/config` (document types, chunk limits,
 * default top_k, etc.), fetch it here and cache it — every page reads
 * from the same source.
 */

export const RAG_DOCUMENT_TYPES = [
  { value: "RULEBOOK",      label: "Rulebook",       description: "Transformation rules & validation constraints" },
  { value: "GLOSSARY",      label: "Glossary",       description: "Business terminology & definitions" },
  { value: "COMPLIANCE",    label: "Compliance",     description: "Data privacy, retention & PII rules" },
  { value: "SPECIFICATION", label: "Specification",  description: "Physical column formats & layouts" },
  { value: "CONTRACT",      label: "Contract",       description: "Service / data contracts between systems" },
  { value: "POLICY",        label: "Policy",         description: "Organizational governance policies" },
  { value: "OTHER",         label: "Other",          description: "Anything else the ontology should know about" },
] as const;

export type RagDocumentType = typeof RAG_DOCUMENT_TYPES[number]["value"];

export function ragDocTypeLabel(type: string): string {
  return RAG_DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// Ingest defaults (used only as initial form values — user can change)
export const DEFAULT_CHUNK_SIZE = 600;
export const DEFAULT_CHUNK_OVERLAP = 100;
export const MIN_CHUNK_SIZE = 100;
export const MAX_CHUNK_SIZE = 5000;

// Query defaults
export const DEFAULT_TOP_K = 4;
export const MIN_TOP_K = 1;
export const MAX_TOP_K = 20;