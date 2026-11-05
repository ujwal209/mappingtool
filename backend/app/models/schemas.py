"""
API Request and Response Data Transfer Objects (DTOs).
Ensures clean serialization, schema documentation, and OpenAPI contract fidelity.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.core.security import Role
from app.models.canonical import (
    ArtifactStatus,
    RunState,
    RuleSeverity,
    ExceptionDisposition,
    Concept,
    SemanticBinding,
    FieldDefinition,
    EntityAttribute,
    OntologyEntity,
    OntologyRelationship,
)


# ==========================================
# Project & Infrastructure DTOs
# ==========================================

class ProjectCreateRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Enterprise ERP to CRM Migration"})
    description: Optional[str] = "Migration of legacy customer accounts and orders"
    owners: List[str] = Field(default_factory=lambda: ["lead-architect@company.com"])
    domain: Optional[str] = "Banking & Financial Services"
    methodology: Optional[str] = "Phased Wave Replication"
    source_ecosystem: Optional[str] = "Legacy Oracle / SAP ERP"
    target_ecosystem: Optional[str] = "Microsoft Fabric OneLake"
    estimated_volume: Optional[str] = "10M - 50M Records"
    target_cutover_date: Optional[str] = "2026-12-31"
    compliance_framework: Optional[str] = "SOC2 Type II / GDPR"
    data_classification: Optional[str] = "CONFIDENTIAL"
    planned_waves: Optional[int] = 3
    rehearsal_strategy: Optional[str] = "Dual-Run Shadow Execution"


class SystemRegisterRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Legacy Oracle CRM"})
    kind: str = Field(..., json_schema_extra={"example": "SOURCE"})  # SOURCE, TARGET, INTERMEDIATE
    connector_type: str = Field(..., json_schema_extra={"example": "relational"})
    classification: str = Field(default="CONFIDENTIAL")


class DirectSystemCreateRequest(BaseModel):
    project_id: Optional[str] = None
    name: str = Field(..., json_schema_extra={"example": "Production Snowflake Lakehouse"})
    kind: str = Field(default="SOURCE", json_schema_extra={"example": "SOURCE"})
    adapter_type: Optional[str] = Field(default=None, json_schema_extra={"example": "snowflake"})
    connector_type: Optional[str] = Field(default=None, json_schema_extra={"example": "snowflake"})
    classification: Optional[str] = Field(default="CONFIDENTIAL")
    purpose: Optional[str] = Field(default=None, json_schema_extra={"example": "Primary customer data replication for Wave 1"})
    environment: Optional[str] = Field(default="Production", json_schema_extra={"example": "Production"})
    connection_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    initial_tables: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class SystemResponseItem(BaseModel):
    system_id: str
    project_id: str
    name: str
    kind: str
    adapter_type: str
    connector_type: str
    classification: str
    purpose: Optional[str] = None
    environment: Optional[str] = "Production"
    created_at: float
    config_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)


class DiscoveredTableItem(BaseModel):
    name: str
    row_count: int = 0
    column_count: int = 0
    columns: List[Dict[str, str]] = Field(default_factory=list)
    sample_records: List[Dict[str, Any]] = Field(default_factory=list)


class PreConnectTestRequest(BaseModel):
    connector_type: str
    connection_config: Dict[str, Any] = Field(default_factory=dict)
    name: Optional[str] = None
    purpose: Optional[str] = None
    environment: Optional[str] = "Production"


class PreConnectTestResponse(BaseModel):
    status: str
    latency_ms: float
    message: str
    capabilities: List[str] = Field(default_factory=list)
    discovered_tables: List[DiscoveredTableItem] = Field(default_factory=list)
    masked_config: Dict[str, Any] = Field(default_factory=dict)



class SheetIntakeRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Customer_Accounts_Export"})
    columns: List[str] = Field(..., json_schema_extra={"example": ["id", "customer_name", "email", "balance"]})
    rows: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    types: Optional[Dict[str, str]] = Field(default_factory=dict)
    namespace: Optional[str] = "spreadsheets"


class ApiIntakeRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Stripe Customers API"})
    endpoint_url: str = Field(..., json_schema_extra={"example": "https://api.stripe.com/v1/customers"})
    auth_header: Optional[str] = None
    sample_payload: Optional[Dict[str, Any]] = None
    sample_records: Optional[List[Dict[str, Any]]] = None
    namespace: Optional[str] = "api_services"


class DatasetDirectCreateRequest(BaseModel):
    system_id: str
    name: str
    namespace: Optional[str] = "default"
    fields: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class EndpointCreateRequest(BaseModel):
    system_id: str
    environment_id: str
    name: str
    connection_params: Dict[str, Any] = Field(default_factory=dict)
    secret_ref: Optional[str] = None


class EndpointTestResponse(BaseModel):
    endpoint_id: Optional[str] = None
    system_id: Optional[str] = None
    status: str
    latency_ms: float
    message: str
    capabilities: List[str] = Field(default_factory=list)
    masked_config: Optional[Dict[str, Any]] = Field(default_factory=dict)


# ==========================================
# Profiling & Drift DTOs
# ==========================================

class ProfileRunRequest(BaseModel):
    sample_size: Optional[int] = Field(default=1000, ge=10, le=100000)
    sampling_policy: str = "HEAD"  # HEAD, RANDOM, FULL_SCAN


class ProfileRunResponse(BaseModel):
    profile_id: str
    dataset_id: str
    row_count: int
    column_count: int
    column_metrics: Dict[str, Any]
    scope_hash: str
    sampled_at: float


class DriftAnalysisResponse(BaseModel):
    dataset_id: str
    baseline_profile_id: str
    current_profile_id: str
    has_drift: bool
    is_blocking: bool
    added_columns: List[str]
    removed_columns: List[str]
    type_mismatches: List[Dict[str, Any]]
    explanation: Optional[str] = None


# ==========================================
# Ontology & Mapping DTOs
# ==========================================

class CreateOntologyVersionRequest(BaseModel):
    name: Optional[str] = "Enterprise Business Ontology"
    description: Optional[str] = None
    domain: Optional[str] = None
    project_id: Optional[str] = None
    parent_id: Optional[str] = None
    version_tag: str = "1.0.0"
    entities: List[OntologyEntity] = Field(default_factory=list)
    relationships: List[OntologyRelationship] = Field(default_factory=list)
    concepts: List[Concept] = Field(default_factory=list)


class UpdateOntologyRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    version_tag: Optional[str] = None
    status: Optional[ArtifactStatus] = None
    entities: Optional[List[OntologyEntity]] = None
    relationships: Optional[List[OntologyRelationship]] = None


class CreateEntityRequest(BaseModel):
    name: str
    label: Optional[str] = None
    description: Optional[str] = None
    category: str = "Master Data"
    attributes: List[EntityAttribute] = Field(default_factory=list)


class UpdateEntityRequest(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    attributes: Optional[List[EntityAttribute]] = None


class CreateRelationshipRequest(BaseModel):
    name: str
    label: Optional[str] = None
    source_entity_id: str
    target_entity_id: str
    relation_type: str = "ASSOCIATION"
    cardinality: str = "ONE_TO_MANY"
    description: Optional[str] = None
    is_bidirectional: bool = False


class UpdateRelationshipRequest(BaseModel):
    name: Optional[str] = None
    label: Optional[str] = None
    relation_type: Optional[str] = None
    cardinality: Optional[str] = None
    description: Optional[str] = None
    is_bidirectional: Optional[bool] = None


class AgentGenerateOntologyRequest(BaseModel):
    prompt: str = Field(..., json_schema_extra={"example": "Build an e-commerce ontology with Customer, Order, OrderItem, Product, and Invoice entities with proper relationships"})
    project_id: str = Field(..., json_schema_extra={"example": "proj-123456"})
    ontology_name: Optional[str] = None
    domain: Optional[str] = None
    target_ontology_id: Optional[str] = None
    model: Optional[str] = None
    mode: Optional[str] = Field(default="action", description="'action' to synthesize & persist directly, or 'plan' to formulate blueprint for approval")
    chat_history: Optional[List[Dict[str, str]]] = None


class AgentApplyPlanRequest(BaseModel):
    project_id: str = Field(..., json_schema_extra={"example": "proj-123456"})
    target_ontology_id: Optional[str] = None
    plan_data: Dict[str, Any] = Field(..., description="Approved architectural blueprint containing domain, entities, and relationships")


class AgentSummarizeChatRequest(BaseModel):
    chat_history: List[Dict[str, str]] = Field(..., description="Chronological conversation turns to summarize")
    model: Optional[str] = None


class MappingProposalRequest(BaseModel):
    source_dataset_id: str
    target_dataset_id: str
    table_pair_source: Optional[str] = None
    table_pair_target: Optional[str] = None
    table_mapping_set_id: Optional[str] = None
    ontology_version_id: Optional[str] = None
    custom_instructions: Optional[str] = None
    use_ai: bool = True
    model_name: Optional[str] = "llama-3.3-70b-versatile"
    api_keys: Optional[List[str]] = None

class IngestRAGDocumentRequest(BaseModel):
    title: str = Field(..., json_schema_extra={"example": "Enterprise Customer Master Glossary & HIPAA Rules"})
    content: str = Field(..., json_schema_extra={"example": "Customer account identifiers must be alphanumeric with prefix CL-. Email is mandatory..."})
    document_type: str = Field(default="SPECIFICATION", json_schema_extra={"example": "RULEBOOK"})  # SPECIFICATION, RULEBOOK, GLOSSARY, COMPLIANCE
    chunk_size: Optional[int] = Field(default=600, ge=100, le=5000)
    chunk_overlap: Optional[int] = Field(default=100, ge=0, le=1000)


class QueryOntologyRAGRequest(BaseModel):
    query: str = Field(..., json_schema_extra={"example": "What are the rules and constraints for corporate customer email and identifier fields?"})
    top_k: Optional[int] = Field(default=4, ge=1, le=20)
    synthesize_with_llm: bool = True


class MappingApprovalRequest(BaseModel):
    actor: str = "business-approver@company.com"
    comments: Optional[str] = "Approved after business verification"


# ==========================================
# Rule Service DTOs
# ==========================================

class RulePackageBuildRequest(BaseModel):
    mapping_version_id: str
    semantic_version: str = "1.0.0"


# ==========================================
# Wave & Manifest DTOs
# ==========================================

class CreateWaveRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Wave 1: High Priority Accounts"})
    scope_definition: Dict[str, Any] = Field(default_factory=dict)
    dependencies: List[str] = Field(default_factory=list)


class CreateManifestRequest(BaseModel):
    project_id: str
    ontology_version_id: str
    mapping_version_id: str
    rule_package_id: str
    source_dataset_id: str
    target_dataset_id: str
    policy_waivers: List[str] = Field(default_factory=list)


# ==========================================
# Execution & Sign-off DTOs
# ==========================================

class RunStartResponse(BaseModel):
    run_id: str
    manifest_id: str
    state: RunState
    status_url: str


class RunPauseResumeRequest(BaseModel):
    reason: str = "Operator manual inspection"


class RunRollbackRequest(BaseModel):
    reason: str = "Reconciliation variance above tolerance"


class ExceptionDispositionRequest(BaseModel):
    disposition: ExceptionDisposition
    resolution_note: str
    actor: str = "analyst@company.com"


class RunSignoffRequest(BaseModel):
    actor: str = "business-approver@company.com"
    comments: str = "Production sign-off granted following reconciliation verification"


# ==========================================
# Lineage & Trace DTOs (TA-012)
# ==========================================

class LineageTraceResponse(BaseModel):
    target_record_id: str
    source_record_id: Optional[str]
    source_system: str
    target_system: str
    run_id: str
    mapping_version_id: str
    rule_package_id: str
    transformations_applied: List[Dict[str, Any]]
    trace_timestamp: float


# ==========================================
# Groq Key Management DTOs
# ==========================================

class UpdateGroqKeysRequest(BaseModel):
    keys: List[str]


class GroqPoolMetricsResponse(BaseModel):
    total_keys: int
    active_keys_metrics: List[Dict[str, Any]]
    round_robin_strategy: str = "ThreadSafeRoundRobinWithFailover"



class DirectSystemUpdateRequest(BaseModel):
    """Partial update for an existing system / connector configuration."""

    name: Optional[str] = Field(default=None, json_schema_extra={"example": "Production Snowflake Lakehouse"})
    kind: Optional[str] = Field(default=None, json_schema_extra={"example": "TARGET"})
    adapter_type: Optional[str] = Field(default=None, json_schema_extra={"example": "snowflake"})
    connector_type: Optional[str] = Field(default=None, json_schema_extra={"example": "snowflake"})
    classification: Optional[str] = None
    purpose: Optional[str] = None
    environment: Optional[str] = None
    connection_config: Optional[Dict[str, Any]] = None
    secret_ref: Optional[str] = None    