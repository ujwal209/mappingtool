"""
Deterministic table-pair matcher.

Used when:
  - caller sets use_ai=False
  - the Groq LLM fails every retry
  - LLM returns invalid Pydantic JSON

Scoring combines four signals, weighted by reliability:

  1. Ontology binding overlap     weight 3.0  ← strongest
  2. Primary-key concept match    weight 2.0
  3. FK dependency structure      weight 1.0
  4. Fuzzy name similarity        weight 1.0  ← weakest

Each signal contributes 0.0 – 1.0; the weighted sum is normalised
to a final 0.0 – 1.0 confidence score.

Ontology bindings are optional. When absent, the matcher degrades
gracefully to signal 4 only.
"""

from typing import Any, Dict, List, Optional

from app.agents.table_matching_agent.state import TablePairCandidate

# Per-signal maximum contribution. Sum of weights normalises to 1.0.
W_BINDINGS = 3.0
W_PK = 2.0
W_FK = 1.0
W_NAME = 1.0

# Below this, we do not propose a pair at all.
MIN_SCORE_TO_PROPOSE = 0.40

# A pair scoring above this is safe to auto-approve downstream.
HIGH_CONFIDENCE = 0.85


def _normalize_name(s: str) -> str:
    """Lowercase, strip underscores/spaces/hyphens for comparison."""
    if not s:
        return ""
    return (
        str(s)
        .lower()
        .replace("_", "")
        .replace(" ", "")
        .replace("-", "")
    )


def _fuzzy_name_score(src_table: str, tgt_table: str) -> float:
    """rapidfuzz score between two table names, normalised to 0.0–1.0."""
    from rapidfuzz import fuzz

    s = _normalize_name(src_table)
    t = _normalize_name(tgt_table)
    if not s or not t:
        return 0.0
    if s == t:
        return 1.0
    return fuzz.token_set_ratio(s, t) / 100.0


def _binding_overlap_score(
    src_table: Dict[str, Any],
    tgt_table: Dict[str, Any],
    bindings_by_table_column: Dict[str, Dict[str, str]],
) -> Dict[str, Any]:
    """
    Compute the fraction of target columns whose ontology concept is
    shared with at least one source column.

    Returns:
        {
          "score": 0.0 – 1.0,
          "matched_concepts": [...],
          "matched_columns": [{source_col, target_col, concept}, ...]
        }
    """
    src_name = src_table.get("name", "")
    tgt_name = tgt_table.get("name", "")

    src_col_bindings = bindings_by_table_column.get(src_name, {})
    tgt_col_bindings = bindings_by_table_column.get(tgt_name, {})

    if not src_col_bindings or not tgt_col_bindings:
        return {"score": 0.0, "matched_concepts": [], "matched_columns": []}

    # concept -> (first source col bound to it)
    src_by_concept: Dict[str, str] = {}
    for col, concept in src_col_bindings.items():
        src_by_concept.setdefault(concept, col)

    matched_concepts: set = set()
    matched_columns: List[Dict[str, str]] = []

    for tgt_col, tgt_concept in tgt_col_bindings.items():
        if tgt_concept in src_by_concept:
            matched_concepts.add(tgt_concept)
            matched_columns.append(
                {
                    "source_col": src_by_concept[tgt_concept],
                    "target_col": tgt_col,
                    "concept": tgt_concept,
                }
            )

    # Fraction of target columns that have a concept match.
    denom = max(len(tgt_col_bindings), 1)
    score = min(1.0, len(matched_columns) / denom)

    return {
        "score": score,
        "matched_concepts": sorted(matched_concepts),
        "matched_columns": matched_columns,
    }


def _pk_score(
    src_table: Dict[str, Any],
    tgt_table: Dict[str, Any],
    bindings_by_table_column: Dict[str, Dict[str, str]],
) -> float:
    """
    Score 1.0 if both tables have a primary key column bound to the same
    ontology concept. 0.0 otherwise.
    """
    src_name = src_table.get("name", "")
    tgt_name = tgt_table.get("name", "")

    def _pk_concepts(table: Dict[str, Any], table_name: str) -> set:
        cols = table.get("columns", []) or []
        table_binds = bindings_by_table_column.get(table_name, {})
        out = set()
        for c in cols:
            if c.get("is_pk"):
                concept = table_binds.get(c.get("name"))
                if concept:
                    out.add(concept)
        return out

    src_pks = _pk_concepts(src_table, src_name)
    tgt_pks = _pk_concepts(tgt_table, tgt_name)

    if not src_pks or not tgt_pks:
        return 0.0
    return 1.0 if src_pks & tgt_pks else 0.0


def _fk_score(
    src_table: Dict[str, Any],
    tgt_table: Dict[str, Any],
    already_paired_tables: Dict[str, str],
) -> float:
    """
    Score by structural FK similarity.

    If source table has FK -> parent_src, and target table has FK -> parent_tgt,
    and (parent_src -> parent_tgt) is already a known pair, we score 1.0.
    """
    src_fks = src_table.get("fks", []) or []
    tgt_fks = tgt_table.get("fks", []) or []

    if not src_fks or not tgt_fks:
        return 0.0

    src_parents = {
        f.get("references_table") for f in src_fks if f.get("references_table")
    }
    tgt_parents = {
        f.get("references_table") for f in tgt_fks if f.get("references_table")
    }

    if not src_parents or not tgt_parents:
        return 0.0

    # Count how many source FK parents have a known target counterpart
    # among the target's FK parents.
    hits = 0
    for src_parent in src_parents:
        # If the source parent maps to any target parent (directly or via
        # known pairs), count it.
        mapped_tgt = already_paired_tables.get(src_parent)
        if mapped_tgt and mapped_tgt in tgt_parents:
            hits += 1
        elif src_parent in tgt_parents:
            # Even without a known pair, matching parent names help.
            hits += 0.5

    denom = max(len(src_parents), 1)
    return min(1.0, hits / denom)


