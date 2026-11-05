"""
Canonical Metadata Model.
Faithfully models every single entity specified in Section 4 and Section 6
of the Technical Specification Document (PRD).

Includes:
- Tenant, Project, Environment, System, Endpoint, Dataset, Field, Relationship
- ProfileSnapshot, DriftAnalysis
- OntologyVersion, Concept, SemanticBinding
- MappingSetVersion, Mapping
- RulePackageVersion
- Wave, RunManifest, Run, TaskAttempt
- ValidationResult, ReconciliationResult, ExceptionCase
- Approval, AuditEvent
"""

import time
import uuid
from typing import Any, Dict, List, Optional
from enum import Enum
from pydantic import BaseModel, Field


# ==========================================
# Enums
# ==========================================

class LifecycleState(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"
    SUSPENDED = "SUSPENDED"


class EnvironmentType(str, Enum):
    DEV = "DEV"
    TEST = "TEST"
    UAT = "UAT"
    PROD = "PROD"


class SystemKind(str, Enum):
    SOURCE = "SOURCE"
    TARGET = "TARGET"
    INTERMEDIATE = "INTERMEDIATE"


class BindingProvenance(str, Enum):
    MANUAL = "MANUAL"
    IMPORTED = "IMPORTED"
    AI = "AI"
    INFERRED = "INFERRED"


class ArtifactStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DEPRECATED = "DEPRECATED"


class RunState(str, Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    EXCEPTION_REVIEW = "EXCEPTION_REVIEW"
    FAILED = "FAILED"
    COMPLETED = "COMPLETED"
    SIGNED_OFF = "SIGNED_OFF"
    ROLLED_BACK = "ROLLED_BACK"


class RuleSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ExceptionDisposition(str, Enum):
    OPEN = "OPEN"
    RESOLVED_REMEDIATED = "RESOLVED_REMEDIATED"
    WAIVED = "WAIVED"
    RETRY_PENDING = "RETRY_PENDING"
    CLOSED = "CLOSED"


# ==========================================
# Core Metadata Entities
# ==========================================

class Tenant(BaseModel):
    tenant_id: str = Field(default_factory=lambda: f"tenant-{uuid.uuid4().hex[:8]}")
    name: str
    policy_profile: Dict[str, Any] = Field(default_factory=dict)
    residency_region: str = "us-east-1"
    created_at: float = Field(default_factory=time.time)


class Project(BaseModel):
    project_id: str = Field(default_factory=lambda: f"proj-{uuid.uuid4().hex[:8]}")
    tenant_id: str = "tenant-default"
    name: str
    description: Optional[str] = None
    owners: List[str] = Field(default_factory=list)
    lifecycle_state: LifecycleState = LifecycleState.ACTIVE
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
    created_at: float = Field(default_factory=time.time)


class Environment(BaseModel):
    environment_id: str = Field(default_factory=lambda: f"env-{uuid.uuid4().hex[:8]}")
    project_id: str
    name: str
    type: EnvironmentType = EnvironmentType.DEV
    network_zone: str = "default-zone"
    created_at: float = Field(default_factory=time.time)


class System(BaseModel):
    system_id: str = Field(default_factory=lambda: f"sys-{uuid.uuid4().hex[:8]}")
    project_id: str
    name: str
    kind: SystemKind
    connector_type: str  # e.g., 'relational', 'file', 'memory'
    classification: str = "CONFIDENTIAL"
    purpose: Optional[str] = None
    environment: str = "Production"
    created_at: float = Field(default_factory=time.time)


class Endpoint(BaseModel):
    endpoint_id: str = Field(default_factory=lambda: f"ep-{uuid.uuid4().hex[:8]}")
    system_id: str
    environment_id: str = "env-default"
    name: str = "default-endpoint"
    connection_params: Dict[str, Any] = Field(default_factory=dict)
    secret_ref: Optional[str] = None
    created_at: float = Field(default_factory=time.time)


class FieldDefinition(BaseModel):
    field_id: str = Field(default_factory=lambda: f"fld-{uuid.uuid4().hex[:8]}")
    dataset_id: str = ""
    name: str
    datatype: str = "string"
    nullable: bool = True
    ordinal: int = 0
    is_primary_key: bool = False
    is_business_key: bool = False
    is_metadata: bool = False
    description: Optional[str] = None


class Dataset(BaseModel):
    dataset_id: str = Field(default_factory=lambda: f"ds-{uuid.uuid4().hex[:8]}")
    system_id: str
    namespace: str = "default"
    physical_name: str
    fields: List[FieldDefinition] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)


class Relationship(BaseModel):
    relationship_id: str = Field(default_factory=lambda: f"rel-{uuid.uuid4().hex[:8]}")
    source_dataset_id: str
    target_dataset_id: str
    source_field: str
    target_field: str
    kind: str = "MANY_TO_ONE"
    confidence: float = 1.0


class ProfileSnapshot(BaseModel):
    profile_id: str = Field(default_factory=lambda: f"prof-{uuid.uuid4().hex[:8]}")
    dataset_id: str
    scope_hash: str = ""
    sampled_at: float = Field(default_factory=time.time)
    row_count: int = 0
    column_count: int = 0
    column_metrics: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    sample_rows: List[Dict[str, Any]] = Field(default_factory=list)


# ==========================================
# Ontology & Semantic Mapping Entities
# ==========================================

class EntityAttribute(BaseModel):
    attribute_id: str = Field(default_factory=lambda: f"attr-{uuid.uuid4().hex[:8]}")
    name: str
    label: str = ""
    datatype: str = "string"
    is_primary_key: bool = False
    is_foreign_key: bool = False
    is_indexed: bool = False
    is_nullable: bool = True
    is_unique: bool = False
    is_pii: bool = False
    foreign_key_target: Optional[str] = None
    default_value: Optional[str] = None
    description: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)


