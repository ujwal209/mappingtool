"""
LangGraph assembly for the Ontology Agent.

Flow:
    router ──► conversational ──► END
           └─► schema_mutation
                 → plan_operations
                 → execute_operations
                 → domain_analysis
                 → generate_entities
                 → infer_relationships
                 → compile_plan (if mode=plan) OR compile_action (if mode=action)
                 → END
"""

from langgraph.graph import END, StateGraph

from app.services.ontology_agent.nodes import (
    node_compile_action,
    node_compile_plan,
    node_conversational,
    node_domain_analysis,
    node_execute_operations,
    node_generate_entities,
    node_infer_relationships,
    node_plan_operations,
    node_router,
    route_after_relationships,
    route_after_router,
)
from app.services.ontology_agent.state import AgentState


def build_ontology_graph():
    g = StateGraph(AgentState)

    # ── Register all nodes ─────────────────────────────────
    g.add_node("router", node_router)
    g.add_node("conversational", node_conversational)
    g.add_node("plan_operations", node_plan_operations)
    g.add_node("execute_operations", node_execute_operations)
    g.add_node("domain_analysis", node_domain_analysis)
    g.add_node("generate_entities", node_generate_entities)
    g.add_node("infer_relationships", node_infer_relationships)
    g.add_node("compile_plan", node_compile_plan)
    g.add_node("compile_action", node_compile_action)

    # ── Entry point ────────────────────────────────────────
    g.set_entry_point("router")

    # ── Router branch ──────────────────────────────────────
    g.add_conditional_edges(
        "router",
        route_after_router,
        {
            "conversational": "conversational",
            "schema_mutation": "plan_operations",
        },
    )

    # ── Conversational ends immediately ────────────────────
    g.add_edge("conversational", END)

    # ── Mutation pipeline ──────────────────────────────────
    g.add_edge("plan_operations", "execute_operations")
    g.add_edge("execute_operations", "domain_analysis")
    g.add_edge("domain_analysis", "generate_entities")
    g.add_edge("generate_entities", "infer_relationships")

    # ── Compile: plan vs action ────────────────────────────
    g.add_conditional_edges(
        "infer_relationships",
        route_after_relationships,
        {
            "plan": "compile_plan",
            "action": "compile_action",
        },
    )

    # ── Both compile paths end ─────────────────────────────
    g.add_edge("compile_plan", END)
    g.add_edge("compile_action", END)

    return g.compile()


# ── Global compiled graph singleton ────────────────────────
ontology_graph = build_ontology_graph()