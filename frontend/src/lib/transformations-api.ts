// src/lib/transformations-api.ts
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

export type TransformCategory =
  | "DIRECT"
  | "STRING"
  | "NUMERIC"
  | "DATE"
  | "SECURITY"
  | "VALIDATION"
  | "LOOKUP"
  | "CONDITIONAL"
  | "CUSTOM";

export type TransformKind = "BUILTIN" | "CUSTOM_DSL";

export interface TransformParam {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: any;
  description: string;
  enum_values?: string[];
}

export interface Transformation {
  transform_id: string;
  tenant_id: string;
  key: string;
  label: string;
  description: string;
  category: TransformCategory;
  kind: TransformKind;
  arity_min: number;
  arity_max: number;
  params: TransformParam[];
  dsl_expression?: string | null;
  example?: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: number;
  updated_at: number;
}

export interface CategoryInfo {
  value: TransformCategory;
  label: string;
  count: number;
}

export interface ExecuteResult {
  valid: boolean;
  results: any[] | null;
  error: string | null;
}

export interface TestDslResult {
  valid: boolean;
  result: any;
  error: string | null;
}

export const transformationsApi = {
  list: (opts: {
    category?: TransformCategory;
    kind?: TransformKind;
    search?: string;
    include_inactive?: boolean;
  } = {}) => {
    const qs = new URLSearchParams();
    if (opts.category) qs.set("category", opts.category);
    if (opts.kind) qs.set("kind", opts.kind);
    if (opts.search) qs.set("search", opts.search);
    if (opts.include_inactive) qs.set("include_inactive", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return req<Transformation[]>(`/transformations${suffix}`);
  },

  categories: () =>
    req<CategoryInfo[]>(`/transformations/categories`),

  get: (id: string) =>
    req<Transformation>(`/transformations/${encodeURIComponent(id)}`),

  getByKey: (key: string) =>
    req<Transformation>(
      `/transformations/by-key/${encodeURIComponent(key)}`
    ),

  create: (body: {
    key: string;
    label: string;
    description?: string;
    category?: TransformCategory;
    dsl_expression: string;
    params?: TransformParam[];
    arity_min?: number;
    arity_max?: number;
    example?: string | null;
  }) =>
    req<Transformation>(`/transformations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: {
      label?: string;
      description?: string;
      dsl_expression?: string;
      params?: TransformParam[];
      is_active?: boolean;
    }
  ) =>
    req<Transformation>(`/transformations/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    req<{ status: string; transform_id: string }>(
      `/transformations/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),

  testDsl: (body: {
    dsl_expression: string;
    source_values: any[];
  }) =>
    req<TestDslResult>(`/transformations/test-dsl`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  execute: (body: {
    op: string;
    source_values: any[];
    params?: Record<string, any>;
  }) =>
    req<ExecuteResult>(`/transformations/execute`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listOps: () => req<string[]>(`/transformations/ops`),
};