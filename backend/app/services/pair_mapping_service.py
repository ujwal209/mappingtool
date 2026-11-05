"""
Pair Mapping Service — one file, all logic.

Responsibilities:
  • create_draft_from_table_set  — expand a table-mapping set into PairBlocks
  • run_ai_on_pair               — LLM on ONE pair (or deterministic fallback)
  • run_ai_on_all_pairs          — sequential loop over run_ai_on_pair
  • apply_review_to_pair         — reviewer edits on ONE pair
  • finalize_set                 — lock hash, mark APPROVED
  • get/list/delete              — CRUD

No LangGraph. Just direct LLM calls via groq_manager + with_structured_output.
"""

import time
import uuid
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.groq_manager import groq_manager
from app.core.logging import get_logger
from app.core.security import compute_sha256
from app.db.mongo import mongo_manager
from app.db.store import store
from app.models.pair_mapping import (
    ColumnCandidate,
    ColumnRule,
    ColumnStatus,
    LLMColumnDecision,
    LLMSchemaMappingResponse,
    PairBlock,
    PairMappingSet,
    PairStatus,
    SetStatus,
)

logger = get_logger("pair_mapping_service")

COLLECTION = "pair_mapping_sets"
DEFAULT_MODEL = "openai/gpt-oss-120b"
MIN_FUZZY_MATCH = 65.0


# ============================================================
# Module-level helpers
# ============================================================
def _pair_id(src: str, tgt: str) -> str:
    return f"{src}__{tgt}"


def _ds_columns(ds) -> List[Dict[str, Any]]:
    if not ds:
        return []
    return [
        {
            "name": f.name,
            "datatype": f.datatype or "string",
            "nullable": f.nullable if f.nullable is not None else True,
        }
        for f in (ds.fields or [])
    ]


def _hash_set(pms: PairMappingSet) -> str:
    return compute_sha256({
        "project_id": pms.project_id,
        "table_mapping_set_id": pms.table_mapping_set_id,
        "version_tag": pms.version_tag,
        "pairs": [
            {
                "pair_id": b.pair_id,
                "source_table": b.source_table,
                "target_table": b.target_table,
                "columns": [
                    {
                        "target_column": c.target_column,
                        "matched_source_column": c.matched_source_column,
                        "confidence_score": c.confidence_score,
                        "transformation_rule": c.transformation_rule,
                        "default_value": c.default_value,
                    }
                    for c in b.columns
                ],
            }
            for b in pms.pairs
        ],
    })


def _deterministic_rules(
    source_cols: List[Dict[str, Any]],
    target_cols: List[Dict[str, Any]],
) -> List[ColumnRule]:
    """Fuzzy/exact fallback matcher — used when use_ai=False or the LLM fails."""
    from rapidfuzz import fuzz

    out: List[ColumnRule] = []
    for tc in target_cols:
        t_name = tc["name"]
        best_src = None
        best_score = 0.0
        candidates: List[ColumnCandidate] = []

        for sc in source_cols:
            s_name = sc["name"]
            exact = (
                100.0
                if s_name.lower().replace("_", "") == t_name.lower().replace("_", "")
                else 0.0
            )
            ratio = fuzz.ratio(s_name.lower(), t_name.lower())
            score = max(exact, ratio)
            candidates.append(ColumnCandidate(
                source_column=s_name,
                score=round(score / 100.0, 3),
                confidence_pct=round(score, 1),
            ))
            if score > best_score:
                best_score = score
                best_src = s_name

        candidates.sort(key=lambda c: c.score, reverse=True)
        matched = best_score >= MIN_FUZZY_MATCH and best_src is not None

        out.append(ColumnRule(
            target_column=t_name,
            target_datatype=tc.get("datatype", "string"),
            target_nullable=tc.get("nullable", True),
            matched_source_column=best_src if matched else None,
            source_datatype=next(
                (c["datatype"] for c in source_cols if c["name"] == best_src),
                None,
            ) if matched else None,
            confidence_score=round(best_score / 100.0, 3) if matched else 0.0,
            status=ColumnStatus.MATCHED if matched else ColumnStatus.UNMATCHED,
            is_auto_mapped=matched,
            transformation_rule="direct_cast" if matched else None,
            default_value="",
            rationale=(
                f"Deterministic similarity ({best_score:.0f}%)"
                if matched
                else "No reliable source column candidate."
            ),
            candidates=candidates[:5],
        ))
    return out


