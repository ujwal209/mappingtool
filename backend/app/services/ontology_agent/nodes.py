"""
LangGraph nodes for the Ontology Agent — supports CREATE, UPDATE, DELETE operations.

FIX (this revision):
  - ROUTER_SYSTEM prompt is rewritten to strongly prefer 'conversational'
    unless the user is clearly issuing a mutation command.
  - node_router falls back to 'conversational' (NOT 'schema_mutation')
    when the LLM classification fails. This means a broken router can
    NEVER silently create entities.
  - node_compile_action uses a name→real-id remap so relationships land
    with valid endpoints (this fixes the "relationships don't appear in
    the canvas" bug from earlier).
"""

import uuid
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.logging import logger
from app.db.store import store
from app.models.canonical import (
    EntityAttribute,
    OntologyEntity,
    OntologyRelationship,
)
from app.services.ontology_agent.llm import build_llm
from app.services.ontology_agent.schemas import (
    DomainAnalysis,
    EntityList,
    IntentClassification,
    OperationPlan,
    RelationshipList,
)
from app.services.ontology_agent.state import AgentState
from app.services.ontology_service import ontology_service


_JSON_TAIL = (
    "\n\nCRITICAL OUTPUT RULES:\n"
    "1. Respond ONLY with a single valid JSON object. No prose, no markdown fences.\n"
    "2. Do not truncate — finish the JSON completely.\n"
    "3. The entire response must be valid, parseable JSON."
)


def _humanize(name: str) -> str:
    if not name:
        return ""
    return " ".join("ID" if p.lower() == "id" else p.capitalize()
                    for p in name.replace("_", " ").split())


def _normalize_datatype(dt: str) -> str:
    d = (dt or "string").lower().strip()
    if d in ("datetime", "timestamptz", "timestamp"): return "timestamp"
    if d in ("int", "smallint", "serial"): return "integer"
    if d in ("bool",): return "boolean"
    if d in ("float", "double", "real", "number", "numeric"): return "decimal"
    if d in ("str", "varchar", "char", "nvarchar"): return "string"
    if d in ("jsonb", "object", "array"): return "json"
    return d if d in ("string", "uuid", "integer", "bigint", "decimal",
                       "boolean", "date", "text") else "string"


# =============================================================
# Router
# =============================================================
ROUTER_SYSTEM = """You are the routing layer of an Enterprise Ontology Copilot.

Your ONLY job: decide whether the user wants the Copilot to CHANGE the
ontology, or just ANSWER a question about it. Do NOT do anything else.

════════════════════════════════════════════════════════════════════
INTENT: "schema_mutation"
════════════════════════════════════════════════════════════════════
The user is asking the Copilot to CREATE, DELETE, RENAME, or otherwise
MODIFY entities / relationships / attributes.

Explicit mutation phrases:
  - "add X", "create Y", "delete Z", "remove W"
  - "rename A to B", "update C", "extend with D"
  - "include X", "insert Y", "append Z"
  - "make a new ...", "build a new ...", "synthesize ..."
  - "extend this model with ...", "enrich with ..."
  - "let's add ...", "go ahead and add ..."

Politeness wrappers around mutation:
  - "can you add ...", "could you create ...", "would you remove ...",
    "please add ...", "I want you to add ...", "I need a new entity ..."

Suggestion requests that produce mutations:
  - "what more entities can we add?"        → propose & add
  - "what else could we add?"                → propose & add
  - "what should we add next?"               → propose & add
  - "suggest more entities"                  → propose & add
  - "how can we extend this model?"          → propose & add
  - "what's missing from this model?"        → propose & add
  - "what would complete this model?"        → propose & add
  - "any other entities we should add?"      → propose & add

Confirmations of a prior mutation proposal:
  - "yes, add those", "go ahead", "let's do it", "sounds good, add them"

════════════════════════════════════════════════════════════════════
INTENT: "conversational"
════════════════════════════════════════════════════════════════════
The user wants to KNOW something. NO ontology changes.

Questions about definitions / concepts / best practices:
  - "what is a foreign key?"
  - "explain cardinality"
  - "what does N:M mean?"
  - "what's the difference between 1:1 and 1:N?"
  - "how do primary keys work?"
  - "what are the normal forms?"

Questions about the CURRENT state (reporting only):
  - "what's on the canvas?"
  - "list the current entities"
  - "how many entities do I have?"
  - "show me the relationships"
  - "what does Customer mean?"
  - "what attributes does Order have?"
  - "who are the neighbours of Product?"
  - "which entities are orphaned?"
  - "describe this ontology"
  - "summarize the model"

Meta / chit-chat / tool questions:
  - greetings ("hi", "hello", "thanks", "ok")
  - "what can you do?"
  - "how does this work?"
  - "how do I export?"
  - "help me understand the UI"

General knowledge / unrelated:
  - "what's the capital of France?"
  - "write me a haiku"
  - "tell me a joke"

════════════════════════════════════════════════════════════════════
DECISION PRINCIPLE
════════════════════════════════════════════════════════════════════
Ask yourself:

  "Will something on the canvas CHANGE because of this message?"
    YES → schema_mutation
    NO  → conversational

A general question like "what is X" NEVER changes the canvas.
"what entities do I have" NEVER changes the canvas.
"how does Y work" NEVER changes the canvas.

Only prompts with an ACTION VERB directed at the model
(add, create, delete, remove, rename, update, extend, include,
append, insert, synthesize, build, enrich, complete) are mutations.

If the user is uncertain — "can we add X?" — that's still a mutation
(it's an offer to add). But "can X be nullable?" is conversational.

Edge cases:
  - "what more can we add"        → mutation (they asked us to propose)
  - "should we add more?"         → mutation (they want a proposal)
  - "should email be nullable?"   → conversational (a definitional question)
  - "what's missing?"             → mutation
  - "is Invoice on the canvas?"   → conversational
  - "why isn't Invoice here?"     → conversational (asking for info)
  - "add Invoice"                 → mutation
  - "make it richer"              → mutation (implies add)
  - "make it faster"              → conversational (feedback on perf)

Return ONLY a JSON object:

  {"intent": "conversational" | "schema_mutation", "reasoning": "<1 sentence>"}

Do not include any other text, markdown, or explanation outside the JSON."""


