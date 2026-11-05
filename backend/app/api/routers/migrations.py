"""
Migration API.

Endpoints for creating runs, approving the load gate, aborting,
signing off, and building the review context.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.middleware.auth_rbac import AuthContext, get_auth_context
from app.models.migration import (
    LoadMode,
    MigrationManifest,
    MigrationRun,
    ReviewContext,
    ReviewMode,
)
from app.services.migration_service import migration_service
from app.db.store import store

router = APIRouter()

# ═══════════════════════════════════════════════════════════════
# Request bodies
# ═══════════════════════════════════════════════════════════════

class TableLoadOverride(BaseModel):
    source_table: str
    target_table: str
    load_mode: LoadMode = LoadMode.UPSERT
    primary_key_columns: Optional[List[str]] = None
    masking_columns: Optional[List[str]] = None

class CreateRunRequest(BaseModel):
    project_id: str
    pair_mapping_set_id: str
    review_mode: ReviewMode = ReviewMode.STANDARD
    table_load_overrides: List[TableLoadOverride] = Field(default_factory=list)
    policy_waivers: List[str] = Field(default_factory=list)
    actor: str = "system"

    # ── Human-facing identity (optional) ────────────────────
    # Sent by the "New migration" form. If omitted, the service
    # derives a fallback (e.g. "Source → Target").
    name: Optional[str] = None
    description: Optional[str] = None
    version_tag: Optional[str] = None

class ApproveLoadRequest(BaseModel):
    actor: str = Field(..., description="Reviewer email")
    comments: str = ""
    waivers_accepted: List[str] = Field(default_factory=list)

class AbortRequest(BaseModel):
    actor: str
    reason: str = ""

class SignoffRequest(BaseModel):
    actor: str
    comments: str = ""

# ═══════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/migrations",
    response_model=MigrationRun,
    status_code=201,
    summary="Start a migration run",
)
def create_migration(
    req: CreateRunRequest,
    batch_size: Optional[int] = Query(
        default=None,
        ge=100,
        le=100_000,
        description=(
            "Rows per read/write batch. Overrides MIGRATION_BATCH_SIZE "
            "for this run only. Defaults to 5000."
        ),
    ),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Creates a run from an approved pair-mapping set.

    The run streams tables batch-by-batch (default 5,000 rows) so tables
    of tens of millions of rows can migrate without loading everything
    into memory at once.

    If the load gate is triggered (warnings, PII, destructive load, or
    STRICT mode), the run lands in `AWAITING_LOAD_REVIEW`. Otherwise it
    proceeds to load + reconcile and auto-signs-off when clean.
    """
    if batch_size is not None:
        import os

        os.environ["MIGRATION_BATCH_SIZE"] = str(batch_size)

    # exclude_none=True prevents Optional[List[str]] fields that were
    # left unset (or explicitly null) from arriving at the service as
    # `{"primary_key_columns": None, ...}`.
    overrides = [
        o.model_dump(exclude_none=True) for o in req.table_load_overrides
    ]

    return migration_service.create_run(
        tenant_id=auth.tenant_id,
        project_id=req.project_id,
        pair_mapping_set_id=req.pair_mapping_set_id,
        review_mode=req.review_mode.value,
        table_load_overrides=overrides,
        policy_waivers=req.policy_waivers,
        actor=req.actor,
        name=req.name,
        description=req.description,
        version_tag=req.version_tag or "1.0.0",
    )

@router.get(
    "/migrations",
    response_model=List[MigrationRun],
    summary="List migration runs",
)
def list_migrations(
    project_id: Optional[str] = None,
    state: Optional[str] = None,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    List all runs for the tenant, newest first.

    Runs created before the `name` / `version_tag` fields existed are
    back-filled here (from the manifest or the parent pair-mapping set)
    so the UI always has something meaningful to render.
    """
    runs = store.list_migration_runs(
        auth.tenant_id, project_id=project_id, state=state
    )
    return [
        migration_service._backfill_run_identity(auth.tenant_id, r)
        for r in runs
    ]

@router.get(
    "/migrations/{run_id}",
    response_model=MigrationRun,
    summary="Get migration run details",
)
def get_migration(
    run_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    run = store.get_migration_run(auth.tenant_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return migration_service._backfill_run_identity(auth.tenant_id, run)

@router.get(
    "/migrations/{run_id}/manifest",
    response_model=MigrationManifest,
    summary="Get the run's manifest",
)
def get_manifest(
    run_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    run = store.get_migration_run(auth.tenant_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    manifest = store.get_migration_manifest(auth.tenant_id, run.manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")
    return manifest

@router.get(
    "/migrations/{run_id}/review-context",
    response_model=ReviewContext,
    summary="Get review context for the load gate",
)
def get_review_context(
    run_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Returns everything a reviewer needs to make the approve/abort
    decision: per-table row counts, warnings, masking flags, and the
    system's recommendation.
    """
    return migration_service.build_review_context(auth.tenant_id, run_id)

@router.post(
    "/migrations/{run_id}/approve-load",
    response_model=MigrationRun,
    summary="★ Gate A — approve target write",
)
def approve_load(
    run_id: str,
    req: ApproveLoadRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Reviewer approval of the load gate.

    Triggers the batched load + reconcile phases. Returns the run in
    state `SIGNED_OFF` (auto) or `EXCEPTION_REVIEW` (if reconcile fails).
    """
    return migration_service.approve_load(
        tenant_id=auth.tenant_id,
        run_id=run_id,
        actor=req.actor,
        comments=req.comments,
        waivers_accepted=req.waivers_accepted,
    )

@router.post(
    "/migrations/{run_id}/abort",
    response_model=MigrationRun,
    summary="Abort the run before load",
)
def abort_migration(
    run_id: str,
    req: AbortRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Reviewer aborts the run at the load gate. Nothing is written to
    the target. Spool files and staging data are purged.
    """
    return migration_service.abort_load(
        tenant_id=auth.tenant_id,
        run_id=run_id,
        actor=req.actor,
        reason=req.reason,
    )

@router.post(
    "/migrations/{run_id}/signoff",
    response_model=MigrationRun,
    summary="★ Gate B — sign off the completed run",
)
def signoff_migration(
    run_id: str,
    req: SignoffRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Business sign-off after reconciliation. Locks the evidence bundle
    hash, purges staging, and moves the run to `SIGNED_OFF`.
    """
    return migration_service.signoff(
        tenant_id=auth.tenant_id,
        run_id=run_id,
        actor=req.actor,
        comments=req.comments,
    )