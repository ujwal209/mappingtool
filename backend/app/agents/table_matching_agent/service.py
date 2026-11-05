"""
Public facade for the table matching agent.

Two entry points:

  propose_pairs(...)
      Runs the graph up to generating proposals. Persists a DRAFT
      with the user-supplied name + version. Called by
      POST /table-pairs/propose.

  save_pairs(...)
      Direct save. Takes the current pair list, dedupes it,
      recomputes content_hash, and persists in place.
      Called by PUT /table-pairs/{set_id}.

Legacy submit_review(...) is kept for compatibility with any
older clients but is no longer used by the current UI.
"""

import time
import uuid
from typing import Any, Dict, List, Optional

from app.agents.table_matching_agent.graph import table_matching_graph
from app.agents.table_matching_agent.llm.structured import (
    DEFAULT_TABLE_MATCHING_MODEL,
)
from app.agents.table_matching_agent.nodes.human_review_gate import (
    node_human_review_gate,
)
from app.agents.table_matching_agent.nodes.finalize_pairs import (
    node_finalize_pairs,
)
from app.agents.table_matching_agent.schemas import HumanTableDecision
from app.agents.table_matching_agent.state import TableMatchingState
from app.core.logging import get_logger
from app.core.security import compute_sha256
from app.db.store import store

logger = get_logger("table_matching_agent")