def node_router(state: AgentState) -> AgentState:
    """
    Router classifies the prompt as 'conversational' or 'schema_mutation'.

    Safety: if the LLM errors out, we default to 'conversational' — NOT
    'schema_mutation'. This means an LLM failure never silently creates
    entities the user didn't ask for.
    """
    llm = build_llm(state.get("model"), temperature=0.0)
    messages = [
        SystemMessage(content=ROUTER_SYSTEM + _JSON_TAIL),
        HumanMessage(content=state["prompt"]),
    ]
    try:
        result: IntentClassification = llm.structured(messages, IntentClassification)
        # Belt-and-braces: reject anything that isn't exactly the two allowed values
        intent = result.intent if result.intent in ("conversational", "schema_mutation") else "conversational"
        state["intent"] = intent
        state["reasoning_steps"].append({
            "stage": "Intent Routing",
            "summary": f"{intent}: {result.reasoning}",
        })
    except Exception as exc:
        logger.warning(f"[Router] classification failed: {exc}")
        # FIX: fall back to conversational, not schema_mutation.
        # A failed classification should NEVER trigger entity creation.
        state["intent"] = "conversational"
        state["reasoning_steps"].append({
            "stage": "Intent Routing",
            "summary": f"fallback to conversational (router failed: {exc})",
        })
    return state


# =============================================================
# Conversational
# =============================================================
CHAT_SYSTEM = """You are Data Bridge Copilot, an enterprise information architect.

Answer concisely in clean GitHub-flavoured markdown.
If the user asks what's on their canvas, list the entities from the
[CURRENT CANVAS STATE] block in their prompt.

If the user asks what more entities COULD be added, answer briefly with
a suggestion list — but understand the backend will then generate and
add them automatically."""


def node_conversational(state: AgentState) -> AgentState:
    llm = build_llm(state.get("model"), temperature=0.3)
    messages = [SystemMessage(content=CHAT_SYSTEM)]
    for turn in (state.get("chat_history") or [])[-6:]:
        role = turn.get("role", "user")
        text = turn.get("content", "")
        messages.append(HumanMessage(content=text) if role == "user" else SystemMessage(content=f"Assistant: {text}"))
    messages.append(HumanMessage(content=state["prompt"]))
    reply = llm.chat(messages)
    state["chat_reply"] = reply
    state["response_markdown"] = reply
    state["reasoning_steps"].append({"stage": "Conversational Reply", "summary": "Answered."})
    return state