def _llm_rules(
    response: LLMSchemaMappingResponse,
    source_cols: List[Dict[str, Any]],
    target_cols: List[Dict[str, Any]],
) -> List[ColumnRule]:
    """Convert LLM response → ColumnRule list with anti-hallucination guard."""
    source_names = {c["name"] for c in source_cols}
    target_names = {c["name"] for c in target_cols}
    decisions = {
        d.target_column: d for d in response.mappings
        if d.target_column in target_names
    }

    out: List[ColumnRule] = []
    for tc in target_cols:
        t_name = tc["name"]
        d = decisions.get(t_name)

        sc = d.matched_source_column if d else None
        if sc and sc not in source_names:
            sc = None

        src_dt = next(
            (c["datatype"] for c in source_cols if c["name"] == sc),
            None,
        )
        conf = 0.0
        if d and sc:
            try:
                conf = max(0.0, min(1.0, float(d.confidence_score)))
            except (TypeError, ValueError):
                conf = 0.0

        out.append(ColumnRule(
            target_column=t_name,
            target_datatype=tc.get("datatype", "string"),
            target_nullable=tc.get("nullable", True),
            matched_source_column=sc,
            source_datatype=src_dt,
            confidence_score=round(conf, 3),
            status=ColumnStatus.MATCHED if sc else ColumnStatus.UNMATCHED,
            is_auto_mapped=bool(sc),
            transformation_rule=d.transformation_rule if d and sc else None,
            default_value=(d.default_value if d else None) or None,
            rationale=(d.rationale if d else "Unassigned target column"),
            candidates=[
                ColumnCandidate(
                    source_column=c["name"],
                    score=1.0 if c["name"] == sc else 0.0,
                    confidence_pct=100.0 if c["name"] == sc else 0.0,
                )
                for c in source_cols[:5]
            ],
        ))
    return out


def _build_prompt(
    source_cols: List[Dict[str, Any]],
    target_cols: List[Dict[str, Any]],
    rag_context: str = "",
    custom_instructions: str = "",
) -> tuple[str, str]:
    """Return (system_prompt, user_prompt)."""
    import json

    system = (
        "You are an expert Data Architecture and Schema Alignment Agent. "
        "Propose schema-level column mappings from Source to Target. "
        "DO NOT invent source columns. Pick exclusively from available "
        "source column names, or declare null. Return strictly valid JSON."
    )

    source_block = json.dumps(
        [{"name": c["name"], "datatype": c.get("datatype")} for c in source_cols],
        indent=2,
    )
    target_block = json.dumps(
        [
            {
                "name": c["name"],
                "datatype": c.get("datatype"),
                "nullable": c.get("nullable", True),
            }
            for c in target_cols
        ],
        indent=2,
    )

    user = f"""
SOURCE COLUMNS:
{source_block}

TARGET COLUMNS:
{target_block}

BUSINESS RULES & RAG CONTEXT:
{rag_context or "None provided."}

CUSTOM INSTRUCTIONS:
{custom_instructions or "Map columns by business identity and type fit."}

Return a JSON object with a "mappings" array:
{{
  "mappings": [
    {{
      "target_column": "string",
      "matched_source_column": "string or null",
      "confidence_score": 0.0,
      "transformation_rule": "direct_cast",
      "default_value": null,
      "rationale": "short explanation"
    }}
  ],
  "overall_confidence": 0.0,
  "reasoning_summary": "one sentence"
}}
"""
    return system, user


