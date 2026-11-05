"""
Abstract connector interface — UNIFIED.

Supports both:

  • OLD-style API (used by systems.py / orchestrator / lineage):
      capabilities(), discover(), estimate(), plan_extract(),
      read_partition(), write_batch(), begin_snapshot(),
      compensate(), health()

  • NEW-style API (used by demo.py / connect-tests / explore):
      test_connection(), list_tables(), read_table(),
      write_records(), describe()

Concrete connectors can implement either surface — the base class
bridges the two so a connector implementing only one API still
satisfies `systems.py` and `demo.py`.
"""

from abc import ABC
from typing import Any, Dict, Iterator, List, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# Data classes used by the OLD-style API
# ─────────────────────────────────────────────────────────────
class ConnectorCapabilities(BaseModel):
    supports_snapshots: bool = True
    supports_cdc: bool = False
    supports_pushdown: bool = True
    supports_transactional_load: bool = True
    supports_idempotent_write: bool = True
    supports_compensation: bool = True
    supports_partitioning: bool = True


class PartitionInfo(BaseModel):
    partition_id: str
    dataset_name: str = ""
    lower_bound: int = 0
    upper_bound: int = 0
    row_count_estimate: int = 0
    token: Optional[str] = None


class WriteBatchResult(BaseModel):
    accepted_records: int = 0
    rejected_records: int = 0
    target_ids: List[str] = Field(default_factory=list)
    rejection_reasons: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────
# Base connector
# ─────────────────────────────────────────────────────────────
class BaseConnector(ABC):
    """
    Base for every connector. Not abstract — every method has a
    working default so subclasses only override what they support.
    """

    name: str = "base"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        self.config = endpoint_config or {}
        self.secret_ref = secret_ref
        self.version = "1.0.0"

    # ═══════════════════════════════════════════════════════
    # NEW API — dict-returning, used by demo.py / explore
    # ═══════════════════════════════════════════════════════
    def test_connection(self) -> Dict[str, Any]:
        """Health check. Returns {status, latency_ms, message, capabilities}."""
        return {
            "status": "SUCCESS",
            "latency_ms": 0.0,
            "message": f"{self.name} connector ready",
            "capabilities": self._capability_names(),
        }

    def list_tables(self) -> List[Dict[str, Any]]:
        """
        List tables. Returns [{name, row_count, columns: [{name, datatype, is_pk}]}].
        Default implementation bridges from `discover()`.
        """
        out: List[Dict[str, Any]] = []
        try:
            for d in self.discover():
                table_name = d.get("dataset_name") or d.get("name") or "table"
                fields = d.get("fields") or d.get("columns") or []
                columns = [
                    {
                        "name": f.get("name"),
                        "datatype": f.get("datatype", "string"),
                        "is_pk": bool(f.get("is_primary_key") or f.get("is_pk")),
                    }
                    for f in fields
                ]
                out.append(
                    {
                        "name": table_name,
                        "row_count": int(d.get("row_count", 0)),
                        "columns": columns,
                    }
                )
        except Exception:
            pass
        return out

    def read_table(self, table: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Read rows from a table. Default bridges from plan_extract/read_partition."""
        try:
            scope = {"dataset_name": table, "batch_size": limit}
            partitions = self.plan_extract(scope)
            if not partitions:
                return []
            rows: List[Dict[str, Any]] = []
            for p in partitions:
                for row in self.read_partition(p):
                    rows.append(row)
                    if len(rows) >= limit:
                        return rows
            return rows
        except Exception:
            return []

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        """
        Write rows to a table. Default bridges from write_batch.
        Returns {table, inserted, updated, total}.
        """
        idem_ctx = {
            "target_dataset": table,
            "idempotency_key": f"{mode}:{self.name}:{table}",
        }
        try:
            res = self.write_batch(records, idem_ctx)
            accepted = getattr(res, "accepted_records", 0) or 0
            return {
                "table": table,
                "inserted": accepted,
                "updated": 0,
                "total": accepted,
            }
        except Exception:
            return {"table": table, "inserted": 0, "updated": 0, "total": 0}

    def describe(self) -> Dict[str, Any]:
        """Return {connector_type, capabilities, version}."""
        return {
            "connector_type": self.name,
            "capabilities": self._capability_names(),
            "version": self.version,
        }

    # ═══════════════════════════════════════════════════════
    # OLD API — used by orchestrator / systems.py / lineage
    # ═══════════════════════════════════════════════════════
    def capabilities(self) -> ConnectorCapabilities:
        """Declared capabilities. Override to disable specific features."""
        return ConnectorCapabilities()

    def discover(self) -> List[Dict[str, Any]]:
        """
        Discover schemas. Returns list of
        {dataset_name, fields: [{name, datatype, is_primary_key, ...}], row_count}.
        """
        return []

    def estimate(self, scope: Dict[str, Any]) -> Dict[str, Any]:
        """Return {row_count, byte_size, partition_count}."""
        table = scope.get("dataset_name", "default")
        try:
            rows = self.read_table(table, limit=1_000_000)
        except Exception:
            rows = []
        return {
            "row_count": len(rows),
            "byte_size": len(str(rows)),
            "partition_count": max(1, (len(rows) + 499) // 500),
        }

    def plan_extract(
        self,
        scope: Dict[str, Any],
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> List[PartitionInfo]:
        """Partition plan. Default: single partition covering the table."""
        table = scope.get("dataset_name", "default")
        try:
            total = len(self.read_table(table, limit=1_000_000))
        except Exception:
            total = 0
        return [
            PartitionInfo(
                partition_id=f"{table}_part_0",
                dataset_name=table,
                lower_bound=0,
                upper_bound=total,
                row_count_estimate=total,
                token="0",
            )
        ]

    def read_partition(
        self,
        partition: PartitionInfo,
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        """Yield rows for a partition. Default: no rows."""
        return iter([])

    def write_batch(
        self,
        records: List[Dict[str, Any]],
        idempotency_context: Dict[str, Any],
    ) -> WriteBatchResult:
        """
        Write a batch. Default bridges from write_records.
        """
        table = idempotency_context.get("target_dataset", "default")
        try:
            r = self.write_records(table, records, mode="append")
            return WriteBatchResult(
                accepted_records=int(r.get("inserted", 0)),
                rejected_records=0,
                target_ids=[],
                rejection_reasons=[],
            )
        except Exception:
            return WriteBatchResult()

    def begin_snapshot(self, operation_ref: str) -> None:
        """Create a point-in-time snapshot for rollback."""
        return

    def compensate(self, operation_ref: str) -> bool:
        """Rollback to the given snapshot. Default: no-op success."""
        return True

    def health(self) -> Dict[str, Any]:
        """Return {status, connector_type, version}."""
        return {
            "status": "UP",
            "connector_type": self.name,
            "version": self.version,
        }

    # ═══════════════════════════════════════════════════════
    # Helpers
    # ═══════════════════════════════════════════════════════
    def _capability_names(self) -> List[str]:
        """Convert ConnectorCapabilities to a list of strings for the new API."""
        try:
            caps = self.capabilities()
        except Exception:
            return []
        names: List[str] = []
        if caps.supports_snapshots:
            names.append("snapshots")
        if caps.supports_cdc:
            names.append("cdc")
        if caps.supports_pushdown:
            names.append("schema_discovery")
        if caps.supports_transactional_load:
            names.append("transactional_load")
        if caps.supports_idempotent_write:
            names.append("idempotent_write")
        if caps.supports_compensation:
            names.append("compensation")
        if caps.supports_partitioning:
            names.append("partitioning")
        return names