"""
Real REST API Connector.

Fetches a JSON endpoint over HTTP(S), infers the column schema from the
returned records, and exposes:

  - ONE main logical table named after the URL's last path segment.
  - ZERO or more CHILD logical tables for nested objects / arrays
    (e.g. `posts.user`, `posts.comments`). Child tables carry a
    synthetic `_parent_id` FK column back to the parent table.

All sample_records are pre-flattened to plain dicts so the UI can render
them as a tabular grid without extra work.
"""

from __future__ import annotations

import copy
import json
import time
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import urlparse

import httpx

from app.core.logging import logger
from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)


MAX_ROWS_PER_TABLE = 5000
MAX_RESPONSE_BYTES = 15 * 1024 * 1024  # 15 MB
DEFAULT_TIMEOUT = 20.0
SAMPLE_SIZE = 5
NESTED_SAMPLE_SIZE = 5


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def _table_name_from_url(url: str) -> str:
    try:
        path = urlparse(url).path.strip("/")
        if not path:
            return "root"
        return path.split("/")[-1] or "root"
    except Exception:
        return "root"


def _infer_datatype(value: Any) -> str:
    if value is None:
        return "string"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "decimal"
    if isinstance(value, (list, tuple, dict)):
        return "json"
    return "string"


def _extract_records(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        candidates = payload
    elif isinstance(payload, dict):
        found = None
        for key in ("data", "items", "results", "records", "value", "rows"):
            v = payload.get(key)
            if isinstance(v, list):
                found = v
                break
        candidates = found if found is not None else [payload]
    else:
        return []

    out: List[Dict[str, Any]] = []
    for item in candidates:
        if isinstance(item, dict):
            out.append(item)
        elif isinstance(item, (str, int, float, bool)) or item is None:
            out.append({"value": item})
    return out


def _flatten_for_display(
    value: Any, prefix: str = "", out: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    if out is None:
        out = {}

    if isinstance(value, dict):
        for k, v in value.items():
            key = f"{prefix}.{k}" if prefix else k
            _flatten_for_display(v, key, out)
    elif isinstance(value, (list, tuple)):
        if value and all(isinstance(i, dict) for i in value):
            out[prefix] = f"[{len(value)} items]"
        else:
            try:
                out[prefix] = json.dumps(value, ensure_ascii=False)
            except Exception:
                out[prefix] = str(value)
    else:
        out[prefix] = value

    return out


def _infer_columns(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Dict[str, Any] = {}
    for rec in records[:200]:
        for k, v in rec.items():
            if k not in seen:
                seen[k] = v
            elif seen[k] is None and v is not None:
                seen[k] = v

    cols: List[Dict[str, Any]] = []
    for idx, (name, sample_val) in enumerate(seen.items()):
        is_id = name.lower() in ("id", "uuid", "key") or name.lower().endswith("_id")
        cols.append(
            {
                "name": name,
                "datatype": _infer_datatype(sample_val),
                "nullable": True,
                "ordinal": idx + 1,
                "is_primary_key": name.lower() in ("id", "uuid", "key"),
                "is_business_key": is_id,
                "is_metadata": False,
            }
        )
    return cols


def _parent_key_of(record: Dict[str, Any], idx: int) -> str:
    for k in ("id", "uuid", "key", "_id"):
        for rk, rv in record.items():
            if rk.lower() == k and rv is not None:
                return str(rv)
    return f"row-{idx}"


# ─────────────────────────────────────────────────────────────
# Connector
# ─────────────────────────────────────────────────────────────
class RestApiConnector(BaseConnector):
    name = "rest_api"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self.version = "1.2.0"

        cfg = self.config or {}
        self.endpoint_url: str = (
            cfg.get("endpoint_url") or cfg.get("url") or cfg.get("endpoint") or ""
        ).strip()
        self.auth_header: str = (
            cfg.get("auth_header") or cfg.get("bearer_token") or ""
        ).strip()
        self.extra_headers: Dict[str, str] = dict(cfg.get("headers") or {})
        self.method: str = (cfg.get("method") or "GET").upper()
        self.body: Any = cfg.get("body")
        self.timeout: float = float(cfg.get("timeout") or DEFAULT_TIMEOUT)

        self.root_name: str = (
            _table_name_from_url(self.endpoint_url)
            if self.endpoint_url
            else "api_table"
        )

        self._tables: Dict[str, List[Dict[str, Any]]] = {}
        self._columns: Dict[str, List[Dict[str, Any]]] = {}
        self._sample: Dict[str, List[Dict[str, Any]]] = {}
        self._last_fetch_ts: Optional[float] = None
        self._snapshots: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._written_keys: set = set()

    # ── HTTP ─────────────────────────────────────────────
    def _fetch(self) -> List[Dict[str, Any]]:
        if not self.endpoint_url:
            raise ValueError("REST API connector requires 'endpoint_url'.")

        headers: Dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": "MigrationStudio/1.2 (+rest-api-connector)",
        }
        if self.auth_header:
            h = self.auth_header
            if not h.lower().startswith(("bearer ", "basic ", "token ")):
                h = f"Bearer {h}"
            headers["Authorization"] = h
        headers.update(self.extra_headers)

        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as c:
                if self.method == "GET":
                    r = c.get(self.endpoint_url, headers=headers)
                elif self.method == "POST":
                    r = c.post(self.endpoint_url, headers=headers, json=self.body or {})
                else:
                    r = c.request(self.method, self.endpoint_url, headers=headers)
        except httpx.HTTPError as e:
            raise RuntimeError(f"HTTP request failed: {e}") from e

        raw = r.content
        if len(raw) > MAX_RESPONSE_BYTES:
            raise RuntimeError(
                f"Response too large ({len(raw)} bytes > {MAX_RESPONSE_BYTES})."
            )
        if r.status_code >= 400:
            raise RuntimeError(
                f"HTTP {r.status_code} {r.reason_phrase} — "
                f"{raw[:500].decode('utf-8', errors='replace')}"
            )
        try:
            payload = r.json()
        except Exception as e:
            preview = raw[:200].decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Not JSON (content-type={r.headers.get('content-type')}, "
                f"preview={preview!r}): {e}"
            ) from e

        records = _extract_records(payload)
        return records[:MAX_ROWS_PER_TABLE]

    # ── Schema inference with nested-table discovery ─────
    def _build_tables_from_records(self, records: List[Dict[str, Any]]) -> None:
        self._tables.clear()
        self._columns.clear()
        self._sample.clear()

        root_flat: List[Dict[str, Any]] = []
        child_rows: Dict[str, List[Dict[str, Any]]] = {}

        for idx, record in enumerate(records):
            parent_key = _parent_key_of(record, idx)
            flat = _flatten_for_display(record)
            flat.setdefault("_parent_id", parent_key)
            root_flat.append(flat)

            self._walk_children(record, parent_key, child_rows)

        self._tables[self.root_name] = root_flat
        self._columns[self.root_name] = _infer_columns(root_flat)
        self._sample[self.root_name] = [dict(r) for r in root_flat[:SAMPLE_SIZE]]

        for child_name, rows in child_rows.items():
            if not rows:
                continue
            self._tables[child_name] = rows
            self._columns[child_name] = _infer_columns(rows)
            self._sample[child_name] = [
                dict(r) for r in rows[:NESTED_SAMPLE_SIZE]
            ]

    def _walk_children(
        self,
        node: Dict[str, Any],
        parent_key: str,
        sink: Dict[str, List[Dict[str, Any]]],
        prefix: str = "",
    ) -> None:
        for k, v in node.items():
            key = f"{prefix}.{k}" if prefix else k
            full_name = f"{self.root_name}.{key}"
            if isinstance(v, dict):
                flat = _flatten_for_display(v)
                flat.setdefault("_parent_id", parent_key)
                sink.setdefault(full_name, []).append(flat)
                self._walk_children(v, parent_key, sink, key)
            elif isinstance(v, list) and v and all(isinstance(i, dict) for i in v):
                for sub in v:
                    flat = _flatten_for_display(sub)
                    flat.setdefault("_parent_id", parent_key)
                    sink.setdefault(full_name, []).append(flat)
                    self._walk_children(sub, parent_key, sink, key)

    def _ensure_fetched(self) -> None:
        if self._last_fetch_ts is not None:
            return
        try:
            records = self._fetch()
        except Exception as e:
            logger.warning(f"[RestApiConnector] fetch failed: {e}")
            records = []
        self._build_tables_from_records(records)
        self._last_fetch_ts = time.time()

    # ── New API ─────────────────────────────────────────
    def test_connection(self) -> Dict[str, Any]:
        if not self.endpoint_url:
            return {
                "status": "FAILED",
                "latency_ms": 0.0,
                "message": "endpoint_url is missing.",
                "capabilities": [],
            }

        t0 = time.time()
        try:
            records = self._fetch()
        except Exception as e:
            return {
                "status": "FAILED",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": str(e),
                "capabilities": [],
            }

        latency = round((time.time() - t0) * 1000, 2)
        self._build_tables_from_records(records)
        self._last_fetch_ts = time.time()

        child_count = len(self._tables) - 1
        extra = f" · {child_count} nested table(s)" if child_count > 0 else ""

        return {
            "status": "SUCCESS",
            "latency_ms": latency,
            "message": (
                f"Fetched {len(records)} record(s) from {self.endpoint_url}{extra} "
                f"in {latency} ms."
            ),
            "capabilities": [
                "json_parsing",
                "schema_inference",
                "nested_flattening",
                "nested_table_discovery",
                "bearer_auth",
            ],
        }

    def list_tables(self) -> List[Dict[str, Any]]:
        self._ensure_fetched()
        out: List[Dict[str, Any]] = []
        for name, rows in self._tables.items():
            out.append(
                {
                    "name": name,
                    "row_count": len(rows),
                    "columns": self._columns.get(name, []),
                    "sample_records": self._sample.get(name, []),
                }
            )
        return out

    def read_table(self, table: str, limit: int = 100) -> List[Dict[str, Any]]:
        self._ensure_fetched()
        rows = self._tables.get(table, [])
        return [dict(r) for r in rows[:limit]]

    # ═════════════════════════════════════════════════════
    # NEW: paginated row read — used by /preview endpoint
    # ═════════════════════════════════════════════════════
    def read_rows(
        self, table: str, offset: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Slice rows [offset : offset+limit] from a table. O(limit)."""
        self._ensure_fetched()
        rows = self._tables.get(table, [])
        return [dict(r) for r in rows[offset : offset + limit]]

    def write_records(
        self, table: str, records: List[Dict[str, Any]], mode: str = "append"
    ) -> Dict[str, Any]:
        if table not in self._tables:
            self._tables[table] = []
        if table not in self._columns:
            self._columns[table] = _infer_columns(records)

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
        if mode == "upsert" and records:
            key = None
            for k in records[0].keys():
                if k.lower() in ("id", "uuid", "key") or k.lower().endswith("_id"):
                    key = k
                    break
            if key:
                by_key = {
                    r.get(key): r for r in self._tables[table] if r.get(key) is not None
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
            "endpoint_url": self.endpoint_url,
            "root_table": self.root_name,
        }

    # ── Old API ─────────────────────────────────────────
    def capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            supports_snapshots=True,
            supports_cdc=False,
            supports_pushdown=True,
            supports_transactional_load=False,
            supports_idempotent_write=True,
            supports_compensation=False,
            supports_partitioning=False,
        )

    def discover(self) -> List[Dict[str, Any]]:
        self._ensure_fetched()
        return [
            {
                "dataset_name": name,
                "fields": self._columns.get(name, []),
                "row_count": len(rows),
            }
            for name, rows in self._tables.items()
        ]

    def estimate(self, scope: Dict[str, Any]) -> Dict[str, Any]:
        table = scope.get("dataset_name", self.root_name)
        rows = self._tables.get(table, [])
        return {
            "row_count": len(rows),
            "byte_size": len(str(rows)),
            "partition_count": 1,
        }

    def plan_extract(
        self, scope: Dict[str, Any], checkpoint: Optional[Dict[str, Any]] = None
    ) -> List[PartitionInfo]:
        self._ensure_fetched()
        table = scope.get("dataset_name", self.root_name)
        rows = self._tables.get(table, [])
        return [
            PartitionInfo(
                partition_id=f"{table}_part_0",
                dataset_name=table,
                lower_bound=0,
                upper_bound=len(rows),
                row_count_estimate=len(rows),
                token="0",
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
        self, records: List[Dict[str, Any]], idempotency_context: Dict[str, Any]
    ) -> WriteBatchResult:
        table = idempotency_context.get("target_dataset", self.root_name)
        r = self.write_records(table, records, mode="append")
        return WriteBatchResult(accepted_records=r["inserted"], rejected_records=0)

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
            "endpoint_url": self.endpoint_url,
        }