# =============================================================
# Operation Planning
# =============================================================
OPERATION_SYSTEM = """You are an agentic schema operator.

Translate the user's request into STRUCTURED OPERATIONS.

AVAILABLE OPERATIONS (each is a JSON object with a discriminating "op" field):
  {"op": "CREATE_ENTITY",   "entity_name": "Invoice"}
  {"op": "DELETE_ENTITY",   "entity_name": "OldTable"}
  {"op": "RENAME_ENTITY",   "entity_name": "Cust",   "new_name": "Customer"}
  {"op": "UPDATE_ENTITY",   "entity_name": "Order",  "new_label": "Sales Order"}
  {"op": "ADD_ATTRIBUTE",   "entity_name": "Order",  "attribute_spec": {"name": "total", "datatype": "decimal", "is_nullable": false}}
  {"op": "DELETE_ATTRIBUTE","entity_name": "Order",  "attribute_name": "legacy_col"}
  {"op": "DELETE_RELATIONSHIP","relationship_name": "owns"}

CRITICAL RULES:

RULE 1 — NEVER RETURN EMPTY for mutation requests.
If the user's request implies ANY change to the ontology, you MUST
return at least one operation. An empty array is ONLY acceptable
when the prompt has nothing to do with the ontology.

RULE 2 — VAGUE SUGGESTION REQUESTS PRODUCE CONCRETE ENTITY NAMES.
When the user asks things like:
  - "what more entities can we add"
  - "what else could we add"
  - "suggest new entities"
  - "what's missing from this model"
  - "add more entities"
  - "make it richer"
  - "extend this"

You must NOT reply with questions or empty arrays. You must decide
on 4-6 CONCRETE new entity names that would naturally extend the
current model and emit one CREATE_ENTITY per name.

TO DO THIS WELL:
- Read the existing entities (they're listed below).
- Infer the DOMAIN from the entity names.
- Identify the entities a real enterprise would have that are MISSING
  from this model.
- Emit CREATE_ENTITY for each missing entity.

EXAMPLE — if existing entities are:
  Vehicle, Customer, Technician, Part, Supplier, Workshop, ServiceOrder, ServiceOrderLine

Then the domain is likely "Automotive Service Workshop".
Missing entities that would complete this model:
  - Invoice          (transactional — billing)
  - Payment          (transactional — payment records)
  - Appointment      (transactional — scheduling)
  - InventoryItem    (associative — parts stock per workshop)
  - VehicleOwner     (associative — ownership history)
  - ServiceHistory   (operational — audit trail)
  - WarrantyClaim    (transactional — claims)

Emit CREATE_ENTITY for each. Aim for 4-6 new entities.

RULE 3 — NAMED ENTITY REQUESTS.
If the user names specific entities ("add Invoice and Payment"),
emit one CREATE_ENTITY per named entity. Do not invent extra ones.

RULE 4 — EXPLICIT OPERATIONS.
For delete/rename/update, use the exact existing entity names.

Return JSON: {"operations": [...], "summary": "one-line summary"}"""


