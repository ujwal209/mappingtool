"""
LangGraph assembly for the table matching agent with HITL gate.

    rag_grounding
        ↓
    generate_pairs
        ↓
    human_review_gate   (conditional — halts unless APPROVED)
        ↓
    finalize_pairs
        ↓
    END
"""

from langgraph.graph import END, StateGraph

from app.agents.table_matching_agent.nodes import (
    node_finalize_pairs,
    node_generate_pairs,
    node_human_review_gate,
    node_rag_grounding,
)
from app.agents.table_matching_agent.state import TableMatchingState


def route_after_gate(state: TableMatchingState) -> str:
    if state.get("error"):
        return END
    if state.get("review_status") == "APPROVED":
        return "finalize_pairs"
    return END


def build_table_matching_graph():
    wf = StateGraph(TableMatchingState)

    wf.add_node("rag_grounding", node_rag_grounding)
    wf.add_node("generate_pairs", node_generate_pairs)
    wf.add_node("human_review_gate", node_human_review_gate)
    wf.add_node("finalize_pairs", node_finalize_pairs)

    wf.set_entry_point("rag_grounding")
    wf.add_edge("rag_grounding", "generate_pairs")
    wf.add_edge("generate_pairs", "human_review_gate")

    wf.add_conditional_edges(
        "human_review_gate",
        route_after_gate,
        {"finalize_pairs": "finalize_pairs", END: END},
    )

    wf.add_edge("finalize_pairs", END)

    return wf.compile()


table_matching_graph = build_table_matching_graph()