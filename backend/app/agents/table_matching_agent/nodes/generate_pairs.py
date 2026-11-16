"""
Proposal generation node for table matching within LangGraph.

Strictly LLM-driven: eliminates all hardcoded deterministic matchers.
All table pairs are discovered dynamically by the LLM reasoning over
business concepts, foreign key topologies, and column-level schemas,
enforced through validated Pydantic models.
"""

from typing import Any, Dict, List, Optional, Set

from app.agents.table_matching_agent.llm.structured import (
    DEFAULT_TABLE_MATCHING_MODEL,
    run_structured_table_matching,
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
    """Turn binding dicts into prompt-friendly string."""
    if not bindings:
        return ""
    lines = [
        f"  • {b.get('table_name')}.{b.get('column_name')} -> {b.get('concept_name')}"
        for b in bindings[:100]
        if b.get("table_name") and b.get("column_name")
    ]
    return "\n".join(lines)


def _resolve_table_name(cand: str, valid_names: Set[str]) -> Optional[str]:
    """
    Resolves table name across case differences, whitespace, or schema prefixes.
    Prevents false rejections when LLM provides e.g. 'erp_source_db.legacy_customers'.
    """
    if not cand:
        return None
    c = str(cand).strip()
    if c in valid_names:
        return c

    # Case-insensitive
    lower_map = {n.lower(): n for n in valid_names}
    if c.lower() in lower_map:
        return lower_map[c.lower()]

    # Strip database/schema qualification (e.g. 'erp_source_db.legacy_customers' -> 'legacy_customers')
    bare = c.split(".")[-1].strip()
    if bare in valid_names:
        return bare
    if bare.lower() in lower_map:
        return lower_map[bare.lower()]

    return None


def _to_candidates(
    response: TableMatchingResponse,
    valid_source_names: Set[str],
    valid_target_names: Set[str],
    min_confidence: float = 0.0,
) -> List[TablePairCandidate]:
    """Convert Pydantic response → state dicts, strictly validating against known tables."""
    out: List[TablePairCandidate] = []

    for d in response.pairs:
        resolved_src = _resolve_table_name(d.source_table, valid_source_names)
        resolved_tgt = _resolve_table_name(d.target_table, valid_target_names)

        if not resolved_src or not resolved_tgt:
            logger.warning(
                f"[TableMatchingAgent] Dropping non-existent pair proposal: "
                f"'{d.source_table}' → '{d.target_table}'"
            )
            continue

        conf = float(d.confidence_score)
        if conf < min_confidence:
            logger.info(
                f"[TableMatchingAgent] Skipping low-confidence proposal ({conf:.2f} < {min_confidence}): "
                f"{resolved_src} → {resolved_tgt}"
            )
            continue

        out.append(
            TablePairCandidate(
                source_table=resolved_src,
                target_table=resolved_tgt,
                confidence_score=conf,
                match_status="MATCHED",
                matched_concepts=list(d.matched_concepts or []),
                matched_columns=list(d.matched_columns or []),
                matched_columns_count=d.matched_columns_count or len(d.matched_columns or []),
                rationale=d.rationale or "Matched by LLM semantic reasoning and schema alignment.",
                requires_masking=bool(d.requires_masking),
                rules_applied=["llm_semantic_matcher"],
                depends_on=list(d.depends_on or []),
            )
        )

    return out


def node_generate_pairs(state: TableMatchingState) -> TableMatchingState:
    """
    Generate table-pair proposals strictly from LLM reasoning.
    Zero hardcoded deterministic matchers.
    """
    state["stage"] = "generate_pairs"

    if state.get("error"):
        return state

    source_tables = state.get("source_tables", []) or []
    target_tables = state.get("target_tables", []) or []

    if not source_tables or not target_tables:
        state["error"] = "Source or target table list is empty — nothing to match."
        return state

    bindings = state.get("ontology_bindings") or []  # type: ignore
    min_conf = state.get("min_confidence", 0.40)

    valid_sources = {t.get("name") for t in source_tables if t.get("name")}
    valid_targets = {t.get("name") for t in target_tables if t.get("name")}

    bindings_str = _format_bindings_for_prompt(bindings)
    rag_context = "\n".join(state.get("retrieved_rules", []) or [])
    custom = state.get("custom_instructions") or (
        "Analyze schemas, column semantics, and foreign key topology to find matching table pairs."
    )

    user_prompt = build_table_matching_user_prompt(
        source_tables=source_tables,
        target_tables=target_tables,
        ontology_bindings=bindings_str,
        rag_context=rag_context,
        custom_instructions=custom,
        min_confidence=min_conf,
    )

    logger.info(
        f"[TableMatchingAgent] Running LLM matching across {len(source_tables)} source tables "
        f"and {len(target_tables)} target tables..."
    )

    response = None
    try:
        response = run_structured_table_matching(
            schema=TableMatchingResponse,
            system_prompt=TABLE_MATCHING_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            api_keys=state.get("api_keys"),
            model_name=state.get("model_name", DEFAULT_TABLE_MATCHING_MODEL),
        )
    except Exception as e:
        logger.error(f"[TableMatchingAgent] LLM matching invocation error: {e}")
        state["error"] = f"LLM matching failed: {e}"
        state["pairs"] = []
        return state

    if not response or not response.pairs:
        logger.warning("[TableMatchingAgent] LLM returned no table matching proposals.")
        state["pairs"] = []
        state["review_status"] = "PENDING_REVIEW"
        return state

    ai_candidates = _to_candidates(
        response=response,
        valid_source_names=valid_sources,
        valid_target_names=valid_targets,
        min_confidence=min_conf,
    )

    # Sort candidates descending by confidence score
    ai_candidates.sort(key=lambda x: x["confidence_score"], reverse=True)

    state["pairs"] = ai_candidates
    state["review_status"] = "PENDING_REVIEW"
    logger.info(f"[TableMatchingAgent] {len(ai_candidates)} pair candidate(s) discovered by LLM.")

    return state
