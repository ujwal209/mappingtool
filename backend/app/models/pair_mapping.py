"""
Data shapes for the pair-level column mapping workbench.

Only models here — no logic. All orchestration lives in
`app/services/pair_mapping_service.py`.
"""

import time
import uuid
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ============================================================
# Enums
# ============================================================
class SetStatus(str, Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    DEPRECATED = "DEPRECATED"


class PairStatus(str, Enum):
    PENDING = "PENDING"
    AI_RUN = "AI_RUN"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"


class ColumnStatus(str, Enum):
    UNMATCHED = "UNMATCHED"
    MATCHED = "MATCHED"
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"


# ============================================================
# Building blocks
# ============================================================
class ColumnCandidate(BaseModel):
    source_column: str
    score: float = 0.0
    confidence_pct: float = 0.0


class ColumnRule(BaseModel):
    rule_id: str = Field(default_factory=lambda: f"rule-{uuid.uuid4().hex[:8]}")
    target_column: str
    target_datatype: str = "string"
    target_nullable: bool = True
    matched_source_column: Optional[str] = None
    source_datatype: Optional[str] = None
    confidence_score: float = 0.0
    status: ColumnStatus = ColumnStatus.UNMATCHED
    is_auto_mapped: bool = False
    transformation_rule: Optional[str] = None
    default_value: Optional[str] = None
    rationale: str = ""
    candidates: List[ColumnCandidate] = Field(default_factory=list)


class PairBlock(BaseModel):
    pair_id: str
    source_table: str
    target_table: str
    source_dataset_id: str = ""
    target_dataset_id: str = ""
    confidence_score: float = 0.0
    match_status: PairStatus = PairStatus.PENDING
    requires_masking: bool = False
    depends_on: List[str] = Field(default_factory=list)
    rationale: str = ""
    columns: List[ColumnRule] = Field(default_factory=list)


class PairMappingSet(BaseModel):
    set_id: str = Field(default_factory=lambda: f"pms-{uuid.uuid4().hex[:6]}")
    project_id: str = "proj-default"
    tenant_id: str = "tenant-default"
    table_mapping_set_id: Optional[str] = None
    ontology_version_id: Optional[str] = None
    source_system_id: Optional[str] = None
    target_system_id: Optional[str] = None
    name: Optional[str] = None
    version_tag: str = "1.0.0"
    status: SetStatus = SetStatus.DRAFT
    content_hash: Optional[str] = None
    pairs: List[PairBlock] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


# ============================================================
# Request DTOs
# ============================================================
class CreateSetFromTableSetRequest(BaseModel):
    table_mapping_set_id: str
    ontology_version_id: Optional[str] = None
    name: Optional[str] = None
    version_tag: str = "1.0.0"


class RunAIPairRequest(BaseModel):
    use_ai: bool = True
    model_name: str = "openai/gpt-oss-120b"
    api_keys: Optional[List[str]] = None
    ontology_version_id: Optional[str] = None
    custom_instructions: Optional[str] = None


class RunAIAllRequest(BaseModel):
    use_ai: bool = True
    model_name: str = "openai/gpt-oss-120b"
    api_keys: Optional[List[str]] = None
    ontology_version_id: Optional[str] = None


class ColumnAdjustment(BaseModel):
    target_column: str
    matched_source_column: Optional[str] = None
    transformation_rule: Optional[str] = None
    default_value: Optional[str] = None
    confidence_score: Optional[float] = None
    rationale: Optional[str] = None


class ReviewPairRequest(BaseModel):
    adjustments: List[ColumnAdjustment] = Field(default_factory=list)
    actor: str = "reviewer@company.com"
    comments: Optional[str] = None


class FinalizeSetRequest(BaseModel):
    actor: str = "reviewer@company.com"
    comments: Optional[str] = None


# ============================================================
# Internal LLM contract (Pydantic — LangChain needs this)
# ============================================================
class LLMColumnDecision(BaseModel):
    target_column: str = Field(..., description="Exact target column name.")
    matched_source_column: Optional[str] = Field(
        None, description="Exact source column name, or null."
    )
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    transformation_rule: str = Field(default="direct_cast")
    default_value: Optional[str] = None
    rationale: str = ""


class LLMSchemaMappingResponse(BaseModel):
    mappings: List[LLMColumnDecision] = Field(default_factory=list)
    overall_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning_summary: str = ""