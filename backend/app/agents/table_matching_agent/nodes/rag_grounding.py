"""
RAG grounding node — retrieves:
  1. Ontology concept bindings (table → column → concept)
  2. RAG rule hints from the ontology knowledge base

Bindings come from `store.list_ontologies` + the ontology's `bindings`
list. RAG rules come from `ontology_rag_service.query_ontology_rag`
if an ontology is configured.

Failure is non-fatal — the matcher degrades gracefully to name-only
similarity when bindings are empty.
"""

from typing import Any, Dict, List

from app.agents.table_matching_agent.state import TableMatchingState
from app.core.logging import get_logger

logger = get_logger("table_matching_agent")


def _extract_bindings_for_ontology(
    ontology: Any,
) -> List[Dict[str, str]]:
    """
    Flatten the ontology's Concept + SemanticBinding records into a
    list of {table_name, column_name, concept_name} dicts.

    Shape of SemanticBinding:
        {binding_id, concept_id, physical_object_id, confidence, ...}
    physical_object_id format from your existing schema bindings:
        "dataset_id.field_name" OR just "field_name"

    We look up the concept by concept_id, and resolve the physical object
    back to a table + column via the store (dataset → system → table).
    """
    from app.db.store import store

    # concept_id -> concept label
    concepts_by_id: Dict[str, str] = {}
    for c in getattr(ontology, "concepts", []) or []:
        cid = getattr(c, "concept_id", None)
        label = getattr(c, "label", None)
        if cid and label:
            concepts_by_id[cid] = label

    tenant_id = getattr(ontology, "tenant_id", "tenant-default")
    bindings_out: List[Dict[str, str]] = []

    for b in getattr(ontology, "bindings", []) or []:
        concept_id = getattr(b, "concept_id", None)
        physical = getattr(b, "physical_object_id", None)
        if not concept_id or not physical:
            continue
        concept_label = concepts_by_id.get(concept_id)
        if not concept_label:
            continue

        # physical_object_id may be "ds-abc123.column_name" or just
        # "column_name". Resolve to a table name when possible.
        table_name = ""
        column_name = physical
        if "." in physical:
            dataset_id, column_name = physical.split(".", 1)
            try:
                ds = store.get_dataset(tenant_id, dataset_id)
                if ds:
                    table_name = ds.physical_name
            except Exception:
                pass

        if table_name:
            bindings_out.append(
                {
                    "table_name": table_name,
                    "column_name": column_name,
                    "concept_name": concept_label,
                }
            )

    return bindings_out


def node_rag_grounding(state: TableMatchingState) -> TableMatchingState:
    """Populate state["retrieved_rules"] with RAG hints, if enabled."""
    state["stage"] = "rag_grounding"

    ont_id = state.get("ontology_version_id")
    tenant_id = state.get("tenant_id", "tenant-default")

    if not ont_id:
        state["retrieved_rules"] = []
        logger.info(
            "[TableMatchingAgent/RAG] No ontology configured — skipping."
        )
        return state

    # ── 1. Attach ontology bindings to state for the matcher/LLM ──
    try:
        from app.db.store import store

        ontology = store.get_ontology(tenant_id, ont_id)
        if ontology:
            bindings = _extract_bindings_for_ontology(ontology)
            state["ontology_bindings"] = bindings  # type: ignore[typeddict-unknown-key]
            logger.info(
                f"[TableMatchingAgent/RAG] Loaded {len(bindings)} "
                f"ontology bindings."
            )
        else:
            state["ontology_bindings"] = []  # type: ignore
    except Exception as e:  # noqa: BLE001
        logger.warning(
            f"[TableMatchingAgent/RAG] Binding load failed: {e}"
        )
        state["ontology_bindings"] = []  # type: ignore

    # ── 2. Pull RAG rules ──
    try:
        from app.services.ontology_rag_service import ontology_rag_service

        source_names = [
            t.get("name", "") for t in state.get("source_tables", [])
        ]
        target_names = [
            t.get("name", "") for t in state.get("target_tables", [])
        ]
        query = (
            "Table mapping constraints, PII rules, and compliance "
            "requirements for tables: "
            + ", ".join((source_names + target_names)[:20])
        )

        rag_res = ontology_rag_service.query_ontology_rag(
            tenant_id=tenant_id,
            ontology_version_id=ont_id,
            query=query,
            top_k=5,
            synthesize_with_llm=False,
        )

        state["retrieved_rules"] = [
            c.get("text", "") for c in rag_res.retrieved_chunks
        ]
        logger.info(
            f"[TableMatchingAgent/RAG] Retrieved "
            f"{len(state['retrieved_rules'])} rule chunks."
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(
            f"[TableMatchingAgent/RAG] Rule retrieval skipped: {e}"
        )
        state["retrieved_rules"] = []

    return state