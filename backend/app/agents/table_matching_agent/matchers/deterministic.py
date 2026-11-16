"""
Deterministic table-pair matcher.

Combines multiple reliable signals:
  1. Column semantic & token overlap (strongest)
  2. Table name similarity with prefix/suffix/synonym normalization
  3. Ontology concept binding overlap (if ontology configured)
  4. Primary-key and Foreign-key structural alignment

Gracefully adapts weights when ontology bindings are absent so that
table pairs are NEVER rejected due to missing ontology metadata.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set

from app.agents.table_matching_agent.state import TablePairCandidate

# Canonical prefixes and suffixes commonly found in database schemas
COMMON_PREFIXES = [
    "legacy_", "tbl_", "table_", "fct_", "fact_", "dim_", "stg_", "stage_",
    "raw_", "src_", "tgt_", "v_", "view_", "ods_", "app_", "dbo_", "tmp_"
]
COMMON_SUFFIXES = [
    "_table", "_tbl", "_fact", "_dim", "_v1", "_v2", "_view", "_data",
    "_records", "_staging", "_stg", "_raw", "_history", "_hist", "_log"
]

# Business entity synonyms across ERP, CRM, and DW vocabularies
SYNONYMS: Dict[str, str] = {
    "cust": "customer",
    "customers": "customer",
    "client": "customer",
    "clients": "customer",
    "user": "customer",
    "users": "customer",
    "account": "account",
    "accounts": "account",
    "balance": "account",
    "balances": "account",
    "item": "product",
    "items": "product",
    "product": "product",
    "products": "product",
    "catalog": "product",
    "catalog_item": "product",
    "catalog_items": "product",
    "sku": "product",
    "goods": "product",
    "order": "order",
    "orders": "order",
    "sale": "order",
    "sales": "order",
    "purchase": "order",
    "order_line": "order_item",
    "order_lines": "order_item",
    "order_item": "order_item",
    "order_items": "order_item",
    "line_item": "order_item",
    "line_items": "order_item",
    "payment": "payment",
    "payments": "payment",
    "transaction": "payment",
    "transactions": "payment",
    "ticket": "support_case",
    "tickets": "support_case",
    "support_ticket": "support_case",
    "support_tickets": "support_case",
    "support_case": "support_case",
    "support_cases": "support_case",
    "case": "support_case",
    "cases": "support_case",
    "incident": "support_case",
    "incidents": "support_case",
    "stock": "warehouse",
    "warehouse": "warehouse",
    "warehouses": "warehouse",
    "inventory": "warehouse",
    "address": "address",
    "addresses": "address",
    "location": "address",
    "locations": "address",
}


def _clean_table_name(name: str) -> str:
    """Strip schema prefixes, clean punctuation, and resolve business synonyms."""
    if not name:
        return ""
    # Strip database/schema prefix (e.g. 'erp_source_db.legacy_customers' -> 'legacy_customers')
    s = name.split(".")[-1].strip().lower()

    # Strip common prefixes
    for p in COMMON_PREFIXES:
        if s.startswith(p):
            s = s[len(p):]
            break

    # Strip common suffixes
    for suf in COMMON_SUFFIXES:
        if s.endswith(suf):
            s = s[:-len(suf)]
            break

    s = s.strip("_ -")
    # Resolve business synonyms
    return SYNONYMS.get(s, s)


def _tokenize_name(name: str) -> Set[str]:
    """Break table or column name into meaningful sub-words."""
    # Split camelCase and snake_case
    s = re.sub(r"([a-z])([A-Z])", r"\1_\2", name).lower()
    tokens = re.split(r"[^a-z0-9]+", s)
    return {t for t in tokens if len(t) >= 2}


def _fuzzy_name_score(src_table: str, tgt_table: str) -> float:
    """Computes normalized similarity between two table names with synonym mapping."""
    clean_src = _clean_table_name(src_table)
    clean_tgt = _clean_table_name(tgt_table)

    if clean_src == clean_tgt:
        return 1.0

    # Token overlap
    src_tokens = _tokenize_name(clean_src)
    tgt_tokens = _tokenize_name(clean_tgt)

    if not src_tokens or not tgt_tokens:
        return 0.0

    intersection = src_tokens.intersection(tgt_tokens)
    union = src_tokens.union(tgt_tokens)

    jaccard = len(intersection) / len(union) if union else 0.0

    # Substring check
    if clean_src in clean_tgt or clean_tgt in clean_src:
        return max(jaccard, 0.85)

    try:
        from rapidfuzz import fuzz
        rf_score = fuzz.token_set_ratio(clean_src, clean_tgt) / 100.0
        return max(jaccard, rf_score)
    except Exception:
        return jaccard


def _column_overlap_score(
    src_table: Dict[str, Any],
    tgt_table: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Computes column-level semantic and token overlap between two tables.
    Returns score (0.0 to 1.0) and matched column pairs.
    """
    src_cols = [c.get("name", "") for c in src_table.get("columns", []) if c.get("name")]
    tgt_cols = [c.get("name", "") for c in tgt_table.get("columns", []) if c.get("name")]

    if not src_cols or not tgt_cols:
        return {"score": 0.0, "matched_columns": []}

    matched_pairs: List[Dict[str, str]] = []

    for sc in src_cols:
        s_tokens = _tokenize_name(sc)
        # Strip common column noise words
        s_meaningful = {t for t in s_tokens if t not in ("raw", "cd", "id", "code", "cents", "usd", "epoch", "int", "iso")}

        best_tc = None
        best_sim = 0.0

        for tc in tgt_cols:
            t_tokens = _tokenize_name(tc)
            t_meaningful = {t for t in t_tokens if t not in ("raw", "cd", "id", "code", "cents", "usd", "epoch", "int", "iso", "key", "dim", "fct", "natural")}

            if sc == tc:
                best_tc = tc
                best_sim = 1.0
                break

            overlap = s_meaningful.intersection(t_meaningful)
            if overlap:
                sim = len(overlap) / max(len(s_meaningful), len(t_meaningful), 1)
                if sim > best_sim:
                    best_sim = sim
                    best_tc = tc

        if best_tc and best_sim >= 0.5:
            matched_pairs.append({
                "source_col": sc,
                "target_col": best_tc,
                "similarity": str(round(best_sim, 2)),
            })

    if not src_cols or not tgt_cols:
        return {"score": 0.0, "matched_columns": []}

    coverage = len(matched_pairs) / min(len(src_cols), len(tgt_cols))
    return {
        "score": min(1.0, round(coverage, 3)),
        "matched_columns": matched_pairs,
    }


