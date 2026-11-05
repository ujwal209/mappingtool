"""
Audit Service.
Maintains append-only audit trail and dispatches standard event contracts (Section 7 & 17).
"""

from typing import Any, Dict, List, Optional
from app.models.canonical import AuditEvent
from app.models.events import EventEnvelope
from app.db.store import store


class AuditService:
    """Records immutable audit trail entries and standard event payloads."""

    def log_event(
        self,
        tenant_id: str,
        actor: str,
        action: str,
        object_ref: str,
        correlation_id: str,
        before_hash: Optional[str] = None,
        after_hash: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditEvent:
        event = AuditEvent(
            tenant_id=tenant_id,
            actor=actor,
            action=action,
            object_ref=object_ref,
            correlation_id=correlation_id,
            before_hash=before_hash,
            after_hash=after_hash,
            metadata=metadata or {},
        )
        store.add_audit_event(tenant_id, event)
        return event

    def query_audit_events(
        self,
        tenant_id: str,
        correlation_id: Optional[str] = None,
    ) -> List[AuditEvent]:
        return store.list_audit_events(tenant_id, correlation_id)


audit_service = AuditService()
