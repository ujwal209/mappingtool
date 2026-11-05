"""
Proposal generation node.

Two paths:
  - AI  →  run_structured_table_matching against TableMatchingResponse
  - Deterministic  →  deterministic_table_match

Both are followed by the anti-hallucination guard: any pair whose
source_table or target_table is not in the input list is silently dropped.
"""

from typing import Any, Dict, List

from app.agents.table_matching_agent.llm.structured import (
    DEFAULT_TABLE_MATCHING_MODEL,
    run_structured_table_matching,
)
from app.agents.table_matching_agent.matchers.deterministic import (
    deterministic_table_match,
)
from app.agents.table_matching_agent.prompts import (
    TABLE_MATCHING_SYSTEM_PROMPT,
    build_table_matching_user_prompt,
)
from app.agents.table_matching_agent.schemas import TableMatchingResponse
from app.agents.table_matching_agent.state import (
    TableMatchingState,
    TablePairCandidate,
)
from app.core.logging import get_logger

logger = get_logger("table_matching_agent")


def _format_bindings_for_prompt(bindings: List[Dict[str, str]]) -> str:
    """Turn binding dicts into the prompt-friendly string."""
    if not bindings:
        return ""
    lines = [
        f"  • {b['table_name']}.{b['column_name']} -> {b['concept_name']}"
        for b in bindings[:100]  # cap to keep prompt bounded
    ]
    return "\n".join(lines)


def _to_candidates(
    response: TableMatchingResponse,
    valid_source_names: set,
    valid_target_names: set,
) -> List[TablePairCandidate]:
    """Convert Pydantic response → state dicts, with anti-hallucination guard."""
    out: List[TablePairCandidate] = []

    for d in response.pairs:
        # Guard: drop invented tables silently.
        if (
            d.source_table not in valid_source_names
            or d.target_table not in valid_target_names
        ):
            logger.warning(
                f"[TableMatchingAgent] Dropping hallucinated pair "
                f"'{d.source_table}' → '{d.target_table}'"
            )
            continue

        out.append(
            TablePairCandidate(
                source_table=d.source_table,
                target_table=d.target_table,
                confidence_score=d.confidence_score,
                match_status="MATCHED",
                matched_concepts=list(d.matched_concepts or []),
                matched_columns=list(d.matched_columns or []),
                matched_columns_count=d.matched_columns_count or 0,
                rationale=d.rationale or "",
                requires_masking=bool(d.requires_masking),
                rules_applied=[],
                depends_on=list(d.depends_on or []),
            )
        )

    return out


def node_generate_pairs(state: TableMatchingState) -> TableMatchingState:
    """Generate table-pair proposals via AI or deterministic fallback."""
    state["stage"] = "generate_pairs"

    if state.get("error"):
        return state

    source_tables = state.get("source_tables", []) or []
    target_tables = state.get("target_tables", []) or []

    if not source_tables or not target_tables:
        state["error"] = (
            "Source or target table list is empty — nothing to match."
        )
        return state

    bindings = state.get("ontology_bindings") or []  # type: ignore
    min_conf = state.get("min_confidence", 0.5)

    # ── Deterministic-only path ───────────────────────────────
    if not state.get("use_ai", True):
        logger.info(
            "[TableMatchingAgent] use_ai=False — deterministic matcher only."
        )
        state["pairs"] = deterministic_table_match(
            source_tables=source_tables,
            target_tables=target_tables,
            ontology_bindings=bindings,
            min_confidence=min_conf,
        )
        state["review_status"] = "PENDING_REVIEW"
        return state

    # ── AI path ────────────────────────────────────────────────
    valid_sources = {t.get("name") for t in source_tables}
    valid_targets = {t.get("name") for t in target_tables}

    bindings_str = _format_bindings_for_prompt(bindings)
    rag_context = "\n".join(state.get("retrieved_rules", []) or [])
    custom = state.get("custom_instructions") or (
        "Match tables by shared business concept, FK structure, then name."
    )

    user_prompt = build_table_matching_user_prompt(
        source_tables=source_tables,
        target_tables=target_tables,
        ontology_bindings=bindings_str,
        rag_context=rag_context,
        custom_instructions=custom,
        min_confidence=min_conf,
    )

    response = run_structured_table_matching(
        schema=TableMatchingResponse,
        system_prompt=TABLE_MATCHING_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        api_keys=state.get("api_keys"),
        model_name=state.get("model_name", DEFAULT_TABLE_MATCHING_MODEL),
    )

    if not response or not response.pairs:
        logger.warning(
            "[TableMatchingAgent] Structured LLM returned no pairs — "
            "falling back to deterministic matcher."
        )
        state["pairs"] = deterministic_table_match(
            source_tables=source_tables,
            target_tables=target_tables,
            ontology_bindings=bindings,
            min_confidence=min_conf,
        )
    else:
        logger.info(
            f"[TableMatchingAgent] LLM returned {len(response.pairs)} "
            f"pair(s)."
        )
        state["pairs"] = _to_candidates(
            response, valid_sources, valid_targets
        )

    proposed = len(state.get("pairs", []))
    logger.info(
        f"[TableMatchingAgent] {proposed} pair candidate(s) proposed."
    )

    state["review_status"] = "PENDING_REVIEW"
    return state