"""
LangGraph nodes for the RAG ingestion agent.

Pipeline:
  extract_text → chunk → embed → persist

Each node writes to state and is independently retryable.
"""

import time
import uuid
from typing import Any, Dict, List

from app.agents.rag_agent.extractor import extract_text, ExtractionError
from app.agents.rag_agent.state import RAGIngestState
from app.core.gemini_manager import gemini_manager
from app.core.logging import get_logger
from app.db.mongo import mongo_manager
from app.models.canonical import OntologyChunk
from app.db.store import store

logger = get_logger("rag_agent")


def node_extract_text(state: RAGIngestState) -> RAGIngestState:
    state["stage"] = "extract"
    state.setdefault("started_at", time.time())

    # If raw_text was provided directly (paste-text path), no file extraction needed
    if state.get("raw_text"):
        text = state["raw_text"].strip()
        if not text:
            state["error"] = "Pasted content is empty."
            return state
        state["extracted_text"] = text
        state["extraction_meta"] = {"parser": "inline", "chars": len(text)}
        state["stage"] = "extracted"
        logger.info(f"[RAG/extract] inline text: {len(text)} chars")
        return state

    # Otherwise, extract from file bytes
    file_bytes = state.get("file_bytes")
    if not file_bytes:
        state["error"] = "No text or file provided."
        return state

    try:
        text, meta = extract_text(
            file_bytes=file_bytes,
            file_name=state.get("file_name") or "document",
            mime_type=state.get("mime_type"),
        )
        state["extracted_text"] = text
        state["extraction_meta"] = meta
        state["stage"] = "extracted"
        logger.info(
            f"[RAG/extract] file '{state.get('file_name')}' → {len(text)} chars, "
            f"meta={meta}"
        )
    except ExtractionError as e:
        state["error"] = str(e)
        logger.error(f"[RAG/extract] {e}")
    return state


def node_chunk(state: RAGIngestState) -> RAGIngestState:
    if state.get("error"):
        return state
    state["stage"] = "chunk"

    text = state.get("extracted_text") or ""
    if not text.strip():
        state["error"] = "Extracted text is empty."
        return state

    size = int(state.get("chunk_size") or 600)
    overlap = int(state.get("chunk_overlap") or 100)
    if overlap >= size:
        overlap = max(0, size // 4)

    chunks: List[Dict[str, Any]] = []

    # Paragraph-first chunking
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    current = ""
    idx = 0
    for para in paragraphs:
        if len(current) + len(para) + 2 < size:
            current = f"{current}\n\n{para}".strip()
        else:
            if current:
                chunks.append({
                    "chunk_id": f"chk-{uuid.uuid4().hex[:8]}",
                    "text": current,
                    "chunk_index": idx,
                })
                idx += 1
            tail = current[-overlap:] if len(current) > overlap else ""
            current = f"{tail}\n\n{para}".strip()

    if current:
        chunks.append({
            "chunk_id": f"chk-{uuid.uuid4().hex[:8]}",
            "text": current,
            "chunk_index": idx,
        })

    if not chunks:
        chunks = [{
            "chunk_id": f"chk-{uuid.uuid4().hex[:8]}",
            "text": text[:size],
            "chunk_index": 0,
        }]

    state["chunks"] = chunks
    state["stage"] = "chunked"
    logger.info(f"[RAG/chunk] produced {len(chunks)} chunks (size={size}, overlap={overlap})")
    return state


def node_embed(state: RAGIngestState) -> RAGIngestState:
    if state.get("error"):
        return state
    state["stage"] = "embed"

    chunks = state.get("chunks") or []
    if not chunks:
        state["error"] = "No chunks to embed."
        return state

    texts = [c["text"] for c in chunks]
    embeddings = gemini_manager.batch_generate_embeddings(
        texts=texts,
        model=state.get("embedding_model"),
        dimension=state.get("embedding_dimension"),
    )
    state["embeddings"] = embeddings
    state["stage"] = "embedded"
    logger.info(f"[RAG/embed] embedded {len(embeddings)} chunks")
    return state


def node_persist(state: RAGIngestState) -> RAGIngestState:
    if state.get("error"):
        return state
    state["stage"] = "persist"

    tenant_id = state["tenant_id"]
    ont_id = state["ontology_version_id"]
    chunks = state.get("chunks") or []
    embeddings = state.get("embeddings") or []

    if len(chunks) != len(embeddings):
        state["error"] = f"Chunk/embedding length mismatch: {len(chunks)} vs {len(embeddings)}"
        return state

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    title = state.get("title") or "Ontology Document"
    doc_type = state.get("document_type") or "SPECIFICATION"

    # Build canonical OntologyChunk models for the in-memory store
    db_chunks: List[OntologyChunk] = []
    for chk, emb in zip(chunks, embeddings):
        db_chunks.append(OntologyChunk(
            chunk_id=chk["chunk_id"],
            ontology_id=ont_id,
            tenant_id=tenant_id,
            document_id=doc_id,
            chunk_index=chk["chunk_index"],
            text=chk["text"],
            embedding=emb,
            token_count=len(chk["text"].split()),
            source_name=title,
        ))

    try:
        store.save_ontology_chunks(tenant_id, ont_id, db_chunks)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[RAG/persist] store.save_ontology_chunks failed: {e}")

    # Persist metadata document in Mongo (for the list endpoint)
    try:
        mongo_manager.upsert_document(
            "ontology_rag_documents",
            {"tenant_id": tenant_id, "document_id": doc_id},
            {
                "tenant_id": tenant_id,
                "document_id": doc_id,
                "ontology_version_id": ont_id,
                "title": title,
                "document_type": doc_type,
                "raw_content_preview": (state.get("extracted_text") or "")[:500],
                "extraction_meta": state.get("extraction_meta") or {},
                "chunk_count": len(db_chunks),
                "created_at": time.time(),
            },
        )
        state["persisted_to_mongo"] = True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[RAG/persist] mongo upsert failed: {e}")
        state["persisted_to_mongo"] = False

    state["document_id"] = doc_id
    state["chunk_count"] = len(db_chunks)
    state["stage"] = "persisted"
    state["finished_at"] = time.time()
    logger.info(
        f"[RAG/persist] document {doc_id} stored with {len(db_chunks)} chunks "
        f"for ontology {ont_id}"
    )
    return state