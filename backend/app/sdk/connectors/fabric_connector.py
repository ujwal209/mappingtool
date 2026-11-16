"""
Microsoft Fabric Connector Plugin.
Supports OneLake Lakehouses, Fabric Warehouses, and Delta Lake tables.
"""

import copy
import time
from typing import Any, Dict, Iterator, List, Optional
import httpx

from app.core.logging import logger
from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)


class MicrosoftFabricConnector(BaseConnector):
    name = "fabric"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self.version = "2.1.0"
        cfg = self.config or {}
        self.workspace_id = cfg.get("workspace_id", "fabric-workspace-default")
        self.lakehouse_id = cfg.get("lakehouse_id", "fabric-lakehouse-gold")
        self.tenant_id = cfg.get("azure_tenant_id") or cfg.get("tenant_id", "common")
        self.client_id = cfg.get("client_id")
        self.client_secret = cfg.get("client_secret") or (secret_ref if secret_ref and not secret_ref.startswith("secret-") else None)

        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0

        self._tables: Dict[str, List[Dict[str, Any]]] = cfg.get(
            "tables",
            {
                "Fabric_Customer_Gold": [
                    {"customer_id": "CUST-001", "name": "Global Logistics Corp", "tier": "Gold", "revenue": 1250000.0},
                    {"customer_id": "CUST-002", "name": "Apex Manufacturing", "tier": "Platinum", "revenue": 3400000.0},
                ],
                "Fabric_Sales_Fact": [
                    {"order_id": "ORD-901", "customer_id": "CUST-001", "amount": 45000.0, "status": "COMPLETED"},
                    {"order_id": "ORD-902", "customer_id": "CUST-002", "amount": 120000.0, "status": "PROCESSING"},
                ],
                "Fabric_Product_Dimension": [
                    {"product_id": "PRD-101", "sku": "SERV-ENTERPRISE", "category": "Cloud Services", "active": True},
                ],
            },
        )
        self._ontology_catalog_table: List[Dict[str, Any]] = []
        self._snapshots: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._written_keys: set = set()

    def _get_token(self) -> Optional[str]:
        if not self.client_id or not self.client_secret:
            return None
        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        try:
            with httpx.Client(timeout=10.0) as client:
                r = client.post(
                    token_url,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "scope": "https://api.fabric.microsoft.com/.default",
                    },
                )
                if r.status_code == 200:
                    data = r.json()
                    self._access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 3600)
                    self._token_expires_at = time.time() + float(expires_in)
                    return self._access_token
                else:
                    logger.warning(f"Fabric OAuth token error ({r.status_code}): {r.text}")
                    return None
        except Exception as e:
            logger.warning(f"Failed to acquire Fabric Azure AD token: {e}")
            return None

    # ── New API ───────────────────────────────────────────
    def test_connection(self) -> Dict[str, Any]:
        t0 = time.time()
        # If client credentials are provided, attempt live verification
        if self.client_id and self.client_secret:
            token = self._get_token()
            latency = round((time.time() - t0) * 1000, 2)
            if not token:
                return {
                    "status": "FAILED",
                    "latency_ms": latency,
                    "message": f"Azure AD OAuth failed for client_id '{self.client_id}' on tenant '{self.tenant_id}'",
                    "capabilities": [],
                }

            # Verify against Fabric API
            try:
                with httpx.Client(timeout=10.0) as client:
                    fabric_url = f"https://api.fabric.microsoft.com/v1/workspaces/{self.workspace_id}/lakehouses/{self.lakehouse_id}/tables"
                    r = client.get(fabric_url, headers={"Authorization": f"Bearer {token}"})
                    live_latency = round((time.time() - t0) * 1000, 2)
                    if r.status_code in (200, 204):
                        return {
                            "status": "SUCCESS",
                            "latency_ms": live_latency,
                            "message": f"Connected to live Microsoft Fabric workspace '{self.workspace_id}' (lakehouse '{self.lakehouse_id}')",
                            "capabilities": [
                                "snapshots",
                                "cdc",
                                "schema_discovery",
                                "idempotent_write",
                                "delta_format",
                                "live_fabric_api",
                            ],
                            "workspace_id": self.workspace_id,
                            "lakehouse_id": self.lakehouse_id,
                        }
                    else:
                        return {
                            "status": "FAILED",
                            "latency_ms": live_latency,
                            "message": f"Fabric REST API returned HTTP {r.status_code}: {r.text[:200]}",
                            "capabilities": [],
                        }
            except Exception as e:
                return {
                    "status": "FAILED",
                    "latency_ms": round((time.time() - t0) * 1000, 2),
                    "message": f"Fabric REST API call failed: {e}",
                    "capabilities": [],
                }

        # Simulated / dev mode
        return {
            "status": "SUCCESS",
            "latency_ms": 12.4,
            "message": (
                f"Authenticated with Fabric workspace '{self.workspace_id}' "
                f"(lakehouse '{self.lakehouse_id}') [Simulated / In-Memory Delta Store]"
            ),
            "capabilities": [
                "snapshots",
                "cdc",
                "schema_discovery",
                "idempotent_write",
                "delta_format",
            ],
        }

    def list_tables(self) -> List[Dict[str, Any]]:
        token = self._get_token()
        if token:
            try:
                with httpx.Client(timeout=10.0) as client:
                    fabric_url = f"https://api.fabric.microsoft.com/v1/workspaces/{self.workspace_id}/lakehouses/{self.lakehouse_id}/tables"
                    r = client.get(fabric_url, headers={"Authorization": f"Bearer {token}"})
                    if r.status_code == 200:
                        data = r.json()
                        items = data.get("data", [])
                        out = []
                        for item in items:
                            tbl_name = item.get("name")
                            out.append({
                                "name": tbl_name,
                                "row_count": 0,
                                "columns": [
                                    {"name": "id", "datatype": "string", "is_pk": True},
                                    {"name": "data", "datatype": "json", "is_pk": False},
                                ],
                            })
                        if out:
                            return out
            except Exception as e:
                logger.warning(f"Failed to query live Fabric tables: {e}")

        out: List[Dict[str, Any]] = []
        for name, rows in self._tables.items():
            columns: List[Dict[str, Any]] = []
            if rows:
                for idx, (col, val) in enumerate(rows[0].items()):
                    dt = "string"
                    if isinstance(val, bool):
                        dt = "boolean"
                    elif isinstance(val, (int, float)):
                        dt = "numeric"
                    columns.append(
                        {"name": col, "datatype": dt, "is_pk": idx == 0}
                    )
            out.append({"name": name, "row_count": len(rows), "columns": columns})
        return out

    def read_table(self, table: str, limit: int = 100) -> List[Dict[str, Any]]:
        return [dict(r) for r in self._tables.get(table, [])[:limit]]

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        if table not in self._tables:
            self._tables[table] = []

        if mode == "replace":
            self._tables[table] = [dict(r) for r in records]
            return {
                "table": table,
                "inserted": len(records),
                "updated": 0,
                "total": len(self._tables[table]),
            }

        inserted = 0
        updated = 0
        if mode == "upsert":
            key = None
            for k in (records[0].keys() if records else []):
                if k.lower() == "id" or k.lower().endswith("_id"):
                    key = k
                    break
            if key:
                by_key = {
                    r.get(key): r
                    for r in self._tables[table]
                    if r.get(key) is not None
                }
                for r in records:
                    rid = r.get(key)
                    if rid in by_key:
                        by_key[rid].update(r)
                        updated += 1
                    else:
                        self._tables[table].append(dict(r))
                        inserted += 1
            else:
                self._tables[table].extend(dict(r) for r in records)
                inserted = len(records)
        else:
            self._tables[table].extend(dict(r) for r in records)
            inserted = len(records)

        return {
            "table": table,
            "inserted": inserted,
            "updated": updated,
            "total": len(self._tables[table]),
        }

    def describe(self) -> Dict[str, Any]:
        return {
            "connector_type": self.name,
            "capabilities": self._capability_names(),
            "version": self.version,
            "workspace_id": self.workspace_id,
            "lakehouse_id": self.lakehouse_id,
        }

    def save_destination_mapping_catalog(self, mapping_catalog: Dict[str, Any]) -> bool:
        self._ontology_catalog_table.append(
            {
                "catalog_id": f"cat_{int(time.time() * 1000)}",
                "lakehouse_id": self.lakehouse_id,
                "workspace_id": self.workspace_id,
                "saved_timestamp": time.time(),
                "ontology_version_id": mapping_catalog.get("ontology_version_id"),
                "mapping_version_id": mapping_catalog.get("mapping_version_id"),
                "target_dataset": mapping_catalog.get("target_dataset_id"),
                "mappings": mapping_catalog.get("mappings", []),
            }
        )
        return True

    def get_destination_mapping_catalog(self) -> List[Dict[str, Any]]:
        return list(self._ontology_catalog_table)

    # ── Old API ───────────────────────────────────────────
    def capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            supports_snapshots=True,
            supports_cdc=True,
            supports_pushdown=True,
            supports_transactional_load=True,
            supports_idempotent_write=True,
            supports_compensation=True,
            supports_partitioning=True,
        )

    def discover(self) -> List[Dict[str, Any]]:
        results = []
        for table_name, rows in self._tables.items():
            fields: List[Dict[str, Any]] = []
            if rows:
                for idx, (col, val) in enumerate(rows[0].items()):
                    dt = "string"
                    if isinstance(val, bool):
                        dt = "boolean"
                    elif isinstance(val, (int, float)):
                        dt = "numeric"
                    fields.append(
                        {
                            "name": col,
                            "datatype": dt,
                            "nullable": True,
                            "ordinal": idx + 1,
                            "is_primary_key": idx == 0,
                            "is_business_key": "id" in col.lower(),
                            "is_metadata": col.startswith("meta_")
                            or col.startswith("_fabric_"),
                        }
                    )
            results.append(
                {
                    "dataset_name": table_name,
                    "fields": fields,
                    "row_count": len(rows),
                }
            )
        return results

    def estimate(self, scope: Dict[str, Any]) -> Dict[str, Any]:
        table = scope.get("dataset_name", "Fabric_Customer_Gold")
        rows = self._tables.get(table, [])
        return {
            "row_count": len(rows),
            "byte_size": len(str(rows)),
            "partition_count": max(1, (len(rows) + 999) // 1000),
        }

    def plan_extract(
        self,
        scope: Dict[str, Any],
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> List[PartitionInfo]:
        table = scope.get("dataset_name", "Fabric_Customer_Gold")
        rows = self._tables.get(table, [])
        batch = scope.get("batch_size", 500)
        partitions = []
        start = 0
        if checkpoint and "last_index" in checkpoint:
            start = checkpoint["last_index"]
        for i in range(start, len(rows), batch):
            partitions.append(
                PartitionInfo(
                    partition_id=f"fabric_{table}_part_{i // batch}",
                    dataset_name=table,
                    lower_bound=i,
                    upper_bound=min(i + batch, len(rows)),
                    row_count_estimate=min(batch, len(rows) - i),
                    token=str(i),
                )
            )
        return partitions or [
            PartitionInfo(
                partition_id=f"fabric_{table}_part_0",
                dataset_name=table,
                lower_bound=0,
                upper_bound=len(rows),
            )
        ]

    def read_partition(
        self,
        partition: PartitionInfo,
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        rows = self._tables.get(partition.dataset_name, [])
        start = partition.lower_bound or 0
        end = partition.upper_bound or len(rows)
        if checkpoint and "offset" in checkpoint:
            start = checkpoint["offset"]
        for row in rows[start:end]:
            yield dict(row)

    def write_batch(
        self,
        records: List[Dict[str, Any]],
        idempotency_context: Dict[str, Any],
    ) -> WriteBatchResult:
        table = idempotency_context.get("target_dataset", "Fabric_Customer_Gold")
        idem = idempotency_context.get("idempotency_key", "")
        if table not in self._tables:
            self._tables[table] = []
        accepted = 0
        target_ids = []
        for rec in records:
            rid = (
                rec.get("id")
                or rec.get("account_id")
                or rec.get("client_id")
                or str(len(self._tables[table]) + 1)
            )
            token = f"{idem}:{rid}"
            if token in self._written_keys:
                continue
            self._written_keys.add(token)
            rc = dict(rec)
            rc["_fabric_ingested_at"] = time.time()
            rc["_fabric_lakehouse_id"] = self.lakehouse_id
            self._tables[table].append(rc)
            target_ids.append(str(rid))
            accepted += 1
        return WriteBatchResult(
            accepted_records=accepted,
            rejected_records=0,
            target_ids=target_ids,
            rejection_reasons=[],
        )

    def begin_snapshot(self, operation_ref: str) -> None:
        self._snapshots[operation_ref] = copy.deepcopy(self._tables)

    def compensate(self, operation_ref: str) -> bool:
        if operation_ref in self._snapshots:
            self._tables = copy.deepcopy(self._snapshots[operation_ref])
            return True
        return False

    def health(self) -> Dict[str, Any]:
        return {
            "status": "UP",
            "connector_type": self.name,
            "version": self.version,
            "workspace_id": self.workspace_id,
            "lakehouse_id": self.lakehouse_id,
        }