def _extract_fks(table: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract foreign-key descriptors from a table dict.

    Supported shapes:
      - table["fks"]: [{column, references_table, references_column}]
      - column-level: {"is_fk": True, "fk_target": "table.column"}
    """
    out: List[Dict[str, Any]] = []

    for fk in table.get("fks", []) or []:
        if isinstance(fk, dict) and fk.get("column"):
            out.append(
                {
                    "column": fk["column"],
                    "references_table": fk.get("references_table", ""),
                    "references_column": fk.get("references_column", ""),
                }
            )

    for col in table.get("columns", []) or []:
        target = col.get("fk_target")
        if target and "." in target:
            ref_table, ref_col = target.split(".", 1)
            out.append(
                {
                    "column": col.get("name"),
                    "references_table": ref_table,
                    "references_column": ref_col,
                }
            )

    # De-dupe
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for fk in out:
        key = (fk["column"], fk["references_table"], fk["references_column"])
        if key not in seen:
            seen.add(key)
            deduped.append(fk)
    return deduped


def deterministic_table_match(
    source_tables: List[Dict[str, Any]],
    target_tables: List[Dict[str, Any]],
    ontology_bindings: Optional[List[Dict[str, Any]]] = None,
    min_confidence: float = MIN_SCORE_TO_PROPOSE,
) -> List[TablePairCandidate]:
    """
    Produce table-pair candidates via deterministic scoring.

    Args:
        source_tables:     list of {name, columns, fks} dicts
        target_tables:     list of {name, columns, fks} dicts
        ontology_bindings: optional list of
                           {table_name, column_name, concept_name}
        min_confidence:    suppress proposals below this score

    Returns:
        List of TablePairCandidate dicts sorted by descending confidence.
    """
    # Index ontology bindings: table -> {column -> concept}
    bindings_by_table_column: Dict[str, Dict[str, str]] = {}
    for b in ontology_bindings or []:
        tbl = b.get("table_name")
        col = b.get("column_name")
        concept = b.get("concept_name")
        if tbl and col and concept:
            bindings_by_table_column.setdefault(tbl, {})[col] = concept

    # Pre-extract FKs into a normalised form so signal scoring is clean.
    src_norm = []
    for t in source_tables:
        t2 = dict(t)
        t2["fks"] = _extract_fks(t)
        src_norm.append(t2)

    tgt_norm = []
    for t in target_tables:
        t2 = dict(t)
        t2["fks"] = _extract_fks(t)
        tgt_norm.append(t2)

    # Build a partial source->target table pairing map, seeded by the
    # highest binding-overlap candidates. Used for FK scoring.
    # Two-pass: first compute bindings, then use as `already_paired`.
    preliminary: Dict[str, str] = {}
    for st in src_norm:
        best_tgt_name = None
        best_score = 0.0
        for tt in tgt_norm:
            b = _binding_overlap_score(st, tt, bindings_by_table_column)
            if b["score"] > best_score:
                best_score = b["score"]
                best_tgt_name = tt.get("name")
        if best_tgt_name and best_score >= 0.6:
            preliminary[st.get("name", "")] = best_tgt_name

    results: List[TablePairCandidate] = []

    for st in src_norm:
        s_name = st.get("name", "")
        for tt in tgt_norm:
            t_name = tt.get("name", "")

            binding_result = _binding_overlap_score(
                st, tt, bindings_by_table_column
            )
            b_score = binding_result["score"]
            pk = _pk_score(st, tt, bindings_by_table_column)
            fk = _fk_score(st, tt, preliminary)
            name_score = _fuzzy_name_score(s_name, t_name)

            weighted = (
                W_BINDINGS * b_score
                + W_PK * pk
                + W_FK * fk
                + W_NAME * name_score
            )
            total_weight = W_BINDINGS + W_PK + W_FK + W_NAME
            confidence = round(weighted / total_weight, 3)

            if confidence < min_confidence:
                continue

            # Build rationale from evidence.
            evidence: List[str] = []
            if b_score >= 0.3:
                evidence.append(
                    f"{len(binding_result['matched_columns'])} ontology-bound "
                    f"columns shared"
                )
            if pk > 0:
                evidence.append("shared primary-key concept")
            if fk > 0:
                evidence.append("FK structure aligns")
            if name_score >= 0.7:
                evidence.append(f"name similarity {round(name_score * 100)}%")

            rationale = (
                " | ".join(evidence)
                if evidence
                else "Low-confidence pair — needs human review."
            )

            # FK-based wave dependency: this target table's FK parents
            # that already have a pair should migrate first.
            depends_on: List[str] = []
            for fk_entry in tt.get("fks", []) or []:
                parent = fk_entry.get("references_table")
                if parent and parent != t_name:
                    depends_on.append(parent)
            depends_on = sorted(set(depends_on))

            # RAG-derived masking flag comes from node layer, not matcher.
            results.append(
                TablePairCandidate(
                    source_table=s_name,
                    target_table=t_name,
                    confidence_score=confidence,
                    match_status="MATCHED",
                    matched_concepts=binding_result["matched_concepts"],
                    matched_columns=binding_result["matched_columns"],
                    matched_columns_count=len(
                        binding_result["matched_columns"]
                    ),
                    rationale=rationale,
                    requires_masking=False,
                    rules_applied=[],
                    depends_on=depends_on,
                )
            )

    results.sort(key=lambda p: p["confidence_score"], reverse=True)
    return results