def _call_llm(
    source_cols: List[Dict[str, Any]],
    target_cols: List[Dict[str, Any]],
    rag_context: str,
    custom_instructions: str,
    api_keys: Optional[List[str]],
    model_name: str,
) -> Optional[LLMSchemaMappingResponse]:
    """Call Groq via LangChain structured output with round-robin failover."""
    system, user = _build_prompt(
        source_cols, target_cols, rag_context, custom_instructions
    )
    messages = [SystemMessage(content=system), HumanMessage(content=user)]
    attempts = max(groq_manager.get_keys_count(), 3)
    last_err: Optional[Exception] = None

    for attempt in range(attempts):
        used_key: Optional[str] = None
        try:
            chat, used_key = groq_manager.get_chat_model(
                model_name=DEFAULT_MODEL,
                temperature=0.0,
                provided_keys=api_keys,
            )
            structured = chat.with_structured_output(LLMSchemaMappingResponse)
            result = structured.invoke(messages)
            if isinstance(result, LLMSchemaMappingResponse):
                groq_manager.record_success(used_key)
                return result
            validated = LLMSchemaMappingResponse.model_validate(result)
            groq_manager.record_success(used_key)
            return validated
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning(
                f"[PairMappingLLM] attempt {attempt + 1}/{attempts}: {exc}"
            )
            if used_key:
                groq_manager.record_failure(used_key, str(exc))

    logger.error(f"[PairMappingLLM] all attempts failed: {last_err}")
    return None


