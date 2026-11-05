"""
Event-Driven Architecture Endpoints.
Provides immutable event logs and real-time event subscriptions (PRD Section 7 & 8).
All events are persisted in MongoDB collection 'events'.
"""

from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.models.events import EventEnvelope
from app.services.event_bus import event_bus
from app.api.middleware.auth_rbac import get_auth_context, AuthContext

router = APIRouter()


@router.get(
    "/events",
    response_model=List[EventEnvelope],
    summary="List Domain Events",
    response_description="List of domain events emitted within tenant boundary",
)
def list_events(
    event_type: Optional[str] = Query(default=None, description="Optional filter by event_type"),
    limit: int = Query(default=50, ge=1, le=200, description="Max events to return"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Retrieve real-time event stream from the event store** (MongoDB collection 'events').
    Captures all asynchronous mutations (projects, ontologies, mappings, execution steps, quality checks).
    """
    return event_bus.list_events(tenant_id=auth.tenant_id, event_type=event_type, limit=limit)
