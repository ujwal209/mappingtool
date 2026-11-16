"""
Test suite for the Table Matching Agent with strict LLM matching and Pydantic schemas.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.agents.table_matching_agent.schemas import (
    TableMatchingResponse,
    TablePairDecision,
)
from app.agents.table_matching_agent.nodes.generate_pairs import node_generate_pairs
from app.agents.table_matching_agent.state import TableMatchingState


def test_table_pair_decision_pydantic_schema():
    """Verify that TablePairDecision validates and clamps fields properly."""
    decision = TablePairDecision(
        source_table="legacy_customers",
        target_table="dim_customers",
        confidence_score=1.2,  # Should clamp to 1.0
        rationale="Customer table alignment",
        matched_concepts=["Customer"],
    )
    assert decision.confidence_score == 1.0
    assert decision.source_table == "legacy_customers"
    assert decision.target_table == "dim_customers"


def test_table_matching_response_pydantic_schema():
    """Verify that TableMatchingResponse parses valid structured output."""
    resp = TableMatchingResponse(
        pairs=[
            TablePairDecision(
                source_table="legacy_customers",
                target_table="dim_customers",
                confidence_score=0.92,
                rationale="Matches customer entities.",
            ),
            TablePairDecision(
                source_table="legacy_orders",
                target_table="fct_orders",
                confidence_score=0.89,
                rationale="Matches order facts.",
            ),
        ],
        overall_confidence=0.905,
        reasoning_summary="Strict LLM schema alignment.",
    )
    assert len(resp.pairs) == 2
    assert resp.overall_confidence == pytest.approx(0.905)


def test_node_generate_pairs_strictly_llm():
    """Verify that node_generate_pairs uses LLM output strictly without deterministic fallback."""
    mock_response = TableMatchingResponse(
        pairs=[
            TablePairDecision(
                source_table="legacy_customers",
                target_table="dim_customers",
                confidence_score=0.95,
                rationale="Direct customer entity match from LLM.",
            )
        ],
        overall_confidence=0.95,
        reasoning_summary="LLM reasoning.",
    )

    with patch(
        "app.agents.table_matching_agent.nodes.generate_pairs.run_structured_table_matching",
        return_value=mock_response,
    ):
        state: TableMatchingState = {
            "source_tables": [
                {"name": "legacy_customers", "columns": [{"name": "id"}]},
                {"name": "unmatched_source", "columns": [{"name": "id"}]},
            ],
            "target_tables": [
                {"name": "dim_customers", "columns": [{"name": "customer_id"}]},
                {"name": "dim_stores", "columns": [{"name": "store_id"}]},
            ],
            "min_confidence": 0.50,
            "use_ai": True,
            "stage": "init",
        }

        result = node_generate_pairs(state)
        pairs = result.get("pairs", [])
        # Only the pair from the LLM should exist. No deterministic injection for unmatched_source!
        assert len(pairs) == 1
        assert pairs[0]["source_table"] == "legacy_customers"
        assert pairs[0]["target_table"] == "dim_customers"
        assert pairs[0]["confidence_score"] == 0.95
        assert pairs[0]["rules_applied"] == ["llm_semantic_matcher"]
