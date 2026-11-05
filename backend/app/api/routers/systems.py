"""
Endpoints, Pluggable Connectors, and Systems API.
Fulfills Section 5, Section 8, and TA-008 (Zero Secret Leakage).

All discovery / health / read / write operations go through the
connector registry — nothing is hardcoded here anymore.
"""

import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.middleware.auth_rbac import AuthContext, get_auth_context
from app.core.config import settings
from app.core.errors import ErrorCategory, PlatformException
from app.core.security import mask_secret
from app.db.mongo import mongo_manager
from app.db.store import store
from app.models.canonical import (
    Dataset,
    Endpoint,
    FieldDefinition,
    Project,
    System,
    SystemKind,
)
from app.models.schemas import (
    ApiIntakeRequest,
    DirectSystemCreateRequest,
    DirectSystemUpdateRequest,
    DiscoveredTableItem,
    EndpointCreateRequest,
    EndpointTestResponse,
    PreConnectTestRequest,
    PreConnectTestResponse,
    SheetIntakeRequest,
    SystemResponseItem,
)
from app.services.discovery_service import discovery_service
from app.services.metadata_service import metadata_service
from app.sdk.connectors.registry import connector_registry

router = APIRouter()

# -------------------------------------------------------------
# Helpers
# -------------------------------------------------------------
_SECRET_HINTS = ("secret", "key", "token", "password", "pass")

def _mask_config(config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        k: mask_secret(str(v)) if any(h in k.lower() for h in _SECRET_HINTS) else v
        for k, v in (config or {}).items()
    }

def _endpoint_for_system(tenant_id: str, system_id: str) -> Optional[Endpoint]:
    eps = store._endpoints.get(tenant_id, {})
    for ep in eps.values():
        if ep.system_id == system_id:
            return ep
    doc = mongo_manager.find_one(
        "endpoints", {"tenant_id": tenant_id, "system_id": system_id}
    )
    if doc:
        try:
            ep = Endpoint(**doc)
            store._endpoints.setdefault(tenant_id, {})[ep.endpoint_id] = ep
            return ep
        except Exception:
            pass
    return None

def _resolve_connector(tenant_id: str, system: System):
    """
    Build a connector for the given system.
    Rehydrates tables from MongoDB when in-memory storage is empty.
    """
    ep = _endpoint_for_system(tenant_id, system.system_id)
    config = dict(ep.connection_params) if ep else {}
    config["endpoint_id"] = system.system_id

    # Fallbacks for MongoDB connectors
    if system.connector_type.lower() in ("mongodb", "mongo"):
        if not config.get("database") and not config.get("db") and not config.get("db_name"):
            config["database"] = settings.DB_NAME or "mapping"
        if not config.get("uri") and not config.get("connection_string"):
            config["uri"] = settings.resolved_mongo_uri or settings.MONGODB_URI or ""

    return connector_registry.get_connector_with_persisted_data(
        connector_type=system.connector_type,
        endpoint_config=config,
        secret_ref=ep.secret_ref if ep else None,
        tenant_id=tenant_id,
        system_id=system.system_id,
    )

def _persist_rows_for_table(
    tenant_id: str,
    system_id: str,
    table_name: str,
    records: List[Dict[str, Any]],
) -> None:
    try:
        mongo_manager.upsert_document(
            "dataset_rows",
            {
                "tenant_id": tenant_id,
                "system_id": system_id,
                "table_name": table_name,
            },
            {
                "tenant_id": tenant_id,
                "system_id": system_id,
                "table_name": table_name,
                "rows": records[:5000],
                "row_count": len(records),
                "saved_at": time.time(),
            },
        )
    except Exception:
        pass

def _check_name_unique(
    tenant_id: str,
    name: str,
    project_id: Optional[str],
    exclude_system_id: Optional[str] = None,
) -> None:
    cleaned = (name or "").strip()
    if not cleaned:
        raise PlatformException(
            code="INVALID_SYSTEM_NAME",
            message="Connector name cannot be empty.",
            category=ErrorCategory.VALIDATION_FAILED,
            status_code=400,
        )

    existing = store.list_systems(tenant_id, project_id=project_id) or []
    lowered = cleaned.lower()
    for other in existing:
        if exclude_system_id and other.system_id == exclude_system_id:
            continue
        if (other.name or "").strip().lower() == lowered:
            raise PlatformException(
                code="SYSTEM_NAME_ALREADY_EXISTS",
                message=f"A connector named '{cleaned}' already exists. Choose a unique name.",
                category=ErrorCategory.CONFLICT,
                status_code=409,
                details={"name": cleaned, "existing_system_id": other.system_id},
            )

