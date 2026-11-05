"""
Immutable Audit Trail API.
Fulfills Section 6, Section 7, and Section 17 with detailed OpenAPI documentation.
"""

from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.models.canonical import AuditEvent
from app.services.audit_service import audit_service
from app.api.middleware.auth_rbac import get_auth_context, AuthContext

router = APIRouter()


@router.get(
    "/audit/events",
    response_model=List[AuditEvent],
    summary="Query Immutable Audit Trail",
    response_description="Chronological audit records with state hashes and correlation IDs",
)
def query_audit_events(
    correlation_id: Optional[str] = Query(default=None, description="Optional request correlation ID filter"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Query the append-only tamper-evident audit log** (PRD Section 6 & 17).

    Each event record captures:
    - `actor`: Authenticated user, service identity, or automated worker.
    - `action`: Specific state mutation performed.
    - `object_ref`: Canonical resource identifier.
    - `before_hash` & `after_hash`: Cryptographic SHA-256 state snapshots.
    - `correlation_id`: Distributed request tracing identifier.
    - `timestamp`: Epoch millisecond timestamp.
    """
    return audit_service.query_audit_events(auth.tenant_id, correlation_id)
