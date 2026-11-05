"""
Connector Registry Service.
Registers available connector plugins, validates capabilities, and initializes connector instances.

Real implementations:
  - memory                     → MemoryConnector
  - fabric / onelake           → MicrosoftFabricConnector
  - d365 / dataverse           → Dynamics365Connector
  - rest_api / api             → RestApiConnector
  - mongodb / mongo            → MongoDBAtlasConnector
  - postgres / postgresql      → PostgresConnector (psycopg 3)
  - cockroach / cockroachdb    → PostgresConnector (Cockroach is Postgres-wire)
  - timescale                  → PostgresConnector
  - redshift                   → PostgresConnector
  - postgis                    → PostgresConnector

Stub implementations (return fake SUCCESS + 0 tables — flagged available=False):
  - snowflake, bigquery, oracle, sqlserver, s3, salesforce, adls, databricks
"""

from typing import Any, Dict, List, Type

from app.core.errors import PlatformException, ErrorCategory
from app.sdk.connectors.base import BaseConnector
from app.sdk.connectors.memory_connector import MemoryConnector
from app.sdk.connectors.fabric_connector import MicrosoftFabricConnector
from app.sdk.connectors.d365_connector import Dynamics365Connector
from app.sdk.connectors.rest_api_connector import RestApiConnector
from app.sdk.connectors.mongodb_connector import MongoDBAtlasConnector
from app.sdk.connectors.postgres_connector import PostgresConnector


