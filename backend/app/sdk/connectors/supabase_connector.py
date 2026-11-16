"""
Supabase Connector Plugin.
Supports both:
  1. Direct PostgreSQL Wire Connection (Supabase DB / Connection Pooler / Local Supabase CLI)
  2. Supabase PostgREST Web API (HTTPS endpoint + API / Service Key)
"""

from __future__ import annotations

import time
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import urlparse

import httpx

from app.core.logging import get_logger
from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)
from app.sdk.connectors.postgres_connector import PostgresConnector

logger = get_logger("supabase_connector")


class SupabaseConnector(BaseConnector):
    name = "supabase"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self.version = "1.0.0"
        cfg = self.config or {}

        # ── Mode 1: Direct Postgres Connection ────────────────────
        self.dsn: str = (
            cfg.get("dsn")
            or cfg.get("connection_string")
            or cfg.get("uri")
            or cfg.get("database_url")
            or ""
        ).strip()

        # If individual Postgres fields are provided without full DSN
        self.host = (cfg.get("host") or "").strip()
        self.port = int(cfg.get("port") or 5432)
        self.user = (cfg.get("user") or cfg.get("username") or "postgres").strip()
        self.password = (cfg.get("password") or "").strip()
        self.database = (cfg.get("database") or cfg.get("dbname") or "postgres").strip()

        # ── Mode 2: Supabase PostgREST API ────────────────────────
        raw_url = (
            cfg.get("supabase_url")
            or cfg.get("project_url")
            or cfg.get("url")
            or ""
        ).strip().rstrip("/")

        self.api_key = (
            cfg.get("supabase_key")
            or cfg.get("api_key")
            or cfg.get("service_role_key")
            or cfg.get("anon_key")
            or ""
        ).strip()

        self.supabase_url = raw_url
        if self.supabase_url:
            if not self.supabase_url.endswith("/rest/v1"):
                self.rest_url = f"{self.supabase_url}/rest/v1"
            else:
                self.rest_url = self.supabase_url
        else:
            self.rest_url = ""

        # Determine preferred mode
        self.use_postgres_wire = bool(
            self.dsn
            or (self.host and not self.supabase_url.startswith("http"))
        )

        # Delegate Postgres connector if wire protocol is chosen
        self._pg_connector: Optional[PostgresConnector] = None
        if self.use_postgres_wire:
            pg_cfg = dict(cfg)
            if self.dsn:
                pg_cfg["dsn"] = self.dsn
            else:
                pg_cfg["host"] = self.host
                pg_cfg["port"] = self.port
                pg_cfg["user"] = self.user
                pg_cfg["password"] = self.password
                pg_cfg["database"] = self.database
            self._pg_connector = PostgresConnector(pg_cfg, secret_ref)

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["apikey"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def test_connection(self) -> Dict[str, Any]:
        """Tests Supabase connection using either Postgres Wire or PostgREST API."""
        t0 = time.time()

        # Mode 1: Postgres Wire
        if self.use_postgres_wire and self._pg_connector:
            res = self._pg_connector.test_connection()
            if res.get("status") == "SUCCESS":
                res["message"] = f"Connected to Supabase (PostgreSQL wire): {res.get('message')}"
            return res

        # Mode 2: PostgREST API
        if not self.rest_url:
            return {
                "status": "FAILED",
                "latency_ms": 0.0,
                "message": (
                    "Missing Supabase configuration. Provide either a PostgreSQL connection URI "
                    "(e.g., postgresql://postgres:password@db.xxx.supabase.co:5432/postgres) "
                    "or a Supabase Project URL + API Key (e.g., https://xxx.supabase.co and anon/service_role key)."
                ),
                "capabilities": [],
            }

        try:
            with httpx.Client(timeout=10.0, verify=False) as client:
                headers = self._headers()
                # Request openapi spec which also acts as healthcheck and table schema listing
                r = client.get(self.rest_url, headers=headers)
                latency = round((time.time() - t0) * 1000, 2)

                if r.status_code in (200, 204):
                    return {
                        "status": "SUCCESS",
                        "latency_ms": latency,
                        "message": f"Successfully connected to Supabase PostgREST at {self.supabase_url}",
                        "capabilities": [
                            "schema_discovery",
                            "read_batch",
                            "write_batch",
                            "postgrest_api",
                            "rls_enforced",
                        ],
                        "rest_url": self.rest_url,
                    }
                else:
                    return {
                        "status": "FAILED",
                        "latency_ms": latency,
                        "message": f"Supabase PostgREST returned HTTP {r.status_code}: {r.text[:200]}",
                        "capabilities": [],
                    }
        except Exception as e:
            return {
                "status": "FAILED",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": f"Failed to connect to Supabase: {e}",
                "capabilities": [],
            }

    def list_tables(self) -> List[Dict[str, Any]]:
        """Lists tables and schema via Postgres wire or Supabase PostgREST OpenAPI schema."""
        if self.use_postgres_wire and self._pg_connector:
            return self._pg_connector.list_tables()

        if not self.rest_url:
            return []

        out: List[Dict[str, Any]] = []
        try:
            with httpx.Client(timeout=10.0, verify=False) as client:
                headers = self._headers()
                headers["Accept"] = "application/openapi+json"
                r = client.get(self.rest_url, headers=headers)
                if r.status_code == 200:
                    spec = r.json()
                    definitions = spec.get("definitions") or spec.get("components", {}).get("schemas", {})
                    for tbl_name, tbl_spec in definitions.items():
                        props = tbl_spec.get("properties", {})
                        required = tbl_spec.get("required", [])
                        columns = []
                        for col_name, col_meta in props.items():
                            columns.append({
                                "name": col_name,
                                "datatype": col_meta.get("type", "string"),
                                "description": col_meta.get("description", ""),
                                "is_pk": col_name == "id" or col_name in required,
                                "nullable": col_name not in required,
                            })
                        out.append({
                            "name": tbl_name,
                            "row_count": 0,
                            "columns": columns,
                        })
        except Exception as e:
            logger.warning(f"Failed to fetch Supabase OpenAPI schema: {e}")

        return out

    def read_table(self, table: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Reads rows from a table via Postgres or PostgREST."""
        if self.use_postgres_wire and self._pg_connector:
            return self._pg_connector.read_table(table, limit)

        if not self.rest_url:
            return []

        try:
            with httpx.Client(timeout=10.0, verify=False) as client:
                url = f"{self.rest_url}/{table}?select=*&limit={limit}"
                r = client.get(url, headers=self._headers())
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list):
                        return data
                    return []
                else:
                    logger.warning(f"Supabase read_table({table}) failed: {r.status_code} {r.text}")
                    return []
        except Exception as e:
            logger.warning(f"Error reading Supabase table {table}: {e}")
            return []

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        """Inserts records into a Supabase table."""
        if not records:
            return {"table": table, "inserted": 0, "updated": 0, "total": 0}

        if self.use_postgres_wire and self._pg_connector:
            return self._pg_connector.write_records(table, records, mode)

        if not self.rest_url:
            raise RuntimeError("Supabase REST URL not configured")

        try:
            with httpx.Client(timeout=15.0, verify=False) as client:
                url = f"{self.rest_url}/{table}"
                headers = self._headers()
                if mode == "upsert":
                    headers["Prefer"] = "resolution=merge-duplicates,return=representation"
                else:
                    headers["Prefer"] = "return=representation"

                r = client.post(url, headers=headers, json=records)
                if r.status_code in (200, 201):
                    res_data = r.json()
                    count = len(res_data) if isinstance(res_data, list) else len(records)
                    return {
                        "table": table,
                        "inserted": count,
                        "updated": 0,
                        "total": count,
                    }
                else:
                    raise RuntimeError(f"Supabase insert failed ({r.status_code}): {r.text}")
        except Exception as e:
            logger.error(f"Failed writing records to Supabase {table}: {e}")
            raise

    def discover(self) -> List[Dict[str, Any]]:
        """Canonical discovery of Supabase tables."""
        if self.use_postgres_wire and self._pg_connector:
            return self._pg_connector.discover()

        tables = self.list_tables()
        datasets = []
        for t in tables:
            fields = []
            for idx, c in enumerate(t.get("columns", [])):
                fields.append({
                    "name": c["name"],
                    "datatype": c.get("datatype", "string"),
                    "nullable": c.get("nullable", True),
                    "ordinal": idx + 1,
                    "is_primary_key": c.get("is_pk", False),
                    "is_business_key": False,
                })
            datasets.append({
                "dataset_name": t["name"],
                "source_format": "SUPABASE_TABLE",
                "estimated_volume": f"{len(t.get('columns', []))} columns",
                "fields": fields,
            })
        return datasets