class OntologyEntity(BaseModel):
    entity_id: str = Field(default_factory=lambda: f"ent-{uuid.uuid4().hex[:8]}")
    name: str
    label: str = ""
    description: Optional[str] = None
    category: str = "Master Data"
    attributes: List[EntityAttribute] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)


class OntologyRelationship(BaseModel):
    relationship_id: str = Field(default_factory=lambda: f"rel-{uuid.uuid4().hex[:8]}")
    name: str
    label: Optional[str] = None
    source_entity_id: str
    source_entity_name: Optional[str] = None
    source_attribute_name: Optional[str] = None
    target_entity_id: str
    target_entity_name: Optional[str] = None
    target_attribute_name: Optional[str] = None
    relation_type: str = "ASSOCIATION"
    cardinality: str = "ONE_TO_MANY"
    cascade_rule: Optional[str] = "CASCADE"
    description: Optional[str] = None
    is_bidirectional: bool = False


class Concept(BaseModel):
    concept_id: str = Field(default_factory=lambda: f"cpt-{uuid.uuid4().hex[:8]}")
    ontology_version_id: str = ""
    type: str = "Attribute"
    label: str
    definition: str = ""
    datatype_expectation: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)


class SemanticBinding(BaseModel):
    binding_id: str = Field(default_factory=lambda: f"bind-{uuid.uuid4().hex[:8]}")
    concept_id: str
    physical_object_id: str
    confidence: float = 1.0
    provenance: BindingProvenance = BindingProvenance.MANUAL
    reviewer_state: str = "APPROVED"


class OntologyVersion(BaseModel):
    ontology_version_id: str = Field(default_factory=lambda: f"ont-{uuid.uuid4().hex[:6]}")
    project_id: str = "proj-default"
    name: str = "Enterprise Business Ontology"
    description: Optional[str] = None
    domain: Optional[str] = None
    parent_id: Optional[str] = None
    version_tag: str = "1.0.0"
    status: ArtifactStatus = ArtifactStatus.DRAFT
    content_hash: Optional[str] = None
    entities: List[OntologyEntity] = Field(default_factory=list)
    relationships: List[OntologyRelationship] = Field(default_factory=list)
    concepts: List[Concept] = Field(default_factory=list)
    bindings: List[SemanticBinding] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class Mapping(BaseModel):
    mapping_id: str = Field(default_factory=lambda: f"map-{uuid.uuid4().hex[:8]}")
    mapping_version_id: str = ""
    source_refs: List[str] = Field(default_factory=list)
    target_ref: str = ""
    expression_ref: Optional[str] = None
    confidence: float = 1.0
    rationale: str = ""
    match_type: str = "EXACT"
    default_value: Optional[str] = None


