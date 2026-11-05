"""
Public facade for the RAG ingestion agent.

Exposes:
  - run_agent(...) → ingest text or file via the LangGraph
  - returns a normalized dict for the HTTP layer
"""

import time
from typing import Any, Dict, Optional

from app.agents.rag_agent.graph import rag_graph
from app.agents.rag_agent.state import RAGIngestState
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("rag_agent_service")


class RAGAgentService:
    def run_agent(
        self,
        tenant_id: str,
        ontology_version_id: str,
        title: str,
        document_type: str = "SPECIFICATION",
        raw_text: Optional[str] = None,
        file_bytes: Optional[bytes] = None,
        file_name: Optional[str] = None,
        mime_type: Optional[str] = None,
        chunk_size: int = 600,
        chunk_overlap: int = 100,
        embedding_model: Optional[str] = None,
        embedding_dimension: Optional[int] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Ingest a document (text or file) into the ontology RAG knowledge base.

        Args:
            tenant_id: multi-tenant isolation key
            ontology_version_id: which ontology this doc is scoped to
            title: human-readable title
            document_type: RULEBOOK / GLOSSARY / COMPLIANCE / SPECIFICATION /
                CONTRACT / POLICY / OTHER
            raw_text: paste-text path — plain text
            file_bytes: file path — raw bytes of the uploaded file
            file_name: needed for extension-based extraction (pdf/docx/etc.)
            mime_type: passed to the extractor (used as a fallback hint)
            chunk_size: character length per chunk
            chunk_overlap: characters shared between adjacent chunks
            embedding_model / embedding_dimension: overrides for Gemini
            extra_metadata: arbitrary dict of doc metadata
                (owner, department, version, jurisdiction, effective_date,
                 expiry_date, tags, related_entities, language,
                 confidentiality, source_url, notes)

        Returns:
            dict with `status` ('INGESTED' or 'ERROR'), document_id,
            chunk_count, extraction_meta, duration_ms, and — on success —
            the stored metadata.
        """
        initial: RAGIngestState = {
            "tenant_id": tenant_id,
            "ontology_version_id": ontology_version_id,
            "title": title,
            "document_type": document_type,
            "source_kind": "file" if file_bytes else "text",
            "raw_text": raw_text,
            "file_bytes": file_bytes,
            "file_name": file_name,
            "mime_type": mime_type,
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
            "embedding_model": embedding_model or settings.GEMINI_EMBEDDING_MODEL,
            "embedding_dimension": embedding_dimension
            or settings.GEMINI_EMBEDDING_DIMENSION,
            "extra_metadata": extra_metadata or {},
            "extracted_text": None,
            "extraction_meta": {},
            "chunks": [],
            "embeddings": [],
            "document_id": None,
            "chunk_count": 0,
            "persisted_to_mongo": False,
            "error": None,
            "stage": "init",
            "started_at": time.time(),
            "finished_at": None,
        }

        result = rag_graph.invoke(initial)

        if result.get("error"):
            logger.warning(
                f"[RAGAgentService] ingestion failed at stage '{result.get('stage')}': "
                f"{result['error']}"
            )
            return {
                "status": "ERROR",
                "stage": result.get("stage"),
                "error": result["error"],
                "document_id": None,
                "chunk_count": 0,
            }

        return {
            "status": "INGESTED",
            "stage": result.get("stage"),
            "document_id": result.get("document_id"),
            "title": title,
            "document_type": document_type,
            "chunk_count": result.get("chunk_count", 0),
            "ontology_version_id": ontology_version_id,
            "extraction_meta": result.get("extraction_meta") or {},
            "extra_metadata": result.get("extra_metadata") or {},
            "persisted_to_mongo": result.get("persisted_to_mongo", False),
            "duration_ms": round(
                (
                    (result.get("finished_at") or time.time())
                    - result["started_at"]
                )
                * 1000,
                1,
            ),
        }


rag_agent_service = RAGAgentService()