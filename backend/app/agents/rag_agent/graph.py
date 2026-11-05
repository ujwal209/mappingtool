"""
LangGraph assembly for the RAG ingestion agent.

Flow:
  extract_text → chunk → embed → persist → END

All nodes are idempotent — if a node sets `state["error"]`, the next
node short-circuits.
"""

from langgraph.graph import END, StateGraph

from app.agents.rag_agent.nodes import (
    node_chunk,
    node_embed,
    node_extract_text,
    node_persist,
)
from app.agents.rag_agent.state import RAGIngestState


def build_rag_graph():
    g = StateGraph(RAGIngestState)

    g.add_node("extract_text", node_extract_text)
    g.add_node("chunk", node_chunk)
    g.add_node("embed", node_embed)
    g.add_node("persist", node_persist)

    g.set_entry_point("extract_text")

    g.add_edge("extract_text", "chunk")
    g.add_edge("chunk", "embed")
    g.add_edge("embed", "persist")
    g.add_edge("persist", END)

    return g.compile()


rag_graph = build_rag_graph()