# backend/app/models/canonical.py — MappingSetVersion
class MappingSetVersion(BaseModel):
    mapping_version_id: str = Field(default_factory=lambda: f"maps-v{uuid.uuid4().hex[:6]}")
    project_id: str = "proj-default"
    source_dataset_id: str = ""
    target_dataset_id: str = ""
    table_pair_source: Optional[str] = None      # ADD
    table_pair_target: Optional[str] = None      # ADD
    table_mapping_set_id: Optional[str] = None   # ADD
    version_tag: str = "1.0.0"
    status: ArtifactStatus = ArtifactStatus.DRAFT
    content_hash: Optional[str] = None
    mappings: List[Mapping] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)

# ==========================================
# Rule & Execution Entities
# ==========================================

class RulePackageVersion(BaseModel):
    rule_package_id: str = Field(default_factory=lambda: f"pkg-v{uuid.uuid4().hex[:6]}")
    project_id: str = "proj-default"
    semantic_version: str = "1.0.0"
    status: ArtifactStatus = ArtifactStatus.DRAFT
    compiled_plan: Dict[str, Any] = Field(default_factory=dict)
    validations: List[Dict[str, Any]] = Field(default_factory=list)
    reconciliations: List[Dict[str, Any]] = Field(default_factory=list)
    signature: Optional[str] = None
    created_at: float = Field(default_factory=time.time)


class Wave(BaseModel):
    wave_id: str = Field(default_factory=lambda: f"wave-{uuid.uuid4().hex[:8]}")
    project_id: str = "proj-default"
    name: str
    scope_definition: Dict[str, Any] = Field(default_factory=dict)
    dependencies: List[str] = Field(default_factory=list)
    state: str = "PLANNED"
    created_at: float = Field(default_factory=time.time)


class RunManifest(BaseModel):
    manifest_id: str = Field(default_factory=lambda: f"man-{uuid.uuid4().hex[:8]}")
    wave_id: str = ""
    project_id: str = ""
    ontology_version_id: str = ""
    mapping_version_id: str = ""
    rule_package_id: str = ""
    source_dataset_id: str = ""
    target_dataset_id: str = ""
    scope_snapshot: Dict[str, Any] = Field(default_factory=dict)
    connector_versions: Dict[str, str] = Field(default_factory=dict)
    manifest_hash: str = ""
    policy_waivers: List[str] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)


class TaskAttempt(BaseModel):
    task_attempt_id: str = Field(default_factory=lambda: f"task-{uuid.uuid4().hex[:8]}")
    run_id: str = ""
    node_id: str = "DISCOVER"
    partition_id: str = ""
    attempt_no: int = 1
    state: str = "PENDING"
    fencing_token: int = 1
    checkpoint: Dict[str, Any] = Field(default_factory=dict)
    error_code: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None


class Run(BaseModel):
    run_id: str = Field(default_factory=lambda: f"run-{uuid.uuid4().hex[:8]}")
    manifest_id: str = ""
    project_id: str = ""
    attempt_no: int = 1
    state: RunState = RunState.DRAFT
    created_at: float = Field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    evidence_bundle_hash: Optional[str] = None
    signoff_record: Optional[Dict[str, Any]] = None


class ValidationResult(BaseModel):
    result_id: str = Field(default_factory=lambda: f"val-{uuid.uuid4().hex[:8]}")
    run_id: str = ""
    rule_id: str = ""
    validation_level: str = "Record"
    severity: RuleSeverity = RuleSeverity.ERROR
    passed: bool = True
    total_records: int = 0
    passed_count: int = 0
    failed_count: int = 0
    details: Dict[str, Any] = Field(default_factory=dict)
    sample_failures: List[Dict[str, Any]] = Field(default_factory=list)


class ReconciliationResult(BaseModel):
    recon_result_id: str = Field(default_factory=lambda: f"rec-{uuid.uuid4().hex[:8]}")
    run_id: str = ""
    control_id: str = ""
    control_name: str = ""
    source_value: Any = None
    target_value: Any = None
    variance: float = 0.0
    tolerance: float = 0.0
    passed: bool = True
    details: Dict[str, Any] = Field(default_factory=dict)


