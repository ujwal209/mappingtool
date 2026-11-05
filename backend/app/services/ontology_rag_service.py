"""
Ontology RAG service — query & retrieve layer.

Ingestion is now handled by the LangGraph agent in
`app/agents/rag_agent/service.py`. This service keeps the query +
retrieve methods used by `/rag/query` and by the mapping RAG pass.
"""

import math
import re
import time
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.core.gemini_manager import gemini_manager
from app.core.groq_manager import groq_manager
from app.db.mongo import mongo_manager
from app.db.store import store
from app.core.logging import get_logger

logger = get_logger("ontology_rag")


class RAGDocument(BaseModel):
    document_id: str = Field(default_factory=lambda: f"doc-{uuid.uuid4().hex[:8]}")
    ontology_version_id: str
    title: str
    document_type: str = "SPECIFICATION"
    raw_content: str = ""
    chunk_count: int = 0
    created_at: float = Field(default_factory=time.time)


class RAGQueryResult(BaseModel):
    query: str
    retrieved_chunks: List[Dict[str, Any]]
    synthesized_guidance: str
    ontology_version_id: str
    model_used: str
    key_used_masked: str
    search_mode: str = "hybrid_vector_keyword"


class OntologyRAGService:
    # ── Ingestion is delegated to the agent ─────────────────
    def ingest_document(
        self,
        tenant_id: str,
        ontology_version_id: str,
        title: str,
        content: str,
        document_type: str = "SPECIFICATION",
        chunk_size: int = 600,
        chunk_overlap: int = 100,
    ) -> Dict[str, Any]:
        """Thin wrapper — for backward compatibility with old callers."""
        from app.agents.rag_agent.service import rag_agent_service
        return rag_agent_service.run_agent(
            tenant_id=tenant_id,
            ontology_version_id=ontology_version_id,
            title=title,
            document_type=document_type,
            raw_text=content,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    # ── Listing ────────────────────────────────────────────
    def list_documents(self, tenant_id: str, ontology_version_id: str) -> List[Dict[str, Any]]:
        docs = mongo_manager.find(
            "ontology_rag_documents",
            {"tenant_id": tenant_id, "ontology_version_id": ontology_version_id},
        )
        return [
            {
                "document_id": d.get("document_id"),
                "title": d.get("title"),
                "document_type": d.get("document_type"),
                "chunk_count": d.get("chunk_count", 0),
                "created_at": d.get("created_at"),
            }
            for d in docs
        ]

    def delete_document(
        self, tenant_id: str, ontology_version_id: str, document_id: str
    ) -> Dict[str, Any]:
        # Remove chunk rows from Mongo (chunks are stored in `ontology_chunks`
        # or wherever your store persists them — adjust the collection name
        # if you use a different one).
        chunks_coll = mongo_manager.get_collection("ontology_chunks")
        deleted_chunks = 0
        if chunks_coll is not None:
            res = chunks_coll.delete_many({
                "tenant_id": tenant_id,
                "ontology_id": ontology_version_id,
                "document_id": document_id,
            })
            deleted_chunks = res.deleted_count

        mongo_manager.delete_one(
            "ontology_rag_documents",
            {"tenant_id": tenant_id, "document_id": document_id},
        )
        return {
            "status": "DELETED",
            "document_id": document_id,
            "deleted_chunks": deleted_chunks,
        }

    # ── Retrieval (unchanged) ──────────────────────────────
    def retrieve_relevant_chunks(
        self,
        ontology_version_id: str,
        query: str,
        tenant_id: str = "tenant-default",
        top_k: int = 4,
    ) -> List[Dict[str, Any]]:
        query_emb = gemini_manager.generate_embedding(query)
        vector_results = store.vector_search_ontology_chunks(
            tenant_id=tenant_id,
            ontology_id=ontology_version_id,
            query_embedding=query_emb,
            top_k=top_k * 2,
        )

        query_tokens = set(re.findall(r"\w+", query.lower()))
        combined_scored = []
        for item in vector_results:
            chunk_dict = item.get("chunk", {})
            vector_score = item.get("score", 0.0)
            text = chunk_dict.get("text", "")
            tokens = re.findall(r"\w+", text.lower())
            kw_hits = sum(1 for t in tokens if t in query_tokens) if query_tokens else 0
            kw_score = kw_hits / (math.sqrt(len(tokens) or 1))

            final_score = round((0.7 * max(0.0, vector_score)) + (0.3 * kw_score), 4)

            combined_scored.append({
                "chunk": {
                    "chunk_id": chunk_dict.get("chunk_id"),
                    "title": chunk_dict.get("source_name", "Ontology Document"),
                    "content": text,
                    "section": f"Chunk #{chunk_dict.get('chunk_index', 0)}",
                },
                "score": final_score,
                "vector_similarity": vector_score,
            })

        combined_scored.sort(key=lambda x: x["score"], reverse=True)
        return combined_scored[:top_k]

    def query_ontology_rag(
        self,
        tenant_id: str,
        ontology_version_id: str,
        query: str,
        top_k: int = 4,
        synthesize_with_llm: bool = True,
    ) -> RAGQueryResult:
        relevant_chunks = self.retrieve_relevant_chunks(
            ontology_version_id=ontology_version_id,
            query=query,
            tenant_id=tenant_id,
            top_k=top_k,
        )

        if not relevant_chunks:
            return RAGQueryResult(
                query=query,
                retrieved_chunks=[],
                synthesized_guidance=(
                    "No ontology documents have been ingested for this ontology version yet. "
                    "Ingest documents via POST /ontologies/{id}/rag/ingest-file to enable vector search."
                ),
                ontology_version_id=ontology_version_id,
                model_used="none",
                key_used_masked="[LOCAL]",
            )

        context_blocks = [
            f"[Source: {rc['chunk']['title']} - Score: {rc.get('score', 0.0)}]\n{rc['chunk']['content']}"
            for rc in relevant_chunks
        ]
        context_str = "\n\n---\n\n".join(context_blocks)

        model_name = "openai/gpt-oss-120b"
        used_key_masked = "[VECTOR_RETRIEVAL_ONLY]"
        synthesized_text = ""

        if synthesize_with_llm and groq_manager.get_keys_count() > 0:
            try:
                client, used_key = groq_manager.get_groq_client()
                used_key_masked = f"{used_key[:4]}...{used_key[-4:]}"

                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are an Enterprise Ontology & Data Governance Architect. "
                                "Use ONLY the provided ontology document context to answer the "
                                "user's question. If the context does not contain the answer, "
                                "say so explicitly. Do not hallucinate."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                f"ONTOLOGY VECTOR KNOWLEDGE BASE CONTEXT:\n{context_str}\n\n"
                                f"USER QUESTION:\n{query}\n\n"
                                "Provide a clear, fact-grounded answer using only the context above."
                            ),
                        },
                    ],
                    temperature=0.0,
                    max_tokens=500,
                )
                groq_manager.record_success(used_key)
                synthesized_text = response.choices[0].message.content.strip()
            except Exception as e:  # noqa: BLE001
                logger.warning(f"RAG LLM synthesis fallback: {e}")
                synthesized_text = (
                    f"Retrieved {len(relevant_chunks)} vector chunks. "
                    f"Top context: {context_blocks[0][:200]}..."
                )
        else:
            synthesized_text = (
                f"Retrieved {len(relevant_chunks)} vector chunks for "
                f"'{query}' with top score {relevant_chunks[0]['score']}."
            )

        return RAGQueryResult(
            query=query,
            retrieved_chunks=relevant_chunks,
            synthesized_guidance=synthesized_text,
            ontology_version_id=ontology_version_id,
            model_used=model_name if synthesize_with_llm else "gemini_vector_only",
            key_used_masked=used_key_masked,
            search_mode="gemini_vector_mongodb_hybrid",
        )


ontology_rag_service = OntologyRAGService()