def node_plan_operations(state: AgentState) -> AgentState:
    existing_names = state.get("existing_entity_names") or []

    if not state.get("target_ontology_id"):
        state["operations"] = []
        state["operation_summary"] = "No target ontology — building fresh."
        state["reasoning_steps"].append({
            "stage": "Operation Planning",
            "summary": "Fresh build — no operation plan needed.",
        })
        return state

    domain = state.get("domain", "Enterprise")
    context = (
        f"Existing entities: {', '.join(existing_names)}\n"
        f"Domain: {domain}\n"
        f"User request: {state['prompt']}"
    )

    llm = build_llm(state.get("model"), temperature=0.1)
    messages = [
        SystemMessage(content=OPERATION_SYSTEM + _JSON_TAIL),
        HumanMessage(content=context),
    ]

    ops: List[Dict[str, Any]] = []
    summary = ""
    try:
        plan: OperationPlan = llm.structured(messages, OperationPlan)
        ops = [o.model_dump() for o in plan.operations]
        summary = plan.summary
        logger.info(
            f"[Operations] Structured plan: {len(ops)} ops "
            f"kinds={[o.get('op') for o in ops]}"
        )
    except Exception as exc:
        logger.error(f"[Operations] Structured plan failed: {exc}")
        state["operations"] = []
        state["operation_summary"] = f"Planning failed: {exc}"
        state["reasoning_steps"].append({
            "stage": "Operation Planning",
            "summary": f"❌ LLM structured call failed: {exc}",
        })
        return state

    if not ops:
        logger.warning("[Operations] Empty plan — retrying with forced suggestion")
        retry_context = (
            f"{context}\n\n"
            f"YOUR PREVIOUS RESPONSE WAS EMPTY. This is NOT acceptable. "
            f"Emit 4-6 CREATE_ENTITY operations for entities that would "
            f"naturally complete this model. Do NOT return []."
        )
        try:
            plan2: OperationPlan = llm.structured(
                [SystemMessage(content=OPERATION_SYSTEM + _JSON_TAIL),
                 HumanMessage(content=retry_context)],
                OperationPlan,
            )
            ops = [o.model_dump() for o in plan2.operations]
            summary = plan2.summary
            logger.info(f"[Operations] Retry: {len(ops)} ops")
        except Exception as exc:
            logger.error(f"[Operations] Retry failed: {exc}")

    state["operations"] = ops
    state["operation_summary"] = summary
    state["reasoning_steps"].append({
        "stage": "Operation Planning",
        "summary": f"{len(ops)} ops planned: {summary or 'no summary'}",
    })
    return state


# =============================================================
# Operation Execution
# =============================================================
def node_execute_operations(state: AgentState) -> AgentState:
    ops = state.get("operations") or []
    target_id = state.get("target_ontology_id")
    tenant_id = state["tenant_id"]
    if not ops or not target_id:
        state["operation_results"] = []
        return state

    results = []
    for op in ops:
        kind = op.get("op")

        try:
            ontology = store.get_ontology(tenant_id, target_id)
        except Exception as exc:
            results.append({"op": kind, "status": "error", "error": str(exc)})
            continue
        if ontology is None:
            results.append({"op": kind, "status": "error", "error": "ontology disappeared"})
            continue

        try:
            if kind == "DELETE_ENTITY":
                match = next((e for e in ontology.entities if e.name == op["entity_name"]), None)
                if match:
                    ontology_service.delete_entity(tenant_id, target_id, match.entity_id)
                    results.append({"op": kind, "entity": op["entity_name"], "status": "deleted"})
                else:
                    results.append({"op": kind, "entity": op["entity_name"], "status": "not_found"})

            elif kind == "RENAME_ENTITY":
                match = next((e for e in ontology.entities if e.name == op["entity_name"]), None)
                if match:
                    ontology_service.update_entity(
                        tenant_id=tenant_id, ontology_version_id=target_id,
                        entity_id=match.entity_id,
                        name=op["new_name"],
                        label=op.get("new_label"),
                    )
                    results.append({
                        "op": kind, "entity": op["entity_name"],
                        "new_name": op["new_name"], "status": "renamed",
                    })
                else:
                    results.append({"op": kind, "entity": op["entity_name"], "status": "not_found"})

            elif kind == "UPDATE_ENTITY":
                match = next((e for e in ontology.entities if e.name == op["entity_name"]), None)
                if match:
                    ontology_service.update_entity(
                        tenant_id=tenant_id, ontology_version_id=target_id,
                        entity_id=match.entity_id,
                        label=op.get("new_label") or match.label,
                        description=op.get("new_description") or match.description,
                        category=op.get("new_category") or match.category,
                    )
                    results.append({"op": kind, "entity": op["entity_name"], "status": "updated"})
                else:
                    results.append({"op": kind, "entity": op["entity_name"], "status": "not_found"})

            elif kind == "ADD_ATTRIBUTE":
                match = next((e for e in ontology.entities if e.name == op["entity_name"]), None)
                spec = op.get("attribute_spec") or {}
                if match and spec:
                    new_attr = EntityAttribute(
                        attribute_id=f"attr-{uuid.uuid4().hex[:8]}",
                        name=spec["name"],
                        label=spec.get("label", _humanize(spec["name"])),
                        datatype=_normalize_datatype(spec.get("datatype")),
                        is_primary_key=spec.get("is_primary_key", False),
                        is_foreign_key=spec.get("is_foreign_key", False),
                        is_indexed=spec.get("is_indexed", False),
                        is_nullable=spec.get("is_nullable", True),
                        is_unique=spec.get("is_unique", False),
                        is_pii=spec.get("is_pii", False),
                        description=spec.get("description", ""),
                    )
                    ontology_service.update_entity(
                        tenant_id=tenant_id, ontology_version_id=target_id,
                        entity_id=match.entity_id,
                        attributes=list(match.attributes) + [new_attr],
                    )
                    results.append({
                        "op": kind, "entity": op["entity_name"],
                        "attribute": new_attr.name, "status": "added",
                    })
                else:
                    results.append({"op": kind, "entity": op["entity_name"], "status": "not_found"})

            elif kind == "DELETE_ATTRIBUTE":
                match = next((e for e in ontology.entities if e.name == op["entity_name"]), None)
                attr_name = op.get("attribute_name")
                if match and attr_name:
                    remaining = [a for a in match.attributes if a.name != attr_name]
                    ontology_service.update_entity(
                        tenant_id=tenant_id, ontology_version_id=target_id,
                        entity_id=match.entity_id, attributes=remaining,
                    )
                    results.append({
                        "op": kind, "entity": op["entity_name"],
                        "attribute": attr_name, "status": "deleted",
                    })
                else:
                    results.append({"op": kind, "entity": op["entity_name"], "status": "not_found"})

            elif kind == "DELETE_RELATIONSHIP":
                rel_name = op.get("relationship_name")
                match = next((r for r in ontology.relationships if r.name == rel_name), None)
                if match:
                    ontology_service.delete_relationship(tenant_id, target_id, match.relationship_id)
                    results.append({"op": kind, "relationship": match.name, "status": "deleted"})
                else:
                    results.append({"op": kind, "relationship": rel_name, "status": "not_found"})

            else:
                results.append({"op": kind, "status": "unknown_op"})

        except Exception as exc:
            logger.error(f"[Operations] {kind} failed: {exc}")
            results.append({"op": kind, "status": "error", "error": str(exc)})

    state["operation_results"] = results
    state["reasoning_steps"].append({
        "stage": "Operation Execution",
        "summary": f"Executed {len(results)} ops.",
    })
    return state


