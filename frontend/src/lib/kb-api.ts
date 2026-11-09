/**
 * KB API client — talks to FastAPI backend via unified api-config.
 * Requires CORS on the backend (allow_origin_regex for localhost ports).
 */

import { API_V1 } from "./api-config";

const API_BASE = API_V1;

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token")
  );
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const base: Record<string, string> = { ...(extra ?? {}) };
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

async function readError(res: Response, url: string): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await res.json();
      if (typeof body?.detail === "string")
        return `${res.status} ${res.statusText} — ${body.detail} (${url})`;
      if (typeof body?.message === "string")
        return `${res.status} ${res.statusText} — ${body.message} (${url})`;
      return `${res.status} ${res.statusText} — ${JSON.stringify(body)} (${url})`;
    }
    const txt = await res.text();
    return `${res.status} ${res.statusText} — ${txt || "(empty body)"} (${url})`;
  } catch {
    return `${res.status} ${res.statusText} (${url})`;
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const isForm = init.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: authHeaders({
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...((init.headers as Record<string, string>) ?? {}),
    }),
  });
  if (!res.ok) {
    const msg = await readError(res, url);
    // eslint-disable-next-line no-console
    console.error("[kb-api] request failed:", msg);
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface KBOntology {
  ontology_version_id: string;
  name: string;
  version_tag: string;
  domain?: string;
  description?: string;
}

export interface UploadMetadata {
  owner?: string;
  department?: string;
  version?: string;
  jurisdiction?: string;
  effective_date?: string;
  expiry_date?: string;
  tags?: string[];
  related_entities?: string[];
  language?: string;
  confidentiality?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  source_url?: string;
  notes?: string;
}

export interface KBDocument {
  document_id: string;
  title: string;
  document_type: string;
  chunk_count: number;
  created_at?: number;
  extra_metadata?: UploadMetadata;
}

export interface KBRagChunk {
  chunk: { title: string; content: string; [k: string]: any };
  score: number;
}

export interface KBQueryResult {
  query: string;
  retrieved_chunks: KBRagChunk[];
  synthesized_guidance: string;
  ontology_version_id: string;
  model_used: string;
  key_used_masked: string;
  search_mode: string;
}

// ─────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────
export interface PageQuery {
  limit?: number;
  offset?: number;
  q?: string;
}

function withPage(path: string, page?: PageQuery): string {
  if (!page) return path;
  const qs = new URLSearchParams();
  if (page.limit != null) qs.set("limit", String(page.limit));
  if (page.offset != null) qs.set("offset", String(page.offset));
  if (page.q) qs.set("q", page.q);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export async function listOntologies(
  projectId?: string,
  page?: PageQuery
): Promise<KBOntology[]> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return requestJson<KBOntology[]>(withPage(`/ontologies${qs}`, page), {
    method: "GET",
  });
}

export async function listDocuments(
  ontologyVersionId: string,
  page?: PageQuery
): Promise<KBDocument[]> {
  return requestJson<KBDocument[]>(
    withPage(
      `/ontologies/${encodeURIComponent(ontologyVersionId)}/rag/documents`,
      page
    ),
    { method: "GET" }
  );
}

export async function uploadDocument(
  ontologyVersionId: string,
  payload: {
    file: File;
    title: string;
    document_type: string;
    metadata?: UploadMetadata;
  }
): Promise<{
  status: string;
  document_id: string;
  title: string;
  chunk_count: number;
  ontology_version_id: string;
  extraction_meta?: Record<string, any>;
  duration_ms?: number;
}> {
  const url = `${API_BASE}/ontologies/${encodeURIComponent(ontologyVersionId)}/rag/ingest-file`;
  const form = new FormData();
  form.append("file", payload.file, payload.file.name);
  form.append("title", payload.title);
  form.append("document_type", payload.document_type);
  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    form.append("metadata_json", JSON.stringify(payload.metadata));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const msg = await readError(res, url);
    // eslint-disable-next-line no-console
    console.error("[kb-api] upload failed:", msg);
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteDocument(
  ontologyVersionId: string,
  documentId: string
): Promise<{ status: string; document_id: string; deleted_chunks: number }> {
  return requestJson(
    `/ontologies/${encodeURIComponent(ontologyVersionId)}/rag/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" }
  );
}

export async function queryOntology(
  ontologyVersionId: string,
  query: string,
  topK: number,
  synthesize = true
): Promise<KBQueryResult> {
  return requestJson<KBQueryResult>(
    `/ontologies/${encodeURIComponent(ontologyVersionId)}/rag/query`,
    {
      method: "POST",
      body: JSON.stringify({
        query,
        top_k: topK,
        synthesize_with_llm: synthesize,
      }),
    }
  );
}