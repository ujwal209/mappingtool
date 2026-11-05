"""LangGraph state for the RAG ingestion agent."""
from typing import Any, Dict, List, Optional, TypedDict


class RAGIngestState(TypedDict, total=False):
    # Input
    tenant_id: str
    ontology_version_id: str
    title: str
    document_type: str
    source_kind: str                          # "text" | "file"
    raw_text: Optional[str]
    file_bytes: Optional[bytes]
    file_name: Optional[str]
    mime_type: Optional[str]

    # Tunables
    chunk_size: int
    chunk_overlap: int
    embedding_model: str
    embedding_dimension: int

    # Derived
    extracted_text: Optional[str]
    extraction_meta: Dict[str, Any]

    # Chunking
    chunks: List[Dict[str, Any]]

    # Embedding
    embeddings: List[List[float]]

    # Persistence
    document_id: Optional[str]
    chunk_count: int
    persisted_to_mongo: bool

    # Errors
    error: Optional[str]
    stage: str
    started_at: float
    finished_at: Optional[float]