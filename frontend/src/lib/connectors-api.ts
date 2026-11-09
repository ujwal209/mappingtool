/**
 * Client for the connector framework API.
 *
 * Covers:
 *  - pre-connect ping (system-less probe)
 *  - system CRUD (register / update / delete / get / list)
 *  - test-connection, explore, table listing, schema, preview rows
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface DiscoveredColumn {
  name: string;
  datatype?: string;
  is_pk?: boolean | string;
}

export interface PreConnectResponse {
  status: string;
  latency_ms: number;
  message: string;
  capabilities: string[];
  discovered_tables: Array<{
    name: string;
    row_count: number;
    column_count: number;
    columns: DiscoveredColumn[];
    sample_records: Record<string, any>[];
  }>;
  masked_config: Record<string, any>;
}

export interface SystemItem {
  system_id: string;
  project_id: string;
  name: string;
  kind: string;
  adapter_type: string;
  connector_type: string;
  classification: string;
  purpose?: string;
  environment?: string;
  created_at: number;
  config_summary?: Record<string, any>;
}

export interface ConnectorTestResponse {
  system_id?: string;
  endpoint_id?: string | null;
  status: string;
  latency_ms: number;
  message: string;
  capabilities: string[];
  masked_config?: Record<string, any>;
}

export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "textarea" | "email" | "url";
  placeholder?: string;
  help?: string;
  required?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Auth headers
// ─────────────────────────────────────────────────────────────
import { API_V1 } from "./api-config";

const API_BASE = API_V1;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) h.Authorization = `Bearer ${token}`;
    h["X-Tenant-ID"] =
      localStorage.getItem("tenant_id") || "tenant-default";
    h["X-Correlation-ID"] = `req-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }
  return h;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail
        .map((d: any) => `${d.loc?.join(".") || "error"}: ${d.msg || d}`)
        .join("; ");
    }
    if (typeof body?.message === "string") return body.message;
    return `HTTP ${res.status} ${res.statusText}`;
  } catch {
    return `HTTP ${res.status} ${res.statusText}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Connector field definitions
// ─────────────────────────────────────────────────────────────
/**
 * Return the form fields the UI should render for a given connector type.
 *
 * Currently real (working) connectors that need config:
 *   - mongodb   → uri, database
 *   - postgres  → dsn, schema  (also cockroach, timescale, redshift, postgis)
 *   - rest_api  → endpoint_url, auth_header, method, body
 *   - fabric    → workspace_id, lakehouse_id, azure_tenant_id
 *   - d365      → environment_url, api_version, client_id
 *
 * Memory / sheet / relational require no credentials.
 */
