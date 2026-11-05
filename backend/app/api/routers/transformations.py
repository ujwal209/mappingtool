"""
Transformations API.

Exposes the catalog, custom-transform CRUD, and a compile-test endpoint.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.middleware.auth_rbac import AuthContext, get_auth_context
from app.models.transformations import (
    TransformCategory,
    TransformKind,
    TransformParam,
    Transformation,
)
from app.services.transforms.catalog_service import transform_catalog_service
from app.services.transforms.dsl_compiler import (
    run_custom_dsl,
    validate_dsl_expression,
)
from app.services.transforms.executor import (
    execute_transform,
    is_registered,
    list_registered_ops,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────
# Request bodies
# ─────────────────────────────────────────────────────────────
class CreateTransformRequest(BaseModel):
    key: str = Field(
        ...,
        description="Machine identifier, e.g. 'clean_phone'",
        min_length=2,
        max_length=64,
    )
    label: str = Field(..., min_length=1, max_length=128)
    description: str = ""
    category: TransformCategory = TransformCategory.CUSTOM
    dsl_expression: str = Field(
        ...,
        description="DSL expression, e.g. \"replace(source[0], '-', '')\"",
    )
    params: List[TransformParam] = Field(default_factory=list)
    arity_min: int = Field(default=1, ge=0, le=20)
    arity_max: int = Field(default=1, ge=0, le=20)
    example: Optional[str] = None


class UpdateTransformRequest(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    dsl_expression: Optional[str] = None
    params: Optional[List[TransformParam]] = None
    is_active: Optional[bool] = None


class TestTransformRequest(BaseModel):
    """Preview a transform against sample values before saving."""
    dsl_expression: str
    source_values: List[Any] = Field(default_factory=list)


class ExecuteTransformRequest(BaseModel):
    """Execute a builtin or custom transform for a dry-run preview."""
    op: str
    source_values: List[Any] = Field(default_factory=list)
    params: Dict[str, Any] = Field(default_factory=dict)


# ─────────────────────────────────────────────────────────────
# Catalog listing
# ─────────────────────────────────────────────────────────────
@router.get(
    "/transformations",
    response_model=List[Transformation],
    summary="List transformation catalog",
)
def list_transformations(
    category: Optional[TransformCategory] = Query(default=None),
    kind: Optional[TransformKind] = Query(default=None),
    search: Optional[str] = Query(default=None),
    include_inactive: bool = Query(default=False),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Return every built-in + custom transform available to this tenant.

    Filter by `category`, `kind`, or free-text `search`. Sorted by
    category then key.
    """
    return transform_catalog_service.list_transforms(
        tenant_id=auth.tenant_id,
        category=category,
        kind=kind,
        search=search,
        include_inactive=include_inactive,
    )


@router.get(
    "/transformations/categories",
    response_model=List[Dict[str, Any]],
    summary="List transform categories with counts",
)
def list_categories(auth: AuthContext = Depends(get_auth_context)):
    """Return the list of categories with how many built-ins each has."""
    return transform_catalog_service.list_categories()


@router.get(
    "/transformations/{transform_id}",
    response_model=Transformation,
    summary="Get one transformation",
)
def get_transformation(
    transform_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    tx = transform_catalog_service.get_by_id(auth.tenant_id, transform_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transform not found")
    return tx


@router.get(
    "/transformations/by-key/{key}",
    response_model=Transformation,
    summary="Get a transformation by stable key",
)
def get_by_key(
    key: str,
    auth: AuthContext = Depends(get_auth_context),
):
    tx = transform_catalog_service.get_by_key(auth.tenant_id, key)
    if not tx:
        raise HTTPException(status_code=404, detail="Transform not found")
    return tx


# ─────────────────────────────────────────────────────────────
# Custom CRUD
# ─────────────────────────────────────────────────────────────
@router.post(
    "/transformations",
    response_model=Transformation,
    status_code=201,
    summary="Create a custom transform",
)
def create_transformation(
    req: CreateTransformRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    return transform_catalog_service.create_custom(
        tenant_id=auth.tenant_id,
        key=req.key,
        label=req.label,
        description=req.description,
        category=req.category,
        dsl_expression=req.dsl_expression,
        params=req.params,
        arity_min=req.arity_min,
        arity_max=req.arity_max,
        example=req.example,
    )


@router.put(
    "/transformations/{transform_id}",
    response_model=Transformation,
    summary="Update a custom transform",
)
def update_transformation(
    transform_id: str,
    req: UpdateTransformRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    return transform_catalog_service.update_custom(
        tenant_id=auth.tenant_id,
        transform_id=transform_id,
        label=req.label,
        description=req.description,
        dsl_expression=req.dsl_expression,
        params=req.params,
        is_active=req.is_active,
    )


@router.delete(
    "/transformations/{transform_id}",
    response_model=Dict[str, Any],
    summary="Delete a custom transform",
)
def delete_transformation(
    transform_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    ok = transform_catalog_service.delete_custom(
        auth.tenant_id, transform_id
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Transform not found")
    return {"status": "DELETED", "transform_id": transform_id}


# ─────────────────────────────────────────────────────────────
# Test / execute
# ─────────────────────────────────────────────────────────────
@router.post(
    "/transformations/test-dsl",
    response_model=Dict[str, Any],
    summary="Test a custom DSL expression against sample values",
)
def test_dsl(
    req: TestTransformRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Compile and run a DSL expression against provided sample source values.

    Returns `{valid, result, error}` — valid=false on compile or runtime
    failure.
    """
    try:
        validate_dsl_expression(req.dsl_expression)
    except ValueError as e:
        return {"valid": False, "error": str(e), "result": None}

    try:
        result = run_custom_dsl(req.dsl_expression, req.source_values)
        return {"valid": True, "result": result, "error": None}
    except Exception as e:
        return {"valid": False, "result": None, "error": str(e)}


@router.post(
    "/transformations/execute",
    response_model=Dict[str, Any],
    summary="Execute a builtin transform for dry-run preview",
)
def execute(
    req: ExecuteTransformRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Run a registered builtin transform against sample values.

    Returns `{valid, results, error}`.
    """
    if not is_registered(req.op):
        # Try custom DSL fallback
        tx = transform_catalog_service.get_by_key(auth.tenant_id, req.op)
        if tx and tx.kind == TransformKind.CUSTOM_DSL and tx.dsl_expression:
            try:
                result = run_custom_dsl(tx.dsl_expression, req.source_values)
                return {"valid": True, "results": [result], "error": None}
            except Exception as e:
                return {"valid": False, "results": None, "error": str(e)}
        return {
            "valid": False,
            "results": None,
            "error": f"Transform '{req.op}' is not registered.",
        }

    try:
        results = execute_transform(req.op, req.source_values, req.params)
        return {"valid": True, "results": results, "error": None}
    except Exception as e:
        return {"valid": False, "results": None, "error": str(e)}


@router.get(
    "/transformations/ops",
    response_model=List[str],
    summary="List all executable transform keys",
)
def list_ops(auth: AuthContext = Depends(get_auth_context)):
    """Every key that has a Python executor (builtin + DSL)."""
    return list_registered_ops()