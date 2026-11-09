// src/lib/pair-mapping-api.ts
import { API_V1 } from "./api-config";

const API_BASE = API_V1;

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) h.Authorization = `Bearer ${token}`;
    h["X-Tenant-ID"] = localStorage.getItem("tenant_id") || "tenant-default";
  }
  return h;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...((init.headers as any) ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface ColumnCandidate {
  source_column: string;
  score: number;
  confidence_pct: number;
}

export interface ColumnRule {
  rule_id: string;
  target_column: string;
  target_datatype: string;
  target_nullable: boolean;
  matched_source_column: string | null;
  source_datatype: string | null;
  confidence_score: number;
  status: "UNMATCHED" | "MATCHED" | "MANUAL_OVERRIDE";
  is_auto_mapped: boolean;
  transformation_rule: string | null;
  default_value: string | null;
  rationale: string;
  candidates: ColumnCandidate[];
}

export interface PairBlock {
  pair_id: string;
  source_table: string;
  target_table: string;
  source_dataset_id: string;
  target_dataset_id: string;
  confidence_score: number;
  match_status: "PENDING" | "AI_RUN" | "REVIEWED" | "APPROVED";
  requires_masking: boolean;
  depends_on: string[];
  rationale: string;
  columns: ColumnRule[];
}

export interface PairMappingSet {
  set_id: string;
  project_id: string;
  tenant_id: string;
  table_mapping_set_id: string | null;
  ontology_version_id: string | null;
  source_system_id: string | null;
  target_system_id: string | null;
  name: string | null;
  version_tag: string;
  status: "DRAFT" | "APPROVED" | "DEPRECATED";
  content_hash: string | null;
  pairs: PairBlock[];
  created_at: number;
  updated_at: number;
}

export const pairMappingApi = {
  createFromTableSet: (
    projectId: string,
    body: {
      table_mapping_set_id: string;
      ontology_version_id?: string;
      name?: string;
      version_tag?: string;
    }
  ) =>
    req<PairMappingSet>(
      `/pair-mapping-sets?project_id=${encodeURIComponent(projectId)}`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  list: (projectId: string, tableMappingSetId?: string) => {
    const qs = new URLSearchParams({ project_id: projectId });
    if (tableMappingSetId) qs.set("table_mapping_set_id", tableMappingSetId);
    return req<PairMappingSet[]>(`/pair-mapping-sets?${qs.toString()}`);
  },

  get: (setId: string) =>
    req<PairMappingSet>(`/pair-mapping-sets/${encodeURIComponent(setId)}`),

  // ── Metadata save (name, version_tag, per-pair rationale/masking) ──
  savePairs: (
    setId: string,
    body: {
      pairs: any[];
      name?: string;
      version_tag?: string;
    }
  ) =>
    req<PairMappingSet>(
      `/pair-mapping-sets/${encodeURIComponent(setId)}`,
      { method: "PUT", body: JSON.stringify(body) }
    ),

  delete: (setId: string) =>
    req<{ status: string; set_id: string }>(
      `/pair-mapping-sets/${encodeURIComponent(setId)}`,
      { method: "DELETE" }
    ),

  runAiOnPair: (
    setId: string,
    pairId: string,
    body: {
      use_ai?: boolean;
      model_name?: string;
      api_keys?: string[];
      ontology_version_id?: string;
      custom_instructions?: string;
    } = {}
  ) =>
    req<PairMappingSet>(
      `/pair-mapping-sets/${encodeURIComponent(
        setId
      )}/pairs/${encodeURIComponent(pairId)}/run-ai`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  runAiOnAll: (
    setId: string,
    body: {
      use_ai?: boolean;
      model_name?: string;
      api_keys?: string[];
      ontology_version_id?: string;
    } = {}
  ) =>
    req<PairMappingSet>(
      `/pair-mapping-sets/${encodeURIComponent(setId)}/run-ai-all`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  reviewPair: (
    setId: string,
    pairId: string,
    body: {
      adjustments: Array<{
        target_column: string;
        matched_source_column?: string | null;
        transformation_rule?: string;
        default_value?: string;
        confidence_score?: number;
        rationale?: string;
      }>;
      actor?: string;
      comments?: string;
    }
  ) =>
    req<PairMappingSet>(
      `/pair-mapping-sets/${encodeURIComponent(
        setId
      )}/pairs/${encodeURIComponent(pairId)}/review`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  finalize: (
    setId: string,
    body: { actor?: string; comments?: string } = {}
  ) =>
    req<PairMappingSet>(
      `/pair-mapping-sets/${encodeURIComponent(setId)}/finalize`,
      { method: "POST", body: JSON.stringify(body) }
    ),
};