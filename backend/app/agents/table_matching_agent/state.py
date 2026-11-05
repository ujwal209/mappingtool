"""
LangGraph state for the table matching agent.

The graph walks:

    rag_grounding  →  generate_pairs  →  human_review_gate  →  finalize_pairs

Each node reads only the fields it needs and writes its own output
fields — nothing is deleted or mutated destructively.
"""

from typing import Any, Dict, List, Optional, TypedDict


class TablePairCandidate(TypedDict, total=False):
    """One source-table ↔ target-table pair recommendation."""

    # Identity
    source_table: str
    target_table: str

    # Confidence
    confidence_score: float             # 0.0 – 1.0
    match_status: str                   # "MATCHED" | "UNMATCHED" | "MANUAL_OVERRIDE"

    # Evidence
    matched_concepts: List[str]         # ontology entity names shared
    matched_columns: List[Dict[str, Any]]  # [{source_col, target_col, concept}]
    matched_columns_count: int
    rationale: str

    # RAG-derived
    requires_masking: bool
    rules_applied: List[str]

    # Wave ordering
    depends_on: List[str]               # target table names to migrate first


class TableMatchingState(TypedDict, total=False):
    """Full state flowing through the LangGraph."""

    # ── Context ──────────────────────────────────────────────
    tenant_id: str
    project_id: str
    table_mapping_set_id: str
    version_tag: str

    # ── Inputs ──────────────────────────────────────────────
    source_system_id: str
    source_system_name: str
    source_system_kind: str

    target_system_id: str
    target_system_name: str
    target_system_kind: str

    source_tables: List[Dict[str, Any]]
    target_tables: List[Dict[str, Any]]

    # ── Optional RAG ────────────────────────────────────────
    ontology_version_id: Optional[str]
    retrieved_rules: List[str]

    # ── Execution knobs ─────────────────────────────────────
    model_name: str
    api_keys: Optional[List[str]]
    use_ai: bool
    min_confidence: float

    # ── Agent output ────────────────────────────────────────
    pairs: List[TablePairCandidate]

    # ── HITL ─────────────────────────────────────────────────
    user_decisions: Optional[List[Dict[str, Any]]]
    review_status: str                  # INITIALIZED | PENDING_REVIEW | APPROVED | REJECTED
    reviewed_by: Optional[str]
    review_comments: Optional[str]

    # ── Persistence ─────────────────────────────────────────
    persisted_to_db: bool
    error: Optional[str]
    stage: str
    started_at: float
    finished_at: Optional[float]