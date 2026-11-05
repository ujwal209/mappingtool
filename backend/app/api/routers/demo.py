"""
Demo / smoke-test endpoints.

Purpose: prove the connector layer works end-to-end with real data —
without needing Azure, Snowflake, or any external service.

Two endpoints:
  • POST /demo/warehouse/bootstrap
      Registers a SOURCE system and a TARGET system (both `memory`),
      writes the sample warehouse dataset into both, and returns the
      IDs so the UI can link to `explore`, `test-connection`, and
      `destination-mappings`.

  • POST /demo/warehouse/copy-source-to-target
      Reads every table from the source connector and writes it into
      the target connector — a deterministic end-to-end copy that
      proves `read_table` and `write_records` actually work.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends

from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.models.canonical import SystemKind, System
from app.db.store import store
from app.sdk.connectors.registry import connector_registry
from app.services.sample_warehouse_data import sample_warehouse_tables

router = APIRouter(tags=["Demo & Simulation"])


def _create_system(
    tenant_id: str,
    name: str,
    kind: SystemKind,
    connector_type: str,
    project_id: str,
    environment: str = "Production",
) -> System:
    sys = System(
        project_id=project_id,
        name=name,
        kind=kind,
        connector_type=connector_type,
        classification="CONFIDENTIAL",
        purpose=f"{kind.value.title()} demo system ({connector_type})",
        environment=environment,
    )
    return store.save_system(tenant_id, sys)


@router.post(
    "/demo/warehouse/bootstrap",
    response_model=Dict[str, Any],
    summary="Bootstrap warehouse demo — source + target with sample data",
    response_description="System IDs, connector summary, per-table row counts",
)
def bootstrap_warehouse_demo(
    auth: AuthContext = Depends(get_auth_context),
):
    """
    Creates two systems (SOURCE + TARGET), both using the in-memory
    connector. Writes the full warehouse dataset from
    `sample_warehouse_data.py` into BOTH systems.

    You can then call:
      POST /systems/{source_id}/test-connection
      GET  /systems/{source_id}/explore
      POST /systems/{target_id}/test-connection
      GET  /systems/{target_id}/explore
      POST /demo/warehouse/copy-source-to-target
    to verify connectors work end-to-end.
    """
    # Ensure there is a project
    projects = store.list_projects(auth.tenant_id)
    if projects:
        project_id = projects[0].project_id
    else:
        from app.services.project_service import project_service
        proj = project_service.create_project(
            tenant_id=auth.tenant_id,
            name="Warehouse Demo Project",
            description="Bootstrap project for the warehouse demo",
        )
        project_id = proj.project_id

    # Create the two systems
    source = _create_system(
        tenant_id=auth.tenant_id,
        name="Warehouse Source",
        kind=SystemKind.SOURCE,
        connector_type="memory",
        project_id=project_id,
        environment="Production",
    )
    target = _create_system(
        tenant_id=auth.tenant_id,
        name="Warehouse Target",
        kind=SystemKind.TARGET,
        connector_type="memory",
        project_id=project_id,
        environment="Production",
    )

    # Build connectors and write every table
    source_conn = connector_registry.get_connector(
        connector_type=source.connector_type,
        endpoint_config={"endpoint_id": source.system_id},
    )
    target_conn = connector_registry.get_connector(
        connector_type=target.connector_type,
        endpoint_config={"endpoint_id": target.system_id},
    )

    tables = sample_warehouse_tables()
    source_summary: Dict[str, int] = {}
    target_summary: Dict[str, int] = {}

    for t in tables:
        write_s = source_conn.write_records(
            table=t["name"], records=t["records"], mode="replace"
        )
        source_summary[t["name"]] = write_s["total"]

        write_t = target_conn.write_records(
            table=t["name"], records=t["records"], mode="replace"
        )
        target_summary[t["name"]] = write_t["total"]

    return {
        "status": "BOOTSTRAP_COMPLETE",
        "project_id": project_id,
        "source_system_id": source.system_id,
        "target_system_id": target.system_id,
        "source_connector": "memory",
        "target_connector": "memory",
        "tables": [t["name"] for t in tables],
        "source_row_counts": source_summary,
        "target_row_counts": target_summary,
        "next_steps": {
            "test_source": f"POST /api/v1/systems/{source.system_id}/test-connection",
            "explore_source": f"GET /api/v1/systems/{source.system_id}/explore",
            "test_target": f"POST /api/v1/systems/{target.system_id}/test-connection",
            "explore_target": f"GET /api/v1/systems/{target.system_id}/explore",
            "copy": "POST /api/v1/demo/warehouse/copy-source-to-target",
        },
    }


@router.post(
    "/demo/warehouse/copy-source-to-target",
    response_model=Dict[str, Any],
    summary="Copy every table from the source system to the target system",
    response_description="Per-table row counts and totals proving read_table/write_records work",
)
def copy_source_to_target(
    source_system_id: str,
    target_system_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    """
    End-to-end test: for every table on the source connector, read all
    rows via `read_table`, then write them to the target via
    `write_records(mode="upsert")`. Proves both methods work with the
    real connector interface.
    """
    source = store.get_system(auth.tenant_id, source_system_id)
    target = store.get_system(auth.tenant_id, target_system_id)
    if not source or not target:
        from app.core.errors import PlatformException, ErrorCategory
        raise PlatformException(
            code="SYSTEM_NOT_FOUND",
            message="Source or target system not found",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    source_conn = connector_registry.get_connector(
        connector_type=source.connector_type,
        endpoint_config={"endpoint_id": source.system_id},
    )
    target_conn = connector_registry.get_connector(
        connector_type=target.connector_type,
        endpoint_config={"endpoint_id": target.system_id},
    )

    source_tables = source_conn.list_tables()
    copied: List[Dict[str, Any]] = []
    total_rows = 0

    for t in source_tables:
        name = t["name"]
        rows = source_conn.read_table(name, limit=10_000)
        if not rows:
            copied.append({"table": name, "rows_copied": 0, "target_total": 0})
            continue
        written = target_conn.write_records(name, rows, mode="upsert")
        total_rows += written["inserted"] + written["updated"]
        copied.append(
            {
                "table": name,
                "rows_copied": written["inserted"] + written["updated"],
                "target_total": written["total"],
            }
        )

    return {
        "status": "COPY_COMPLETE",
        "source_system_id": source.system_id,
        "target_system_id": target.system_id,
        "tables": copied,
        "total_rows_copied": total_rows,
    }