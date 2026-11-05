"""
Lineage Traceability API.
Fulfills TA-012 with detailed OpenAPI documentation.
"""

from fastapi import APIRouter, Depends, Path
from app.models.schemas import LineageTraceResponse
from app.services.evidence_service import evidence_service
from app.api.middleware.auth_rbac import get_auth_context, AuthContext

router = APIRouter()


@router.get(
    "/runs/{run_id}/lineage/{target_record_id}",
    response_model=LineageTraceResponse,
    summary="Trace Record-Level Lineage (Source to Target)",
    response_description="Record lineage identifying source record ID, mapping version, transform rules, and run ID",
)
def get_record_lineage(
    run_id: str = Path(..., description="Migration Run ID that produced the target record"),
    target_record_id: str = Path(..., description="Primary or business key of the target record"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Retrieve record-level audit lineage for any destination record** (PRD TA-012).

    ### Lineage Trace Guarantee (TA-012):
    For any target record produced by a migration run, identifies:
    - `source_record_id`: Originating source record business identifier.
    - `source_system`: Logical source system of origin.
    - `target_system`: Destination system (e.g. Fabric, D365).
    - `mapping_version_id`: Approved mapping release that governed field alignment.
    - `rule_package_id`: Executable rule package and semantic version applied.
    - `transformations_applied`: Granular per-attribute transformations (`trim`, `cast`, `normalize`, `hash`).
    """
    return evidence_service.get_record_lineage(
        tenant_id=auth.tenant_id,
        run_id=run_id,
        target_record_id=target_record_id,
    )