# -------------------------------------------------------------
# Pre-Connect Ping & Discovery (TA-008)
# -------------------------------------------------------------
@router.post(
    "/systems/test-pre-connect",
    response_model=PreConnectTestResponse,
    summary="Ping and Inspect Remote Database Before Connecting",
    response_description="Connection latency, ping status, capabilities, and discovered tables/collections",
)
def test_pre_connect(
    req: PreConnectTestRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    c_type = (req.connector_type or "memory").lower().strip()
    config = dict(req.connection_config or {})
    config.setdefault("endpoint_id", f"preconnect-{auth.tenant_id}-{c_type}")
    connector = connector_registry.get_connector(
        connector_type=c_type,
        endpoint_config=config,
    )
    try:
        health = connector.test_connection()
    except Exception as e:  # noqa: BLE001
        return PreConnectTestResponse(
            status="FAILED",
            latency_ms=0.0,
            message=f"Connector error: {e}",
            capabilities=[],
            discovered_tables=[],
            masked_config=_mask_config(config),
        )

    discovered: List[DiscoveredTableItem] = []
    try:
        tables = connector.list_tables()
    except Exception:  # noqa: BLE001
        tables = []

    SAMPLE_LIMIT = 1000

    for t in tables[:50]:
        name = t.get("name", "table")
        try:
            sample_rows = connector.read_table(name, limit=SAMPLE_LIMIT)
        except Exception:  # noqa: BLE001
            sample_rows = []
        discovered.append(
            DiscoveredTableItem(
                name=name,
                row_count=int(t.get("row_count", 0)),
                column_count=len(t.get("columns", [])),
                columns=[
                    {
                        "name": c.get("name"),
                        "datatype": c.get("datatype"),
                        "is_pk": str(bool(c.get("is_pk"))),
                    }
                    for c in t.get("columns", [])
                ],
                sample_records=sample_rows,
            )
        )

    return PreConnectTestResponse(
        status=health.get("status", "SUCCESS"),
        latency_ms=float(health.get("latency_ms", 0.0)),
        message=health.get("message", f"Connected to {c_type}"),
        capabilities=health.get("capabilities", []),
        discovered_tables=discovered,
        masked_config=_mask_config(config),
    )

# -------------------------------------------------------------
# Systems Catalog & Lifecycle
# -------------------------------------------------------------
@router.get(
    "/systems",
    response_model=List[SystemResponseItem],
    summary="List Registered Enterprise Systems",
    response_description="List of systems with adapter configuration summaries",
)
def list_systems(
    project_id: Optional[str] = Query(
        default=None,
        description="Project ID filter. Connectors are project-scoped.",
    ),
    auth: AuthContext = Depends(get_auth_context),
):
    # Connectors are project-scoped. If the caller omits project_id, fall
    # back to the tenant's first project so we never return another
    # project's connectors. If no project exists at all, return [].
    effective_project_id = project_id
    if not effective_project_id:
        try:
            projects = store.list_projects(auth.tenant_id)
            if projects:
                effective_project_id = projects[0].project_id
        except Exception:
            pass

    if not effective_project_id:
        return []

    systems = store.list_systems(
        auth.tenant_id, project_id=effective_project_id
    )
    out: List[SystemResponseItem] = []
    for s in systems:
        ep = _endpoint_for_system(auth.tenant_id, s.system_id)
        config_summary = _mask_config(ep.connection_params) if ep else {}
        out.append(
            SystemResponseItem(
                system_id=s.system_id,
                project_id=s.project_id,
                name=s.name,
                kind=s.kind.value if hasattr(s.kind, "value") else str(s.kind),
                adapter_type=s.connector_type,
                connector_type=s.connector_type,
                classification=s.classification,
                purpose=getattr(s, "purpose", None),
                environment=getattr(s, "environment", "Production"),
                created_at=s.created_at,
                config_summary=config_summary,
            )
        )
    return out

@router.post(
    "/systems",
    response_model=SystemResponseItem,
    status_code=201,
    summary="Register Enterprise System and Connector Configuration",
    response_description="Newly registered system with assigned connector plugin",
)
def register_system(
    req: DirectSystemCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    project_id = req.project_id
    if not project_id:
        existing_projects = store.list_projects(auth.tenant_id)
        if existing_projects:
            project_id = existing_projects[0].project_id
        else:
            new_proj = Project(
                tenant_id=auth.tenant_id,
                name="Primary Enterprise Migration Project",
                description="Default migration project automatically initialized for tenant",
            )
            store.save_project(auth.tenant_id, new_proj)
            project_id = new_proj.project_id

    _check_name_unique(auth.tenant_id, req.name, project_id)

    connector_type = (req.adapter_type or req.connector_type or "memory").lower().strip()
    kind_str = (req.kind or "SOURCE").upper().strip()
    kind_enum = getattr(SystemKind, kind_str, SystemKind.SOURCE)

    system_obj = System(
        project_id=project_id,
        name=req.name.strip(),
        kind=kind_enum,
        connector_type=connector_type,
        classification=req.classification or "CONFIDENTIAL",
        purpose=req.purpose,
        environment=req.environment or "Production",
    )
    saved_system = store.save_system(auth.tenant_id, system_obj)

    cfg = dict(req.connection_config or {})
    cfg["endpoint_id"] = saved_system.system_id
    ep = Endpoint(
        system_id=saved_system.system_id,
        environment_id=f"env-{system_obj.environment.lower()}",
        name=f"{req.name}-Endpoint",
        connection_params=cfg,
    )
    store.save_endpoint(auth.tenant_id, ep)

    config_summary = _mask_config(cfg)

    if req.initial_tables:
        connector = _resolve_connector(auth.tenant_id, saved_system)
        for tbl in req.initial_tables:
            tbl_name = tbl.get("name", "table_1")
            cols = tbl.get("columns", [])
            records = tbl.get("sample_records", []) or []

            if records:
                try:
                    connector.write_records(tbl_name, records, mode="replace")
                except Exception:
                    pass
                _persist_rows_for_table(
                    auth.tenant_id, saved_system.system_id, tbl_name, records
                )
            else:
                try:
                    if hasattr(connector, "_tables"):
                        connector._tables.setdefault(tbl_name, [])
                except Exception:
                    pass
                _persist_rows_for_table(
                    auth.tenant_id, saved_system.system_id, tbl_name, []
                )

            fields = [
                FieldDefinition(
                    dataset_id="temp",
                    name=c.get("name", f"col_{i}"),
                    datatype=c.get("datatype", "string"),
                    ordinal=i + 1,
                    is_primary_key=bool(c.get("is_pk", i == 0)),
                )
                for i, c in enumerate(cols)
            ]
            try:
                ds = metadata_service.register_dataset(
                    tenant_id=auth.tenant_id,
                    system_id=saved_system.system_id,
                    physical_name=tbl_name,
                    fields=fields,
                )
                if records:
                    try:
                        discovery_service.profile_records(
                            tenant_id=auth.tenant_id,
                            dataset_id=ds.dataset_id,
                            records=records,
                        )
                    except Exception:
                        pass
            except Exception:
                pass

    return SystemResponseItem(
        system_id=saved_system.system_id,
        project_id=saved_system.project_id,
        name=saved_system.name,
        kind=saved_system.kind.value if hasattr(saved_system.kind, "value") else str(saved_system.kind),
        adapter_type=saved_system.connector_type,
        connector_type=saved_system.connector_type,
        classification=saved_system.classification,
        purpose=saved_system.purpose,
        environment=saved_system.environment,
        created_at=saved_system.created_at,
        config_summary=config_summary,
    )

@router.get(
    "/systems/{system_id}",
    response_model=SystemResponseItem,
    summary="Get System Details",
)
def get_system(system_id: str, auth: AuthContext = Depends(get_auth_context)):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )
    ep = _endpoint_for_system(auth.tenant_id, system_id)
    return SystemResponseItem(
        system_id=s.system_id,
        project_id=s.project_id,
        name=s.name,
        kind=s.kind.value if hasattr(s.kind, "value") else str(s.kind),
        adapter_type=s.connector_type,
        connector_type=s.connector_type,
        classification=s.classification,
        purpose=getattr(s, "purpose", None),
        environment=getattr(s, "environment", "Production"),
        created_at=s.created_at,
        config_summary=_mask_config(ep.connection_params) if ep else {},
    )

@router.put(
    "/systems/{system_id}",
    response_model=SystemResponseItem,
    summary="Update System / Connector Configuration",
    response_description="Updated system with merged config and re-pinged table discovery",
)
def update_system(
    system_id: str,
    req: DirectSystemUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    if req.name is not None:
        new_name = req.name.strip()
        if not new_name:
            raise PlatformException(
                code="INVALID_SYSTEM_NAME",
                message="Connector name cannot be empty.",
                category=ErrorCategory.VALIDATION_FAILED,
                status_code=400,
            )
        _check_name_unique(
            auth.tenant_id,
            new_name,
            s.project_id,
            exclude_system_id=s.system_id,
        )

    if req.name is not None:
        s.name = req.name.strip()
    if req.kind is not None:
        kind_enum = getattr(SystemKind, req.kind.upper(), None)
        if kind_enum:
            s.kind = kind_enum
    if req.classification is not None:
        s.classification = req.classification
    if req.purpose is not None:
        s.purpose = req.purpose
    if req.environment is not None:
        s.environment = req.environment

    switched_connector = False
    if req.connector_type is not None or req.adapter_type is not None:
        new_ct = (req.connector_type or req.adapter_type or "").lower().strip()
        if new_ct and new_ct != s.connector_type:
            s.connector_type = new_ct
            switched_connector = True

    store.save_system(auth.tenant_id, s)

    ep = _endpoint_for_system(auth.tenant_id, system_id)
    if ep is None:
        ep = Endpoint(
            system_id=system_id,
            environment_id=f"env-{(s.environment or 'production').lower()}",
            name=f"{s.name}-Endpoint",
            connection_params={"endpoint_id": system_id},
        )

    if req.connection_config:
        merged = dict(ep.connection_params or {})
        for k, v in req.connection_config.items():
            merged[k] = v
        merged["endpoint_id"] = system_id
        ep.connection_params = merged
    if req.secret_ref is not None:
        ep.secret_ref = req.secret_ref or None
    if req.environment is not None:
        ep.environment_id = f"env-{req.environment.lower()}"

    store.save_endpoint(auth.tenant_id, ep)

    if switched_connector:
        try:
            mongo_manager.delete_many(
                "dataset_rows",
                {"tenant_id": auth.tenant_id, "system_id": system_id},
            )
            mongo_manager.delete_many(
                "datasets",
                {"tenant_id": auth.tenant_id, "system_id": system_id},
            )
        except Exception:
            pass

    try:
        connector = _resolve_connector(auth.tenant_id, s)
        health = connector.test_connection()
        if health.get("status") == "SUCCESS":
            for t in connector.list_tables():
                name = t.get("name")
                if not name:
                    continue
                try:
                    rows = connector.read_table(name, limit=10_000)
                except Exception:
                    rows = []
                _persist_rows_for_table(auth.tenant_id, system_id, name, rows)
    except Exception:
        pass

    return SystemResponseItem(
        system_id=s.system_id,
        project_id=s.project_id,
        name=s.name,
        kind=s.kind.value if hasattr(s.kind, "value") else str(s.kind),
        adapter_type=s.connector_type,
        connector_type=s.connector_type,
        classification=s.classification,
        purpose=s.purpose,
        environment=s.environment,
        created_at=s.created_at,
        config_summary=_mask_config(ep.connection_params),
    )

@router.delete(
    "/systems/{system_id}",
    response_model=Dict[str, Any],
    summary="Delete Connected System",
    response_description="Confirmation of system removal",
)
def delete_system(system_id: str, auth: AuthContext = Depends(get_auth_context)):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )
    with store._lock:
        if system_id in store._systems.get(auth.tenant_id, {}):
            del store._systems[auth.tenant_id][system_id]

        mongo_manager.delete_one("systems", {"tenant_id": auth.tenant_id, "system_id": system_id})
        mongo_manager.delete_many("endpoints", {"tenant_id": auth.tenant_id, "system_id": system_id})
        mongo_manager.delete_many("datasets", {"tenant_id": auth.tenant_id, "system_id": system_id})
        mongo_manager.delete_many("dataset_rows", {"tenant_id": auth.tenant_id, "system_id": system_id})
    return {"status": "DELETED", "system_id": system_id}

# -------------------------------------------------------------
# Deep Exploration
# -------------------------------------------------------------
@router.get(
    "/systems/{system_id}/explore",
    response_model=Dict[str, Any],
    summary="Explore Connected Database In Depth",
    response_description="Live ping, discovered tables, real schema, and sample records",
)
def explore_system(system_id: str, auth: AuthContext = Depends(get_auth_context)):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )
    ep = _endpoint_for_system(auth.tenant_id, system_id)
    config = _mask_config(ep.connection_params) if ep else {}
    connector = _resolve_connector(auth.tenant_id, s)
    health = connector.test_connection()
    tables_raw = connector.list_tables() if health.get("status") == "SUCCESS" else []
    tables_out: List[Dict[str, Any]] = []

    SAMPLE_LIMIT = 1000

    for t in tables_raw:
        name = t.get("name", "table")
        try:
            sample_rows = connector.read_table(name, limit=SAMPLE_LIMIT)
        except Exception:  # noqa: BLE001
            sample_rows = []
        tables_out.append(
            {
                "name": name,
                "row_count": int(t.get("row_count", 0)),
                "columns": t.get("columns", []),
                "sample_records": sample_rows,
            }
        )

    return {
        "system_id": s.system_id,
        "project_id": s.project_id,
        "name": s.name,
        "kind": s.kind.value if hasattr(s.kind, "value") else str(s.kind),
        "connector_type": s.connector_type,
        "purpose": getattr(s, "purpose", "Enterprise replication connector"),
        "environment": getattr(s, "environment", "Production"),
        "classification": s.classification,
        "ping_status": health.get("status", "SUCCESS"),
        "latency_ms": float(health.get("latency_ms", 0.0)),
        "capabilities": health.get("capabilities", []),
        "created_at": s.created_at,
        "config": config,
        "tables": tables_out,
    }