# =============================================================
# Domain Analysis
# =============================================================
DOMAIN_SYSTEM = """You are an expert Enterprise Information Architect.

Return JSON: {
  "domain": "Industry Name",
  "ontology_name": "Model Title",
  "description": "One sentence.",
  "core_entities": ["Customer", "Order"]
}
RULES:
- KEEP existing entity names in core_entities.
- MAX 15 entity names."""


def node_domain_analysis(state: AgentState) -> AgentState:
    existing_names = state.get("existing_entity_names") or []
    if state.get("target_ontology_id"):
        ont = store.get_ontology(state["tenant_id"], state["target_ontology_id"])
        if ont:
            existing_names = [e.name for e in ont.entities]
            state["existing_ontology_summary"] = f"Entities: {', '.join(existing_names)}"
            state["existing_entity_names"] = existing_names
            state["domain"] = state["domain"] or ont.domain
            state["ontology_name"] = state["ontology_name"] or ont.name

    llm = build_llm(state.get("model"), temperature=0.1)
    parts = [f"Requirements:\n{state['prompt']}"]
    if existing_names:
        parts.append(f"Existing entities: {', '.join(existing_names)}")

    messages = [
        SystemMessage(content=DOMAIN_SYSTEM + _JSON_TAIL),
        HumanMessage(content="\n\n".join(parts)),
    ]
    try:
        analysis: DomainAnalysis = llm.structured(messages, DomainAnalysis)
    except Exception:
        analysis = DomainAnalysis(
            domain=state.get("domain") or "Enterprise",
            ontology_name=state.get("ontology_name") or "Enterprise Business Model",
            description="Model.",
            core_entities=existing_names or ["Entity"],
        )

    state["domain_analysis"] = analysis.model_dump()
    state["domain"] = state["domain"] or analysis.domain
    state["ontology_name"] = state["ontology_name"] or analysis.ontology_name
    state["reasoning_steps"].append({"stage": "Domain Analysis", "summary": analysis.domain})
    return state


