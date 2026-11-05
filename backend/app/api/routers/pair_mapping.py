"""HTTP surface — thin wrapper over pair_mapping_service."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.middleware.auth_rbac import AuthContext, get_auth_context
from app.models.pair_mapping import (
    CreateSetFromTableSetRequest,
    FinalizeSetRequest,
    PairMappingSet,
    ReviewPairRequest,
    RunAIAllRequest,
    RunAIPairRequest,
    SetStatus
)
from app.services.pair_mapping_service import pair_mapping_service

router = APIRouter(tags=["Pair Mapping"])


@router.post(
    "/pair-mapping-sets",
    response_model=PairMappingSet,
    status_code=201,
    summary="Create a pair mapping set from a table-mapping set",
)
def create_set(
    req: CreateSetFromTableSetRequest,
    project_id: str = Query(...),
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return pair_mapping_service.create_draft_from_table_set(
            tenant_id=auth.tenant_id,
            project_id=project_id,
            table_mapping_set_id=req.table_mapping_set_id,
            ontology_version_id=req.ontology_version_id,
            name=req.name,
            version_tag=req.version_tag,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/pair-mapping-sets",
    response_model=List[PairMappingSet],
    summary="List pair mapping sets",
)
def list_sets(
    project_id: str = Query(...),
    table_mapping_set_id: str = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
):
    return pair_mapping_service.list_sets(
        tenant_id=auth.tenant_id,
        project_id=project_id,
        table_mapping_set_id=table_mapping_set_id,
    )


@router.get(
    "/pair-mapping-sets/{set_id}",
    response_model=PairMappingSet,
    summary="Get a pair mapping set",
)
def get_set(set_id: str, auth: AuthContext = Depends(get_auth_context)):
    s = pair_mapping_service.get_set(auth.tenant_id, set_id)
    if not s:
        raise HTTPException(status_code=404, detail="Pair mapping set not found")
    return s


@router.delete(
    "/pair-mapping-sets/{set_id}",
    summary="Delete a pair mapping set",
)
def delete_set(set_id: str, auth: AuthContext = Depends(get_auth_context)):
    ok = pair_mapping_service.delete_set(auth.tenant_id, set_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Pair mapping set not found")
    return {"status": "DELETED", "set_id": set_id}


@router.post(
    "/pair-mapping-sets/{set_id}/pairs/{pair_id}/run-ai",
    response_model=PairMappingSet,
    summary="Run AI on one pair",
)
def run_ai_on_pair(
    set_id: str,
    pair_id: str,
    req: RunAIPairRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return pair_mapping_service.run_ai_on_pair(
            tenant_id=auth.tenant_id,
            set_id=set_id,
            pair_id=pair_id,
            use_ai=req.use_ai,
            model_name=req.model_name,
            api_keys=req.api_keys,
            ontology_version_id=req.ontology_version_id,
            custom_instructions=req.custom_instructions,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/pair-mapping-sets/{set_id}/run-ai-all",
    response_model=PairMappingSet,
    summary="Run AI on every pair in the set",
)
def run_ai_on_all(
    set_id: str,
    req: RunAIAllRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return pair_mapping_service.run_ai_on_all_pairs(
            tenant_id=auth.tenant_id,
            set_id=set_id,
            use_ai=req.use_ai,
            model_name=req.model_name,
            api_keys=req.api_keys,
            ontology_version_id=req.ontology_version_id,
        )
    except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/pair-mapping-sets/{set_id}/pairs/{pair_id}/review",
    response_model=PairMappingSet,
    summary="Apply reviewer adjustments to one pair",
)
def review_pair(
    set_id: str,
    pair_id: str,
    req: ReviewPairRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return pair_mapping_service.apply_review_to_pair(
            tenant_id=auth.tenant_id,
            set_id=set_id,
            pair_id=pair_id,
            adjustments=[a.model_dump() for a in req.adjustments],
            actor=req.actor,
            comments=req.comments,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/pair-mapping-sets/{set_id}/finalize",
    response_model=PairMappingSet,
    summary="Approve & freeze the whole set",
)
def finalize_set(
    set_id: str,
    req: FinalizeSetRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return pair_mapping_service.finalize_set(
            tenant_id=auth.tenant_id,
            set_id=set_id,
            actor=req.actor,
            comments=req.comments,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put(
    "/pair-mapping-sets/{set_id}",
    response_model=PairMappingSet,
    summary="Save set metadata (name, version, per-pair rationale/masking)",
)
def update_set_metadata(
    set_id: str,
    body: dict,
    auth: AuthContext = Depends(get_auth_context),
):
    try:
        return pair_mapping_service.save_set_metadata(
            tenant_id=auth.tenant_id,
            set_id=set_id,
            name=body.get("name"),
            version_tag=body.get("version_tag"),
            pair_metadata=body.get("pairs"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))