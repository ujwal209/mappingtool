"""
Ontology, Semantic Graph, and Ontology RAG Endpoints.
Fulfills Section 5, Section 9 (Ontology and Semantic Mapping Design),
and user requirement for RAG-based ontology knowledge management.
"""

from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter,
    Depends,
    Query,
    UploadFile,
    File,
    Form,
    HTTPException,
)

from app.models.canonical import (
    OntologyVersion,
    Concept,
    SemanticBinding,
    OntologyEntity,
    OntologyRelationship,
)
from app.models.schemas import (
    CreateOntologyVersionRequest,
    UpdateOntologyRequest,
    CreateEntityRequest,
    UpdateEntityRequest,
    CreateRelationshipRequest,
    UpdateRelationshipRequest,
    AgentGenerateOntologyRequest,
    AgentApplyPlanRequest,
    AgentSummarizeChatRequest,
    IngestRAGDocumentRequest,
    QueryOntologyRAGRequest,
)
from app.services.ontology_service import ontology_service
from app.services.ontology_agent_service import ontology_agent_service
from app.db.store import store
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.core.errors import PlatformException, ErrorCategory

router = APIRouter()


# =================================================================
# Ontology CRUD
# =================================================================
@router.get(
    "/ontologies",
    response_model=List[OntologyVersion],
    summary="List Ontologies",
    response_description="List of all ontology versions for tenant or project",
)
def list_ontologies(
    project_id: Optional[str] = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
):
    """**Retrieve all ontology versions** for the authenticated tenant."""
    return store.list_ontologies(auth.tenant_id, project_id)


@router.post(
    "/ontologies",
    response_model=OntologyVersion,
    status_code=201,
    summary="Create Draft Ontology Version",
    response_description="Created ontology version",
)
def create_ontology(
    req: CreateOntologyVersionRequest,
    project_id: Optional[str] = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
):
    """**Create a new draft ontology version** (persisted to MongoDB 'ontologies')."""
    target_project = project_id or req.project_id or "proj-default"
    return ontology_service.create_version(
        tenant_id=auth.tenant_id,
        project_id=target_project,
        name=req.name or "Enterprise Business Ontology",
        description=req.description,
        domain=req.domain,
        version_tag=req.version_tag,
        parent_id=req.parent_id,
        entities=req.entities,
        relationships=req.relationships,
        concepts=req.concepts,
    )


