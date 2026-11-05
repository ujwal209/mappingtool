"""
Relational connector — SQLite, in-memory DB. Standard library only.
"""

import sqlite3
import time
import uuid
from typing import Any, Dict, Iterator, List, Optional

from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)


_DT_MAP = {
    "int": "INTEGER",
    "integer": "INTEGER",
    "bigint": "INTEGER",
    "float": "REAL",
    "decimal": "REAL",
    "number": "REAL",
    "bool": "INTEGER",
    "boolean": "INTEGER",
    "date": "TEXT",
    "datetime": "TEXT",
    "timestamp": "TEXT",
    "string": "TEXT",
    "text": "TEXT",
    "json": "TEXT",
}


def _infer_sql_type(v: Any) -> str:
    if v is None:
        return "TEXT"
    if isinstance(v, bool):
        return "INTEGER"
    if isinstance(v, int):
        return "INTEGER"
    if isinstance(v, float):
        return "REAL"
    if isinstance(v, (list, dict)):
        return "TEXT"
    return "TEXT"


class RelationalConnector(BaseConnector):
    name = "relational"

    _DBS: Dict[str, sqlite3.Connection] = {}

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self._endpoint_key = (
            self.config.get("endpoint_id")
            or self.config.get("name")
            or f"sqlite-{uuid.uuid4().hex[:8]}"
        )

    def _connect(self) -> sqlite3.Connection:
        if self._endpoint_key not in self._DBS:
            conn = sqlite3.connect(":memory:", check_same_thread=False)
            conn.row_factory = sqlite3.Row
            self._DBS[self._endpoint_key] = conn
        return self._DBS[self._endpoint_key]

    def test_connection(self) -> Dict[str, Any]:
        t0 = time.time()
        try:
            conn = self._connect()
            conn.execute("SELECT 1").fetchone()
            return {
                "status": "SUCCESS",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": f"SQLite connected ({self._endpoint_key})",
                "capabilities": [
                    "snapshots",
                    "schema_discovery",
                    "idempotent_write",
                ],
            }
        except Exception as e:
            return {
                "status": "FAILED",
                "latency_ms": 0.0,
                "message": f"SQLite connection failed: {e}",
                "capabilities": [],
            }

    def list_tables(self) -> List[Dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        names = [r["name"] for r in cur.fetchall()]
        out: List[Dict[str, Any]] = []
        for name in names:
            info = conn.execute(f'PRAGMA table_info("{name}")').fetchall()
            columns = [
                {
                    "name": row["name"],
                    "datatype": row["type"],
                    "is_pk": bool(row["pk"]),
                }
                for row in info
            ]
            try:
                row_count = conn.execute(
                    f'SELECT COUNT(*) AS n FROM "{name}"'
                ).fetchone()["n"]
            except Exception:
                row_count = 0
            out.append({"name": name, "row_count": row_count, "columns": columns})
        return out

    def read_table(self, table: str, limit: int = 100) -> List[Dict[str, Any]]:
        try:
            cur = self._connect().execute(
                f'SELECT * FROM "{table}" LIMIT {int(limit)}'
            )
            return [dict(r) for r in cur.fetchall()]
        except Exception:
            return []

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        if not records:
            return {"table": table, "inserted": 0, "updated": 0, "total": 0}
        conn = self._connect()
        columns = list(records[0].keys())
        col_defs = ", ".join(
            f'"{c}" {_infer_sql_type(records[0][c])}' for c in columns
        )
        if mode == "replace":
            conn.execute(f'DROP TABLE IF EXISTS "{table}"')
        conn.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ({col_defs})')
        key = None
        if mode == "upsert":
            for c in columns:
                if c.lower() == "id" or c.lower().endswith("_id"):
                    key = c
                    break
        placeholders = ", ".join("?" for _ in columns)
        col_list = ", ".join(f'"{c}"' for c in columns)
        inserted = 0
        updated = 0
        for r in records:
            values = [r.get(c) for c in columns]
            try:
                if key:
                    exists = conn.execute(
                        f'SELECT COUNT(*) AS n FROM "{table}" WHERE "{key}" = ?',
                        [r.get(key)],
                    ).fetchone()["n"]
                    if exists > 0:
                        assignments = ", ".join(
                            f'"{c}" = ?' for c in columns if c != key
                        )
                        if assignments:
                            conn.execute(
                                f'UPDATE "{table}" SET {assignments} WHERE "{key}" = ?',
                                [r.get(c) for c in columns if c != key]
                                + [r.get(key)],
                            )
                        updated += 1
                        continue
                conn.execute(
                    f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})',
                    values,
                )
                inserted += 1
            except Exception:
                continue
        conn.commit()
        try:
            total = conn.execute(
                f'SELECT COUNT(*) AS n FROM "{table}"'
            ).fetchone()["n"]
        except Exception:
            total = inserted + updated
        return {
            "table": table,
            "inserted": inserted,
            "updated": updated,
            "total": total,
        }

    def describe(self) -> Dict[str, Any]:
        return {
            "connector_type": self.name,
            "capabilities": self._capability_names(),
            "version": self.version,
            "endpoint_key": self._endpoint_key,
        }

    # ── Old API ───────────────────────────────────────────
    def capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            supports_snapshots=True,
            supports_cdc=False,
            supports_pushdown=True,
            supports_transactional_load=True,
            supports_idempotent_write=True,
            supports_compensation=False,
            supports_partitioning=True,
        )

    def discover(self) -> List[Dict[str, Any]]:
        results = []
        for t in self.list_tables():
            fields = [
                {
                    "name": c["name"],
                    "datatype": c["datatype"],
                    "nullable": True,
                    "ordinal": idx + 1,
                    "is_primary_key": c["is_pk"],
                    "is_business_key": c["name"].lower().endswith("_id"),
                    "is_metadata": c["name"].startswith("meta_"),
                }
                for idx, c in enumerate(t["columns"])
            ]
            results.append(
                {
                    "dataset_name": t["name"],
                    "fields": fields,
                    "row_count": t["row_count"],
                }
            )
        return results

    def read_partition(
        self,
        partition: PartitionInfo,
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        rows = self.read_table(partition.dataset_name, limit=1_000_000)
        start = partition.lower_bound or 0
        end = partition.upper_bound or len(rows)
        for r in rows[start:end]:
            yield r

    def write_batch(
        self,
        records: List[Dict[str, Any]],
        idempotency_context: Dict[str, Any],
    ) -> WriteBatchResult:
        table = idempotency_context.get("target_dataset", "default")
        r = self.write_records(table, records, mode="append")
        return WriteBatchResult(
            accepted_records=int(r.get("inserted", 0)),
            rejected_records=0,
        )