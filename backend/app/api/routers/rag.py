"""
Ontology RAG — Ingestion, Listing, Deletion, Query.

Isolated router so:
  - The endpoints load independently of `ontologies.py` (an import
    problem here can't take down the ontology CRUD).
  - /docs lists them under their own "Ontology RAG" tag.
  - File-upload (multipart) parsing lives in one predictable place.

Mounted at /api/v1 (see main.py) → final URLs are:
    POST   /api/v1/ontologies/{ontology_version_id}/rag/ingest-file
    POST   /api/v1/ontologies/{ontology_version_id}/rag/documents
    GET    /api/v1/ontologies/{ontology_version_id}/rag/documents
    DELETE /api/v1/ontologies/{ontology_version_id}/rag/documents/{document_id}
    POST   /api/v1/ontologies/{ontology_version_id}/rag/query
"""

import json as _json
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    HTTPException,
)

from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.models.schemas import (
    IngestRAGDocumentRequest,
    QueryOntologyRAGRequest,
)

router = APIRouter(tags=["Ontology RAG"])


# =================================================================
# File upload (multipart)
# =================================================================
@router.post(
    "/ontologies/{ontology_version_id}/rag/ingest-file",
    response_model=Dict[str, Any],
    status_code=201,
    summary="Upload a Rulebook / Policy File with rich metadata",
    response_description="Ingestion status with chunk metadata, extraction details, and stored metadata",
)
async def ingest_ontology_file(
    ontology_version_id: str,
    file: UploadFile = File(..., description="Document file to parse and index"),
    title: str = Form(...),
    document_type: str = Form("SPECIFICATION"),
    metadata_json: Optional[str] = Form(
        default=None,
        description='Optional JSON string of extra metadata: {"owner": "...", "tags": [...]}',
    ),
    chunk_size: int = Form(600),
    chunk_overlap: int = Form(100),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Upload a real file (PDF, DOCX, TXT, MD, CSV, JSON) and index it via the RAG agent.**

    Multipart form fields:
      - `file`: the document
      - `title`: human-readable title
      - `document_type`: RULEBOOK / GLOSSARY / COMPLIANCE / SPECIFICATION / CONTRACT / POLICY / OTHER
      - `metadata_json`: JSON string with extra fields (`owner`, `department`,
        `version`, `jurisdiction`, `effective_date`, `expiry_date`, `tags`,
        `related_entities`, `language`, `confidentiality`, `source_url`, `notes`)
      - `chunk_size`, `chunk_overlap`: chunker knobs
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    MAX_BYTES = 20 * 1024 * 1024
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data)} bytes). Maximum is 20 MB.",
        )

    # Parse + whitelist metadata
    extra_meta: Dict[str, Any] = {}
    if metadata_json:
        try:
            parsed = _json.loads(metadata_json)
            if isinstance(parsed, dict):
                extra_meta = parsed
        except _json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="metadata_json is not valid JSON.",
            )

    allowed = {
        "owner",
        "department",
        "version",
        "jurisdiction",
        "effective_date",
        "expiry_date",
        "tags",
        "related_entities",
        "language",
        "confidentiality",
        "source_url",
        "notes",
    }
    clean_meta: Dict[str, Any] = {k: v for k, v in extra_meta.items() if k in allowed}
    for arr_key in ("tags", "related_entities"):
        if arr_key in clean_meta and isinstance(clean_meta[arr_key], str):
            clean_meta[arr_key] = [
                s.strip() for s in clean_meta[arr_key].split(",") if s.strip()
            ]

    from app.agents.rag_agent.service import rag_agent_service

    result = rag_agent_service.run_agent(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        title=title,
        document_type=document_type,
        file_bytes=data,
        file_name=file.filename,
        mime_type=file.content_type,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        extra_metadata=clean_meta,
    )

    if result.get("status") == "ERROR":
        raise HTTPException(
            status_code=400,
            detail=result.get("error") or "Ingestion failed",
        )
    return result


# =================================================================
# Text paste ingestion
# =================================================================
@router.post(
    "/ontologies/{ontology_version_id}/rag/documents",
    response_model=Dict[str, Any],
    status_code=201,
    summary="Ingest Ontology Rulebook or Document (text paste)",
    response_description="Ingestion status and chunk metadata",
)
def ingest_ontology_document(
    ontology_version_id: str,
    req: IngestRAGDocumentRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Ingest a pasted document into the ontology RAG knowledge base.**

    Delegates to the LangGraph ingestion agent:
    extract → chunk → Gemini embed (round-robin) → MongoDB persist.
    """
    from app.agents.rag_agent.service import rag_agent_service

    result = rag_agent_service.run_agent(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        title=req.title,
        document_type=req.document_type or "SPECIFICATION",
        raw_text=req.content,
        chunk_size=req.chunk_size or 600,
        chunk_overlap=req.chunk_overlap or 100,
    )

    if result.get("status") == "ERROR":
        raise HTTPException(
            status_code=400,
            detail=result.get("error") or "Ingestion failed",
        )
    return result


# =================================================================
# List
# =================================================================
@router.get(
    "/ontologies/{ontology_version_id}/rag/documents",
    response_model=List[Dict[str, Any]],
    summary="List Ingested Ontology Documents (RAG)",
    response_description="List of documents and rulebooks indexed for this ontology version",
)
def list_ontology_documents(
    ontology_version_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """**List all ingested documents, compliance rulebooks, and glossaries attached to this ontology version.**"""
    from app.services.ontology_rag_service import ontology_rag_service
    return ontology_rag_service.list_documents(auth.tenant_id, ontology_version_id)


# =================================================================
# Delete
# =================================================================
@router.delete(
    "/ontologies/{ontology_version_id}/rag/documents/{document_id}",
    response_model=Dict[str, Any],
    summary="Delete an Ingested Document and its Chunks",
    response_description="Deletion confirmation",
)
def delete_ontology_document(
    ontology_version_id: str,
    document_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Delete an ingested RAG document and all its associated chunks.**"""
    from app.services.ontology_rag_service import ontology_rag_service
    return ontology_rag_service.delete_document(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        document_id=document_id,
    )


# =================================================================
# Query
# =================================================================
@router.post(
    "/ontologies/{ontology_version_id}/rag/query",
    response_model=Dict[str, Any],
    summary="Query Ontology Knowledge Base (RAG)",
    response_description="Retrieved semantic chunks and Groq LLM synthesized domain guidance",
)
def query_ontology_rag(
    ontology_version_id: str,
    req: QueryOntologyRAGRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Perform grounded semantic search and LLM synthesis over the ontology knowledge base.**

    Retrieves the most relevant chunks via hybrid vector + keyword search,
    then uses the Groq multi-key round-robin LLM pool to synthesize an answer.
    """
    from app.services.ontology_rag_service import ontology_rag_service
    res = ontology_rag_service.query_ontology_rag(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        query=req.query,
        top_k=req.top_k or 4,
        synthesize_with_llm=req.synthesize_with_llm,
    )
    return res.model_dump()