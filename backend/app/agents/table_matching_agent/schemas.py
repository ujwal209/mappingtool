"""
Pydantic structured-output contract for the table matching LLM within LangGraph.

Each Field description is sent to the LLM as part of the JSON schema.
Keep them precise — they are part of the prompt.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class TablePairDecision(BaseModel):
    """One source-table → target-table mapping recommendation strictly matching schemas."""

    source_table: str = Field(
        ...,
        description=(
            "The EXACT source table name, verbatim from the provided SOURCE TABLES list. "
            "Must not be invented, abbreviated, or modified."
        ),
    )

    target_table: str = Field(
        ...,
        description=(
            "The EXACT target table name, verbatim from the provided TARGET TABLES list. "
            "Must not be invented, abbreviated, or modified."
        ),
    )

    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description=(
            "Confidence score between 0.0 and 1.0 that these two tables represent "
            "the same business entity or dataset."
        ),
    )

    matched_concepts: List[str] = Field(
        default_factory=list,
        description=(
            "Domain and ontology entity concepts shared between source and target "
            "(e.g. ['Customer', 'Order', 'Product', 'Payment']). Empty if no ontology bindings exist."
        ),
    )

    matched_columns: List[Dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Sample or key matching columns between the source and target table. "
            "Each entry should be an object with keys: source_col, target_col, concept."
        ),
    )

    matched_columns_count: int = Field(
        default=0,
        ge=0,
        description="Count of columns with strong semantic match.",
    )

    rationale: str = Field(
        default="",
        description=(
            "Clear technical rationale explaining why this pair is proposed, "
            "citing column overlap, entity semantics, or foreign key structures."
        ),
    )

    requires_masking: bool = Field(
        default=False,
        description=(
            "True if this table contains PII (e.g. emails, tax IDs, phone numbers) "
            "or regulated data requiring masking on load."
        ),
    )

    depends_on: List[str] = Field(
        default_factory=list,
        description=(
            "Target table names that must migrate BEFORE this one "
            "due to foreign-key parent dependencies. Used for migration wave ordering."
        ),
    )

    @field_validator("confidence_score", mode="before")
    @classmethod
    def _clamp_confidence(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (ValueError, TypeError):
            return 0.5


class TableMatchingResponse(BaseModel):
    """Full structured output from the table matching LLM."""

    pairs: List[TablePairDecision] = Field(
        default_factory=list,
        description=(
            "List of source-to-target table pairs discovered. "
            "Each pair must represent a genuine mapping between a source table and target table."
        ),
    )

    overall_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Average confidence across all proposed table pairs.",
    )

    reasoning_summary: str = Field(
        default="",
        description=(
            "Detailed summary explaining the migration matching strategy, "
            "evaluated tables, signals analyzed, and topological wave order."
        ),
    )

    @field_validator("overall_confidence", mode="before")
    @classmethod
    def _clamp_overall(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (ValueError, TypeError):
            return 0.5


class HumanTableDecision(BaseModel):
    """One reviewer decision applied via the HITL gate."""

    source_table: str = Field(..., description="Source table name.")
    target_table: str = Field(..., description="Target table name.")
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
    def _norm_decision(cls, v):
        return str(v or "APPROVED").upper().strip()
