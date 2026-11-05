"""
Event Bus & Event Store for Event-Driven Architecture.
Dispatches and records immutable domain events into MongoDB database 'mapping' (collection 'events').
"""

import time
import uuid
import threading
from typing import Any, Dict, List, Optional, Callable
from app.models.events import EventEnvelope, EventType
from app.db.mongo import mongo_manager
from app.core.logging import logger


class EventBus:
    """
    Central Event Bus and Event Store.
    Provides publish/subscribe coordination and immutable persistence of domain events.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._subscribers: Dict[str, List[Callable[[EventEnvelope], None]]] = {}
        self._recent_events: List[EventEnvelope] = []
        self._max_in_memory = 1000

    def subscribe(self, event_type: str, handler: Callable[[EventEnvelope], None]):
        """Subscribes an event handler callback to a specific event type."""
        with self._lock:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            self._subscribers[event_type].append(handler)

    def publish(
        self,
        tenant_id: str,
        event_type: str,
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None,
        producer: str = "migration-control-plane",
    ) -> EventEnvelope:
        """
        Publishes a domain event, persists it to MongoDB 'events' collection,
        and triggers any registered subscriber callbacks.
        """
        corr_id = correlation_id or f"corr-{uuid.uuid4().hex[:10]}"
        envelope = EventEnvelope(
            event_id=f"ev-{uuid.uuid4().hex[:12]}",
            event_type=event_type,
            schema_version="1.0.0",
            tenant_id=tenant_id,
            occurred_at=time.time(),
            producer=producer,
            correlation_id=corr_id,
            payload=payload,
        )

        with self._lock:
            # Buffer in memory
            self._recent_events.append(envelope)
            if len(self._recent_events) > self._max_in_memory:
                self._recent_events.pop(0)

        # Persist to MongoDB
        try:
            mongo_manager.upsert_document(
                "events",
                {"tenant_id": tenant_id, "event_id": envelope.event_id},
                envelope.model_dump(),
            )
        except Exception as e:
            logger.warning(f"Failed to persist event {envelope.event_id} to MongoDB: {str(e)}")

        # Notify subscribers
        with self._lock:
            handlers = list(self._subscribers.get(event_type, [])) + list(self._subscribers.get("*", []))

        for h in handlers:
            try:
                h(envelope)
            except Exception as e:
                logger.error(f"Error in event handler for {event_type}: {str(e)}")

        return envelope

    def list_events(
        self,
        tenant_id: str,
        event_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[EventEnvelope]:
        """
        Retrieves events for a tenant from MongoDB or in-memory cache.
        """
        # Try Mongo first
        try:
            query: Dict[str, Any] = {"tenant_id": tenant_id}
            if event_type:
                query["event_type"] = event_type
            docs = mongo_manager.find_many("events", query, limit=limit)
            if docs:
                docs.sort(key=lambda d: d.get("occurred_at", 0), reverse=True)
                return [EventEnvelope(**d) for d in docs]
        except Exception as e:
            logger.warning(f"Error reading events from MongoDB: {str(e)}")

        # Fallback to in-memory events
        with self._lock:
            filtered = [
                e for e in self._recent_events
                if e.tenant_id == tenant_id and (not event_type or e.event_type == event_type)
            ]
            filtered.sort(key=lambda x: x.occurred_at, reverse=True)
            return filtered[:limit]


# Global event bus singleton
event_bus = EventBus()