class ExceptionCase(BaseModel):
    exception_id: str = Field(default_factory=lambda: f"exc-{uuid.uuid4().hex[:8]}")
    run_id: str = ""
    category: str = "VALIDATION"
    severity: RuleSeverity = RuleSeverity.ERROR
    signature: str = ""
    owner: str = "unassigned"
    disposition: ExceptionDisposition = ExceptionDisposition.OPEN
    resolution_note: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: float = Field(default_factory=time.time)


class Approval(BaseModel):
    approval_id: str = Field(default_factory=lambda: f"appr-{uuid.uuid4().hex[:8]}")
    object_type: str = ""
    object_version: str = ""
    actor: str = ""
    decision: str = "APPROVED"
    timestamp: float = Field(default_factory=time.time)
    comments: Optional[str] = None


class AuditEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt-{uuid.uuid4().hex[:8]}")
    tenant_id: str = "tenant-default"
    actor: str = ""
    action: str = ""
    object_ref: str = ""
    before_hash: Optional[str] = None
    after_hash: Optional[str] = None
    correlation_id: str = ""
    timestamp: float = Field(default_factory=time.time)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ==========================================
# User & Authentication Entities
# ==========================================

class User(BaseModel):
    user_id: str = Field(default_factory=lambda: f"usr-{uuid.uuid4().hex[:8]}")
    email: str = ""
    hashed_password: str = ""
    full_name: str = ""
    tenant_id: str = "tenant-default"
    role: str = "Analyst"
    is_verified: bool = False
    is_active: bool = True
    verification_token: Optional[str] = None
    reset_token: Optional[str] = None
    reset_token_expires_at: Optional[float] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class UserCreateRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    full_name: str
    organization: Optional[str] = None
    role: Optional[str] = "Analyst"


class UserLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user_id: str = ""
    email: str = ""
    tenant_id: str = "tenant-default"
    role: str = "Analyst"
    is_verified: bool = False


class VerifyEmailRequest(BaseModel):
    token: str
    email: Optional[str] = None


class ResendVerificationRequest(BaseModel):
    email: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    tenant_id: str
    role: str
    is_verified: bool
    is_active: bool
    created_at: float


# ==========================================
# Ontology RAG Vector Search Entities
# ==========================================

class OntologyChunk(BaseModel):
    chunk_id: str = Field(default_factory=lambda: f"chk-{uuid.uuid4().hex[:8]}")
    ontology_id: str = ""
    tenant_id: str = "tenant-default"
    document_id: str = ""
    chunk_index: int = 0
    text: str = ""
    embedding: List[float] = Field(default_factory=list)
    token_count: int = 0
    source_name: str = "manual"
    created_at: float = Field(default_factory=time.time)


# ==========================================
# Table-Level Mapping (table_matching_agent)
# ==========================================
class TablePairRecord(BaseModel):
    """One persisted source-table → target-table pair."""
    source_table: str = ""
    target_table: str = ""
    confidence_score: float = 0.0
    match_status: str = "MATCHED"
    matched_concepts: List[str] = Field(default_factory=list)
    matched_columns: List[Dict[str, Any]] = Field(default_factory=list)
    matched_columns_count: int = 0
    rationale: str = ""
    requires_masking: bool = False
    rules_applied: List[str] = Field(default_factory=list)
    depends_on: List[str] = Field(default_factory=list)


class TableMappingSetVersion(BaseModel):
    """
    Versioned set of table-level mappings between one source system
    and one target system, scoped to an ontology version.
    """
    table_mapping_set_id: str = Field(
        default_factory=lambda: f"tms-v{uuid.uuid4().hex[:6]}"
    )
    project_id: str = "proj-default"
    name: str = "Untitled Pair Set"              # ← ADD THIS LINE
    source_system_id: str = ""
    target_system_id: str = ""
    ontology_version_id: Optional[str] = None
    version_tag: str = "1.0.0"
    status: ArtifactStatus = ArtifactStatus.DRAFT
    content_hash: Optional[str] = None
    pairs: List[Dict[str, Any]] = Field(default_factory=list)
    reviewed_by: Optional[str] = None
    review_comments: Optional[str] = None
    created_at: float = Field(default_factory=time.time)