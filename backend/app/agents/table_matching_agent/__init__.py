"""
Table Matching Agent.

Given two systems' schemas + an ontology, proposes which source tables
map to which target tables. Human review is mandatory — the agent
produces candidates, the reviewer confirms.
"""

from app.agents.table_matching_agent.service import (
    TableMatchingAgentService,
    table_matching_agent_service,
)

__all__ = [
    "TableMatchingAgentService",
    "table_matching_agent_service",
]