def _binding_overlap_score(
    src_table: Dict[str, Any],
    tgt_table: Dict[str, Any],
    bindings_by_table_column: Dict[str, Dict[str, str]],
) -> Dict[str, Any]:
    """Compute overlap based on configured ontology concept bindings."""
    src_name = src_table.get("name", "")
    tgt_name = tgt_table.get("name", "")

    src_col_bindings = bindings_by_table_column.get(src_name, {})
    tgt_col_bindings = bindings_by_table_column.get(tgt_name, {})

    if not src_col_bindings or not tgt_col_bindings:
        return {"score": 0.0, "matched_concepts": [], "matched_columns": []}

    src_by_concept: Dict[str, str] = {}
    for col, concept in src_col_bindings.items():
        src_by_concept.setdefault(concept, col)

    matched_concepts = set()
    matched_columns = []

    for tgt_col, tgt_concept in tgt_col_bindings.items():
        if tgt_concept in src_by_concept:
            matched_concepts.add(tgt_concept)
            matched_columns.append({
                "source_col": src_by_concept[tgt_concept],
                "target_col": tgt_col,
                "concept": tgt_concept,
            })

    score = len(matched_concepts) / max(len(tgt_col_bindings), 1)
    return {
        "score": round(score, 3),
        "matched_concepts": sorted(matched_concepts),
        "matched_columns": matched_columns,
    }


