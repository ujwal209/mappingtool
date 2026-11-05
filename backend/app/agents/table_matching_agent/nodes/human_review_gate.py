"""
Human review gate node.

Applies reviewer decisions:
  - APPROVED → keep as-is
  - REJECTED → drop the pair
  - EDITED   → apply overrides (confidence, masking, rationale)

Sets review_status="APPROVED" when all decisions are applied.
"""

from typing import List

from app.agents.table_matching_agent.state import (
    TableMatchingState,
    TablePairCandidate,
)
from app.core.logging import get_logger

logger = get_logger("table_matching_agent")


def node_human_review_gate(
    state: TableMatchingState,
) -> TableMatchingState:
    """Apply reviewer decisions to the pair list."""
    state["stage"] = "human_review_gate"

    decisions = state.get("user_decisions")
    if not decisions:
        # No decisions yet — leave status PENDING_REVIEW so the graph
        # halts at the conditional edge.
        return state

    # Index current pairs by (source_table, target_table)
    pairs_by_key = {
        (p["source_table"], p["target_table"]): p
        for p in state.get("pairs", [])
    }

    keep: List[TablePairCandidate] = []
    rejected = 0
    edited = 0
    approved = 0

    # Build a set of decisions by key for O(1) lookup.
    decisions_by_key = {
        (d.get("source_table"), d.get("target_table")): d
        for d in decisions
    }

    for key, pair in pairs_by_key.items():
        decision = decisions_by_key.get(key)
        if not decision:
            # No explicit decision → keep the pair unchanged.
            keep.append(pair)
            continue

        action = (decision.get("decision") or "APPROVED").upper()

        if action == "REJECTED":
            rejected += 1
            continue

        if action == "EDITED":
            edited += 1
            if decision.get("override_confidence") is not None:
                pair["confidence_score"] = float(
                    decision["override_confidence"]
                )
            if decision.get("override_requires_masking") is not None:
                pair["requires_masking"] = bool(
                    decision["override_requires_masking"]
                )
            if decision.get("override_rationale"):
                pair["rationale"] = decision["override_rationale"]
            pair["match_status"] = "MANUAL_OVERRIDE"
            keep.append(pair)
            continue

        # APPROVED (default)
        approved += 1
        keep.append(pair)

    # Also handle ADDED pairs — a decision can propose a pair that wasn't
    # in the original LLM list. These appear as EDITED decisions with
    # no matching key in pairs_by_key.
    for key, decision in decisions_by_key.items():
        if key in pairs_by_key:
            continue
        if (decision.get("decision") or "").upper() not in {
            "APPROVED",
            "EDITED",
        }:
            continue
        # Manually added pair
        keep.append(
            TablePairCandidate(
                source_table=decision["source_table"],
                target_table=decision["target_table"],
                confidence_score=float(
                    decision.get("override_confidence") or 1.0
                ),
                match_status="MANUAL_OVERRIDE",
                matched_concepts=[],
                matched_columns=[],
                matched_columns_count=0,
                rationale=decision.get("override_rationale")
                or "Manually added by reviewer.",
                requires_masking=bool(
                    decision.get("override_requires_masking") or False
                ),
                rules_applied=[],
                depends_on=[],
            )
        )

    state["pairs"] = keep
    state["review_status"] = "APPROVED"

    logger.info(
        f"[TableMatchingAgent/HITL] {approved} approved, "
        f"{rejected} rejected, {edited} edited — "
        f"{len(keep)} pairs remain."
    )
    return state