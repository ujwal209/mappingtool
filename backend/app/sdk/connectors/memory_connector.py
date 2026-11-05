"""
In-Memory Connector Plugin.

Provides full fidelity connector SPI implementation for testing, mock
datasets, and deterministic golden-migration runs.
"""

from typing import Any, Dict, Iterator, List, Optional

from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)


class MemoryConnector(BaseConnector):
    """
    In-memory connector with partition slicing, deterministic ordering,
    idempotent upserts, and compensation rollback snapshots.
    """

    name = "memory"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self.version = "1.0.0"
        self._tables: Dict[str, List[Dict[str, Any]]] = self.config.get(
            "tables", {}
        )
        self._snapshots: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._written_keys: set = set()

    # ── New API (native implementation) ───────────────────
    def test_connection(self) -> Dict[str, Any]:
        return {
            "status": "SUCCESS",
            "latency_ms": 1.5,
            "message": "Memory connector active and healthy",
            "capabilities": [
                "snapshots",
                "idempotent_write",
                "compensation",
                "schema_discovery",
            ],
        }

    def list_tables(self) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for name, rows in self._tables.items():
            columns: List[Dict[str, Any]] = []
            if rows:
                for idx, (col, val) in enumerate(rows[0].items()):
                    columns.append(
                        {
                            "name": col,
                            "datatype": type(val).__name__,
                            "is_pk": idx == 0,
                        }
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
            "table_count": len(self._tables),
        }

    # ── Old API ───────────────────────────────────────────
    def capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            supports_snapshots=True,
            supports_cdc=False,
            supports_pushdown=True,
            supports_transactional_load=True,
            supports_idempotent_write=True,
            supports_compensation=True,
            supports_partitioning=True,
        )

    def discover(self) -> List[Dict[str, Any]]:
        results = []
        for table_name, rows in self._tables.items():
            fields = []
            if rows:
                for idx, (col, val) in enumerate(rows[0].items()):
                    fields.append(
                        {
                            "name": col,
                            "datatype": type(val).__name__,
                            "nullable": True,
                            "ordinal": idx + 1,
                            "is_primary_key": idx == 0,
                            "is_business_key": "id" in col.lower(),
                            "is_metadata": col.startswith("meta_"),
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
        table = scope.get("dataset_name", "default")
        rows = self._tables.get(table, [])
        return {
            "row_count": len(rows),
            "byte_size": len(str(rows)),
            "partition_count": max(1, (len(rows) + 99) // 100),
        }

    def plan_extract(
        self,
        scope: Dict[str, Any],
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> List[PartitionInfo]:
        table = scope.get("dataset_name", "default")
        rows = self._tables.get(table, [])
        batch = scope.get("batch_size", 100)
        partitions = []
        start = 0
        if checkpoint and "last_index" in checkpoint:
            start = checkpoint["last_index"]
        for i in range(start, len(rows), batch):
            partitions.append(
                PartitionInfo(
                    partition_id=f"{table}_part_{i // batch}",
                    dataset_name=table,
                    lower_bound=i,
                    upper_bound=min(i + batch, len(rows)),
                    row_count_estimate=min(batch, len(rows) - i),
                    token=str(i),
                )
            )
        return partitions or [
            PartitionInfo(
                partition_id=f"{table}_part_0",
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
        table = idempotency_context.get("target_dataset", "default")
        idem = idempotency_context.get("idempotency_key", "")
        if table not in self._tables:
            self._tables[table] = []
        accepted = 0
        target_ids = []
        for rec in records:
            rid = (
                rec.get("id")
                or rec.get("client_id")
                or rec.get("sku")
                or str(len(self._tables[table]) + 1)
            )
            token = f"{idem}:{rid}"
            if token in self._written_keys:
                continue
            self._written_keys.add(token)
            self._tables[table].append(dict(rec))
            target_ids.append(str(rid))
            accepted += 1
        return WriteBatchResult(
            accepted_records=accepted,
            rejected_records=0,
            target_ids=target_ids,
            rejection_reasons=[],
        )

    def begin_snapshot(self, operation_ref: str) -> None:
        import copy

        self._snapshots[operation_ref] = copy.deepcopy(self._tables)

    def compensate(self, operation_ref: str) -> bool:
        import copy

        if operation_ref in self._snapshots:
            self._tables = copy.deepcopy(self._snapshots[operation_ref])
            return True
        return False

    def health(self) -> Dict[str, Any]:
        return {
            "status": "UP",
            "connector_type": self.name,
            "version": self.version,
        }

    def read_rows(
        self, table: str, offset: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Slice rows [offset : offset+limit] from a table. O(limit)."""
        rows = self._tables.get(table, [])
        return [dict(r) for r in rows[offset : offset + limit]]