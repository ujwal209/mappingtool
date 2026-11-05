"""
Public facade of the Ontology Agent.

Changes vs. previous version:
  - `run_agent` now returns an explicit `status="ERROR"` when the
    operation-planning stage failed (rather than pretending SUCCESS
    with zero entities). This makes broken runs visible to the caller.
"""

from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.logging import logger
from app.db.store import store
from app.models.canonical import OntologyEntity, OntologyRelationship
from app.services.ontology_agent.graph import ontology_graph
from app.services.ontology_agent.llm import build_llm
from app.services.ontology_agent.state import AgentState
from app.services.ontology_service import ontology_service


SUMMARY_SYSTEM = """You are an Enterprise Information Architect.

Produce a dense architectural summary of the ontology-design conversation,
organized under these headings:

### Architectural Scope & Requirements
### Agreed Entities & Attributes
### Ontological Relationships
### Open Items & Next Steps
"""


def _persist_plan(
    tenant_id: str,
    project_id: str,
    entities: List[OntologyEntity],
    relationships: List[OntologyRelationship],
    name: str,
    description: str,
    domain: str,
    target_ontology_id: Optional[str],
) -> dict:
    """
    Persist entities then relationships, remapping IDs by entity name.
    Guarantees relationships land on real persisted entity IDs.
    """
    if target_ontology_id:
        existing = ontology_service.update_ontology(
            tenant_id=tenant_id,
            ontology_version_id=target_ontology_id,
            name=name,
            description=description,
            domain=domain,
        )
        name_to_existing = {e.name.lower(): e for e in existing.entities}
        plan_name_to_real_id: Dict[str, str] = {}

        for ent in entities:
            match = name_to_existing.get(ent.name.lower())
            if match:
                try:
                    ontology_service.update_entity(
                        tenant_id=tenant_id,
                        ontology_version_id=target_ontology_id,
                        entity_id=match.entity_id,
                        attributes=ent.attributes,
                        description=ent.description,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(f"update_entity failed for {ent.name}: {exc}")
                plan_name_to_real_id[ent.name] = match.entity_id
            else:
                try:
                    created = ontology_service.add_entity(
                        tenant_id=tenant_id,
                        ontology_version_id=target_ontology_id,
                        name=ent.name,
                        label=ent.label,
                        description=ent.description,
                        category=ent.category,
                        attributes=ent.attributes,
                    )
                    plan_name_to_real_id[ent.name] = created.entity_id
                except Exception as exc:  # noqa: BLE001
                    logger.error(f"add_entity failed for {ent.name}: {exc}")

        for rel in relationships:
            src_id = plan_name_to_real_id.get(rel.source_entity_name)
            tgt_id = plan_name_to_real_id.get(rel.target_entity_name)
            if not src_id or not tgt_id:
                logger.warning(
                    f"Skipping relationship '{rel.name}': cannot resolve "
                    f"{rel.source_entity_name} -> {rel.target_entity_name}"
                )
                continue
            try:
                ontology_service.add_relationship(
                    tenant_id=tenant_id,
                    ontology_version_id=target_ontology_id,
                    name=rel.name,
                    source_entity_id=src_id,
                    target_entity_id=tgt_id,
                    relation_type=rel.relation_type,
                    cardinality=rel.cardinality,
                    label=rel.label,
                    description=rel.description,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"add_relationship failed for '{rel.name}': {exc}")

        compiled = store.get_ontology(tenant_id, target_ontology_id)
        return compiled.model_dump() if compiled else existing.model_dump()

    # Fresh path
    container = ontology_service.create_version(
        tenant_id=tenant_id,
        project_id=project_id,
        name=name,
        description=description,
        domain=domain,
        version_tag="1.0.0",
        entities=[],
        relationships=[],
    )
    new_id = container.ontology_version_id
    plan_name_to_real_id: Dict[str, str] = {}

    for ent in entities:
        try:
            created = ontology_service.add_entity(
                tenant_id=tenant_id,
                ontology_version_id=new_id,
                name=ent.name,
                label=ent.label,
                description=ent.description,
                category=ent.category,
                attributes=ent.attributes,
            )
            plan_name_to_real_id[ent.name] = created.entity_id
        except Exception as exc:  # noqa: BLE001
            logger.error(f"add_entity failed for {ent.name}: {exc}")

    for rel in relationships:
        src_id = plan_name_to_real_id.get(rel.source_entity_name)
        tgt_id = plan_name_to_real_id.get(rel.target_entity_name)
        if not src_id or not tgt_id:
            logger.warning(
                f"Skipping relationship '{rel.name}': cannot resolve "
                f"{rel.source_entity_name} -> {rel.target_entity_name}"
            )
            continue
        try:
            ontology_service.add_relationship(
                tenant_id=tenant_id,
                ontology_version_id=new_id,
                name=rel.name,
                source_entity_id=src_id,
                target_entity_id=tgt_id,
                relation_type=rel.relation_type,
                cardinality=rel.cardinality,
                label=rel.label,
                description=rel.description,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"add_relationship failed for '{rel.name}': {exc}")

    compiled = store.get_ontology(tenant_id, new_id)
    return compiled.model_dump() if compiled else container.model_dump()


class OntologyAgentService:
    def run_agent(
        self,
        tenant_id: str,
        project_id: str,
        prompt: str,
        ontology_name: Optional[str] = None,
        domain: Optional[str] = None,
        target_ontology_id: Optional[str] = None,
        model: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        mode: str = "action",
    ) -> Dict[str, Any]:
        initial: AgentState = {
            "tenant_id": tenant_id,
            "project_id": project_id,
            "prompt": prompt,
            "mode": mode,
            "model": model,
            "chat_history": chat_history or [],
            "target_ontology_id": target_ontology_id,
            "domain": domain,
            "ontology_name": ontology_name,
            "intent": None,
            "existing_ontology_summary": None,
            "domain_analysis": None,
            "entities": [],
            "relationships": [],
            "reasoning_steps": [],
            "plan_data": None,
            "final_ontology": None,
            "response_markdown": None,
            "chat_reply": None,
        }

        result = ontology_graph.invoke(initial)
        is_plan = (mode or "action").lower() == "plan"

        if result.get("intent") == "conversational":
            return {
                "status": "SUCCESS",
                "mode": mode,
                "is_plan": False,
                "intent": "conversational",
                "plan_data": None,
                "reasoning_steps": result.get("reasoning_steps", []),
                "ontology": None,
                "domain": None,
                "entity_count": 0,
                "relationship_count": 0,
                "response_markdown": result.get("chat_reply") or "",
            }

        # Surface errors loudly
        entity_count = len(result.get("entities", []))
        relationship_count = len(result.get("relationships", []))
        ops_planned = len(result.get("operations") or [])
        target_present = bool(result.get("target_ontology_id"))
        if target_present and ops_planned == 0 and entity_count == 0:
            return {
                "status": "ERROR",
                "mode": mode,
                "is_plan": is_plan,
                "intent": result.get("intent"),
                "plan_data": None,
                "reasoning_steps": result.get("reasoning_steps", []),
                "ontology": None,
                "domain": result.get("domain"),
                "entity_count": 0,
                "relationship_count": 0,
                "response_markdown": result.get("response_markdown") or "",
                "error": "Operation planning produced zero ops and no entities. "
                         "Check LLM structured-output logs.",
            }

        return {
            "status": "PLAN_READY" if is_plan else "SUCCESS",
            "mode": mode,
            "is_plan": is_plan,
            "intent": result.get("intent"),
            "plan_data": result.get("plan_data"),
            "reasoning_steps": result.get("reasoning_steps", []),
            "ontology": result.get("final_ontology"),
            "domain": result.get("domain"),
            "entity_count": entity_count,
            "relationship_count": relationship_count,
            "response_markdown": result.get("response_markdown") or "",
        }

    def apply_plan(
        self,
        tenant_id: str,
        project_id: str,
        plan_data: Dict[str, Any],
        target_ontology_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        entities = [OntologyEntity(**e) for e in plan_data.get("entities", [])]
        relationships = [OntologyRelationship(**r) for r in plan_data.get("relationships", [])]
        name = plan_data.get("ontology_name") or "Enterprise Business Ontology"
        description = plan_data.get("description") or "Applied from approved plan."
        domain = plan_data.get("domain") or "General Enterprise"

        final_ont = _persist_plan(
            tenant_id=tenant_id,
            project_id=project_id,
            entities=entities,
            relationships=relationships,
            name=name,
            description=description,
            domain=domain,
            target_ontology_id=target_ontology_id,
        )

        return {
            "status": "SUCCESS",
            "ontology": final_ont,
            "entity_count": len(entities),
            "relationship_count": len(relationships),
            "message": f"Applied {len(entities)} entities and {len(relationships)} relationships.",
        }

    def summarize_chat(
        self,
        chat_history: List[Dict[str, str]],
        model_override: Optional[str] = None,
    ) -> str:
        if not chat_history:
            return "No previous conversation to summarize."

        transcript = "\n\n".join(
            f"**{m.get('role', 'user').capitalize()}**: {m.get('content', '').strip()}"
            for m in chat_history
            if m.get("content")
        )

        llm = build_llm(model_override, temperature=0.2)
        try:
            return llm.chat(
                [
                    SystemMessage(content=SUMMARY_SYSTEM),
                    HumanMessage(content=f"Summarize:\n\n{transcript}"),
                ]
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(f"Summarize failed: {exc}")
            return f"**Session**: {len(chat_history)} turns of ontology discussion."