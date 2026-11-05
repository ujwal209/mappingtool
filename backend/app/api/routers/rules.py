"""
Rule Packages & Transformation Engine API.
Fulfills Section 5 and Section 11 (Transformation Engine) with detailed OpenAPI documentation.
"""

from fastapi import APIRouter, Depends
from app.models.canonical import RulePackageVersion
from app.models.schemas import RulePackageBuildRequest
from app.services.rule_service import rule_service
from app.db.store import store
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.core.errors import PlatformException, ErrorCategory

router = APIRouter()


@router.post(
    "/rule-packages/{mapping_version_id}/build",
    response_model=RulePackageVersion,
    status_code=201,
    summary="Compile and Cryptographically Sign Rule Package",
    response_description="Executable RulePackageVersion with compiled execution plan, validations, and SHA-256 signature",
)
def build_rule_package(
    mapping_version_id: str,
    req: RulePackageBuildRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Compile an approved mapping set into a signed executable rule package** (PRD Section 5 & 11).

    ### Compilation Semantics:
    1. Validates that the referenced mapping version is in `APPROVED` status.
    2. Compiles high-level mappings into pure deterministic functions (`cast`, `trim`, `normalize_text`, `hash`, `mask`, `map_code`).
    3. Attaches multi-level quality validations (Schema, Record, Uniqueness, Referential) and reconciliation controls.
    4. Computes SHA-256 cryptographic signature locking the package specification.
    5. Persists the compiled package to MongoDB collection `rule_packages` in database `mapping`.
    """
    return rule_service.build_rule_package(
        tenant_id=auth.tenant_id,
        mapping_version_id=mapping_version_id,
        semantic_version=req.semantic_version,
    )


@router.get(
    "/rule-packages/{rule_package_id}",
    response_model=RulePackageVersion,
    summary="Get Rule Package Details",
    response_description="RulePackageVersion containing compiled execution plan and cryptographic signature",
)
def get_rule_package(rule_package_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve details and compiled execution plan of a signed rule package.**
    """
    pkg = store.get_rule_package(auth.tenant_id, rule_package_id)
    if not pkg:
        raise PlatformException(code="PACKAGE_NOT_FOUND", message="Rule package not found", status_code=404)
    return pkg
