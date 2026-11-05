"""
Finalisation node.

Persists the approved pair list as a TableMappingSetVersion in the store.
Reached only after human_review_gate sets review_status="APPROVED".

The canonical model (TableMappingSetVersion) and store method
(save_table_mapping_set) are added in PR 4. This node imports them
lazily so nothing breaks at import time.
"""

import time
import uuid

from app.agents.table_matching_agent.state import TableMatchingState
from app.core.logging import get_logger
from app.core.security import compute_sha256
from app.db.store import store

logger = get_logger("table_matching_agent")


def node_finalize_pairs(
    state: TableMatchingState,
) -> TableMatchingState:
    """Persist the approved pairs as a versioned table mapping set."""
    state["stage"] = "finalize"

    tenant_id = state.get("tenant_id", "tenant-default")
    project_id = state.get("project_id", "proj-default")
    version_id = (
        state.get("table_mapping_set_id")
        or f"tms-v{uuid.uuid4().hex[:6]}"
    )

    pairs = state.get("pairs", []) or []

    # Normalise for hashing — remove volatile fields, keep content fields.
    hash_payload = {
        "project_id": project_id,
        "source_system_id": state.get("source_system_id", ""),
        "target_system_id": state.get("target_system_id", ""),
        "ontology_version_id": state.get("ontology_version_id"),
        "version_tag": state.get("version_tag", "1.0.0"),
        "pairs": [
            {
                "source_table": p["source_table"],
                "target_table": p["target_table"],
                "confidence_score": p["confidence_score"],
                "matched_concepts": p.get("matched_concepts", []),
                "matched_columns": p.get("matched_columns", []),
                "rationale": p.get("rationale", ""),
                "requires_masking": p.get("requires_masking", False),
                "depends_on": p.get("depends_on", []),
            }
            for p in pairs
        ],
    }
    content_hash = compute_sha256(hash_payload)

    # Persist via the store (method added in PR 4).
    try:
        from app.models.canonical import TableMappingSetVersion

        tms = TableMappingSetVersion(
            table_mapping_set_id=version_id,
            project_id=project_id,
            source_system_id=state.get("source_system_id", ""),
            target_system_id=state.get("target_system_id", ""),
            ontology_version_id=state.get("ontology_version_id"),
            version_tag=state.get("version_tag", "1.0.0"),
            content_hash=content_hash,
            pairs=[dict(p) for p in pairs],
            reviewed_by=state.get("reviewed_by"),
            review_comments=state.get("review_comments"),
        )

        store.save_table_mapping_set(tenant_id, tms)
        state["persisted_to_db"] = True
        logger.info(
            f"[TableMatchingAgent] Persisted table mapping set "
            f"{version_id} with {len(pairs)} pair(s)."
        )
    except Exception as e:  # noqa: BLE001
        logger.error(
            f"[TableMatchingAgent] Persistence failed: {e}. "
            f"This is expected until PR 4 adds TableMappingSetVersion."
        )
        state["persisted_to_db"] = False

    state["table_mapping_set_id"] = version_id
    state["content_hash"] = content_hash  # type: ignore
    state["finished_at"] = time.time()

    return state