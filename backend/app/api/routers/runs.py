"""
Run Execution, Control, and Evidence Sign-Off API.
Fulfills Section 5, Section 14, TA-007, TA-010, and TA-011 with detailed OpenAPI documentation.
"""

from fastapi import APIRouter, Depends, Header
from typing import Dict, Any, Optional, List
from app.models.canonical import Run, RunState
from app.models.schemas import (
    RunStartResponse,
    RunPauseResumeRequest,
    RunRollbackRequest,
    RunSignoffRequest,
)
from app.services.orchestrator_service import orchestrator_service
from app.services.evidence_service import evidence_service
from app.db.store import store
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.api.middleware.idempotency import idempotency_manager
from app.core.errors import PlatformException, ErrorCategory

router = APIRouter()


@router.get(
    "/runs",
    response_model=List[Run],
    summary="List Migration Runs",
    response_description="List of all migration runs for current tenant",
)
def list_runs(auth: AuthContext = Depends(get_auth_context)):
    """
    **List all migration runs and their current states for the tenant.**
    """
    return store.list_runs(auth.tenant_id)


@router.post(
    "/manifests/{manifest_id}/runs",
    response_model=RunStartResponse,
    status_code=202,
    summary="Start Migration Run from Manifest",
    response_description="HTTP 202 Accepted with execution run_id and status polling URL",
)
def start_run(
    manifest_id: str,
    auth: AuthContext = Depends(get_auth_context),
    idempotency_key: Optional[str] = Header(
        default=None,
        alias="Idempotency-Key",
        description="Optional client UUID for idempotent execution requests.",
    ),
):
    """
    **Initiate a migration run from an immutable Run Manifest** (PRD Section 5 & 14).

    ### Execution DAG Pipeline:
    1. **Pre-flight Gate (TA-005)**: Evaluates schema drift. If blocking drift is detected without an authorized waiver, execution halts immediately.
    2. **EXTRACT**: Streams partitioned records from Source Connector (OneLake, D365, Relational, File) with checksums.
    3. **TRANSFORM (TA-002, TA-012)**: Pure deterministic evaluation of compiled rule package; generates record-level lineage trace.
    4. **VALIDATE (Section 12)**: Evaluates Schema, Record, Uniqueness, and Referential quality gates.
    5. **LOAD (TA-004)**: Batched idempotent writes into Destination Connector with dedup protection.
       - **Destination Mapping Persistence**: Saves verified ontology-aligned mapping catalog into destination system.
    6. **RECONCILE (Section 13)**: Compares row counts, hash totals, and sums between source and destination. Emits linked exceptions on variance.
    7. **GATE (Section 14.1)**: Determines final state (`COMPLETED` or `EXCEPTION_REVIEW`).
    """
    if idempotency_key:
        cached = idempotency_manager.check_or_store(auth.tenant_id, idempotency_key, {"manifest_id": manifest_id})
        if cached:
            return cached[1]

    run = orchestrator_service.start_run(auth.tenant_id, manifest_id)

    response_payload = RunStartResponse(
        run_id=run.run_id,
        manifest_id=run.manifest_id,
        state=run.state,
        status_url=f"/api/v1/runs/{run.run_id}",
    )

    if idempotency_key:
        idempotency_manager.record_response(auth.tenant_id, idempotency_key, {"manifest_id": manifest_id}, 202, response_payload)

    return response_payload


@router.get(
    "/runs/{run_id}",
    response_model=Run,
    summary="Get Migration Run Status",
    response_description="Current run state, attempt number, timestamps, and evidence hashes",
)
def get_run(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve status, state machine phase, and completion metrics for a migration run.**
    """
    run = store.get_run(auth.tenant_id, run_id)
    if not run:
        raise PlatformException(code="RUN_NOT_FOUND", message="Run not found", status_code=404)
    return run


@router.post(
    "/runs/{run_id}/pause",
    response_model=Run,
    summary="Request Safe Checkpoint Pause",
    response_description="Paused run state with preserved worker checkpoints",
)
def pause_run(run_id: str, req: RunPauseResumeRequest, auth: AuthContext = Depends(get_auth_context)):
    """
    **Request a safe checkpoint pause for a running execution** (PRD Section 5 & 14.1).
    Ensures in-flight partitions complete cleanly before pausing.
    """
    return orchestrator_service.pause_run(auth.tenant_id, run_id, reason=req.reason)


@router.post(
    "/runs/{run_id}/resume",
    response_model=Run,
    summary="Resume Run from Checkpoint",
    response_description="Resumed run state continuing from durable checkpoint offsets",
)
def resume_run(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Resume a paused migration run from its durable checkpoint tokens** (PRD Section 5 & 14.1).
    """
    return orchestrator_service.resume_run(auth.tenant_id, run_id)


@router.post(
    "/runs/{run_id}/rollback",
    response_model=Run,
    summary="Execute Rollback Compensation Workflow",
    response_description="Separate rollback execution record linked to original run",
)
def rollback_run(run_id: str, req: RunRollbackRequest, auth: AuthContext = Depends(get_auth_context)):
    """
    **Execute configured target rollback or compensation workflow** (PRD Section 5 & TA-011).

    ### Auditing Guarantee (TA-011):
    - Creates a separate audited rollback execution record linked to the original run.
    - Never deletes or overwrites the original execution run or its quality evidence.
    """
    return orchestrator_service.rollback_run(auth.tenant_id, run_id, reason=req.reason)


@router.get(
    "/runs/{run_id}/evidence",
    response_model=Dict[str, Any],
    summary="Retrieve Quality & Reconciliation Evidence Manifest",
    response_description="Complete evidence manifest payload and SHA-256 evidence bundle hash",
)
def get_run_evidence(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve immutable quality and reconciliation evidence manifest for a run** (PRD Section 5).
    """
    return evidence_service.assemble_evidence_manifest(auth.tenant_id, run_id)


@router.post(
    "/runs/{run_id}/signoff",
    response_model=Dict[str, Any],
    summary="Capture Final Business Cutover Sign-Off",
    response_description="Sign-off confirmation with locked evidence hash and staging purge indicator",
)
def signoff_run(run_id: str, req: RunSignoffRequest, auth: AuthContext = Depends(get_auth_context)):
    """
    **Capture formal business cutover sign-off** (PRD Section 5 & TA-007).

    ### Verification & Staging Purge (TA-007):
    - Computes and locks the tamper-evident SHA-256 evidence bundle hash.
    - Transitions run to state `SIGNED_OFF`.
    - Purges transient staging partition data while permanently preserving the evidence bundle.
    """
    return evidence_service.signoff_run(
        tenant_id=auth.tenant_id,
        run_id=run_id,
        actor=req.actor,
        comments=req.comments,
    )


@router.post(
    "/runs/{run_id}/selective-rerun",
    response_model=Run,
    summary="Execute Selective Rerun for Failed Partition",
    response_description="Rerun execution record processing only the designated partition scope",
)
def selective_rerun(
    run_id: str,
    partition_id: str = "part-0",
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Execute selective rerun for only the failed partition/exception scope** (PRD Section 14 & TA-010).
    Maintains parent lineage linkage to the original run and approved artifact versions.
    """
    return orchestrator_service.execute_selective_rerun(auth.tenant_id, run_id, partition_id)