# =============================================================
# Entity Generation
# =============================================================
ENTITY_SYSTEM_AUGMENT = """You are an expert Enterprise Information Architect.

The user is ADDING entities to an EXISTING ontology. Generate ONLY the NEW
entities being requested. Do NOT re-output entities that already exist.

Rules:
- If the prompt names specific new entities, generate ONLY those.
- If the prompt is vague (e.g. "add more entities", "what more can we add"),
  infer 4-6 sensible NEW entities that complete the domain model.
- Include foreign-key attributes on new entities that reference existing ones.
- Every entity: name (PascalCase), label, category, description, attributes[]
- Every attribute: name, label, datatype, is_primary_key, is_foreign_key,
  is_indexed, is_nullable, is_unique, is_pii

Return JSON: {"entities": [...]}"""


def node_generate_entities(state: AgentState) -> AgentState:
    existing_names = state.get("existing_entity_names") or []
    ops = state.get("operations") or []
    creates = [op["entity_name"] for op in ops if op.get("op") == "CREATE_ENTITY"]

    if not creates and not state.get("target_ontology_id"):
        creates = []

    if not creates and state.get("target_ontology_id") and not ops:
        state["entities"] = []
        state["reasoning_steps"].append({
            "stage": "Entity Generation",
            "summary": "No CREATE ops and target ontology present — nothing to do.",
        })
        return state

    llm = build_llm(state.get("model"), temperature=0.15)
    parts = []
    if existing_names:
        parts.append(f"Existing entities (DO NOT re-output): {', '.join(existing_names)}")
    parts.append(f"User request: {state['prompt']}")
    if creates:
        parts.append(f"Generate ONLY these NEW entities: {', '.join(creates)}")
    else:
        parts.append("Generate 4-6 entities that satisfy the request.")

    messages = [
        SystemMessage(content=ENTITY_SYSTEM_AUGMENT + _JSON_TAIL),
        HumanMessage(content="\n\n".join(parts)),
    ]
    try:
        result: EntityList = llm.structured(messages, EntityList)
    except Exception as exc:
        logger.error(f"[Entities] failed: {exc}")
        state["entities"] = []
        state["reasoning_steps"].append({
            "stage": "Entity Generation",
            "summary": f"❌ Failed: {exc}",
        })
        return state

    existing_lower = {n.lower() for n in existing_names}
    new_entities = []
    for spec in result.entities:
        if spec.name.lower() in existing_lower:
            continue
        attrs = [
            EntityAttribute(
                attribute_id=f"attr-{uuid.uuid4().hex[:8]}",
                name=a.name,
                label=a.label or _humanize(a.name),
                datatype=_normalize_datatype(a.datatype),
                is_primary_key=a.is_primary_key,
                is_foreign_key=a.is_foreign_key,
                is_indexed=a.is_indexed or a.is_primary_key or a.is_foreign_key,
                is_nullable=False if a.is_primary_key else a.is_nullable,
                is_unique=a.is_unique or a.is_primary_key,
                is_pii=a.is_pii,
                foreign_key_target=a.foreign_key_target,
                description=a.description,
            ) for a in spec.attributes
        ]
        new_entities.append(OntologyEntity(
            entity_id=f"ent-{uuid.uuid4().hex[:8]}",
            name=spec.name,
            label=spec.label or spec.name,
            category=spec.category,
            description=spec.description,
            attributes=attrs,
        ))

    state["entities"] = [e.model_dump() for e in new_entities]
    state["reasoning_steps"].append({
        "stage": "Entity Generation",
        "summary": f"Created {len(new_entities)} entities.",
    })
    return state


# =============================================================
# Relationship Inference
# =============================================================
RELATIONSHIP_SYSTEM = """You are an expert Business Ontologist.
Describe how the NEW entities interact with EXISTING entities.

ABSOLUTE RULES:
1. ONLY use entity names from "Valid entities".
2. Do not invent names.
3. Return JSON: {"relationships": [
  {"name": "owns", "source_entity_name": "Customer", "target_entity_name": "Vehicle", "cardinality": "ONE_TO_MANY"}
]}"""


