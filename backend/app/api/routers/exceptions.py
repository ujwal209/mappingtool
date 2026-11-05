"""
Exception Cases & Disposition API.
Fulfills Section 5 and Section 14.1 with detailed OpenAPI documentation.
"""

from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.models.canonical import ExceptionCase
from app.models.schemas import ExceptionDispositionRequest
from app.services.exception_service import exception_service
from app.api.middleware.auth_rbac import get_auth_context, AuthContext

router = APIRouter()


@router.get(
    "/exceptions",
    response_model=List[ExceptionCase],
    summary="List Governed Exception Cases",
    response_description="List of exceptions matching filters",
)
def list_exceptions(
    run_id: Optional[str] = Query(default=None, description="Optional filter by migration run ID"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **List all governed exception cases** resulting from quality validation or reconciliation control failures.
    """
    return exception_service.list_exceptions(auth.tenant_id, run_id=run_id)


@router.get(
    "/exceptions/{exception_id}",
    response_model=ExceptionCase,
    summary="Get Exception Case Details",
    response_description="Exception case details including failure signature, severity, and current disposition",
)
def get_exception(exception_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve details for a specific governed exception case.**
    """
    return exception_service.get_exception(auth.tenant_id, exception_id)


@router.post(
    "/exceptions/{exception_id}/dispositions",
    response_model=ExceptionCase,
    summary="Record Exception Disposition or Policy Waiver",
    response_description="Updated exception case with resolution notes and disposition state",
)
def record_disposition(
    exception_id: str,
    req: ExceptionDispositionRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Record a formal remediation, waiver, or closure disposition for an exception** (PRD Section 5 & 14.1).

    ### Automated Run Progression:
    - If all exceptions blocking a run in `EXCEPTION_REVIEW` are waived or resolved,
      the run state machine automatically advances the run to `COMPLETED`, unblocking business sign-off.
    """
    return exception_service.record_disposition(
        tenant_id=auth.tenant_id,
        exception_id=exception_id,
        disposition=req.disposition,
        resolution_note=req.resolution_note,
        actor=req.actor,
    )