# -------------------------------------------------------------
# Test Connection
# -------------------------------------------------------------
@router.post(
    "/systems/{system_id}/test-connection",
    response_model=EndpointTestResponse,
    summary="Test Enterprise System Connection",
    response_description="Connection latency, operational status, and verified connector capabilities",
)
def test_system_connection(system_id: str, auth: AuthContext = Depends(get_auth_context)):
    system_obj = store.get_system(auth.tenant_id, system_id)
    if not system_obj:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    ep = _endpoint_for_system(auth.tenant_id, system_id)
    connector = _resolve_connector(auth.tenant_id, system_obj)
    result = connector.test_connection()

    return EndpointTestResponse(
        system_id=system_id,
        endpoint_id=ep.endpoint_id if ep else None,
        status=result.get("status", "SUCCESS"),
        latency_ms=float(result.get("latency_ms", 0.0)),
        message=result.get("message", f"Connected to {system_obj.connector_type}"),
        capabilities=result.get("capabilities", []),
        masked_config=_mask_config(ep.connection_params) if ep else {},
    )

# -------------------------------------------------------------
# Direct Read / Write
# -------------------------------------------------------------
@router.get(
    "/systems/{system_id}/tables/{table_name}/rows",
    response_model=Dict[str, Any],
    summary="Read rows directly from the connector",
    response_description="Row array from the underlying connector",
)
def read_table_rows(
    system_id: str,
    table_name: str,
    limit: int = Query(default=100, ge=1, le=1000),
    auth: AuthContext = Depends(get_auth_context),
):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )
    connector = _resolve_connector(auth.tenant_id, s)
    rows = connector.read_table(table_name, limit=limit)
    return {
        "system_id": system_id,
        "table": table_name,
        "row_count": len(rows),
        "rows": rows,
    }

