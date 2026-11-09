/**
 * Enterprise API Client for the AI-Powered Ontology-Driven Data Migration Platform.
 * Supports Bearer JWT authorization, correlation ID propagation, tenant scoping,
 * and error envelope unpacking.
 */

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  mongo_connected: boolean;
  groq_pool_keys: number;
}

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  organization?: string;
  tenant_id: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  email: string;
  tenant_id: string;
  role: string;
  is_verified: boolean;
}

export interface ProjectItem {
  project_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  owners?: string[];
  lifecycle_state?: string;
  domain?: string;
  methodology?: string;
  source_ecosystem?: string;
  target_ecosystem?: string;
  estimated_volume?: string;
  target_cutover_date?: string;
  compliance_framework?: string;
  data_classification?: string;
  planned_waves?: number;
  rehearsal_strategy?: string;
  source_system_id?: string;
  target_system_id?: string;
  created_at: number;
}

export interface SystemItem {
  system_id: string;
  project_id: string;
  name: string;
  kind: "SOURCE" | "TARGET" | "INTERMEDIATE" | string;
  adapter_type: string;
  connector_type?: string;
  classification?: string;
  purpose?: string;
  environment?: string;
  config_summary?: Record<string, any>;
  created_at: number;
}

export interface DatasetItem {
  dataset_id: string;
  system_id: string;
  name: string;
  record_count?: number;
  fields: Array<{
    name: string;
    datatype: string;
    nullable: boolean;
    description?: string;
  }>;
  created_at: number;
}

export interface ProfileSnapshot {
  profile_id: string;
  dataset_id: string;
  row_count: number;
  column_count: number;
  sampled_at: number;
  field_profiles: Record<
    string,
    {
      inferred_type: string;
      null_count: number;
      null_percentage: number;
      distinct_count: number;
      min_val?: any;
      max_val?: any;
      mean?: any;
    }
  >;
}

export interface EntityAttribute {
  attribute_id: string;
  name: string;
  label: string;
  datatype: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  is_indexed?: boolean;
  is_nullable?: boolean;
  is_unique?: boolean;
  is_pii?: boolean;
  foreign_key_target?: string;
  default_value?: string;
  description?: string;
  aliases?: string[];
}

export interface OntologyEntity {
  entity_id: string;
  name: string;
  label: string;
  description?: string;
  category: string;
  attributes: EntityAttribute[];
  created_at?: number;
}

export interface OntologyRelationship {
  relationship_id: string;
  name: string;
  label?: string;
  source_entity_id: string;
  source_entity_name?: string;
  source_attribute_name?: string;
  target_entity_id: string;
  target_entity_name?: string;
  target_attribute_name?: string;
  relation_type: string;
  cardinality: string;
  cascade_rule?: string;
  description?: string;
  is_bidirectional?: boolean;
}

export interface ConceptItem {
  concept_id: string;
  name?: string;
  label?: string;
  business_definition?: string;
  definition?: string;
  datatype?: string;
  datatype_expectation?: string;
  type?: string;
  is_pii?: boolean;
  is_mandatory?: boolean;
  aliases?: string[];
}

export interface SemanticBindingItem {
  binding_id: string;
  concept_id: string;
  physical_object_id: string;
  confidence: number;
  provenance: string;
  reviewer_state: string;
}

export interface OntologyVersionItem {
  ontology_version_id: string;
  project_id: string;
  name?: string;
  description?: string;
  domain?: string;
  version_tag: string;
  status: string;
  content_hash?: string;
  entities?: OntologyEntity[];
  relationships?: OntologyRelationship[];
  concepts: ConceptItem[];
  bindings: SemanticBindingItem[];
  created_at: number;
  updated_at?: number;
}

export interface RAGDocumentItem {
  document_id: string;
  title: string;
  document_type: string;
  chunk_count: number;
  created_at: number;
}

export interface RAGQueryResult {
  query: string;
  retrieved_chunks: Array<{
    chunk: {
      chunk_id: string;
      title: string;
      content: string;
      section?: string;
    };
    score: number;
    vector_similarity?: number;
  }>;
  synthesized_guidance: string;
  model_used: string;
  key_used_masked: string;
  search_mode?: string;
}

export interface MappingProposalItem {
  mapping_id: string;
  source_refs: string[];
  target_ref: string;
  expression_ref?: string;
  confidence: number;
  rationale: string;
  match_type: string;
  default_value?: string;
}

export interface MappingSetItem {
  mapping_version_id: string;
  project_id: string;
  source_dataset_id: string;
  target_dataset_id: string;
  version_tag: string;
  status: string;
  content_hash?: string;
  mappings: MappingProposalItem[];
  created_at: number;
}

