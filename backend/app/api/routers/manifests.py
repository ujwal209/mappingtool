"""
Manifests and Version Pinning API.
Fulfills Section 5, Section 14, and TA-001 (Version Pinning) with detailed OpenAPI documentation.
"""

from fastapi import APIRouter, Depends, Header
from typing import Optional
from app.models.canonical import RunManifest
from app.models.schemas import CreateManifestRequest
from app.services.orchestrator_service import orchestrator_service
from app.db.store import store
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.api.middleware.idempotency import idempotency_manager
from app.core.errors import PlatformException, ErrorCategory

router = APIRouter()


@router.post(
    "/waves/{wave_id}/manifests",
    response_model=RunManifest,
    status_code=201,
    summary="Create Immutable Run Manifest (Version Pinning)",
    response_description="Created RunManifest with pinned artifact versions and locked manifest_hash",
)
def create_wave_manifest(
    wave_id: str,
    req: CreateManifestRequest,
    auth: AuthContext = Depends(get_auth_context),
    idempotency_key: Optional[str] = Header(
        default=None,
        alias="Idempotency-Key",
        description="Optional client UUID for idempotent manifest creation.",
    ),
):
    """
    **Create an immutable Run Manifest from approved artifacts** (PRD Section 5, 14, & TA-001).

    ### Version Pinning Principle (TA-001):
    - Binds exact versions of:
      - `ontology_version_id`
      - `mapping_version_id`
      - `rule_package_id`
      - `source_dataset_id`
      - `target_dataset_id`
      - Connector versions
    - Production execution depends solely on this manifest, never on 'latest'.
    - Computes and stores the immutable SHA-256 `manifest_hash` prior to execution.
    - Persisted to MongoDB collection `manifests` in database `mapping`.
    """
    if idempotency_key:
        cached = idempotency_manager.check_or_store(auth.tenant_id, idempotency_key, req.model_dump())
        if cached:
            return cached[1]

    manifest = orchestrator_service.create_run_manifest(
        tenant_id=auth.tenant_id,
        wave_id=wave_id,
        project_id=req.project_id,
        ontology_version_id=req.ontology_version_id,
        mapping_version_id=req.mapping_version_id,
        rule_package_id=req.rule_package_id,
        source_dataset_id=req.source_dataset_id,
        target_dataset_id=req.target_dataset_id,
        policy_waivers=req.policy_waivers,
    )

    if idempotency_key:
        idempotency_manager.record_response(auth.tenant_id, idempotency_key, req.model_dump(), 201, manifest)

    return manifest


@router.get(
    "/manifests/{manifest_id}",
    response_model=RunManifest,
    summary="Get Run Manifest Details",
    response_description="RunManifest specifying pinned artifact versions and cryptographic manifest hash",
)
def get_manifest(manifest_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve details for a specific immutable run manifest.**
    """
    man = store.get_manifest(auth.tenant_id, manifest_id)
    if not man:
        raise PlatformException(code="MANIFEST_NOT_FOUND", message="Manifest not found", status_code=404)
    return man
