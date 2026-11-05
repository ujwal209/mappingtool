// src/lib/table-matching-api.ts
//
// Table Matching API client.
//
//   POST   /mapping-sets/{project}/table-pairs/propose
//   GET    /mapping-sets/{project}/table-pairs
//   GET    /mapping-sets/{project}/table-pairs/{id}
//   PUT    /mapping-sets/{project}/table-pairs/{id}       ← direct save (no approval)
//   DELETE /mapping-sets/{project}/table-pairs/{id}
//
// Also exposes small helpers for fetching the source/target system
// lists + ontology versions used by the discover wizard.

import type {
  ProposePairsRequest,
  ProposePairsResponse,
  SavePairsRequest,
  SavePairsResponse,
  SystemOption,
  OntologyOption,
  TableMappingSet,
} from "@/app/(protected)/table-matching/_types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api/v1";

// ─────────────────────────────────────────────────────────────
// Auth headers
// ─────────────────────────────────────────────────────────────
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
    headers["X-Tenant-ID"] =
      localStorage.getItem("tenant_id") || "tenant-default";
  }
  return headers;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return (
      (typeof body?.detail === "string" && body.detail) ||
      (typeof body?.message === "string" && body.message) ||
      `Request failed (${res.status})`
    );
  } catch {
    return `Request failed (${res.status})`;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────
// Table matching endpoints
// ─────────────────────────────────────────────────────────────
export async function proposeTablePairs(
  projectId: string,
  payload: ProposePairsRequest
): Promise<ProposePairsResponse> {
  return request<ProposePairsResponse>(
    `/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/propose`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function listTableMappingSets(
  projectId: string,
  filters?: { source_system_id?: string; target_system_id?: string }
): Promise<TableMappingSet[]> {
  const qs = new URLSearchParams();
  if (filters?.source_system_id)
    qs.set("source_system_id", filters.source_system_id);
  if (filters?.target_system_id)
    qs.set("target_system_id", filters.target_system_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<TableMappingSet[]>(
    `/mapping-sets/${encodeURIComponent(projectId)}/table-pairs${suffix}`
  );
}

export async function getTableMappingSet(
  projectId: string,
  setId: string
): Promise<TableMappingSet> {
  return request<TableMappingSet>(
    `/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/${encodeURIComponent(setId)}`
  );
}

export async function saveTablePairs(
  projectId: string,
  setId: string,
  payload: SavePairsRequest
): Promise<SavePairsResponse> {
  return request<SavePairsResponse>(
    `/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/${encodeURIComponent(setId)}`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export async function deleteTableMappingSet(
  projectId: string,
  setId: string
): Promise<{ status: string; table_mapping_set_id: string }> {
  return request(
    `/mapping-sets/${encodeURIComponent(projectId)}/table-pairs/${encodeURIComponent(setId)}`,
    { method: "DELETE" }
  );
}

// ─────────────────────────────────────────────────────────────
// Picker data (systems + ontologies)
// Reuses the existing endpoints. Local types keep the picker
// components decoupled from the full API model shapes.
// ─────────────────────────────────────────────────────────────
export async function listSystemsForPicker(): Promise<SystemOption[]> {
  const raw = await request<any[]>("/systems");
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    system_id: s.system_id,
    name: s.name || s.system_id,
    kind: s.kind || "SOURCE",
    connector_type: s.connector_type || s.adapter_type,
  }));
}

export async function listOntologiesForPicker(
  projectId?: string
): Promise<OntologyOption[]> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const raw = await request<any[]>(`/ontologies${qs}`);
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => ({
    ontology_version_id: o.ontology_version_id,
    name: o.name || "Untitled Ontology",
    version_tag: o.version_tag || "1.0.0",
    domain: o.domain,
  }));
}