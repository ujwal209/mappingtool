"""
Migration domain models.

Separate from `canonical.py` so the migration engine has its own
narrow contract. `canonical.py` keeps the core entities; this file
adds the migration-specific shapes.
"""

import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ═══════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════

class LoadMode(str, Enum):
    """How to write into the target table."""
    REPLACE = "REPLACE"   # truncate then insert
    APPEND = "APPEND"     # insert only
    UPSERT = "UPSERT"     # update on PK match, insert otherwise

class ReviewMode(str, Enum):
    """When the load gate pauses."""
    STANDARD = "STANDARD"   # pause only on warnings/PII/dirty target
    STRICT = "STRICT"       # pause on every run

class MigrationPhase(str, Enum):
    """Sub-states within a run, used for progress reporting."""
    PREFLIGHT = "PREFLIGHT"
    EXTRACT = "EXTRACT"
    TRANSFORM = "TRANSFORM"
    VALIDATE = "VALIDATE"
    AWAITING_LOAD_REVIEW = "AWAITING_LOAD_REVIEW"
    LOAD = "LOAD"
    RECONCILE = "RECONCILE"
    DONE = "DONE"

# ═══════════════════════════════════════════════════════════════
# Per-table load configuration
# ═══════════════════════════════════════════════════════════════

class TableLoadConfig(BaseModel):
    """One table's load configuration inside a manifest."""
    source_table: str
    target_table: str
    load_mode: LoadMode = LoadMode.UPSERT
    primary_key_columns: List[str] = Field(default_factory=list)
    requires_masking: bool = False
    masking_columns: List[str] = Field(default_factory=list)
    include_column_map: Dict[str, str] = Field(
        default_factory=dict,
        description="source_col -> target_col; derived from pair block",
    )

# ═══════════════════════════════════════════════════════════════
# Pre-flight gate results
# ═══════════════════════════════════════════════════════════════

class PreflightGate(BaseModel):
    """One pre-flight gate that ran before the migration started."""
    gate_id: str = Field(default_factory=lambda: f"gate-{uuid.uuid4().hex[:6]}")
    name: str = Field(
        ...,
        description=(
            "source_reachable | target_reachable | schema_drift | "
            "target_state | rule_integrity | pair_mapping_approved"
        ),
    )
    status: str = Field(
        ..., description="PASSED | FAILED | WARNING"
    )
    message: str = ""
    details: Dict[str, Any] = Field(default_factory=dict)
    blocking: bool = True
    ran_at: float = Field(default_factory=time.time)

# ═══════════════════════════════════════════════════════════════
# Review context — what a reviewer sees at the load gate
# ═══════════════════════════════════════════════════════════════

class TablePreview(BaseModel):
    """Per-table summary shown in the load-review card."""
    source_table: str
    target_table: str
    load_mode: LoadMode
    source_row_count: int = 0
    target_row_count_before: int = 0
    target_row_count_after_estimate: int = 0
    columns_mapped: int = 0
    masked_columns: List[str] = Field(default_factory=list)
    warnings_count: int = 0
    warnings: List[str] = Field(default_factory=list)
    is_destructive: bool = False   # True when REPLACE will delete existing rows

class ReviewContext(BaseModel):
    """
    Everything a reviewer needs to decide "approve load?".
    Rendered as a card in the UI.
    """
    run_id: str
    phase: MigrationPhase = MigrationPhase.AWAITING_LOAD_REVIEW

    # Headline numbers
    total_source_rows: int = 0
    total_target_rows_before: int = 0
    total_target_rows_after_estimate: int = 0
    total_tables: int = 0
    total_columns_mapped: int = 0

    # Per-table breakdown
    table_previews: List[TablePreview] = Field(default_factory=list)

    # Warnings / masking
    warning_count: int = 0
    warnings: List[str] = Field(default_factory=list)
    pii_table_count: int = 0

    # Pre-flight gate results
    preflight_gates: List[PreflightGate] = Field(default_factory=list)

    # Recommendation from the system
    recommendation: str = Field(
        default="REVIEW_REQUIRED",
        description="SAFE_TO_LOAD | REVIEW_REQUIRED | BLOCKING_WARNINGS",
    )
    recommendation_reason: str = ""

# ═══════════════════════════════════════════════════════════════
# Sign-off (Gate B)
# ═══════════════════════════════════════════════════════════════

class LoadApproval(BaseModel):
    """Recorded when a reviewer approves the load gate."""
    approved_by: str
    approved_at: float = Field(default_factory=time.time)
    comments: str = ""
    waivers_accepted: List[str] = Field(default_factory=list)

class SignoffRecord(BaseModel):
    """Recorded when a reviewer signs off the completed run."""
    actor: str
    signed_at: float = Field(default_factory=time.time)
    comments: str = ""
    evidence_hash: str = ""

# ═══════════════════════════════════════════════════════════════
# Migration manifest — the full contract
# ═══════════════════════════════════════════════════════════════

class MigrationManifest(BaseModel):
    """
    The immutable contract that pins every artifact for a run.
    Created once, never modified.
    """
    manifest_id: str = Field(default_factory=lambda: f"man-{uuid.uuid4().hex[:8]}")
    tenant_id: str = "tenant-default"
    project_id: str = ""

    # ── Human-facing identity ──────────────────────────────
    # These are copied from the create-run request so the UI
    # can render something meaningful instead of just `run-abc`.
    name: str = ""
    version_tag: str = "1.0.0"

    # Pinned artifacts
    pair_mapping_set_id: str = ""
    ontology_version_id: Optional[str] = None
    source_system_id: str = ""
    target_system_id: str = ""

    # Execution plan
    table_load_configs: List[TableLoadConfig] = Field(default_factory=list)
    review_mode: ReviewMode = ReviewMode.STANDARD
    policy_waivers: List[str] = Field(default_factory=list)

    # Content hash — computed once, never changes
    manifest_hash: str = ""

    created_by: str = ""
    created_at: float = Field(default_factory=time.time)

# ═══════════════════════════════════════════════════════════════
# Run record
# ═══════════════════════════════════════════════════════════════

class MigrationRun(BaseModel):
    """One execution of a manifest. Extends the canonical Run."""
    run_id: str = Field(default_factory=lambda: f"run-{uuid.uuid4().hex[:8]}")
    manifest_id: str = ""
    project_id: str = ""
    tenant_id: str = "tenant-default"

    # ── Human-facing identity (mirrored from the manifest) ─
    # The frontend uses these for the list + detail page title.
    name: str = ""
    description: str = ""
    version_tag: str = "1.0.0"

    # State
    state: str = "DRAFT"
    phase: MigrationPhase = MigrationPhase.PREFLIGHT

    # Progress
    tables_total: int = 0
    tables_completed: int = 0
    rows_extracted: int = 0
    rows_transformed: int = 0
    rows_validated: int = 0
    rows_loaded: int = 0
    rows_failed: int = 0

    # Gates
    preflight_gates: List[PreflightGate] = Field(default_factory=list)
    load_approval: Optional[LoadApproval] = None
    signoff: Optional[SignoffRecord] = None

    # Diagnostics
    error: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)

    # Timestamps
    created_at: float = Field(default_factory=time.time)
    started_at: Optional[float] = None
    load_started_at: Optional[float] = None
    completed_at: Optional[float] = None