export interface RunItem {
  run_id: string;
  wave_id: string;
  manifest_id: string;
  state: "PENDING" | "EXTRACTING" | "TRANSFORMING" | "VALIDATING" | "LOADING" | "RECONCILING" | "COMPLETED" | "FAILED" | "PAUSED" | "ROLLED_BACK";
  started_at?: number;
  completed_at?: number;
  progress_percentage: number;
  total_records_processed: number;
  records_loaded: number;
  records_quarantined: number;
  dag_tasks?: Array<{
    task_id: string;
    node_name: string;
    state: string;
    records_in: number;
    records_out: number;
  }>;
  audit_bundle_hash?: string;
}

export interface KeyTelemetry {
  key_index: number;
  masked_key: string;
  total_calls: number;
  success_calls: number;
  failure_calls: number;
  is_active: boolean;
  last_error?: string;
}

export interface GroqPoolMetrics {
  total_keys: number;
  round_robin_strategy: string;
  active_keys_metrics: KeyTelemetry[];
}

export interface GeminiPoolMetrics {
  total_keys: number;
  round_robin_strategy: string;
  embedding_model: string;
  dimension: number;
  keys_telemetry: KeyTelemetry[];
}

import { API_ROOT } from "./api-config";

const API_BASE = API_ROOT;

