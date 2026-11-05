"""
User prompt builder for the table matching agent.
"""

import json
from typing import Any, Dict, List


def _format_tables(tables: List[Dict[str, Any]]) -> str:
    """Format a list of table dicts for the prompt."""
    if not tables:
        return "  (none)"

    lines: List[str] = []
    for t in tables:
        cols = t.get("columns", []) or []
        col_list = ", ".join(
            f"{c.get('name')}:{c.get('datatype', 'string')}"
            + ("*PK" if c.get("is_pk") else "")
            for c in cols
        )

        fks = t.get("fks", []) or []
        fk_str = ""
        if fks:
            fk_str = (
                " FKs=["
                + ", ".join(
                    f"{f.get('column')}->"
                    f"{f.get('references_table')}."
                    f"{f.get('references_column')}"
                    for f in fks
                )
                + "]"
            )

        lines.append(f"  • {t.get('name')}: {col_list}{fk_str}")

    return "\n".join(lines)


def build_table_matching_user_prompt(
    source_tables: List[Dict[str, Any]],
    target_tables: List[Dict[str, Any]],
    ontology_bindings: str = "",
    rag_context: str = "",
    custom_instructions: str = "",
    min_confidence: float = 0.5,
) -> str:
    """
    Build the user prompt for the table matching LLM.

    Args:
        source_tables:       list of {name, columns, fks} dicts
        target_tables:       list of {name, columns, fks} dicts
        ontology_bindings:   pre-formatted binding lines
        rag_context:         joined RAG rule text
        custom_instructions: free-form reviewer hints
        min_confidence:      cutoff to suppress very weak proposals
    """
    return f"""
SOURCE TABLES ({len(source_tables)} total):
{_format_tables(source_tables)}

TARGET TABLES ({len(target_tables)} total):
{_format_tables(target_tables)}

ONTOLOGY CONCEPT BINDINGS:
{ontology_bindings if ontology_bindings else "None bound yet."}

BUSINESS RULES (from RAG):
{rag_context if rag_context else "None provided."}

REVIEWER INSTRUCTIONS:
{custom_instructions if custom_instructions else "Match tables by shared business concept."}

CONSTRAINTS:
- Only propose pairs with confidence_score >= {min_confidence}.
- Every source_table and target_table MUST appear verbatim in the lists above.
- You may propose the same source table against multiple targets if ambiguous.
- For each pair, include matched_concepts, matched_columns, rationale,
  requires_masking, and depends_on (FK-parent target tables).

Produce the response strictly in the provided JSON schema.
"""