export function getConnectorFields(type: string): ConnectorField[] {
  const t = (type || "").toLowerCase();

  // ── PostgreSQL family (all speak Postgres wire) ─────────
  if (
    t === "postgres" ||
    t === "postgresql" ||
    t === "pg" ||
    t === "cockroach" ||
    t === "cockroachdb" ||
    t === "timescale" ||
    t === "timescaledb" ||
    t === "redshift" ||
    t === "postgis"
  ) {
    return [
      {
        key: "dsn",
        label: "Connection URI (DSN)",
        type: "password",
        required: true,
        placeholder:
          "postgresql://user:password@host:5432/dbname?sslmode=require",
        help:
          "Full Postgres URI. Works with Neon, Supabase, Railway, RDS, " +
          "Azure Database for PostgreSQL, CockroachDB Serverless, and " +
          "self-hosted. If you omit sslmode, the connector injects " +
          "sslmode=require for hosted providers.",
      },
      {
        key: "schema",
        label: "Schema",
        type: "text",
        placeholder: "public",
        help:
          "Namespace to introspect. Default: public. For Dynamics-style " +
          "deployments use dbo; for Supabase try public.",
      },
      {
        key: "connect_timeout",
        label: "Connect timeout (seconds)",
        type: "number",
        placeholder: "10",
        help: "Optional. Defaults to 10s.",
      },
      {
        key: "statement_timeout_ms",
        label: "Statement timeout (ms)",
        type: "number",
        placeholder: "30000",
        help: "Optional. Server-side statement_timeout. Defaults to 30000ms.",
      },
    ];
  }

  // ── MongoDB Atlas ────────────────────────────────────────
  if (t === "mongodb" || t === "mongo" || t === "atlas") {
    return [
      {
        key: "uri",
        label: "Connection URI",
        type: "password",
        required: true,
        placeholder:
          "mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/",
        help:
          "Atlas SRV URI (or a plain mongodb:// URI). Network access must " +
          "allow your IP.",
      },
      {
        key: "database",
        label: "Database",
        type: "text",
        placeholder: "migration_test",
        help:
          "Database name to introspect. Defaults to MONGODB database from " +
          "server config if blank.",
      },
    ];
  }

  // ── REST API ────────────────────────────────────────────
  if (t === "rest_api" || t === "api" || t === "http_json") {
    return [
      {
        key: "endpoint_url",
        label: "Endpoint URL",
        type: "url",
        required: true,
        placeholder: "https://api.example.com/v1/customers",
        help: "Must return JSON — array, or {data|items|results: [...]}.",
      },
      {
        key: "auth_header",
        label: "Authorization header",
        type: "password",
        placeholder: "Bearer eyJhbGciOi...",
        help: "Optional. Sent as Authorization. Bearer prefix added if missing.",
      },
      {
        key: "method",
        label: "HTTP method",
        type: "text",
        placeholder: "GET",
        help: "Default GET. POST requires a body.",
      },
      {
        key: "body",
        label: "Request body (JSON)",
        type: "textarea",
        placeholder: '{"query":"..."}',
        help: "Optional. Only used for POST/PUT/PATCH.",
      },
    ];
  }

  // ── Fabric ──────────────────────────────────────────────
  if (t === "fabric" || t === "microsoft_fabric" || t === "onelake") {
    return [
      {
        key: "workspace_id",
        label: "Workspace ID",
        type: "text",
        required: true,
        placeholder: "fabric-workspace-abc123",
      },
      {
        key: "lakehouse_id",
        label: "Lakehouse ID",
        type: "text",
        required: true,
        placeholder: "fabric-lakehouse-gold",
      },
      {
        key: "azure_tenant_id",
        label: "Azure tenant ID",
        type: "text",
        placeholder: "common",
      },
    ];
  }

  // ── Dynamics 365 / Dataverse ────────────────────────────
  if (
    t === "d365" ||
    t === "dynamics365" ||
    t === "dynamics_365" ||
    t === "dataverse"
  ) {
    return [
      {
        key: "environment_url",
        label: "Environment URL",
        type: "url",
        required: true,
        placeholder: "https://contoso.crm.dynamics.com",
      },
      {
        key: "api_version",
        label: "API version",
        type: "text",
        placeholder: "v9.2",
      },
      {
        key: "client_id",
        label: "Client ID",
        type: "text",
        placeholder: "d365-client-app",
      },
    ];
  }

  // ── Memory / sheet / relational / unknown → no fields ──
  return [];
}

