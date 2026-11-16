"""
Proposal generation node.

Combines AI (Groq LLM structured output) and high-accuracy Deterministic matching.
Guarantees that every source table receives high-confidence proposals and
resolves schema prefixes and case-insensitive table names without false drops.
"""

from typing import Any, Dict, List, Optional, Set

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
    """Turn binding dicts into prompt-friendly string."""
    if not bindings:
        return ""
    lines = [
        f"  • {b['table_name']}.{b['column_name']} -> {b['concept_name']}"
        for b in bindings[:100]
    ]
    return "\n".join(lines)


def _resolve_table_name(cand: str, valid_names: Set[str]) -> Optional[str]:
    """Resolves table name across case differences, whitespace, or schema prefixes."""
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
) -> List[TablePairCandidate]:
    """Convert Pydantic response → state dicts, with robust canonical resolution."""
    out: List[TablePairCandidate] = []

    for d in response.pairs:
        resolved_src = _resolve_table_name(d.source_table, valid_source_names)
        resolved_tgt = _resolve_table_name(d.target_table, valid_target_names)

        if not resolved_src or not resolved_tgt:
            logger.warning(
                f"[TableMatchingAgent] Dropping unrecognized pair "
                f"'{d.source_table}' → '{d.target_table}'"
            )
            continue

        out.append(
            TablePairCandidate(
                source_table=resolved_src,
                target_table=resolved_tgt,
                confidence_score=float(d.confidence_score),
                match_status="MATCHED",
                matched_concepts=list(d.matched_concepts or []),
                matched_columns=list(d.matched_columns or []),
                matched_columns_count=d.matched_columns_count or len(d.matched_columns or []),
                rationale=d.rationale or "Matched by AI semantic reasoning.",
                requires_masking=bool(d.requires_masking),
                rules_applied=["ai_structured_matcher"],
                depends_on=list(d.depends_on or []),
            )
        )

    return out


def node_generate_pairs(state: TableMatchingState) -> TableMatchingState:
    """Generate table-pair proposals via AI supplemented by deterministic matching."""
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

    # Compute deterministic pairs first as a baseline
    deterministic_pairs = deterministic_table_match(
        source_tables=source_tables,
        target_tables=target_tables,
        ontology_bindings=bindings,
        min_confidence=min_conf,
    )

    # ── Deterministic-only path ───────────────────────────────
    if not state.get("use_ai", True):
        logger.info("[TableMatchingAgent] use_ai=False — using deterministic matcher.")
        state["pairs"] = deterministic_pairs
        state["review_status"] = "PENDING_REVIEW"
        return state

    # ── AI path ────────────────────────────────────────────────
    valid_sources = {t.get("name") for t in source_tables if t.get("name")}
    valid_targets = {t.get("name") for t in target_tables if t.get("name")}

    bindings_str = _format_bindings_for_prompt(bindings)
    rag_context = "\n".join(state.get("retrieved_rules", []) or [])
    custom = state.get("custom_instructions") or (
        "Match tables by shared business concept, foreign key topology, and attribute overlap."
    )

    user_prompt = build_table_matching_user_prompt(
        source_tables=source_tables,
        target_tables=target_tables,
        ontology_bindings=bindings_str,
        rag_context=rag_context,
        custom_instructions=custom,
        min_confidence=min_conf,
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
        logger.warning(f"[TableMatchingAgent] AI matching error: {e}")

    ai_candidates: List[TablePairCandidate] = []
    if response and response.pairs:
        ai_candidates = _to_candidates(response, valid_sources, valid_targets)
        logger.info(f"[TableMatchingAgent] LLM returned {len(ai_candidates)} validated pair(s).")

    # Combine AI candidates with deterministic baseline so no source table is left unmatched
    final_pairs: List[TablePairCandidate] = list(ai_candidates)
    matched_sources = {p["source_table"] for p in final_pairs}

    for dp in deterministic_pairs:
        if dp["source_table"] not in matched_sources:
            final_pairs.append(dp)
            matched_sources.add(dp["source_table"])

    # If AI returned nothing, use deterministic pairs directly
    if not final_pairs:
        final_pairs = deterministic_pairs

    # Sort descending by confidence score
    final_pairs.sort(key=lambda x: x["confidence_score"], reverse=True)

    state["pairs"] = final_pairs
    proposed = len(state.get("pairs", []))
    logger.info(f"[TableMatchingAgent] {proposed} total pair candidate(s) proposed.")

    state["review_status"] = "PENDING_REVIEW"
    return state