# ============================================================
# Service
# ============================================================
class PairMappingService:
    # ─────────────────────────────────────────────────────────
    # PHASE 0 — create draft from a table-mapping set
    # ─────────────────────────────────────────────────────────
    def create_draft_from_table_set(
        self,
        tenant_id: str,
        project_id: str,
        table_mapping_set_id: str,
        ontology_version_id: Optional[str] = None,
        name: Optional[str] = None,
        version_tag: str = "1.0.0",
    ) -> PairMappingSet:
        tms = store.get_table_mapping_set(tenant_id, table_mapping_set_id)
        if not tms:
            raise ValueError(f"Table mapping set {table_mapping_set_id} not found")

        raw_pairs = tms.pairs or []
        if not raw_pairs:
            raise ValueError("Table mapping set has no pairs")

        src_map = {
            d.physical_name: d
            for d in store.list_datasets(tenant_id, system_id=tms.source_system_id)
        }
        tgt_map = {
            d.physical_name: d
            for d in store.list_datasets(tenant_id, system_id=tms.target_system_id)
        }

        blocks: List[PairBlock] = []
        for p in raw_pairs:
            src_table = p.get("source_table") or ""
            tgt_table = p.get("target_table") or ""
            src_ds = src_map.get(src_table)
            tgt_ds = tgt_map.get(tgt_table)
            if not src_ds or not tgt_ds:
                logger.warning(
                    f"[PairMapping] Skipping {src_table} → {tgt_table}: "
                    f"dataset missing"
                )
                continue

            # Seed from table-matching's matched_columns if present
            src_dt_by_name = {c["name"]: c["datatype"] for c in _ds_columns(src_ds)}
            seeded: Dict[str, Dict[str, Any]] = {
                mc.get("target_col"): mc
                for mc in (p.get("matched_columns") or [])
                if mc.get("target_col")
            }

            columns: List[ColumnRule] = []
            for tf in (tgt_ds.fields or []):
                seed = seeded.get(tf.name)
                if seed:
                    columns.append(ColumnRule(
                        target_column=tf.name,
                        target_datatype=tf.datatype or "string",
                        target_nullable=tf.nullable if tf.nullable is not None else True,
                        matched_source_column=seed.get("source_col"),
                        source_datatype=src_dt_by_name.get(seed.get("source_col") or ""),
                        confidence_score=float(p.get("confidence_score", 0.0)),
                        status=ColumnStatus.MATCHED,
                        is_auto_mapped=True,
                        transformation_rule="direct_cast",
                        default_value="",
                        rationale=f"From table-matching: {seed.get('concept', '')}",
                    ))
                else:
                    columns.append(ColumnRule(
                        target_column=tf.name,
                        target_datatype=tf.datatype or "string",
                        target_nullable=tf.nullable if tf.nullable is not None else True,
                        status=ColumnStatus.UNMATCHED,
                        rationale="Awaiting AI analysis or manual mapping.",
                    ))

            blocks.append(PairBlock(
                pair_id=_pair_id(src_table, tgt_table),
                source_table=src_table,
                target_table=tgt_table,
                source_dataset_id=src_ds.dataset_id,
                target_dataset_id=tgt_ds.dataset_id,
                confidence_score=float(p.get("confidence_score", 0.0)),
                match_status=PairStatus.PENDING,
                requires_masking=bool(p.get("requires_masking", False)),
                rationale=p.get("rationale", "") or "",
                depends_on=p.get("depends_on", []) or [],
                columns=columns,
            ))

        pms = PairMappingSet(
            set_id=f"pms-{uuid.uuid4().hex[:6]}",
            project_id=project_id,
            tenant_id=tenant_id,
            table_mapping_set_id=table_mapping_set_id,
            ontology_version_id=ontology_version_id,
            source_system_id=tms.source_system_id,
            target_system_id=tms.target_system_id,
            name=name or getattr(tms, "name", None),
            version_tag=version_tag,
            status=SetStatus.DRAFT,
            pairs=blocks,
        )
        self._save(tenant_id, pms)
        logger.info(
            f"[PairMapping] Created {pms.set_id} ({len(blocks)} pair(s), "
            f"TMS {table_mapping_set_id})"
        )
        return pms

    # ─────────────────────────────────────────────────────────
    # PHASE 1 — AI on ONE pair
    # ─────────────────────────────────────────────────────────
    def run_ai_on_pair(
        self,
        tenant_id: str,
        set_id: str,
        pair_id: str,
        use_ai: bool = True,
        model_name: str = DEFAULT_MODEL,
        api_keys: Optional[List[str]] = None,
        ontology_version_id: Optional[str] = None,
        custom_instructions: Optional[str] = None,
    ) -> PairMappingSet:
        pms = self.get_set(tenant_id, set_id)
        if not pms:
            raise ValueError(f"Pair mapping set {set_id} not found")
        if pms.status == SetStatus.APPROVED:
            raise ValueError("Cannot run AI on an APPROVED set")

        block = next((b for b in pms.pairs if b.pair_id == pair_id), None)
        if not block:
            raise ValueError(f"Pair {pair_id} not found")

        src_ds = store.get_dataset(tenant_id, block.source_dataset_id)
        tgt_ds = store.get_dataset(tenant_id, block.target_dataset_id)
        if not src_ds or not tgt_ds:
            raise ValueError("Source or target dataset missing for this pair")

        source_cols = _ds_columns(src_ds)
        target_cols = _ds_columns(tgt_ds)
        if not target_cols:
            raise ValueError("Target dataset has no columns")

        # RAG grounding (optional)
        rag_context = ""
        ont_id = ontology_version_id or pms.ontology_version_id
        if ont_id:
            try:
                from app.services.ontology_rag_service import ontology_rag_service
                query = (
                    "Column mapping rules for fields: "
                    + ", ".join(c["name"] for c in target_cols[:15])
                )
                res = ontology_rag_service.query_ontology_rag(
                    tenant_id=tenant_id,
                    ontology_version_id=ont_id,
                    query=query,
                    top_k=5,
                    synthesize_with_llm=False,
                )
                rag_context = "\n".join(
                    c.get("chunk", {}).get("content", "")
                    for c in res.retrieved_chunks
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"[PairMapping/RAG] skipped: {exc}")

        # LLM path or deterministic fallback
        rules: Optional[List[ColumnRule]] = None
        if use_ai:
            response = _call_llm(
                source_cols=source_cols,
                target_cols=target_cols,
                rag_context=rag_context,
                custom_instructions=custom_instructions or "",
                api_keys=api_keys,
                model_name=model_name,
            )
            if response and response.mappings:
                rules = _llm_rules(response, source_cols, target_cols)

        if rules is None:
            logger.info(
                f"[PairMapping] Pair {pair_id}: using deterministic fallback"
            )
            rules = _deterministic_rules(source_cols, target_cols)

        block.columns = rules
        block.match_status = PairStatus.AI_RUN
        pms.updated_at = time.time()
        self._save(tenant_id, pms)

        matched = sum(1 for c in rules if c.matched_source_column)
        logger.info(
            f"[PairMapping] AI on {pair_id}: {matched}/{len(rules)} matched"
        )
        return pms

    # ─────────────────────────────────────────────────────────
    # PHASE 1b — AI on every pair
    # ─────────────────────────────────────────────────────────
    def run_ai_on_all_pairs(
        self,
        tenant_id: str,
        set_id: str,
        use_ai: bool = True,
        model_name: str = DEFAULT_MODEL,
        api_keys: Optional[List[str]] = None,
        ontology_version_id: Optional[str] = None,
    ) -> PairMappingSet:
        pms = self.get_set(tenant_id, set_id)
        if not pms:
            raise ValueError(f"Pair mapping set {set_id} not found")
        if pms.status == SetStatus.APPROVED:
            raise ValueError("Cannot run AI on an APPROVED set")

        # Snapshot pair ids so we don't iterate over stale state
        pair_ids = [b.pair_id for b in pms.pairs]
        for pid in pair_ids:
            try:
                self.run_ai_on_pair(
                    tenant_id=tenant_id,
                    set_id=set_id,
                    pair_id=pid,
                    use_ai=use_ai,
                    model_name=model_name,
                    api_keys=api_keys,
                    ontology_version_id=ontology_version_id,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"[PairMapping] Pair {pid} failed: {exc}")

        return self.get_set(tenant_id, set_id) or pms

    # ─────────────────────────────────────────────────────────
    # PHASE 2 — reviewer edits on ONE pair
    # ─────────────────────────────────────────────────────────
    def apply_review_to_pair(
        self,
        tenant_id: str,
        set_id: str,
        pair_id: str,
        adjustments: List[Dict[str, Any]],
        actor: str,
        comments: Optional[str] = None,
    ) -> PairMappingSet:
        pms = self.get_set(tenant_id, set_id)
        if not pms:
            raise ValueError(f"Pair mapping set {set_id} not found")
        if pms.status == SetStatus.APPROVED:
            raise ValueError("Cannot edit an APPROVED set")

        block = next((b for b in pms.pairs if b.pair_id == pair_id), None)
        if not block:
            raise ValueError(f"Pair {pair_id} not found")

        by_target = {c.target_column: c for c in block.columns}
        for adj in adjustments:
            col = by_target.get(adj.get("target_column"))
            if not col:
                continue
            if "matched_source_column" in adj:
                src = adj["matched_source_column"]
                col.matched_source_column = src
                col.status = (
                    ColumnStatus.MANUAL_OVERRIDE if src else ColumnStatus.UNMATCHED
                )
                col.is_auto_mapped = False
            if "transformation_rule" in adj:
                col.transformation_rule = adj["transformation_rule"]
            if "default_value" in adj:
                col.default_value = adj["default_value"]
            if "confidence_score" in adj:
                try:
                    col.confidence_score = float(adj["confidence_score"])
                except (TypeError, ValueError):
                    pass
            if adj.get("rationale"):
                col.rationale = adj["rationale"]

        block.match_status = PairStatus.REVIEWED
        pms.updated_at = time.time()
        self._save(tenant_id, pms)

        logger.info(
            f"[PairMapping] Reviewed {pair_id} by {actor} "
            f"({len(adjustments)} adjustment(s))"
        )
        return pms

    # ─────────────────────────────────────────────────────────
    # PHASE 3 — finalize the whole set
    # ─────────────────────────────────────────────────────────
    def finalize_set(
        self,
        tenant_id: str,
        set_id: str,
        actor: str,
        comments: Optional[str] = None,
    ) -> PairMappingSet:
        pms = self.get_set(tenant_id, set_id)
        if not pms:
            raise ValueError(f"Pair mapping set {set_id} not found")
        if not pms.pairs:
            raise ValueError("Cannot finalize an empty set")

        pms.status = SetStatus.APPROVED
        for b in pms.pairs:
            b.match_status = PairStatus.APPROVED
        pms.content_hash = _hash_set(pms)
        pms.updated_at = time.time()
        self._save(tenant_id, pms)

        logger.info(
            f"[PairMapping] Finalized {set_id} by {actor} "
            f"(hash={pms.content_hash[:10]}…)"
        )
        return pms

    # ─────────────────────────────────────────────────────────
    # CRUD
    # ─────────────────────────────────────────────────────────
    def get_set(
        self, tenant_id: str, set_id: str
    ) -> Optional[PairMappingSet]:
        doc = mongo_manager.find_one(
            COLLECTION, {"tenant_id": tenant_id, "set_id": set_id}
        )
        if not doc:
            return None
        doc.pop("_id", None)
        try:
            return PairMappingSet(**doc)
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"[PairMapping] parse failed for {set_id}: {exc}")
            return None

    def list_sets(
        self,
        tenant_id: str,
        project_id: Optional[str] = None,
        table_mapping_set_id: Optional[str] = None,
    ) -> List[PairMappingSet]:
        q: Dict[str, Any] = {"tenant_id": tenant_id}
        if project_id:
            q["project_id"] = project_id
        if table_mapping_set_id:
            q["table_mapping_set_id"] = table_mapping_set_id
        docs = mongo_manager.find_many(COLLECTION, q)
        out: List[PairMappingSet] = []
        for d in docs:
            d.pop("_id", None)
            try:
                out.append(PairMappingSet(**d))
            except Exception:
                pass
        out.sort(key=lambda s: s.created_at, reverse=True)
        return out

    def delete_set(self, tenant_id: str, set_id: str) -> bool:
        existing = self.get_set(tenant_id, set_id)
        if not existing:
            return False
        mongo_manager.delete_one(
            COLLECTION, {"tenant_id": tenant_id, "set_id": set_id}
        )
        return True

    # ─────────────────────────────────────────────────────────
    # Persistence
    # ─────────────────────────────────────────────────────────
    def _save(self, tenant_id: str, pms: PairMappingSet) -> PairMappingSet:
        mongo_manager.upsert_document(
            COLLECTION,
            {"tenant_id": tenant_id, "set_id": pms.set_id},
            {"tenant_id": tenant_id, **pms.model_dump(mode="json")},
        )
        return pms

    def save_set_metadata(
    self,
    tenant_id: str,
    set_id: str,
    name: Optional[str] = None,
    version_tag: Optional[str] = None,
    pair_metadata: Optional[List[Dict[str, Any]]] = None,
) -> PairMappingSet:
        pms = self.get_set(tenant_id, set_id)
        if not pms:
            raise ValueError(f"Pair mapping set {set_id} not found")
        if pms.status == SetStatus.APPROVED:
            raise ValueError(
                "Approved sets are immutable. Create a new draft from the parent table-mapping set."
            )

        if name is not None:
            pms.name = name.strip() or pms.name
        if version_tag is not None:
            pms.version_tag = version_tag.strip() or pms.version_tag

        if pair_metadata:
            by_id = {p.pair_id: p for p in pms.pairs}
            for meta in pair_metadata:
                pair = by_id.get(meta.get("pair_id"))
                if not pair:
                    continue
                if "rationale" in meta:
                    pair.rationale = meta["rationale"] or ""
                if "requires_masking" in meta:
                    pair.requires_masking = bool(meta["requires_masking"])

        pms.updated_at = time.time()
        self._save(tenant_id, pms)
        return pms

# Singleton
pair_mapping_service = PairMappingService()