def node_infer_relationships(state: AgentState) -> AgentState:
    new_entities = state.get("entities") or []
    if not new_entities:
        state["relationships"] = []
        state["reasoning_steps"].append({"stage": "Relationship Inference", "summary": "No new entities — skipping."})
        return state

    target_id = state.get("target_ontology_id")
    if target_id:
        ont = store.get_ontology(state["tenant_id"], target_id)
        current_names = [e.name for e in ont.entities] if ont else []
        current_id_map = {e.name: e.entity_id for e in ont.entities} if ont else {}
    else:
        current_names = [e["name"] for e in new_entities]
        current_id_map = {e["name"]: e["entity_id"] for e in new_entities}

    all_names = list(set(current_names) | {e["name"] for e in new_entities})
    if len(all_names) < 2:
        state["relationships"] = []
        return state

    new_entity_summary = "\n".join(f"  - {e['name']} ({e['category']})" for e in new_entities)

    llm = build_llm(state.get("model"), temperature=0.1)
    messages = [
        SystemMessage(content=RELATIONSHIP_SYSTEM + _JSON_TAIL),
        HumanMessage(
            content=(
                f"NEW entities:\n{new_entity_summary}\n\n"
                f"Valid entities (ONLY these):\n{', '.join(all_names)}\n\n"
                f"User request: {state['prompt']}"
            )
        ),
    ]
    try:
        result: RelationshipList = llm.structured(messages, RelationshipList)
    except Exception as exc:
        logger.error(f"[Relationships] failed: {exc}")
        state["relationships"] = []
        return state

    valid_set = set(all_names)
    relationships = []
    for spec in result.relationships:
        if spec.source_entity_name not in valid_set or spec.target_entity_name not in valid_set:
            continue
        src_id = current_id_map.get(spec.source_entity_name) or next(
            (e["entity_id"] for e in new_entities if e["name"] == spec.source_entity_name), None
        )
        tgt_id = current_id_map.get(spec.target_entity_name) or next(
            (e["entity_id"] for e in new_entities if e["name"] == spec.target_entity_name), None
        )
        if not src_id or not tgt_id:
            continue
        relationships.append(OntologyRelationship(
            relationship_id=f"rel-{uuid.uuid4().hex[:8]}",
            name=spec.name,
            label=spec.label or spec.name.title(),
            source_entity_id=src_id,
            source_entity_name=spec.source_entity_name,
            source_attribute_name=None,
            target_entity_id=tgt_id,
            target_entity_name=spec.target_entity_name,
            target_attribute_name=None,
            relation_type=spec.relation_type,
            cardinality=spec.cardinality,
            cascade_rule="CASCADE",
            description=spec.description,
            is_bidirectional=spec.is_bidirectional,
        ))

    state["relationships"] = [r.model_dump() for r in relationships]
    logger.info(
        f"[Relationships] inferred {len(relationships)}: "
        f"{[(r.name, r.source_entity_name, r.target_entity_name) for r in relationships]}"
    )
    state["reasoning_steps"].append({
        "stage": "Relationship Inference",
        "summary": f"Inferred {len(relationships)} relationships.",
    })
    return state


# =============================================================
# Compile
# =============================================================
def _markdown_summary(state: AgentState) -> str:
    results = state.get("operation_results") or []
    entities = state.get("entities") or []
    relationships = state.get("relationships") or []
    name = state.get("ontology_name", "Enterprise Ontology")

    lines = [f"### {name}\n"]
    if results:
        lines.append("#### Operations Applied")
        for r in results:
            op = r.get("op")
            if op == "DELETE_ENTITY":
                lines.append(f"- 🗑️ Deleted **{r.get('entity')}**")
            elif op == "RENAME_ENTITY":
                lines.append(f"- ✏️ Renamed **{r.get('entity')}** → **{r.get('new_name')}**")
            elif op == "ADD_ATTRIBUTE":
                lines.append(f"- ➕ Added attr **{r.get('attribute')}**")
            elif op == "DELETE_ATTRIBUTE":
                lines.append(f"- ➖ Removed attr **{r.get('attribute')}**")
            elif op == "DELETE_RELATIONSHIP":
                lines.append(f"- 🔗 Removed rel **{r.get('relationship')}**")
        lines.append("")

    if entities:
        lines.append("#### New Entities")
        for e in entities:
            lines.append(f"- **{e['name']}** ({len(e.get('attributes', []))} attributes)")
    if relationships:
        lines.append("\n#### New Relationships")
        for r in relationships:
            lines.append(f"- **{r['source_entity_name']}** → **{r['target_entity_name']}**")
    return "\n".join(lines)


