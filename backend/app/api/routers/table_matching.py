"""
Table Pair Matching Agent API.

Endpoints:
  POST   /table-pairs/propose              — propose pairs (persists as DRAFT)
  GET    /table-pairs                       — list all sets
  GET    /table-pairs/{set_id}              — single set
  PUT    /table-pairs/{set_id}              — direct-save pair edits (no approval gate)
  DELETE /table-pairs/{set_id}              — delete a draft
  POST   /table-pairs/{set_id}/review       — legacy (unused by UI)
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.agents.table_matching_agent.service import (
    table_matching_agent_service,
)
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.db.store import store

router = APIRouter()


# ─────────────────────────────────────────────────────────────
# Request bodies
# ─────────────────────────────────────────────────────────────
class ProposePairsRequest(BaseModel):
    source_system_id: str
    target_system_id: str
    name: Optional[str] = None
    version_tag: str = "1.0.0"
    ontology_version_id: Optional[str] = None
    custom_instructions: Optional[str] = None
    use_ai: bool = True
    model_name: Optional[str] = "openai/gpt-oss-120b"
    api_keys: Optional[List[str]] = None
    min_confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class SavePairsRequest(BaseModel):
    pairs: List[Dict[str, Any]] = Field(default_factory=list)
    name: Optional[str] = None
    version_tag: Optional[str] = None


class TableDecisionItem(BaseModel):
    source_table: str
    target_table: str
    decision: str = Field(default="APPROVED")
    override_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    override_requires_masking: Optional[bool] = None
    override_rationale: Optional[str] = None


class SubmitTableReviewRequest(BaseModel):
    decisions: List[TableDecisionItem] = Field(default_factory=list)
    actor: str = "lead-architect@company.com"
    comments: Optional[str] = "Approved after table review."


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────
@router.post(
    "/mapping-sets/{project_id}/table-pairs/propose",
    status_code=201,
    summary="Propose table pairs",
)
def propose_table_pairs(
    project_id: str,
    req: ProposePairsRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return table_matching_agent_service.propose_pairs(
            tenant_id=auth.tenant_id,
            project_id=project_id,
            source_system_id=req.source_system_id,
            target_system_id=req.target_system_id,
            name=req.name,
            version_tag=req.version_tag,
            ontology_version_id=req.ontology_version_id,
            custom_instructions=req.custom_instructions,
            use_ai=req.use_ai,
            model_name=req.model_name or "openai/gpt-oss-120b",
            api_keys=req.api_keys,
            min_confidence=req.min_confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/mapping-sets/{project_id}/table-pairs",
    response_model=List[Dict[str, Any]],
    summary="List table mapping sets for a project",
)
def list_table_pairs(
    project_id: str,
    source_system_id: Optional[str] = Query(default=None),
    target_system_id: Optional[str] = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
):
    sets = store.list_table_mapping_sets(
        auth.tenant_id,
        project_id=project_id,
        source_system_id=source_system_id,
        target_system_id=target_system_id,
    )
    return [s.model_dump(mode="json") for s in sets]


@router.get(
    "/mapping-sets/{project_id}/table-pairs/{set_id}",
    response_model=Dict[str, Any],
    summary="Get a single table mapping set",
)
def get_table_pairs(
    project_id: str,
    set_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    tms = store.get_table_mapping_set(auth.tenant_id, set_id)
    if not tms:
        raise HTTPException(
            status_code=404, detail="Table mapping set not found"
        )
    return tms.model_dump(mode="json")


@router.put(
    "/mapping-sets/{project_id}/table-pairs/{set_id}",
    response_model=Dict[str, Any],
    summary="Save pair list directly (no approval gate)",
)
def save_table_pairs(
    project_id: str,
    set_id: str,
    req: SavePairsRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return table_matching_agent_service.save_pairs(
            tenant_id=auth.tenant_id,
            project_id=project_id,
            table_mapping_set_id=set_id,
            pairs=req.pairs,
            name=req.name,
            version_tag=req.version_tag,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/mapping-sets/{project_id}/table-pairs/{set_id}/review",
    response_model=Dict[str, Any],
    summary="Legacy: submit review decisions (unused by UI)",
    deprecated=True,
)
def submit_table_review(
    project_id: str,
    set_id: str,
    req: SubmitTableReviewRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        decisions_dicts = [d.model_dump() for d in req.decisions]
        return table_matching_agent_service.submit_review(
            tenant_id=auth.tenant_id,
            project_id=project_id,
            table_mapping_set_id=set_id,
            decisions=decisions_dicts,
            actor=req.actor,
            comments=req.comments,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/mapping-sets/{project_id}/table-pairs/{set_id}",
    response_model=Dict[str, Any],
    summary="Delete a table mapping set",
)
def delete_table_pairs(
    project_id: str,
    set_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    tms = store.get_table_mapping_set(auth.tenant_id, set_id)
    if not tms:
        raise HTTPException(
            status_code=404, detail="Table mapping set not found"
        )
    try:
        from app.db.mongo import mongo_manager

        with store._lock:
            store._table_mapping_sets.get(auth.tenant_id, {}).pop(
                set_id, None
            )
            mongo_manager.delete_one(
                "table_mappings",
                {"tenant_id": auth.tenant_id, "table_mapping_set_id": set_id},
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "DELETED", "table_mapping_set_id": set_id}