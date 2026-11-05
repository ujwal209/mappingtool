"""
Datasets, Profiling, and Drift Detection API.
Fulfills Section 5, Section 19, and TA-005 (Schema Drift Detection).
"""

from fastapi import APIRouter, Depends, Query
from typing import List, Optional, Dict, Any
from app.models.canonical import Dataset, FieldDefinition, ProfileSnapshot
from app.models.schemas import ProfileRunRequest, ProfileRunResponse, DriftAnalysisResponse
from app.services.metadata_service import metadata_service
from app.services.discovery_service import discovery_service
from app.db.store import store
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.core.errors import PlatformException, ErrorCategory

from app.models.schemas import (
    ProfileRunRequest,
    ProfileRunResponse,
    DriftAnalysisResponse,
    DatasetDirectCreateRequest,
)

router = APIRouter()


@router.post(
    "/datasets",
    response_model=Dataset,
    status_code=201,
    summary="Register Dataset and Schema",
    response_description="Created dataset catalog resource with physical field definitions",
)
def create_dataset(
    req: Optional[DatasetDirectCreateRequest] = None,
    system_id: Optional[str] = Query(default=None, description="Logical System ID hosting this physical dataset"),
    physical_name: Optional[str] = Query(default=None, description="Physical table, file, or object name"),
    namespace: Optional[str] = Query(default="default", description="Namespace, schema, or container name"),
    fields: Optional[List[FieldDefinition]] = None,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Register a physical dataset and its schema definition** (PRD Section 4 & 5).
    Accepts JSON body or query parameters.
    """
    target_system_id = (req.system_id if req else None) or system_id
    target_name = (req.name if req else None) or physical_name
    target_ns = (req.namespace if req else None) or namespace or "default"

    if not target_system_id or not target_name:
        raise PlatformException(
            code="INVALID_ARGUMENTS",
            message="Both system_id and physical_name (or name) are required to register a dataset",
            status_code=400,
        )

    field_defs: List[FieldDefinition] = []
    if req and req.fields:
        for idx, f in enumerate(req.fields):
            field_defs.append(
                FieldDefinition(
                    dataset_id="",
                    name=f.get("name", f"col_{idx}"),
                    datatype=f.get("datatype", "string"),
                    nullable=f.get("nullable", True),
                    ordinal=idx,
                    description=f.get("description"),
                )
            )
    elif fields:
        field_defs = fields

    return metadata_service.register_dataset(
        tenant_id=auth.tenant_id,
        system_id=target_system_id,
        physical_name=target_name,
        namespace=target_ns,
        fields=field_defs,
    )


@router.get(
    "/datasets",
    response_model=List[Dataset],
    summary="List Registered Datasets",
    response_description="List of datasets within tenant, optionally filtered by system",
)
def list_datasets(
    system_id: Optional[str] = Query(default=None, description="Optional system filter"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Retrieve all registered datasets** for the authenticated tenant.
    """
    return store.list_datasets(auth.tenant_id, system_id=system_id)


@router.get(
    "/datasets/{dataset_id}",
    response_model=Dataset,
    summary="Get Dataset Details",
    response_description="Dataset metadata and list of physical field definitions",
)
def get_dataset(dataset_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve full details and field specifications for a given dataset.**
    """
    ds = store.get_dataset(auth.tenant_id, dataset_id)
    if not ds:
        raise PlatformException(code="DATASET_NOT_FOUND", message="Dataset not found", status_code=404)
    return ds


@router.post(
    "/datasets/{dataset_id}/profile-runs",
    response_model=ProfileSnapshot,
    status_code=201,
    summary="Execute Dataset Profiling Snapshot",
    response_description="Immutable statistical profiling snapshot with column metrics and scope hash",
)
def start_profile_run(
    dataset_id: str,
    req: ProfileRunRequest,
    records: Optional[List[Dict[str, Any]]] = None,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Execute statistical profiling over dataset partitions** (PRD Section 5 & 19).

    ### Profiling Metrics Computed:
    - Row count and column count.
    - Null counts and null percentages per column.
    - Cardinality (distinct / unique value counts).
    - Statistical sample values (DLP-sanitized).
    - Inferred data types (numeric, string, datetime, boolean).
    - Cryptographic `scope_hash` for baseline drift comparison.
    """
    ds = store.get_dataset(auth.tenant_id, dataset_id)
    if not ds:
        raise PlatformException(code="DATASET_NOT_FOUND", message="Dataset not found", status_code=404)

    sample_records = records
    if not sample_records:
        sample_records = [
            {f.name: f"Sample_{f.name}_{i}" for f in ds.fields}
            for i in range(10)
        ]

    return discovery_service.profile_records(
        tenant_id=auth.tenant_id,
        dataset_id=dataset_id,
        records=sample_records,
        sample_size=req.sample_size,
    )


@router.get(
    "/profile-runs/{profile_id}",
    response_model=ProfileSnapshot,
    summary="Get Profiling Snapshot Results",
    response_description="Immutable profiling snapshot with column-level metrics",
)
def get_profile_run(profile_id: str, auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve results of an immutable profiling snapshot.**
    """
    p = store.get_profile(auth.tenant_id, profile_id)
    if not p:
        raise PlatformException(code="PROFILE_NOT_FOUND", message="Profile not found", status_code=404)
    return p


@router.get(
    "/datasets/{dataset_id}/profile",
    response_model=Optional[ProfileSnapshot],
    summary="Get Latest Dataset Profile",
    response_description="Most recent immutable statistical profiling snapshot for dataset",
)
def get_latest_dataset_profile(dataset_id: str, auth: AuthContext = Depends(get_auth_context)):
    """Retrieve the latest profile snapshot for a dataset."""
    tenant_profiles = store._profiles.get(auth.tenant_id, {})
    matching = [p for p in tenant_profiles.values() if p.dataset_id == dataset_id]
    if not matching:
        return None
    return sorted(matching, key=lambda x: x.sampled_at, reverse=True)[0]


@router.post(
    "/datasets/{dataset_id}/profile",
    response_model=ProfileSnapshot,
    summary="Profile Records Directly",
)
def profile_dataset_records(
    dataset_id: str,
    payload: Dict[str, Any],
    auth: AuthContext = Depends(get_auth_context),
):
    """Profile records provided in the request body."""
    ds = store.get_dataset(auth.tenant_id, dataset_id)
    if not ds:
        raise PlatformException(code="DATASET_NOT_FOUND", message="Dataset not found", status_code=404)
    records = payload.get("records") or []
    if not records:
        records = [{f.name: f"Sample_{f.name}_{i}" for f in ds.fields} for i in range(10)]
    return discovery_service.profile_records(
        tenant_id=auth.tenant_id,
        dataset_id=dataset_id,
        records=records,
        sample_size=len(records),
    )


@router.get(
    "/datasets/{dataset_id}/drift",
    response_model=DriftAnalysisResponse,
    summary="Detect Schema Drift Between Baseline and Current Profiles",
    response_description="Drift analysis showing added columns, removed columns, and blocking drift status",
)
def detect_drift(
    dataset_id: str,
    baseline_profile_id: str = Query(..., description="Profile ID representing approved rehearsal baseline"),
    current_profile_id: str = Query(..., description="Profile ID representing current/incoming state"),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **Detect and classify schema drift between baseline and current profiles** (PRD Section 5 & TA-005).

    ### Governance Gate (TA-005):
    - Identifies added columns, deleted columns, and data type incompatibilities.
    - If columns were removed or types became incompatible, `is_blocking: true` is raised.
    - A blocking drift condition prevents production runs from executing unless an authorized policy waiver is attached to the Run Manifest.
    """
    return metadata_service.detect_schema_drift(
        tenant_id=auth.tenant_id,
        dataset_id=dataset_id,
        baseline_profile_id=baseline_profile_id,
        current_profile_id=current_profile_id,
    )
