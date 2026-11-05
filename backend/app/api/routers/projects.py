"""
Project, System, and Wave Endpoints.
Fulfills Section 5 of the PRD with detailed OpenAPI documentation.
"""

from fastapi import APIRouter, Depends, Header, Query
from typing import List, Optional
from app.models.schemas import ProjectCreateRequest, SystemRegisterRequest, CreateWaveRequest
from app.models.canonical import Project, System, SystemKind, Wave
from app.services.project_service import project_service
from app.services.metadata_service import metadata_service
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.api.middleware.idempotency import idempotency_manager

router = APIRouter()


@router.post(
    "/projects",
    response_model=Project,
    status_code=201,
    summary="Create Migration Project",
    response_description="Created migration project with auto-provisioned DEV, TEST, and PROD environments",
)
def create_project(
    req: ProjectCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    idempotency_key: Optional[str] = Header(
        default=None,
        alias="Idempotency-Key",
        description="Optional client-generated UUID for exactly-once mutation semantics.",
    ),
):
    """
    **Create a new top-level migration project** (PRD Section 4 & 5).

    ### Workflow Details:
    1. Validates multi-tenant boundaries (`X-Tenant-Id`).
    2. Initializes project container with lifecycle state `ACTIVE`.
    3. Automatically provisions default environments (`DEV`, `TEST`, `PROD`).
    4. Persists the record to MongoDB collection `projects` (database: `mapping`).
    5. Returns the fully hydrated project model.

    ### Idempotency:
    - If `Idempotency-Key` is supplied and reused with the same payload, the original response is returned.
    - If reused with a different payload, HTTP 409 Conflict is raised.
    """
    if idempotency_key:
        cached = idempotency_manager.check_or_store(auth.tenant_id, idempotency_key, req.model_dump())
        if cached:
            return cached[1]

    proj = project_service.create_project(
        tenant_id=auth.tenant_id,
        name=req.name,
        description=req.description,
        owners=req.owners,
        domain=req.domain,
        methodology=req.methodology,
        source_ecosystem=req.source_ecosystem,
        target_ecosystem=req.target_ecosystem,
        estimated_volume=req.estimated_volume,
        target_cutover_date=req.target_cutover_date,
        compliance_framework=req.compliance_framework,
        data_classification=req.data_classification,
        planned_waves=req.planned_waves,
        rehearsal_strategy=req.rehearsal_strategy,
    )

    if idempotency_key:
        idempotency_manager.record_response(auth.tenant_id, idempotency_key, req.model_dump(), 201, proj)

    return proj


@router.get(
    "/projects",
    response_model=List[Project],
    summary="List Migration Projects",
    response_description="List of all active and archived projects within the caller's tenant boundary",
)
def list_projects(auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve all migration projects** belonging to the authenticated tenant.
    Enforces strict tenant isolation boundary (TA-009).
    """
    return project_service.list_projects(auth.tenant_id)


@router.post(
    "/projects/{project_id}/systems",
    response_model=System,
    status_code=201,
    summary="Register Source or Target System",
    response_description="Registered logical system with assigned connector plugin type",
)
def register_system(
    project_id: str,
    req: SystemRegisterRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Register a logical source or target system for a project** (PRD Section 5).

    ### Supported System Kinds:
    - `SOURCE`: Legacy databases, CRM feeds, or cloud data stores.
    - `TARGET`: Destination systems (e.g. Microsoft Fabric OneLake, Dynamics 365 Dataverse, ERP databases).
    - `INTERMEDIATE`: Staging zones and data lakes.

    ### Pluggable Connectors:
    - `fabric` / `microsoft_fabric`: Microsoft Fabric OneLake Lakehouses & Delta tables.
    - `d365` / `dynamics_365`: Dynamics 365 CRM & Microsoft Dataverse.
    - `relational`: PostgreSQL, MySQL, Oracle, SQL Server.
    - `file`: S3, Azure Blob, CSV, Excel.
    - `memory`: High-speed in-memory simulation connector.
    """
    kind_enum = getattr(SystemKind, req.kind.upper(), SystemKind.SOURCE)
    return metadata_service.register_system(
        tenant_id=auth.tenant_id,
        project_id=project_id,
        name=req.name,
        kind=kind_enum,
        connector_type=req.connector_type,
        classification=req.classification,
    )


@router.get(
    "/projects/{project_id}/systems",
    response_model=List[System],
    summary="List Registered Systems for Project",
    response_description="List of source and target systems registered under the specified project",
)
def list_systems(project_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **List all source and target systems** associated with a specific migration project.
    """
    from app.db.store import store
    return store.list_systems(auth.tenant_id, project_id=project_id)


@router.post(
    "/waves",
    response_model=Wave,
    status_code=201,
    summary="Create Governed Delivery Wave",
    response_description="Created wave binding migration delivery scope, partitions, and dependencies",
)
def create_wave(
    req: CreateWaveRequest,
    project_id: str = Query(..., description="Project ID under which this wave is created"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Define a governed migration wave** (PRD Section 4 & 5).

    A wave represents a discrete delivery release unit (e.g., 'Wave 1: Enterprise Accounts', 'Wave 2: Historical Orders').
    Contains the dataset scope definitions, dependencies, and rollout criteria.
    """
    return project_service.create_wave(
        tenant_id=auth.tenant_id,
        project_id=project_id,
        name=req.name,
        scope_definition=req.scope_definition,
        dependencies=req.dependencies,
    )


@router.get(
    "/waves/{wave_id}",
    response_model=Wave,
    summary="Get Delivery Wave Details",
    response_description="Wave metadata and scope definition",
)
def get_wave(wave_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve details for a specific migration wave.**
    """
    return project_service.get_wave(auth.tenant_id, wave_id)
