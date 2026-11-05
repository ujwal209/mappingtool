"""Backward-compatible re-export. Real implementation lives in app/services/ontology_agent/."""
from app.services.ontology_agent.service import OntologyAgentService

ontology_agent_service = OntologyAgentService()

__all__ = ["OntologyAgentService", "ontology_agent_service"]