def deterministic_table_match(
    source_tables: List[Dict[str, Any]],
    target_tables: List[Dict[str, Any]],
    ontology_bindings: Optional[List[Dict[str, Any]]] = None,
    min_confidence: float = 0.40,
) -> List[TablePairCandidate]:
    """
    Produce high-accuracy table-pair candidates via adaptive deterministic scoring.
    Combines table name synonyms, column attribute overlap, and ontology bindings.
    """
    bindings_by_table_column: Dict[str, Dict[str, str]] = {}
    for b in ontology_bindings or []:
        tbl = b.get("table_name")
        col = b.get("column_name")
        concept = b.get("concept_name")
        if tbl and col and concept:
            bindings_by_table_column.setdefault(tbl, {})[col] = concept

    has_ontology = bool(bindings_by_table_column)
    results: List[TablePairCandidate] = []

    # Track best target match for each source to prioritize 1-to-1 strong pairings
    for st in source_tables:
        s_name = st.get("name", "")
        for tt in target_tables:
            t_name = tt.get("name", "")

            name_score = _fuzzy_name_score(s_name, t_name)
            col_result = _column_overlap_score(st, tt)
            col_score = col_result["score"]

            binding_result = _binding_overlap_score(st, tt, bindings_by_table_column)
            b_score = binding_result["score"]

            # Dynamic weight calculation: do NOT penalize tables when ontology is absent!
            if has_ontology:
                # When ontology is present: 40% ontology, 35% name, 25% columns
                confidence = (0.40 * b_score) + (0.35 * name_score) + (0.25 * col_score)
            else:
                # When ontology is absent: 55% name similarity (with synonyms), 45% column overlap
                confidence = (0.55 * name_score) + (0.45 * col_score)

            confidence = round(confidence, 3)

            # If name is an exact synonym/stem match, give boost
            if name_score >= 0.85:
                confidence = max(confidence, 0.80)
            if name_score >= 0.95 and col_score >= 0.40:
                confidence = max(confidence, 0.90)

            if confidence < min_confidence:
                continue

            evidence = []
            if name_score >= 0.85:
                evidence.append(f"Entity name match: '{_clean_table_name(s_name)}' ≈ '{_clean_table_name(t_name)}'")
            if col_score >= 0.30:
                evidence.append(f"{len(col_result['matched_columns'])} shared attributes identified")
            if b_score >= 0.30:
                evidence.append(f"{len(binding_result['matched_concepts'])} ontology concepts aligned")

            rationale = " | ".join(evidence) if evidence else "Evaluated by structural attribute analysis."

            # Determine if masking is required for PII
            requires_masking = any(
                keyword in col.lower()
                for col in [c.get("name", "") for c in st.get("columns", [])]
                for keyword in ("email", "phone", "ssn", "password", "secret", "credit_card", "balance")
            )

            # Extract foreign key dependencies
            depends_on = []
            for fk in tt.get("fks", []) or []:
                ref_tbl = fk.get("references_table")
                if ref_tbl and ref_tbl != t_name:
                    depends_on.append(ref_tbl)

            # Collect matched columns
            matched_columns = binding_result.get("matched_columns") or col_result.get("matched_columns") or []

            results.append(
                TablePairCandidate(
                    source_table=s_name,
                    target_table=t_name,
                    confidence_score=confidence,
                    match_status="MATCHED",
                    matched_concepts=binding_result.get("matched_concepts", []),
                    matched_columns=matched_columns,
                    matched_columns_count=len(matched_columns),
                    rationale=rationale,
                    requires_masking=requires_masking,
                    rules_applied=["deterministic_entity_matcher", "column_attribute_overlap"],
                    depends_on=sorted(set(depends_on)),
                )
            )

    # Sort descending by confidence score
    results.sort(key=lambda x: x["confidence_score"], reverse=True)

    # Keep the top-matching target for each source table (or allow top 2 if close)
    deduped: List[TablePairCandidate] = []
    seen_sources = set()
    seen_targets = set()

    for cand in results:
        src = cand["source_table"]
        tgt = cand["target_table"]
        # Allow best 1-to-1 match first
        if src not in seen_sources and tgt not in seen_targets:
            seen_sources.add(src)
            seen_targets.add(tgt)
            deduped.append(cand)

    # Second pass: append remaining high-confidence candidates for 1-to-many relationships
    for cand in results:
        if cand not in deduped and cand["confidence_score"] >= 0.70:
            deduped.append(cand)

    return deduped