@router.post(
    "/systems/{system_id}/tables/{table_name}/rows",
    response_model=Dict[str, Any],
    summary="Write records directly to the connector",
    response_description="Count of inserted / updated rows",
)
def write_table_rows(
    system_id: str,
    table_name: str,
    payload: Dict[str, Any],
    auth: AuthContext = Depends(get_auth_context),
):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    records = payload.get("records") or []
    mode = (payload.get("mode") or "append").lower()
    if mode not in ("append", "upsert", "replace"):
        mode = "append"

    connector = _resolve_connector(auth.tenant_id, s)
    result = connector.write_records(table_name, records, mode=mode)

    try:
        current = connector.read_table(table_name, limit=10_000)
        _persist_rows_for_table(auth.tenant_id, system_id, table_name, current)
    except Exception:
        pass

    return result

@router.post(
    "/systems/{source_id}/copy-to/{target_id}",
    response_model=Dict[str, Any],
    summary="Copy every table from one system to another",
    response_description="Per-table copy stats proving read_table + write_records work",
)
def copy_between_systems(
    source_id: str,
    target_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    source = store.get_system(auth.tenant_id, source_id)
    target = store.get_system(auth.tenant_id, target_id)
    if not source or not target:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message="Source or target system not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    src = _resolve_connector(auth.tenant_id, source)
    tgt = _resolve_connector(auth.tenant_id, target)

    tables = src.list_tables()
    per_table = []
    total_rows = 0
    for t in tables:
        name = t.get("name")
        rows = src.read_table(name, limit=10_000)
        if not rows:
            per_table.append({"table": name, "rows_copied": 0, "target_total": 0})
            continue
        written = tgt.write_records(name, rows, mode="upsert")
        total_rows += written["inserted"] + written["updated"]
        per_table.append(
            {
                "table": name,
                "rows_copied": written["inserted"] + written["updated"],
                "target_total": written["total"],
            }
        )
        try:
            current = tgt.read_table(name, limit=10_000)
            _persist_rows_for_table(auth.tenant_id, target_id, name, current)
        except Exception:
            pass

    return {
        "status": "COPY_COMPLETE",
        "source_system_id": source_id,
        "target_system_id": target_id,
        "tables": per_table,
        "total_rows_copied": total_rows,
    }

# -------------------------------------------------------------
# Sheet / API Intake
# -------------------------------------------------------------
@router.post(
    "/systems/{system_id}/intake-sheet",
    response_model=Dataset,
    status_code=201,
    summary="Intake Manual Spreadsheet Schema and Records",
    response_description="Created dataset catalog with inferred field types and profiled sample records",
)
def intake_sheet(
    system_id: str,
    req: SheetIntakeRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    system_obj = store.get_system(auth.tenant_id, system_id)
    if not system_obj:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            status_code=404,
        )

    fields: List[FieldDefinition] = []
    for idx, col in enumerate(req.columns):
        col_clean = col.strip()
        dtype = req.types.get(col_clean, "string") if req.types else "string"
        if req.rows and (not req.types or col_clean not in req.types):
            sample_val = next(
                (r.get(col_clean) for r in req.rows if r.get(col_clean) is not None),
                None,
            )
            if sample_val is not None:
                if isinstance(sample_val, bool):
                    dtype = "boolean"
                elif isinstance(sample_val, (int, float)):
                    dtype = "number"
                elif isinstance(sample_val, str) and (
                    "date" in col_clean.lower() or "time" in col_clean.lower()
                ):
                    dtype = "datetime"
        is_pk = idx == 0 or "id" in col_clean.lower()
        fields.append(
            FieldDefinition(
                dataset_id="",
                name=col_clean,
                datatype=dtype,
                nullable=not is_pk,
                ordinal=idx,
                is_primary_key=is_pk,
                is_business_key=is_pk,
                description=f"Extracted from spreadsheet column '{col_clean}'",
            )
        )

    dataset = metadata_service.register_dataset(
        tenant_id=auth.tenant_id,
        system_id=system_id,
        physical_name=req.name.strip().replace(" ", "_"),
        namespace=req.namespace or "spreadsheets",
        fields=fields,
    )

    if req.rows:
        connector = _resolve_connector(auth.tenant_id, system_obj)
        try:
            connector.write_records(dataset.physical_name, req.rows, mode="append")
        except Exception:
            pass
        try:
            current = connector.read_table(dataset.physical_name, limit=10_000)
            _persist_rows_for_table(
                auth.tenant_id, system_id, dataset.physical_name, current
            )
        except Exception:
            _persist_rows_for_table(
                auth.tenant_id, system_id, dataset.physical_name, req.rows
            )
        discovery_service.profile_records(
            tenant_id=auth.tenant_id,
            dataset_id=dataset.dataset_id,
            records=req.rows,
            sample_size=len(req.rows),
        )

    return dataset

@router.post(
    "/systems/{system_id}/intake-api",
    response_model=Dataset,
    status_code=201,
    summary="Intake REST API Payload and Schema",
    response_description="Created dataset catalog resource parsed from REST API endpoint JSON",
)
def intake_api(
    system_id: str,
    req: ApiIntakeRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    system_obj = store.get_system(auth.tenant_id, system_id)
    if not system_obj:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            status_code=404,
        )

    records_to_profile: List[Dict[str, Any]] = []
    if req.sample_records:
        records_to_profile = req.sample_records
    elif req.sample_payload:
        if isinstance(req.sample_payload, list):
            records_to_profile = req.sample_payload
        elif isinstance(req.sample_payload, dict):
            for key in ("data", "items", "results", "records", "value"):
                v = req.sample_payload.get(key)
                if isinstance(v, list):
                    records_to_profile = v
                    break
            if not records_to_profile:
                records_to_profile = [req.sample_payload]

    fields: List[FieldDefinition] = []
    seen = set()
    i = 0
    for rec in records_to_profile[:20]:
        if not isinstance(rec, dict):
            continue
        for k, v in rec.items():
            if k in seen:
                continue
            seen.add(k)
            dtype = "string"
            if isinstance(v, bool):
                dtype = "boolean"
            elif isinstance(v, (int, float)):
                dtype = "number"
            elif isinstance(v, (list, dict)):
                dtype = "json"
            is_pk = k.lower() in ("id", "uuid", f"{req.name.lower()}_id", "key")
            fields.append(
                FieldDefinition(
                    dataset_id="",
                    name=k,
                    datatype=dtype,
                    nullable=not is_pk,
                    ordinal=i,
                    is_primary_key=is_pk,
                    is_business_key=is_pk,
                    description=f"Extracted from REST endpoint '{req.endpoint_url}'",
                )
            )
            i += 1

    if not fields:
        fields = [
            FieldDefinition(
                dataset_id="",
                name="id",
                datatype="string",
                nullable=False,
                ordinal=0,
                is_primary_key=True,
                is_business_key=True,
                description="Default identifier for API resource",
            ),
        ]

    dataset = metadata_service.register_dataset(
        tenant_id=auth.tenant_id,
        system_id=system_id,
        physical_name=req.name.strip().replace(" ", "_"),
        namespace=req.namespace or "api_services",
        fields=fields,
    )

    if records_to_profile:
        connector = _resolve_connector(auth.tenant_id, system_obj)
        try:
            connector.write_records(
                dataset.physical_name, records_to_profile, mode="append"
            )
        except Exception:
            pass
        try:
            current = connector.read_table(dataset.physical_name, limit=10_000)
            _persist_rows_for_table(
                auth.tenant_id, system_id, dataset.physical_name, current
            )
        except Exception:
            _persist_rows_for_table(
                auth.tenant_id, system_id, dataset.physical_name, records_to_profile
            )
        discovery_service.profile_records(
            tenant_id=auth.tenant_id,
            dataset_id=dataset.dataset_id,
            records=records_to_profile,
            sample_size=len(records_to_profile),
        )

    return dataset

# -------------------------------------------------------------
# Endpoints & Connectors Reference
# -------------------------------------------------------------
@router.post(
    "/endpoints",
    response_model=Endpoint,
    status_code=201,
    summary="Create Connection Endpoint",
    response_description="Created endpoint with masked secret reference",
)
def create_endpoint(req: EndpointCreateRequest, auth: AuthContext = Depends(get_auth_context)):
    return metadata_service.create_endpoint(
        tenant_id=auth.tenant_id,
        system_id=req.system_id,
        environment_id=req.environment_id,
        name=req.name,
        connection_params=req.connection_params,
        secret_ref=req.secret_ref,
    )

@router.post(
    "/endpoints/{endpoint_id}/test",
    response_model=Dict[str, Any],
    summary="Test Connection Without Secret Leakage",
    response_description="Connection latency, operational status, and verified connector capabilities",
)

def test_endpoint(endpoint_id: str, auth: AuthContext = Depends(get_auth_context)):
    return metadata_service.test_endpoint(auth.tenant_id, endpoint_id)

@router.get(
    "/systems/{system_id}/destination-mappings",
    response_model=Dict[str, Any],
    summary="Get Destination Ontology-Driven Mapping Catalog",
    response_description="Ontology-aligned mapping catalog saved in the destination system",
)
def get_destination_mappings(system_id: str, auth: AuthContext = Depends(get_auth_context)):
    catalogs = store.get_destination_mappings(auth.tenant_id, system_id)
    return {
        "system_id": system_id,
        "tenant_id": auth.tenant_id,
        "catalogs_count": len(catalogs),
        "catalogs": catalogs,
    }

@router.get(
    "/connectors/types",
    response_model=List[Dict[str, Any]],
    summary="List Supported Enterprise Connector Plugins",
    response_description="Catalog of available connectors and their declared capabilities",
)
def list_available_connectors():
    return connector_registry.list_connector_types()

# ═════════════════════════════════════════════════════════════
# Scalable Table Explorer Endpoints
# ═════════════════════════════════════════════════════════════
@router.get(
    "/systems/{system_id}/tables",
    response_model=Dict[str, Any],
    summary="Paginated table list (scalable for thousands of tables)",
    response_description="{ tables, total, offset, limit, query }",
)
def list_tables_paginated(
    system_id: str,
    q: str = Query(default="", description="Substring match on table name"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    auth: AuthContext = Depends(get_auth_context),
):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    connector = _resolve_connector(auth.tenant_id, s)
    try:
        all_tables = connector.list_tables()
    except Exception as e:
        raise PlatformException(
            code="LIST_TABLES_FAILED",
            message=f"Connector list_tables failed: {e}",
            category=ErrorCategory.PLATFORM_RESOURCE,
            status_code=502,
        )

    if q.strip():
        ql = q.strip().lower()
        all_tables = [t for t in all_tables if ql in (t.get("name") or "").lower()]

    total = len(all_tables)
    page = all_tables[offset : offset + limit]

    tables_out = [
        {
            "name": t.get("name"),
            "row_count": int(t.get("row_count") or 0),
            "column_count": len(t.get("columns") or []),
        }
        for t in page
    ]

    return {
        "system_id": system_id,
        "tables": tables_out,
        "total": total,
        "offset": offset,
        "limit": limit,
        "query": q,
    }

@router.get(
    "/systems/{system_id}/tables/{table_name}",
    response_model=Dict[str, Any],
    summary="Get schema for a single table (cheap — no rows)",
    response_description="{ name, columns, row_count, column_count }",
)
def get_table_schema(
    system_id: str,
    table_name: str,
    auth: AuthContext = Depends(get_auth_context),
):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    connector = _resolve_connector(auth.tenant_id, s)
    try:
        tables = connector.list_tables()
    except Exception as e:
        raise PlatformException(
            code="LIST_TABLES_FAILED",
            message=f"Connector list_tables failed: {e}",
            category=ErrorCategory.PLATFORM_RESOURCE,
            status_code=502,
        )

    match = next((t for t in tables if t.get("name") == table_name), None)
    if not match:
        raise PlatformException(
            code="TABLE_NOT_FOUND",
            message=f"Table '{table_name}' not found in connector",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    columns = match.get("columns") or []
    for c in columns:
        v = c.get("is_pk")
        c["is_pk"] = v is True or v == "true" or v == "True"

    return {
        "system_id": system_id,
        "name": table_name,
        "row_count": int(match.get("row_count") or 0),
        "column_count": len(columns),
        "columns": columns,
    }

@router.get(
    "/systems/{system_id}/tables/{table_name}/preview",
    response_model=Dict[str, Any],
    summary="Paginated row preview for a single table",
    response_description="{ rows, offset, limit, total, has_more }",
)
def preview_table_rows(
    system_id: str,
    table_name: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    auth: AuthContext = Depends(get_auth_context),
):
    s = store.get_system(auth.tenant_id, system_id)
    if not s:
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message=f"System '{system_id}' was not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    connector = _resolve_connector(auth.tenant_id, s)

    total: Optional[int] = None
    try:
        listed = next(
            (t for t in connector.list_tables() if t.get("name") == table_name),
            None,
        )
        if listed is not None:
            total = int(listed.get("row_count") or 0)
    except Exception:
        pass

    try:
        if hasattr(connector, "read_rows"):
            rows_out = connector.read_rows(table_name, offset=offset, limit=limit)
        else:
            all_rows = connector.read_table(table_name, limit=offset + limit)
            rows_out = all_rows[offset : offset + limit]
    except Exception as e:
        raise PlatformException(
            code="READ_TABLE_FAILED",
            message=f"Connector read_table failed: {e}",
            category=ErrorCategory.PLATFORM_RESOURCE,
            status_code=502,
        )

    has_more = total is None or (offset + len(rows_out)) < total

    return {
        "system_id": system_id,
        "table": table_name,
        "rows": rows_out,
        "offset": offset,
        "limit": limit,
        "total": total,
        "has_more": has_more,
    }