"""
Event contracts and envelopes as defined in Section 7 of the Technical Specification.
Supports asynchronous worker coordination, audit forwarding, and idempotent event processing (TA-003).
"""

import time
import uuid
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class EventType:
    PROJECT_CREATED = "project.created"
    SYSTEM_REGISTERED = "system.registered"
    ONTOLOGY_CREATED = "ontology.created"
    ONTOLOGY_CONCEPT_ADDED = "ontology.concept.added"
    DATASET_PROFILED = "dataset.profiled"
    MAPPING_CREATED = "mapping.created"
    MAPPING_APPROVED = "mapping.approved"
    RUN_REQUESTED = "migration.run.requested"
    TASK_READY = "migration.task.ready"
    TASK_COMPLETED = "migration.task.completed"
    TASK_FAILED = "migration.task.failed"
    VALIDATION_FAILED = "migration.validation.failed"
    RECONCILIATION_FAILED = "migration.reconciliation.failed"
    EXCEPTION_CREATED = "migration.exception.created"
    ARTIFACT_APPROVED = "migration.artifact.approved"
    RUN_SIGNED_OFF = "migration.run.signed_off"


class EventEnvelope(BaseModel):
    """
    Standard event envelope format defined in PRD Section 7 & 8:
    event_id, event_type, schema_version, tenant_id, occurred_at, producer, correlation_id, payload.
    """
    event_id: str = Field(default_factory=lambda: f"ev-{uuid.uuid4().hex[:12]}")
    event_type: str
    schema_version: str = "1.0.0"
    tenant_id: str
    occurred_at: float = Field(default_factory=time.time)
    producer: str = "migration-control-plane"
    correlation_id: str
    payload: Dict[str, Any]
