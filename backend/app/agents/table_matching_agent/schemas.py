"""
Pydantic structured-output contract for the table matching LLM.

Each Field description is sent to the LLM as part of the JSON schema.
Keep them precise — they're part of the prompt.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class TablePairDecision(BaseModel):
    """One source-table → target-table mapping recommendation."""

    source_table: str = Field(
        ...,
        description=(
            "The EXACT source table name, verbatim from the source table "
            "list. Must not be invented or abbreviated."
        ),
    )

    target_table: str = Field(
        ...,
        description=(
            "The EXACT target table name, verbatim from the target table "
            "list. Must not be invented or abbreviated."
        ),
    )

    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description=(
            "Confidence between 0.0 and 1.0 that these two tables represent "
            "the same business concept. Use >=0.85 only when both share "
            "ontology concept bindings AND have matching primary keys."
        ),
    )

    matched_concepts: List[str] = Field(
        default_factory=list,
        description=(
            "Ontology entity names shared between source and target "
            "(e.g. ['Customer', 'Order']). Empty if no bindings exist."
        ),
    )

    matched_columns: List[Dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Column pairs that share a concept or clear semantic equivalence. "
            "Each entry must have keys: source_col, target_col, concept."
        ),
    )

    matched_columns_count: int = Field(
        default=0,
        ge=0,
        description="Count of columns with a strong match.",
    )

    rationale: str = Field(
        ...,
        description=(
            "One or two sentences explaining why this pair is proposed. "
            "Cite specific evidence — concept overlap, name similarity, or "
            "FK structure. Do not speculate."
        ),
    )

    requires_masking: bool = Field(
        default=False,
        description=(
            "True if the RAG rules indicate this table contains PII or "
            "regulated data that needs masking on load."
        ),
    )

    depends_on: List[str] = Field(
        default_factory=list,
        description=(
            "Target table names that must migrate BEFORE this one "
            "(FK parents). Used for wave ordering."
        ),
    )

    @field_validator("confidence_score", mode="after")
    @classmethod
    def _clamp_confidence(cls, v):
        return max(0.0, min(1.0, v))


class TableMatchingResponse(BaseModel):
    """Full structured output from the table matching LLM."""

    pairs: List[TablePairDecision] = Field(
        default_factory=list,
        description=(
            "One entry per source ↔ target table pairing you believe is "
            "correct. Multiple source tables may map to the same target if "
            "the domain is ambiguous; the human reviewer will resolve it."
        ),
    )

    overall_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Average of all pair confidence scores. Informational.",
    )

    reasoning_summary: str = Field(
        default="",
        description=(
            "One paragraph summarising the matching strategy: how many "
            "tables were examined, how many pairs proposed, and which "
            "signals drove the decisions."
        ),
    )


class HumanTableDecision(BaseModel):
    """One reviewer decision applied via the HITL gate."""

    source_table: str = Field(..., description="Source table.")
    target_table: str = Field(..., description="Target table.")
    decision: str = Field(
        ...,
        description=(
            "APPROVED (keep as proposed) | REJECTED (remove pair) | "
            "EDITED (override some fields)."
        ),
    )
    override_confidence: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Optional confidence override for EDITED decisions.",
    )
    override_requires_masking: Optional[bool] = Field(
        None, description="Optional masking flag override."
    )
    override_rationale: Optional[str] = Field(
        None, description="Optional rationale override."
    )

    @field_validator("decision", mode="before")
    @classmethod
    def _normalize_decision(cls, v):
        s = str(v or "").upper().strip()
        return s if s in {"APPROVED", "REJECTED", "EDITED"} else "APPROVED"