// ─────────────────────────────────────────────────────────────
// API surface
// ─────────────────────────────────────────────────────────────
export const connectorsApi = {
  /** Probe a connection BEFORE registering a system. */
  async testPreConnect(payload: {
    connector_type: string;
    connection_config: Record<string, any>;
    name?: string;
    purpose?: string;
    environment?: string;
  }): Promise<PreConnectResponse> {
    const res = await fetch(`${API_BASE}/systems/test-pre-connect`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** List connectors for a project. */
  async listSystems(projectId?: string): Promise<SystemItem[]> {
    const url = new URL(`${API_BASE}/systems`);
    if (projectId) url.searchParams.set("project_id", projectId);
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Get a single connector. */
  async getSystem(systemId: string): Promise<SystemItem> {
    const res = await fetch(`${API_BASE}/systems/${encodeURIComponent(systemId)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Create a connector. */
  async registerSystem(payload: {
    project_id?: string;
    name: string;
    kind: string;
    adapter_type?: string;
    connector_type?: string;
    classification?: string;
    purpose?: string;
    environment?: string;
    connection_config?: Record<string, any>;
    initial_tables?: Array<{
      name: string;
      columns: any[];
      sample_records: Record<string, any>[];
    }>;
  }): Promise<SystemItem> {
    const res = await fetch(`${API_BASE}/systems`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Update an existing connector. */
  async updateSystem(
    systemId: string,
    payload: {
      name?: string;
      kind?: string;
      environment?: string;
      connector_type?: string;
      adapter_type?: string;
      classification?: string;
      purpose?: string;
      connection_config?: Record<string, any>;
      secret_ref?: string;
    }
  ): Promise<SystemItem> {
    const res = await fetch(
      `${API_BASE}/systems/${encodeURIComponent(systemId)}`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Delete a connector. */
  async deleteSystem(systemId: string): Promise<void> {
    const res = await fetch(
      `${API_BASE}/systems/${encodeURIComponent(systemId)}`,
      { method: "DELETE", headers: authHeaders() }
    );
    if (!res.ok) throw new Error(await parseError(res));
  },

  /** Test a registered connector's connectivity. */
  async testSystemConnection(systemId: string): Promise<ConnectorTestResponse> {
    const res = await fetch(
      `${API_BASE}/systems/${encodeURIComponent(systemId)}/test-connection`,
      { method: "POST", headers: authHeaders() }
    );
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Deep explore — returns tables + schema + sample rows. */
  async exploreSystem(systemId: string): Promise<{
    system_id: string;
    project_id: string;
    name: string;
    kind: string;
    connector_type: string;
    purpose: string;
    environment: string;
    classification: string;
    ping_status: string;
    latency_ms: number;
    capabilities: string[];
    created_at: number;
    config: Record<string, any>;
    tables: Array<{
      name: string;
      row_count: number;
      columns: DiscoveredColumn[];
      sample_records: Record<string, any>[];
    }>;
  }> {
    const res = await fetch(
      `${API_BASE}/systems/${encodeURIComponent(systemId)}/explore`,
      { headers: authHeaders() }
    );
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Paginated table list — scalable for thousands of tables. */
  async listTablesPaginated(
    systemId: string,
    opts: { q?: string; offset?: number; limit?: number }
  ): Promise<{
    system_id: string;
    tables: Array<{ name: string; row_count: number; column_count: number }>;
    total: number;
    offset: number;
    limit: number;
    query: string;
  }> {
    const url = new URL(
      `${API_BASE}/systems/${encodeURIComponent(systemId)}/tables`
    );
    if (opts.q) url.searchParams.set("q", opts.q);
    if (opts.offset != null) url.searchParams.set("offset", String(opts.offset));
    if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Schema for a single table (no rows). */
  async getTableSchema(
    systemId: string,
    tableName: string
  ): Promise<{
    system_id: string;
    name: string;
    row_count: number;
    column_count: number;
    columns: DiscoveredColumn[];
  }> {
    const res = await fetch(
      `${API_BASE}/systems/${encodeURIComponent(
        systemId
      )}/tables/${encodeURIComponent(tableName)}`,
      { headers: authHeaders() }
    );
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },

  /** Paginated row preview for a single table. */
  async previewTableRows(
    systemId: string,
    tableName: string,
    opts: { offset?: number; limit?: number }
  ): Promise<{
    system_id: string;
    table: string;
    rows: Record<string, any>[];
    offset: number;
    limit: number;
    total: number | null;
    has_more: boolean;
  }> {
    const url = new URL(
      `${API_BASE}/systems/${encodeURIComponent(
        systemId
      )}/tables/${encodeURIComponent(tableName)}/preview`
    );
    if (opts.offset != null) url.searchParams.set("offset", String(opts.offset));
    if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  },
};