def node_compile_plan(state: AgentState) -> AgentState:
    state["plan_data"] = {
        "domain": state.get("domain"),
        "ontology_name": state.get("ontology_name"),
        "operations": state.get("operations") or [],
        "entities": state.get("entities") or [],
        "relationships": state.get("relationships") or [],
        "operation_results": state.get("operation_results") or [],
    }
    state["response_markdown"] = _markdown_summary(state) + "\n\n*Blueprint ready — approve to apply.*"
    state["final_ontology"] = None
    return state


def _persist_entities_and_relationships(
    tenant_id: str,
    ontology_version_id: str,
    new_entities: List[OntologyEntity],
    new_rels: List[OntologyRelationship],
) -> Dict[str, str]:
    """
    Persist entities, then relationships, remapping relationship endpoints
    from the in-memory `ent-xxxx` IDs to the real persisted IDs by entity name.

    Returns the name → real entity_id map.
    """
    name_to_real_id: Dict[str, str] = {}

    existing = store.get_ontology(tenant_id, ontology_version_id)
    if existing:
        for e in existing.entities:
            name_to_real_id.setdefault(e.name, e.entity_id)

    for ent in new_entities:
        try:
            created = ontology_service.add_entity(
                tenant_id=tenant_id,
                ontology_version_id=ontology_version_id,
                name=ent.name,
                label=ent.label,
                description=ent.description,
                category=ent.category,
                attributes=ent.attributes,
            )
            name_to_real_id[ent.name] = created.entity_id
        except Exception as exc:
            logger.warning(f"[Persist] add_entity failed for {ent.name}: {exc}")

    for rel in new_rels:
        real_src = name_to_real_id.get(rel.source_entity_name)
        real_tgt = name_to_real_id.get(rel.target_entity_name)
        if not real_src or not real_tgt:
            logger.warning(
                f"[Persist] Skipping relationship '{rel.name}': cannot resolve "
                f"{rel.source_entity_name}({real_src}) -> {rel.target_entity_name}({real_tgt})"
            )
            continue
        try:
            ontology_service.add_relationship(
                tenant_id=tenant_id,
                ontology_version_id=ontology_version_id,
                name=rel.name,
                source_entity_id=real_src,
                target_entity_id=real_tgt,
                relation_type=rel.relation_type,
                cardinality=rel.cardinality,
                label=rel.label,
                description=rel.description,
            )
            logger.info(
                f"[Persist] relationship '{rel.name}' {rel.source_entity_name} -> "
                f"{rel.target_entity_name} saved with ids {real_src} -> {real_tgt}"
            )
        except Exception as exc:
            logger.warning(f"[Persist] add_relationship failed for '{rel.name}': {exc}")

    return name_to_real_id


def node_compile_action(state: AgentState) -> AgentState:
    new_entities = [OntologyEntity(**e) for e in state.get("entities") or []]
    new_rels = [OntologyRelationship(**r) for r in state.get("relationships") or []]
    target_id = state.get("target_ontology_id")

    if target_id:
        _persist_entities_and_relationships(
            tenant_id=state["tenant_id"],
            ontology_version_id=target_id,
            new_entities=new_entities,
            new_rels=new_rels,
        )
        compiled = store.get_ontology(state["tenant_id"], target_id)
        state["final_ontology"] = compiled.model_dump() if compiled else None
    else:
        container = ontology_service.create_version(
            tenant_id=state["tenant_id"],
            project_id=state["project_id"],
            name=state.get("ontology_name", "Model"),
            description=state.get("domain_analysis", {}).get("description", ""),
            domain=state.get("domain", "Enterprise"),
            version_tag="1.0.0",
            entities=[],
            relationships=[],
        )
        new_id = container.ontology_version_id
        _persist_entities_and_relationships(
            tenant_id=state["tenant_id"],
            ontology_version_id=new_id,
            new_entities=new_entities,
            new_rels=new_rels,
        )
        compiled = store.get_ontology(state["tenant_id"], new_id)
        state["final_ontology"] = compiled.model_dump() if compiled else container.model_dump()

    state["response_markdown"] = _markdown_summary(state)
    return state


def route_after_router(state: AgentState) -> str:
    return state.get("intent", "conversational")


def route_after_relationships(state: AgentState) -> str:
    return "plan" if (state.get("mode") or "action").lower() == "plan" else "action"