@router.post(
    "/ontologies/{project_id}/versions",
    response_model=OntologyVersion,
    status_code=201,
    summary="Create Draft Ontology Version",
    response_description="Created ontology version with initial concept graph",
)
def create_ontology_version(
    project_id: str,
    req: CreateOntologyVersionRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Create a new draft ontology version for a project** (PRD Section 5 & 9)."""
    return ontology_service.create_version(
        tenant_id=auth.tenant_id,
        project_id=project_id,
        name=req.name or "Enterprise Business Ontology",
        description=req.description,
        domain=req.domain,
        version_tag=req.version_tag,
        parent_id=req.parent_id,
        entities=req.entities,
        relationships=req.relationships,
        concepts=req.concepts,
    )


@router.get(
    "/ontologies/{ontology_version_id}",
    response_model=OntologyVersion,
    summary="Get Ontology Version Details",
    response_description="Ontology version including entities, relationships, concepts, bindings, and content hash",
)
def get_ontology_version(
    ontology_version_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Retrieve full ontology version** including entities, relationships, concepts."""
    ont = store.get_ontology(auth.tenant_id, ontology_version_id)
    if not ont:
        raise PlatformException(
            code="ONTOLOGY_NOT_FOUND",
            message="Ontology version not found",
            status_code=404,
        )
    return ont


@router.put(
    "/ontologies/{ontology_version_id}",
    response_model=OntologyVersion,
    summary="Update Ontology Metadata",
    response_description="Updated ontology version",
)
def update_ontology(
    ontology_version_id: str,
    req: UpdateOntologyRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Update ontology name, description, domain, or version tag.**"""
    return ontology_service.update_ontology(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        name=req.name,
        description=req.description,
        domain=req.domain,
        version_tag=req.version_tag,
        status=req.status,
        entities=req.entities,
        relationships=req.relationships,
    )


@router.delete(
    "/ontologies/{ontology_version_id}",
    response_model=Dict[str, Any],
    summary="Delete Ontology",
    response_description="Deletion confirmation status",
)
def delete_ontology(
    ontology_version_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Delete an ontology version** and its associated semantic chunks and rulebooks."""
    ontology_service.delete_ontology(auth.tenant_id, ontology_version_id)
    return {"status": "DELETED", "ontology_version_id": ontology_version_id}


# =================================================================
# Entity CRUD
# =================================================================
@router.post(
    "/ontologies/{ontology_version_id}/entities",
    response_model=OntologyEntity,
    status_code=201,
    summary="Add Entity to Ontology",
    response_description="Created entity definition",
)
def add_entity(
    ontology_version_id: str,
    req: CreateEntityRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Add a business entity with typed attributes to the ontology.**"""
    return ontology_service.add_entity(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        name=req.name,
        label=req.label,
        description=req.description,
        category=req.category,
        attributes=req.attributes,
    )


@router.put(
    "/ontologies/{ontology_version_id}/entities/{entity_id}",
    response_model=OntologyEntity,
    summary="Update Entity in Ontology",
    response_description="Updated entity definition",
)
def update_entity(
    ontology_version_id: str,
    entity_id: str,
    req: UpdateEntityRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Update entity name, label, category, description, or attributes.**"""
    return ontology_service.update_entity(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        entity_id=entity_id,
        name=req.name,
        label=req.label,
        description=req.description,
        category=req.category,
        attributes=req.attributes,
    )


@router.delete(
    "/ontologies/{ontology_version_id}/entities/{entity_id}",
    response_model=Dict[str, Any],
    summary="Delete Entity from Ontology",
    response_description="Deletion confirmation status",
)
def delete_entity(
    ontology_version_id: str,
    entity_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Delete an entity from the ontology** (also deletes dependent relationships)."""
    ontology_service.delete_entity(auth.tenant_id, ontology_version_id, entity_id)
    return {"status": "DELETED", "entity_id": entity_id}


# =================================================================
# Relationship CRUD
# =================================================================
@router.post(
    "/ontologies/{ontology_version_id}/relationships",
    response_model=OntologyRelationship,
    status_code=201,
    summary="Add Relationship between Entities",
    response_description="Created ontological relationship",
)
def add_relationship(
    ontology_version_id: str,
    req: CreateRelationshipRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Add an ontological relationship connecting two entities** with cardinality and relationship type."""
    return ontology_service.add_relationship(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        name=req.name,
        label=req.label,
        source_entity_id=req.source_entity_id,
        target_entity_id=req.target_entity_id,
        relation_type=req.relation_type,
        cardinality=req.cardinality,
        description=req.description,
        is_bidirectional=req.is_bidirectional,
    )


@router.put(
    "/ontologies/{ontology_version_id}/relationships/{relationship_id}",
    response_model=OntologyRelationship,
    summary="Update Relationship",
    response_description="Updated relationship",
)
def update_relationship(
    ontology_version_id: str,
    relationship_id: str,
    req: UpdateRelationshipRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Update relationship properties, cardinality, or description.**"""
    return ontology_service.update_relationship(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        relationship_id=relationship_id,
        name=req.name,
        label=req.label,
        relation_type=req.relation_type,
        cardinality=req.cardinality,
        description=req.description,
        is_bidirectional=req.is_bidirectional,
    )


@router.delete(
    "/ontologies/{ontology_version_id}/relationships/{relationship_id}",
    response_model=Dict[str, Any],
    summary="Delete Relationship",
    response_description="Deletion confirmation status",
)
def delete_relationship(
    ontology_version_id: str,
    relationship_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Delete a relationship from the ontology.**"""
    ontology_service.delete_relationship(auth.tenant_id, ontology_version_id, relationship_id)
    return {"status": "DELETED", "relationship_id": relationship_id}


# =================================================================
# LangGraph + Groq Agent Builder
# =================================================================
@router.post(
    "/ontologies/agent/generate",
    response_model=Dict[str, Any],
    summary="Build Ontology with LangGraph + Groq Agent",
    response_description="Synthesized ontology model with reasoning trail and entity/relationship graphs",
)
def agent_generate_ontology(
    req: AgentGenerateOntologyRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Synthesize a complete enterprise business ontology using the LangGraph + Groq autonomous agent.**"""
    return ontology_agent_service.run_agent(
        tenant_id=auth.tenant_id,
        project_id=req.project_id,
        prompt=req.prompt,
        ontology_name=req.ontology_name,
        domain=req.domain,
        target_ontology_id=req.target_ontology_id,
        model=req.model,
        chat_history=req.chat_history,
        mode=req.mode or "action",
    )


@router.post(
    "/ontologies/agent/apply-plan",
    response_model=Dict[str, Any],
    summary="Approve and Apply Architecture Plan to Graph",
    response_description="Compiled ontology model materialized onto active graph and persisted to database",
)
def agent_apply_plan(
    req: AgentApplyPlanRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Approve and apply an architectural plan formulated by the AI Copilot.**"""
    return ontology_agent_service.apply_plan(
        tenant_id=auth.tenant_id,
        project_id=req.project_id,
        plan_data=req.plan_data,
        target_ontology_id=req.target_ontology_id,
    )


@router.post(
    "/ontologies/agent/summarize",
    response_model=Dict[str, Any],
    summary="Summarize Multi-turn Chat for Context Window Compression",
    description="Compresses multi-turn conversation into structured architectural summary.",
)
def agent_summarize_chat(
    req: AgentSummarizeChatRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    summary = ontology_agent_service.summarize_chat(
        chat_history=req.chat_history,
        model_override=req.model,
    )
    return {"summary": summary, "status": "SUCCESS"}


# =================================================================
# Semantic concepts & bindings
# =================================================================
@router.post(
    "/ontologies/{ontology_version_id}/concepts",
    response_model=Concept,
    status_code=201,
    summary="Add Business Concept to Ontology",
    response_description="Created business semantic concept with aliases and expected types",
)
def add_concept(
    ontology_version_id: str,
    label: str = Query(..., description="Human-readable concept name"),
    definition: str = Query(..., description="Formal semantic definition of the concept"),
    concept_type: str = Query(default="Attribute", description="Entity, Attribute, or Identifier"),
    datatype_expectation: str = Query(default="string", description="Expected canonical datatype"),
    aliases: Optional[List[str]] = Query(default=None, description="Synonyms and alternative labels"),
    auth: AuthContext = Depends(get_auth_context),
):
    """**Add a business semantic concept to an active draft ontology version** (PRD Section 9)."""
    return ontology_service.add_concept(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        label=label,
        definition=definition,
        concept_type=concept_type,
        datatype_expectation=datatype_expectation,
        aliases=aliases,
    )


@router.post(
    "/ontologies/{ontology_version_id}/bind",
    response_model=SemanticBinding,
    status_code=201,
    summary="Bind Concept to Physical Attribute",
    response_description="Semantic binding linking a business concept to a physical column",
)
def bind_concept(
    ontology_version_id: str,
    concept_id: str = Query(..., description="Target business concept ID"),
    physical_object_id: str = Query(..., description="Physical field or dataset identifier"),
    confidence: float = Query(default=1.0, ge=0.0, le=1.0, description="Confidence of the association"),
    auth: AuthContext = Depends(get_auth_context),
):
    """**Create a SemanticBinding linking a business concept to a physical column** (PRD Section 9)."""
    return ontology_service.bind_concept(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        concept_id=concept_id,
        physical_object_id=physical_object_id,
        confidence=confidence,
    )


@router.get(
    "/ontologies/{ontology_version_id}/impact/{concept_id}",
    response_model=Dict[str, Any],
    summary="Perform Dependency Impact Analysis",
    response_description="Graph traversal showing affected bindings, mappings, rules, and manifests",
)
def get_concept_impact(
    ontology_version_id: str,
    concept_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """**Perform graph-based dependency impact analysis before promoting changes** (PRD Section 9)."""
    return ontology_service.perform_impact_analysis(
        tenant_id=auth.tenant_id,
        ontology_version_id=ontology_version_id,
        concept_id=concept_id,
    )


# =================================================================
# Ontology RAG — Ingestion (text)
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
# Ontology RAG — File Upload (multipart)
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
    import json as _json

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    MAX_BYTES = 20 * 1024 * 1024
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data)} bytes). Maximum is 20 MB.",
        )

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
# Ontology RAG — List Documents
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
# Ontology RAG — Delete Document
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
# Ontology RAG — Query
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