def _dedupe_pairs(
    pairs: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Remove pairs with duplicate (source_table, target_table)."""
    seen = set()
    out: List[Dict[str, Any]] = []
    for p in pairs:
        key = (p.get("source_table"), p.get("target_table"))
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def _hash_pairs(
    project_id: str,
    source_system_id: str,
    target_system_id: str,
    ontology_version_id: Optional[str],
    version_tag: str,
    pairs: List[Dict[str, Any]],
) -> str:
    return compute_sha256(
        {
            "project_id": project_id,
            "source_system_id": source_system_id,
            "target_system_id": target_system_id,
            "ontology_version_id": ontology_version_id,
            "version_tag": version_tag,
            "pairs": [
                {
                    "source_table": p.get("source_table"),
                    "target_table": p.get("target_table"),
                    "confidence_score": p.get("confidence_score", 0.0),
                    "matched_concepts": p.get("matched_concepts", []),
                    "matched_columns": p.get("matched_columns", []),
                    "rationale": p.get("rationale", ""),
                    "requires_masking": p.get("requires_masking", False),
                    "depends_on": p.get("depends_on", []),
                }
                for p in pairs
            ],
        }
    )


class TableMatchingAgentService:
    # ─────────────────────────────────────────────────────────
    # Phase 1 — propose pairs, persist as DRAFT
    # ─────────────────────────────────────────────────────────
    def propose_pairs(
        self,
        tenant_id: str,
        project_id: str,
        source_system_id: str,
        target_system_id: str,
        name: Optional[str] = None,
        version_tag: str = "1.0.0",
        ontology_version_id: Optional[str] = None,
        custom_instructions: Optional[str] = None,
        model_name: str = DEFAULT_TABLE_MATCHING_MODEL,
        api_keys: Optional[List[str]] = None,
        use_ai: bool = True,
        min_confidence: float = 0.5,
    ) -> Dict[str, Any]:
        source_sys = store.get_system(tenant_id, source_system_id)
        target_sys = store.get_system(tenant_id, target_system_id)
        if not source_sys or not target_sys:
            raise ValueError(
                f"Invalid system IDs: source={source_system_id}, "
                f"target={target_system_id}"
            )

        source_tables = self._load_tables_for_system(
            tenant_id, source_system_id
        )
        target_tables = self._load_tables_for_system(
            tenant_id, target_system_id
        )

        if not source_tables or not target_tables:
            raise ValueError(
                "Source or target system has no registered datasets. "
                "Register tables via /systems/{id}/tables before "
                "proposing pairs."
            )

        tms_id = f"tms-v{uuid.uuid4().hex[:6]}"
        resolved_name = (name or "").strip() or (
            f"{source_sys.name} → {target_sys.name}"
        )

        initial: TableMatchingState = {
            "tenant_id": tenant_id,
            "project_id": project_id,
            "table_mapping_set_id": tms_id,
            "version_tag": version_tag,
            "source_system_id": source_system_id,
            "source_system_name": source_sys.name,
            "source_system_kind": (
                source_sys.kind.value
                if hasattr(source_sys.kind, "value")
                else str(source_sys.kind)
            ),
            "target_system_id": target_system_id,
            "target_system_name": target_sys.name,
            "target_system_kind": (
                target_sys.kind.value
                if hasattr(target_sys.kind, "value")
                else str(target_sys.kind)
            ),
            "source_tables": source_tables,
            "target_tables": target_tables,
            "ontology_version_id": ontology_version_id,
            "retrieved_rules": [],
            "model_name": model_name,
            "api_keys": api_keys,
            "use_ai": use_ai,
            "min_confidence": min_confidence,
            "pairs": [],
            "user_decisions": None,
            "review_status": "INITIALIZED",
            "reviewed_by": None,
            "review_comments": None,
            "persisted_to_db": False,
            "error": None,
            "stage": "init",
            "started_at": time.time(),
            "finished_at": None,
        }

        logger.info(
            f"[TableMatchingAgent] Proposing '{resolved_name}' v{version_tag} "
            f"({len(source_tables)} src × {len(target_tables)} tgt, "
            f"use_ai={use_ai})"
        )

        result = table_matching_graph.invoke(initial)

        if result.get("error"):
            logger.warning(
                f"[TableMatchingAgent] Errored at '{result.get('stage')}': "
                f"{result['error']}"
            )

        pairs = _dedupe_pairs(result.get("pairs", []))
        content_hash = _hash_pairs(
            project_id,
            source_system_id,
            target_system_id,
            ontology_version_id,
            version_tag,
            pairs,
        )

        self._persist_set(
            tenant_id=tenant_id,
            tms_id=tms_id,
            project_id=project_id,
            name=resolved_name,
            source_system_id=source_system_id,
            target_system_id=target_system_id,
            ontology_version_id=ontology_version_id,
            version_tag=version_tag,
            pairs=pairs,
            content_hash=content_hash,
        )

        return {
            "table_mapping_set_id": tms_id,
            "project_id": project_id,
            "name": resolved_name,
            "version_tag": version_tag,
            "review_status": "DRAFT",
            "stage": result.get("stage"),
            "pairs": pairs,
            "source_tables_count": len(source_tables),
            "target_tables_count": len(target_tables),
            "error": result.get("error"),
        }

    # ─────────────────────────────────────────────────────────
    # Phase 2 — direct save (no review gate)
    # ─────────────────────────────────────────────────────────
    def save_pairs(
        self,
        tenant_id: str,
        project_id: str,
        table_mapping_set_id: str,
        pairs: List[Dict[str, Any]],
        name: Optional[str] = None,
        version_tag: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Overwrite the pair list of an existing set. Rejects
        duplicates, recomputes content_hash, persists.
        """
        existing = store.get_table_mapping_set(
            tenant_id, table_mapping_set_id
        )
        if not existing:
            raise ValueError(
                f"Table mapping set {table_mapping_set_id} not found."
            )

        # Detect duplicates BEFORE dedupe so we can reject with 400.
        seen = set()
        dups: List[str] = []
        for p in pairs:
            key = (p.get("source_table"), p.get("target_table"))
            if key in seen:
                dups.append(f"{key[0]} → {key[1]}")
            seen.add(key)

        if dups:
            raise ValueError(
                "Duplicate pairs detected: " + "; ".join(dups[:5])
                + ("…" if len(dups) > 5 else "")
            )

        resolved_name = (
            (name or "").strip() or existing.name or "Untitled Pair Set"
        )
        resolved_version = (
            (version_tag or "").strip() or existing.version_tag or "1.0.0"
        )

        content_hash = _hash_pairs(
            project_id,
            existing.source_system_id,
            existing.target_system_id,
            existing.ontology_version_id,
            resolved_version,
            pairs,
        )

        # Overwrite the set in place.
        try:
            from app.models.canonical import (
                ArtifactStatus,
                TableMappingSetVersion,
            )

            updated = TableMappingSetVersion(
                table_mapping_set_id=table_mapping_set_id,
                project_id=project_id,
                name=resolved_name,
                source_system_id=existing.source_system_id,
                target_system_id=existing.target_system_id,
                ontology_version_id=existing.ontology_version_id,
                version_tag=resolved_version,
                status=ArtifactStatus.DRAFT,
                content_hash=content_hash,
                pairs=pairs,
                reviewed_by=None,
                review_comments=None,
                created_at=existing.created_at,
            )
            store.save_table_mapping_set(tenant_id, updated)
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"[TableMatchingAgent] save_pairs persistence failed: {e}"
            )
            raise

        logger.info(
            f"[TableMatchingAgent] Saved {len(pairs)} pair(s) to "
            f"'{resolved_name}' v{resolved_version} ({table_mapping_set_id})."
        )

        return {
            "table_mapping_set_id": table_mapping_set_id,
            "project_id": project_id,
            "name": resolved_name,
            "version_tag": resolved_version,
            "status": "DRAFT",
            "content_hash": content_hash,
            "pair_count": len(pairs),
            "pairs": pairs,
        }

    # ─────────────────────────────────────────────────────────
    # Legacy — kept for compatibility, not used by UI
    # ─────────────────────────────────────────────────────────
    def submit_review(
        self,
        tenant_id: str,
        project_id: str,
        table_mapping_set_id: str,
        decisions: List[Dict[str, Any]],
        actor: str,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Legacy approve/reject/edit endpoint. UI does not call this."""
        existing = store.get_table_mapping_set(
            tenant_id, table_mapping_set_id
        )
        if not existing:
            raise ValueError(
                f"Table mapping set {table_mapping_set_id} not found."
            )

        pairs = [dict(p) for p in existing.pairs]

        parsed_decisions: List[Dict[str, Any]] = []
        for raw in decisions:
            try:
                dec = HumanTableDecision.model_validate(raw)
                parsed_decisions.append(
                    dec.model_dump(exclude_none=True)
                )
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"[TableMatchingAgent] Skipping invalid decision: {e}"
                )

        state: TableMatchingState = {
            "tenant_id": tenant_id,
            "project_id": project_id,
            "table_mapping_set_id": table_mapping_set_id,
            "version_tag": existing.version_tag,
            "source_system_id": existing.source_system_id,
            "target_system_id": existing.target_system_id,
            "ontology_version_id": existing.ontology_version_id,
            "pairs": pairs,
            "user_decisions": parsed_decisions,
            "review_status": "APPROVED",
            "reviewed_by": actor,
            "review_comments": comments,
            "persisted_to_db": False,
            "error": None,
            "stage": "human_review_gate",
            "started_at": time.time(),
            "finished_at": None,
            "model_name": DEFAULT_TABLE_MATCHING_MODEL,
            "use_ai": False,
            "min_confidence": 0.5,
            "retrieved_rules": [],
            "source_tables": [],
            "target_tables": [],
            "source_system_name": "",
            "source_system_kind": "",
            "target_system_name": "",
            "target_system_kind": "",
        }

        state = node_human_review_gate(state)
        state = node_finalize_pairs(state)

        return {
            "table_mapping_set_id": table_mapping_set_id,
            "project_id": project_id,
            "review_status": state.get("review_status"),
            "content_hash": state.get("content_hash"),
            "status": "APPROVED",
            "final_pairs_count": len(state.get("pairs", [])),
            "pairs": state.get("pairs", []),
        }

    # ─────────────────────────────────────────────────────────
    # Internals
    # ─────────────────────────────────────────────────────────
    def _load_tables_for_system(
        self, tenant_id: str, system_id: str
    ) -> List[Dict[str, Any]]:
        datasets = store.list_datasets(tenant_id, system_id=system_id)
        tables: List[Dict[str, Any]] = []
        for ds in datasets or []:
            columns = [
                {
                    "name": f.name,
                    "datatype": f.datatype,
                    "is_pk": bool(getattr(f, "is_primary_key", False)),
                    "nullable": bool(getattr(f, "nullable", True)),
                }
                for f in (ds.fields or [])
            ]
            fks: List[Dict[str, Any]] = []
            for f in ds.fields or []:
                target = getattr(f, "foreign_key_target", None)
                if target and "." in target:
                    ref_table, ref_col = target.split(".", 1)
                    fks.append(
                        {
                            "column": f.name,
                            "references_table": ref_table,
                            "references_column": ref_col,
                        }
                    )
            tables.append(
                {
                    "name": ds.physical_name,
                    "columns": columns,
                    "fks": fks,
                }
            )
        return tables

    def _persist_set(
        self,
        tenant_id: str,
        tms_id: str,
        project_id: str,
        name: str,
        source_system_id: str,
        target_system_id: str,
        ontology_version_id: Optional[str],
        version_tag: str,
        pairs: List[Dict[str, Any]],
        content_hash: str,
    ) -> None:
        try:
            from app.models.canonical import (
                ArtifactStatus,
                TableMappingSetVersion,
            )

            tms = TableMappingSetVersion(
                table_mapping_set_id=tms_id,
                project_id=project_id,
                name=name,
                source_system_id=source_system_id,
                target_system_id=target_system_id,
                ontology_version_id=ontology_version_id,
                version_tag=version_tag,
                status=ArtifactStatus.DRAFT,
                content_hash=content_hash,
                pairs=pairs,
            )
            store.save_table_mapping_set(tenant_id, tms)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[TableMatchingAgent] _persist_set failed: {e}"
            )


table_matching_agent_service = TableMatchingAgentService()