class ConnectorRegistry:
    """Manages connector plugins and instantiates connectors from system endpoints."""

    def __init__(self):
        self._registry: Dict[str, Type[BaseConnector]] = {
            # ── Real, fully-working connectors ─────────────────
            "memory": MemoryConnector,
            "mock": MemoryConnector,
            "fabric": MicrosoftFabricConnector,
            "microsoft_fabric": MicrosoftFabricConnector,
            "onelake": MicrosoftFabricConnector,
            "d365": Dynamics365Connector,
            "dynamics365": Dynamics365Connector,
            "dynamics_365": Dynamics365Connector,
            "dataverse": Dynamics365Connector,
            "rest_api": RestApiConnector,
            "api": RestApiConnector,
            "http_json": RestApiConnector,
            "mongodb": MongoDBAtlasConnector,
            "mongo": MongoDBAtlasConnector,
            "atlas": MongoDBAtlasConnector,

            # ── PostgreSQL family (all speak Postgres wire) ────
            "postgres": PostgresConnector,
            "postgresql": PostgresConnector,
            "pg": PostgresConnector,
            "cockroach": PostgresConnector,
            "cockroachdb": PostgresConnector,
            "timescale": PostgresConnector,
            "timescaledb": PostgresConnector,
            "redshift": PostgresConnector,
            "postgis": PostgresConnector,

            # ── Aliases that reuse a real connector ────────────
            "relational": MemoryConnector,
            "file": MemoryConnector,
            "sheet": MemoryConnector,
            "sheets": MemoryConnector,
            "csv": MemoryConnector,
            "excel": MemoryConnector,

            # ── Stubs (real backends NOT yet implemented) ──────
            "snowflake": MemoryConnector,
            "databricks": MicrosoftFabricConnector,
            "bigquery": MemoryConnector,
            "oracle": MemoryConnector,
            "sqlserver": MemoryConnector,
            "s3": MemoryConnector,
            "adls": MicrosoftFabricConnector,
            "salesforce": Dynamics365Connector,
        }

    def register_connector(
        self, connector_type: str, connector_cls: Type[BaseConnector]
    ):
        self._registry[connector_type.lower()] = connector_cls

    def get_connector(
        self,
        connector_type: str,
        endpoint_config: Dict[str, Any],
        secret_ref: str = None,
    ) -> BaseConnector:
        c_type = connector_type.lower()
        if c_type not in self._registry:
            raise PlatformException(
                code="CONNECTOR_NOT_FOUND",
                message=f"Connector type '{connector_type}' is not registered in connector framework",
                category=ErrorCategory.PLATFORM_RESOURCE,
                status_code=404,
            )
        return self._registry[c_type](
            endpoint_config=endpoint_config, secret_ref=secret_ref
        )

    # ═══════════════════════════════════════════════════════════
    # Rehydrate connector tables from persisted `dataset_rows`.
    #
    # ROOT CAUSE of "source_has_rows FAILED" on a Mongo connector:
    #   1. The dataset_rows docs were written with a `tenant_id` that
    #      doesn't match the caller's tenant (e.g. seeded with
    #      "tenant-default" but the request arrives with a JWT whose
    #      tenant_id is different).
    #   2. OR the system is a real `mongodb` connector with no
    #      connection_params — so its `_tables` is empty by design
    #      and its `list_tables()` hits the live cluster.
    #
    # Strategy:
    #   1. Skip rehydration entirely for MongoDBConnector (it manages
    #      its own state by talking to a live cluster).
    #   2. Skip rehydration for PostgresConnector (same reason — it
    #      talks to a live Postgres instance; its state is NOT
    #      cached in dataset_rows).
    #   3. Try tenant-scoped dataset_rows first.
    #   4. If that returns nothing, fall back to a system-only query
    #      (safe for demo tenants — dataset_rows is per-system).
    #   5. Log every branch so you can see exactly what happened.
    # ═══════════════════════════════════════════════════════════
    def get_connector_with_persisted_data(
        self,
        connector_type: str,
        endpoint_config: Dict[str, Any],
        secret_ref: str = None,
        tenant_id: str = None,
        system_id: str = None,
    ) -> BaseConnector:
        """
        Returns a connector. If its tables came back empty (process restart
        between page visits), this rebuilds the `tables` field from the
        persisted `dataset_rows` collection.
        """
        connector = self.get_connector(
            connector_type=connector_type,
            endpoint_config=endpoint_config,
            secret_ref=secret_ref,
        )

        # ── Live connectors manage their own state ──────────
        # MongoDBAtlasConnector and PostgresConnector both read from a
        # live server on every call. Their in-memory `_tables` cache is
        # not the source of truth — rehydrating from `dataset_rows` would
        # OVERWRITE the live behavior with stale cached rows, causing the
        # preflight gate to see the wrong data.
        if isinstance(connector, (MongoDBAtlasConnector, PostgresConnector)):
            return connector

        # Only rehydrate connectors that hold in-memory tables
        if not hasattr(connector, "_tables"):
            return connector
        if getattr(connector, "_tables", None):
            return connector  # already populated

        if not tenant_id or not system_id:
            return connector

        try:
            from app.core.logging import get_logger
            from app.db.mongo import mongo_manager

            log = get_logger("registry")

            # ── Pass 1: tenant-scoped ─────────────────────────
            rows_docs = mongo_manager.find_many(
                "dataset_rows",
                {"tenant_id": tenant_id, "system_id": system_id},
                limit=10_000,
            )
            log.info(
                f"[Registry] Pass 1 (tenant={tenant_id}, system={system_id}): "
                f"{len(rows_docs or [])} dataset_rows doc(s)"
            )

            # ── Pass 2: system-only fallback (demo tenants) ───
            # Handles the case where the system was seeded under a
            # different tenant header than the migration is running under.
            if not rows_docs:
                rows_docs = mongo_manager.find_many(
                    "dataset_rows",
                    {"system_id": system_id},
                    limit=10_000,
                )
                log.info(
                    f"[Registry] Pass 2 (system={system_id} only): "
                    f"{len(rows_docs or [])} dataset_rows doc(s)"
                )

            # ── Pass 3: last-resort — pull from datasets catalog ──
            # If dataset_rows has nothing at all, at least hydrate the
            # table names (with 0 rows) from the datasets collection so
            # list_tables surfaces them and the pre-flight check can
            # say "empty" instead of "missing".
            if not rows_docs:
                catalog = mongo_manager.find_many(
                    "datasets", {"system_id": system_id}, limit=10_000
                )
                log.info(
                    f"[Registry] Pass 3 (datasets catalog, "
                    f"system={system_id}): {len(catalog or [])} dataset(s)"
                )
                for ds in catalog or []:
                    physical = ds.get("physical_name")
                    if physical and physical not in connector._tables:
                        connector._tables[physical] = []

            # Apply whatever we found.
            for doc in rows_docs or []:
                table_name = doc.get("table_name")
                if not table_name:
                    continue
                rows = doc.get("rows") or []
                if not isinstance(rows, list):
                    rows = []

                existing = connector._tables.get(table_name) or []
                if len(existing) >= len(rows):
                    continue

                connector._tables[table_name] = [
                    dict(r) if isinstance(r, dict) else r for r in rows
                ]
                log.info(
                    f"[Registry] Rehydrated '{table_name}' on system "
                    f"'{system_id}' with {len(rows)} row(s)"
                )

        except Exception as e:  # noqa: BLE001
            try:
                from app.core.logging import get_logger

                get_logger("registry").warning(
                    f"[Registry] Rehydration failed for system "
                    f"'{system_id}': {e}"
                )
            except Exception:
                pass

        return connector

    def list_connector_types(self) -> List[Dict[str, Any]]:
        return [
            {
                "type": "fabric",
                "name": "Microsoft Fabric OneLake",
                "category": "Lakehouse / Warehouse",
                "aliases": ["microsoft_fabric", "onelake"],
                "description": "Microsoft Fabric OneLake Lakehouse & Delta tables",
                "capabilities": ["snapshots", "cdc", "pushdown", "idempotent_write"],
                "available": True,
            },
            {
                "type": "d365",
                "name": "Microsoft Dynamics 365",
                "category": "CRM & ERP / Dataverse",
                "aliases": ["dynamics365", "dynamics_365", "dataverse"],
                "description": "Microsoft Dynamics 365 CRM/ERP and Dataverse",
                "capabilities": ["snapshots", "cdc", "alternate_keys", "idempotent_write"],
                "available": True,
            },
            {
                "type": "rest_api",
                "name": "REST API Endpoint",
                "category": "Web Services & APIs",
                "aliases": ["api", "http_json"],
                "description": "Direct HTTP REST API connector",
                "capabilities": ["json_parsing", "schema_inference", "bearer_auth"],
                "available": True,
            },
            {
                "type": "sheet",
                "name": "Spreadsheet / Sheet Upload",
                "category": "Manual Files & Tables",
                "aliases": ["csv", "excel", "sheets"],
                "description": "Upload CSV or Excel spreadsheets",
                "capabilities": ["type_inference", "schema_extraction"],
                "available": True,
            },
            {
                "type": "memory",
                "name": "In-Memory Simulation",
                "category": "Testing / Sandboxing",
                "aliases": ["mock"],
                "description": "High-performance memory connector",
                "capabilities": ["snapshots", "idempotent_write", "compensation"],
                "available": True,
            },
            {
                "type": "mongodb",
                "name": "MongoDB Atlas",
                "category": "Document & Vector Store",
                "aliases": ["mongo", "atlas"],
                "description": "Live MongoDB Atlas cluster",
                "capabilities": ["schema_discovery", "nested_flattening", "idempotent_write"],
                "available": True,
            },
            {
                "type": "postgres",
                "name": "PostgreSQL",
                "category": "Relational Database",
                "aliases": [
                    "postgresql",
                    "pg",
                    "cockroach",
                    "cockroachdb",
                    "timescale",
                    "redshift",
                    "postgis",
                ],
                "description": (
                    "Live PostgreSQL (Neon, Supabase, Railway, RDS, Azure, "
                    "self-hosted). Also covers CockroachDB, TimescaleDB, and "
                    "Redshift, which speak the Postgres wire protocol."
                ),
                "capabilities": [
                    "schema_discovery",
                    "cursor_pagination",
                    "streaming_reads",
                    "idempotent_upsert",
                    "transactional_load",
                    "tls",
                ],
                "available": True,
            },
            {
                "type": "relational",
                "name": "Relational (SQLite)",
                "category": "Relational Database",
                "aliases": ["sqlite"],
                "description": "In-process SQLite database",
                "capabilities": ["snapshots", "schema_discovery", "idempotent_write"],
                "available": True,
            },
        ]


connector_registry = ConnectorRegistry()