class ApiClient {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Correlation-ID": `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const tenant = localStorage.getItem("tenant_id") || "tenant-default";
      headers["X-Tenant-ID"] = tenant;
    }

    return headers;
  }

  public async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${path}`;
    const headers = { ...this.getHeaders(), ...(options.headers as Record<string, string>) };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // -------------------------------------------------------------
  // System Health & Seeding
  // -------------------------------------------------------------
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/v1/health");
  }

  async seedGoldenDemo(): Promise<any> {
    return this.request<any>("/api/v1/seed/golden-demo", { method: "POST" });
  }

  // -------------------------------------------------------------
  // Authentication & Profile
  // -------------------------------------------------------------
  async signup(data: { email: string; password: string; full_name: string; organization?: string; role?: string }): Promise<any> {
    return this.request<any>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async verifyEmail(token: string, email?: string): Promise<any> {
    return this.request<any>("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token, email: email || undefined }),
    });
  }

  async resendVerification(email: string): Promise<any> {
    return this.request<any>("/api/v1/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async login(data: { email: string; password: string }): Promise<TokenResponse> {
    const res = await this.request<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (typeof window !== "undefined" && res.access_token) {
      localStorage.setItem("auth_token", res.access_token);
      localStorage.setItem("tenant_id", res.tenant_id);
    }
    return res;
  }

  async forgotPassword(email: string): Promise<any> {
    return this.request<any>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, new_password: string): Promise<any> {
    return this.request<any>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    });
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>("/api/v1/auth/me");
  }

  // -------------------------------------------------------------
  // Projects & Waves
  // -------------------------------------------------------------
  async getProjects(): Promise<ProjectItem[]> {
    return this.request<ProjectItem[]>("/api/v1/projects");
  }

  async createProject(
    data:
      | {
          name: string;
          description?: string;
          owners?: string[];
          domain?: string;
          methodology?: string;
          source_ecosystem?: string;
          target_ecosystem?: string;
          source_system_id?: string;
          target_system_id?: string;
          estimated_volume?: string;
          target_cutover_date?: string;
          compliance_framework?: string;
          data_classification?: string;
          planned_waves?: number;
          rehearsal_strategy?: string;
        }
      | string,
    maybeDesc?: string
  ): Promise<ProjectItem> {
    const payload = typeof data === "string" ? { name: data, description: maybeDesc || "" } : data;
    return this.request<ProjectItem>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getWaves(projectId: string): Promise<any[]> {
    return this.request<any[]>(`/api/v1/projects/${projectId}/waves`);
  }

  async createWave(projectId: string, name: string, scope: Record<string, any>): Promise<any> {
    return this.request<any>(`/api/v1/projects/${projectId}/waves`, {
      method: "POST",
      body: JSON.stringify({ name, scope_definition: scope }),
    });
  }

  // -------------------------------------------------------------
  // Systems & Pluggable Connectors
  // -------------------------------------------------------------
  async getSystems(): Promise<SystemItem[]> {
    return this.request<SystemItem[]>("/api/v1/systems");
  }

  async getConnectorTypes(): Promise<Array<{ type: string; name: string; category: string; description: string; capabilities: string[] }>> {
    return this.request<any[]>("/api/v1/connectors/types");
  }

  async registerSystem(data: {
    project_id?: string;
    name: string;
    kind: "SOURCE" | "TARGET" | "INTERMEDIATE" | string;
    adapter_type: string;
    connector_type?: string;
    classification?: string;
    purpose?: string;
    environment?: string;
    connection_config?: Record<string, any>;
    initial_tables?: any[];
  }): Promise<SystemItem> {
    return this.request<SystemItem>("/api/v1/systems", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async testPreConnect(data: {
    connector_type: string;
    connection_config: Record<string, any>;
    name?: string;
    purpose?: string;
    environment?: string;
  }): Promise<{
    status: string;
    latency_ms: number;
    message: string;
    capabilities: string[];
    discovered_tables: Array<{
      name: string;
      row_count: number;
      column_count: number;
      columns: Array<{ name: string; datatype: string; is_pk?: string | boolean }>;
      sample_records: any[];
    }>;
    masked_config: Record<string, any>;
  }> {
    return this.request<any>("/api/v1/systems/test-pre-connect", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

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
    created_at: number;
    config: Record<string, any>;
    tables: Array<{
      dataset_id: string;
      physical_name: string;
      field_count: number;
      row_count: number;
      fields: Array<{
        field_id: string;
        name: string;
        datatype: string;
        is_primary_key: boolean;
        nullable: boolean;
        description?: string;
      }>;
      profile_summary?: any;
    }>;
  }> {
    return this.request<any>(`/api/v1/systems/${systemId}/explore`);
  }

  async deleteSystem(systemId: string): Promise<any> {
    return this.request<any>(`/api/v1/systems/${systemId}`, {
      method: "DELETE",
    });
  }

  async testSystemConnection(systemId: string): Promise<{ status: string; latency_ms: number; masked_config: any; message?: string; capabilities?: string[] }> {
    return this.request<any>(`/api/v1/systems/${systemId}/test-connection`, {
      method: "POST",
    });
  }

  async intakeSheet(
    systemId: string,
    data: {
      name: string;
      columns: string[];
      rows?: any[];
      types?: Record<string, string>;
      namespace?: string;
    }
  ): Promise<DatasetItem> {
    return this.request<DatasetItem>(`/api/v1/systems/${systemId}/intake-sheet`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async intakeApi(
    systemId: string,
    data: {
      name: string;
      endpoint_url: string;
      auth_header?: string;
      sample_payload?: any;
      sample_records?: any[];
      namespace?: string;
    }
  ): Promise<DatasetItem> {
    return this.request<DatasetItem>(`/api/v1/systems/${systemId}/intake-api`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getDestinationMappings(systemId: string): Promise<any[]> {
    return this.request<any[]>(`/api/v1/systems/${systemId}/destination-mappings`);
  }

  // -------------------------------------------------------------
  // Datasets & Profiling
  // -------------------------------------------------------------
  async getDatasets(systemId?: string): Promise<DatasetItem[]> {
    const query = systemId ? `?system_id=${systemId}` : "";
    return this.request<DatasetItem[]>(`/api/v1/datasets${query}`);
  }

  async registerDataset(data: {
    system_id: string;
    name: string;
    fields: Array<{ name: string; datatype: string; nullable?: boolean; description?: string }>;
  }): Promise<DatasetItem> {
    return this.request<DatasetItem>("/api/v1/datasets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getProfile(datasetId: string): Promise<ProfileSnapshot | null> {
    return this.request<ProfileSnapshot | null>(`/api/v1/datasets/${datasetId}/profile`);
  }

  async profileRecords(datasetId: string, records: any[]): Promise<ProfileSnapshot> {
    return this.request<ProfileSnapshot>(`/api/v1/datasets/${datasetId}/profile`, {
      method: "POST",
      body: JSON.stringify({ records }),
    });
  }

  async detectDrift(datasetId: string, incomingFields: any[]): Promise<any> {
    return this.request<any>(`/api/v1/datasets/${datasetId}/drift-check`, {
      method: "POST",
      body: JSON.stringify({ fields: incomingFields }),
    });
  }

  // -------------------------------------------------------------
  // Ontologies & Vector RAG
  // -------------------------------------------------------------
  async getOntologies(projectId?: string): Promise<OntologyVersionItem[]> {
    const query = projectId ? `?project_id=${projectId}` : "";
    return this.request<OntologyVersionItem[]>(`/api/v1/ontologies${query}`);
  }

  async getOntology(ontologyId: string): Promise<OntologyVersionItem> {
    return this.request<OntologyVersionItem>(`/api/v1/ontologies/${ontologyId}`);
  }

  async createOntology(
    dataOrProjectId:
      | string
      | {
          project_id?: string;
          name: string;
          description?: string;
          domain?: string;
          version_tag?: string;
          entities?: OntologyEntity[];
          relationships?: OntologyRelationship[];
          concepts?: any[];
        },
    versionTag: string = "1.0.0",
    concepts?: any[]
  ): Promise<OntologyVersionItem> {
    const payload =
      typeof dataOrProjectId === "string"
        ? { project_id: dataOrProjectId, version_tag: versionTag, concepts }
        : dataOrProjectId;
    return this.request<OntologyVersionItem>("/api/v1/ontologies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createOntologyVersion(
    projectId: string,
    versionTag: string = "1.0.0",
    concepts?: any[]
  ): Promise<OntologyVersionItem> {
    return this.createOntology(projectId, versionTag, concepts);
  }

  async updateOntology(
    ontologyId: string,
    data: {
      name?: string;
      description?: string;
      domain?: string;
      version_tag?: string;
      status?: string;
      entities?: OntologyEntity[];
      relationships?: OntologyRelationship[];
    }
  ): Promise<OntologyVersionItem> {
    return this.request<OntologyVersionItem>(`/api/v1/ontologies/${ontologyId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteOntology(ontologyId: string): Promise<any> {
    return this.request<any>(`/api/v1/ontologies/${ontologyId}`, {
      method: "DELETE",
    });
  }

  async addEntity(
    ontologyId: string,
    data: {
      name: string;
      label?: string;
      description?: string;
      category?: string;
      attributes?: EntityAttribute[];
    }
  ): Promise<OntologyEntity> {
    return this.request<OntologyEntity>(`/api/v1/ontologies/${ontologyId}/entities`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateEntity(
    ontologyId: string,
    entityId: string,
    data: Partial<OntologyEntity>
  ): Promise<OntologyEntity> {
    return this.request<OntologyEntity>(`/api/v1/ontologies/${ontologyId}/entities/${entityId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEntity(ontologyId: string, entityId: string): Promise<any> {
    return this.request<any>(`/api/v1/ontologies/${ontologyId}/entities/${entityId}`, {
      method: "DELETE",
    });
  }

  async addRelationship(
    ontologyId: string,
    data: {
      name: string;
      label?: string;
      source_entity_id: string;
      target_entity_id: string;
      relation_type?: string;
      cardinality?: string;
      description?: string;
      is_bidirectional?: boolean;
    }
  ): Promise<OntologyRelationship> {
    return this.request<OntologyRelationship>(`/api/v1/ontologies/${ontologyId}/relationships`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateRelationship(
    ontologyId: string,
    relationshipId: string,
    data: Partial<OntologyRelationship>
  ): Promise<OntologyRelationship> {
    return this.request<OntologyRelationship>(
      `/api/v1/ontologies/${ontologyId}/relationships/${relationshipId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  }

  async deleteRelationship(ontologyId: string, relationshipId: string): Promise<any> {
    return this.request<any>(`/api/v1/ontologies/${ontologyId}/relationships/${relationshipId}`, {
      method: "DELETE",
    });
  }

  async generateOntologyWithAgent(data: {
    prompt: string;
    project_id: string;
    ontology_name?: string;
    domain?: string;
    target_ontology_id?: string;
    model?: string;
    mode?: "action" | "plan";
    chat_history?: Array<{ role: string; content: string }>;
  }): Promise<{
    status: string;
    mode?: string;
    is_plan?: boolean;
    plan_data?: any;
    reasoning_steps: Array<{ stage: string; summary: string }>;
    ontology: OntologyVersionItem;
    domain?: string;
    entity_count: number;
    relationship_count: number;
    response_markdown?: string;
  }> {
    return this.request<any>("/api/v1/ontologies/agent/generate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async applyAgentPlan(data: {
    project_id: string;
    target_ontology_id?: string;
    plan_data: any;
  }): Promise<{
    status: string;
    ontology: OntologyVersionItem;
    entity_count: number;
    relationship_count: number;
    message: string;
  }> {
    return this.request<any>("/api/v1/ontologies/agent/apply-plan", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async summarizeAgentChat(data: {
    chat_history: Array<{ role: string; content: string }>;
    model?: string;
  }): Promise<{
    summary: string;
    status: string;
  }> {
    return this.request<any>("/api/v1/ontologies/agent/summarize", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async addConcept(ontologyId: string, concept: { name: string; business_definition: string; datatype: string; is_pii?: boolean; is_mandatory?: boolean }): Promise<any> {
    return this.request<any>(`/api/v1/ontologies/${ontologyId}/concepts`, {
      method: "POST",
      body: JSON.stringify(concept),
    });
  }

  async ingestRAGDocument(ontologyId: string, data: { title: string; content: string; document_type?: string; chunk_size?: number; chunk_overlap?: number }): Promise<any> {
    return this.request<any>(`/api/v1/ontologies/${ontologyId}/rag/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async listRAGDocuments(ontologyId: string): Promise<RAGDocumentItem[]> {
    return this.request<RAGDocumentItem[]>(`/api/v1/ontologies/${ontologyId}/rag/documents`);
  }

  async queryOntologyRAG(ontologyId: string, query: string, top_k: number = 4): Promise<RAGQueryResult> {
    return this.request<RAGQueryResult>(`/api/v1/ontologies/${ontologyId}/rag/query`, {
      method: "POST",
      body: JSON.stringify({ query, top_k }),
    });
  }

  // -------------------------------------------------------------
  // Mapping Sets & Proposals
  // -------------------------------------------------------------
  async getMappingSets(projectId?: string): Promise<MappingSetItem[]> {
    const query = projectId ? `?project_id=${projectId}` : "";
    return this.request<MappingSetItem[]>(`/api/v1/mappings${query}`);
  }

  async createMappingProposals(data: {
    project_id: string;
    source_dataset_id: string;
    target_dataset_id: string;
    use_ai?: boolean;
    ontology_version_id?: string;
  }): Promise<MappingSetItem> {
    return this.request<MappingSetItem>("/api/v1/mappings/propose", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async approveMappingSet(mappingVersionId: string): Promise<MappingSetItem> {
    return this.request<MappingSetItem>(`/api/v1/mappings/${mappingVersionId}/approve`, {
      method: "POST",
    });
  }

  // -------------------------------------------------------------
  // Manifests & Execution Runs
  // -------------------------------------------------------------
  async createManifest(data: {
    project_id: string;
    wave_id: string;
    ontology_version_id: string;
    mapping_version_id: string;
    rule_package_id: string;
  }): Promise<any> {
    return this.request<any>("/api/v1/manifests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async startRun(manifestId: string, dryRun: boolean = false): Promise<RunItem> {
    return this.request<RunItem>("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify({ manifest_id: manifestId, dry_run: dryRun }),
    });
  }

  async getRuns(): Promise<RunItem[]> {
    return this.request<RunItem[]>("/api/v1/runs");
  }

  async getRun(runId: string): Promise<RunItem> {
    return this.request<RunItem>(`/api/v1/runs/${runId}`);
  }

  async pauseRun(runId: string): Promise<any> {
    return this.request<any>(`/api/v1/runs/${runId}/pause`, { method: "POST" });
  }

  async resumeRun(runId: string): Promise<any> {
    return this.request<any>(`/api/v1/runs/${runId}/resume`, { method: "POST" });
  }

  async rollbackRun(runId: string, reason: string = "Operator rollback"): Promise<any> {
    return this.request<any>(`/api/v1/runs/${runId}/rollback`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async getLineage(runId: string, targetRecordId: string): Promise<any> {
    return this.request<any>(`/api/v1/lineage/records/${targetRecordId}?run_id=${runId}`);
  }

  async getExceptions(runId?: string): Promise<any[]> {
    const query = runId ? `?run_id=${runId}` : "";
    return this.request<any[]>(`/api/v1/exceptions${query}`);
  }

  // -------------------------------------------------------------
  // Event-Driven Stream
  // -------------------------------------------------------------
  async getEvents(eventType?: string, limit: number = 50): Promise<any[]> {
    const q = eventType ? `?event_type=${encodeURIComponent(eventType)}&limit=${limit}` : `?limit=${limit}`;
    return this.request<any[]>(`/api/v1/events${q}`);
  }

  // -------------------------------------------------------------
  // AI Key Pools Telemetry
  // -------------------------------------------------------------
  async getGroqPool(): Promise<GroqPoolMetrics> {
    return this.request<GroqPoolMetrics>("/api/v1/ai/groq-pool");
  }

  async testGroqPool(): Promise<any> {
    return this.request<any>("/api/v1/ai/groq-pool/test", { method: "POST" });
  }

  async getGeminiPool(): Promise<GeminiPoolMetrics> {
    return this.request<GeminiPoolMetrics>("/api/v1/ai/gemini-pool");
  }

  async testGeminiPool(): Promise<any> {
    return this.request<any>("/api/v1/ai/gemini-pool/test", { method: "POST" });
  }
}

export const api = new ApiClient();
