// src/lib/migrations-api.ts
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api/v1";

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

export type LoadMode = "REPLACE" | "APPEND" | "UPSERT";
export type ReviewMode = "STANDARD" | "STRICT";
export type MigrationPhase =
  | "PREFLIGHT"
  | "EXTRACT"
  | "TRANSFORM"
  | "VALIDATE"
  | "AWAITING_LOAD_REVIEW"
  | "LOAD"
  | "RECONCILE"
  | "DONE";

export interface PreflightGate {
  gate_id: string;
  name: string;
  status: "PASSED" | "FAILED" | "WARNING";
  message: string;
  blocking: boolean;
  ran_at: number;
}

export interface LoadApproval {
  approved_by: string;
  approved_at: number;
  comments: string;
  waivers_accepted: string[];
}

export interface SignoffRecord {
  actor: string;
  signed_at: number;
  comments: string;
  evidence_hash: string;
}

// Add to the create payload type in lib/migrations-api.ts
export interface CreateMigrationPayload {
  project_id: string;
  pair_mapping_set_id: string;
  review_mode: ReviewMode;
  table_load_overrides: Array<{
    source_table: string;
    target_table: string;
    load_mode: LoadMode;
    primary_key_columns?: string[];
    masking_columns?: string[];
  }>;
  policy_waivers: string[];
  actor: string;
  name?: string;
  description?: string;
  version_tag?: string;
}
export interface MigrationRun {
  run_id: string;
  manifest_id: string;
  project_id: string;
  tenant_id: string;
  state: string;
  phase: MigrationPhase;
  tables_total: number;
  tables_completed: number;
  rows_extracted: number;
  rows_transformed: number;
  rows_validated: number;
  rows_loaded: number;
  rows_failed: number;
  preflight_gates: PreflightGate[];
  load_approval?: LoadApproval | null;
  signoff?: SignoffRecord | null;
  error?: string | null;
  warnings: string[];
  created_at: number;
  started_at?: number | null;
  load_started_at?: number | null;
  completed_at?: number | null;
}

export interface TableLoadConfig {
  source_table: string;
  target_table: string;
  load_mode: LoadMode;
  primary_key_columns: string[];
  requires_masking: boolean;
  masking_columns: string[];
  include_column_map: Record<string, string>;
}

export interface MigrationManifest {
  manifest_id: string;
  tenant_id: string;
  project_id: string;
  pair_mapping_set_id: string;
  ontology_version_id?: string | null;
  source_system_id: string;
  target_system_id: string;
  table_load_configs: TableLoadConfig[];
  review_mode: ReviewMode;
  policy_waivers: string[];
  manifest_hash: string;
  created_by: string;
  created_at: number;
}

export interface TablePreview {
  source_table: string;
  target_table: string;
  load_mode: LoadMode;
  source_row_count: number;
  target_row_count_before: number;
  target_row_count_after_estimate: number;
  columns_mapped: number;
  masked_columns: string[];
  warnings_count: number;
  warnings: string[];
  is_destructive: boolean;
}

export interface ReviewContext {
  run_id: string;
  phase: MigrationPhase;
  total_source_rows: number;
  total_target_rows_before: number;
  total_target_rows_after_estimate: number;
  total_tables: number;
  total_columns_mapped: number;
  table_previews: TablePreview[];
  warning_count: number;
  warnings: string[];
  pii_table_count: number;
  preflight_gates: PreflightGate[];
  recommendation: "SAFE_TO_LOAD" | "REVIEW_REQUIRED" | "BLOCKING_WARNINGS";
  recommendation_reason: string;
}

export interface CreateRunBody {
  project_id: string;
  pair_mapping_set_id: string;
  review_mode?: ReviewMode;
  table_load_overrides?: Array<{
    source_table: string;
    target_table: string;
    load_mode: LoadMode;
    primary_key_columns?: string[];
    masking_columns?: string[];
  }>;
  policy_waivers?: string[];
  actor?: string;
}

export const migrationsApi = {
  create: (body: CreateRunBody) =>
    req<MigrationRun>(`/migrations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  list: (opts: { project_id?: string; state?: string } = {}) => {
    const qs = new URLSearchParams();
    if (opts.project_id) qs.set("project_id", opts.project_id);
    if (opts.state) qs.set("state", opts.state);
    const s = qs.toString();
    return req<MigrationRun[]>(`/migrations${s ? `?${s}` : ""}`);
  },

  get: (runId: string) =>
    req<MigrationRun>(`/migrations/${encodeURIComponent(runId)}`),

  getManifest: (runId: string) =>
    req<MigrationManifest>(
      `/migrations/${encodeURIComponent(runId)}/manifest`
    ),

  getReviewContext: (runId: string) =>
    req<ReviewContext>(
      `/migrations/${encodeURIComponent(runId)}/review-context`
    ),

  approveLoad: (
    runId: string,
    body: { actor: string; comments?: string; waivers_accepted?: string[] }
  ) =>
    req<MigrationRun>(
      `/migrations/${encodeURIComponent(runId)}/approve-load`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  abort: (runId: string, body: { actor: string; reason?: string }) =>
    req<MigrationRun>(`/migrations/${encodeURIComponent(runId)}/abort`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  signoff: (runId: string, body: { actor: string; comments?: string }) =>
    req<MigrationRun>(`/migrations/${encodeURIComponent(runId)}/signoff`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};