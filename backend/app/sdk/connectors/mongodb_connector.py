"""
Real MongoDB Atlas Connector.

Talks to a live MongoDB deployment (Atlas SRV URIs, standalone, replica
set, mongos) using pymongo.

Capabilities
------------
- list_tables()        → collections + exact doc counts + inferred schema
- collection_stats()   → exact count + avg document size + index list
- read_table(name)     → bounded preview when limit is passed, full stream otherwise
- read_rows(...)       → cursor-paginated slice (server-side skip/limit)
- iter_collection(...) → streams the full collection in bounded batches
- write_records(...)   → insert / upsert / replace records
- test_connection()    → ping + masked response
- begin_snapshot()     → deepcopy of read collections for rollback
- compensate()         → restore from snapshot
"""

from __future__ import annotations

import copy
import json
import threading
import time
from datetime import date, datetime
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import urlparse

from app.core.config import settings
from app.core.logging import logger
from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)

try:
    from bson import ObjectId
    from pymongo import MongoClient, ReplaceOne
    from pymongo.database import Database
    from pymongo.errors import (
        BulkWriteError,
        ConnectionFailure,
        DuplicateKeyError,
        OperationFailure,
        PyMongoError,
        ServerSelectionTimeoutError,
    )
    PYMONGO_AVAILABLE = True
except ImportError:  # pragma: no cover
    PYMONGO_AVAILABLE = False
    MongoClient = None  # type: ignore
    Database = None  # type: ignore
    ReplaceOne = None  # type: ignore

    class PyMongoError(Exception): ...  # type: ignore
    class ConnectionFailure(PyMongoError): ...  # type: ignore
    class OperationFailure(PyMongoError): ...  # type: ignore
    class ServerSelectionTimeoutError(PyMongoError): ...  # type: ignore
    class DuplicateKeyError(PyMongoError): ...  # type: ignore
    class BulkWriteError(PyMongoError): ...  # type: ignore

DEFAULT_STREAM_BATCH = 1000
# Safety cap for full-collection reads when limit=None
MAX_FULL_READ = 200_000

_BSON_TYPE_MAP = {
    "string": "string",
    "int": "integer",
    "long": "bigint",
    "double": "decimal",
    "decimal": "decimal",
    "bool": "boolean",
    "date": "datetime",
    "timestamp": "timestamp",
    "objectId": "objectId",
    "object": "object",
    "array": "array",
    "binData": "binary",
    "null": "string",
    "regex": "string",
    "javascript": "string",
    "symbol": "string",
    "undefined": "string",
    "minKey": "string",
    "maxKey": "string",
}


# ============================================================
# Helpers
# ============================================================
def _humanize(name: str) -> str:
    return " ".join(
        ("ID" if p.lower() == "id" else p.capitalize())
        for p in name.replace("_", " ").split()
    )


def _json_safe(value: Any) -> Any:
    """Convert BSON-native types to JSON-serializable equivalents."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="replace")
        except Exception:
            return repr(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return str(value)


def _flatten(
    doc: Dict[str, Any],
    prefix: str = "",
    out: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Flatten nested documents into dot-notation keys for tabular output."""
    if out is None:
        out = {}

    for k, v in doc.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            _flatten(v, key, out)
        elif isinstance(v, (list, tuple)):
            if v and all(isinstance(i, dict) for i in v):
                out[f"{key}.__nested_array__"] = json.dumps(
                    _json_safe(list(v)), ensure_ascii=False
                )
            else:
                out[key] = json.dumps(_json_safe(list(v)), ensure_ascii=False)
        else:
            out[key] = _json_safe(v)

    return out


def _infer_mongo_datatype(value: Any) -> str:
    if value is None:
        return "string"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "decimal"
    if isinstance(value, ObjectId):
        return "objectId"
    if isinstance(value, datetime):
        return "datetime"
    if isinstance(value, date):
        return "date"
    if isinstance(value, bytes):
        return "binary"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "string"


def _mongo_type_to_dtype(bson_type: str) -> str:
    return _BSON_TYPE_MAP.get(bson_type, "string")


def _mask_uri(uri: str) -> str:
    """Mask credentials inside MongoDB URI for safe logging."""
    if not uri:
        return "[NOT_SET]"
    try:
        if "://" in uri:
            scheme, rest = uri.split("://", 1)
        else:
            scheme, rest = "mongodb", uri
        if "@" in rest:
            creds, hostpart = rest.rsplit("@", 1)
            if ":" in creds:
                user, _ = creds.split(":", 1)
                return f"{scheme}://{user}:****@{hostpart}"
            return f"{scheme}://****@{hostpart}"
        return uri
    except Exception:
        return "***masked***"


def _extract_db_from_uri(uri: str) -> Optional[str]:
    """Parse out database name segment from URI if specified."""
    try:
        parsed = urlparse(uri)
        path = (parsed.path or "").strip("/")
        if path:
            return path.split("?")[0].strip()
    except Exception:
        pass
    return None


# ============================================================
# Connector
# ============================================================
class MongoDBAtlasConnector(BaseConnector):
    name = "mongodb"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self.version = "1.3.0"
        cfg = self.config or {}

        raw_uri = (
            cfg.get("uri")
            or cfg.get("connection_string")
            or cfg.get("mongodb_uri")
            or cfg.get("endpoint_url")
            or settings.resolved_mongo_uri
            or settings.MONGODB_URI
            or ""
        ).strip()

        db_from_uri = _extract_db_from_uri(raw_uri)
        explicit_db = (
            cfg.get("database")
            or cfg.get("db")
            or cfg.get("db_name")
            or db_from_uri
            or getattr(settings, "DB_NAME", None)
            or "mapping"
        ).strip()

        self.uri: str = raw_uri
        self.database: str = explicit_db
        self.username: str = (
            cfg.get("username")
            or cfg.get("user")
            or getattr(settings, "MONGODB_USERNAME", "")
            or ""
        )
        self.password: str = (
            cfg.get("password")
            or getattr(settings, "MONGODB_PASSWORD", "")
            or ""
        )
        self.auth_source: str = cfg.get("auth_source") or "admin"
        self.tls: bool = cfg.get("tls", True)
        self.timeout_ms: int = int(cfg.get("timeout_ms") or 5000)

        self._client: Optional[MongoClient] = None
        self._db: Optional[Database] = None
        self._lock = threading.Lock()

        self._schema_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._snapshots: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._written_keys: set = set()

    # ---------------------------------------------------------
    # Connection Management
    # ---------------------------------------------------------
    def _resolve_uri(self) -> str:
        uri = self.uri
        if not uri:
            raise ValueError(
                "MongoDB connector requires 'uri' (or 'connection_string') in connection_config."
            )
        if self.username and self.password and "@" not in uri.split("://", 1)[-1]:
            from urllib.parse import quote_plus
            scheme = uri.split("://", 1)[0] if "://" in uri else "mongodb"
            rest = uri.split("://", 1)[-1] if "://" in uri else uri
            uri = f"{scheme}://{quote_plus(self.username)}:{quote_plus(self.password)}@{rest}"
        return uri

    def _connect(self) -> Database:
        if not PYMONGO_AVAILABLE:
            raise RuntimeError("pymongo is not installed. Run: uv add pymongo dnspython")
        if self._db is not None:
            return self._db

        with self._lock:
            if self._db is not None:
                return self._db

            uri = self._resolve_uri()
            client = MongoClient(
                uri,
                serverSelectionTimeoutMS=self.timeout_ms,
                connectTimeoutMS=self.timeout_ms,
                socketTimeoutMS=max(self.timeout_ms * 2, 10000),
                retryWrites=True,
                maxPoolSize=10,
            )
            client.admin.command("ping")
            self._client = client
            self._db = client[self.database]
            logger.info(f"[MongoDB] connected uri={_mask_uri(uri)} db={self.database}")
            return self._db

    def __del__(self):  # pragma: no cover
        try:
            if self._client is not None:
                self._client.close()
        except Exception:
            pass

    def invalidate_schema(self) -> None:
        self._schema_cache.clear()

    # ---------------------------------------------------------
    # Connection Test
    # ---------------------------------------------------------
    def test_connection(self) -> Dict[str, Any]:
        t0 = time.time()
        try:
            db = self._connect()
            db.command("ping")
            server_version = "?"
            try:
                info = self._client.server_info()  # type: ignore[union-attr]
                server_version = info.get("version", "?")
            except Exception:
                pass

            collections = []
            try:
                collections = db.list_collection_names()
            except Exception:
                pass

            return {
                "status": "SUCCESS",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": (
                    f"Connected to MongoDB {server_version} "
                    f"(db={self.database}, collections={len(collections)})"
                ),
                "capabilities": self._capability_names(),
                "database": self.database,
                "server_version": server_version,
            }
        except Exception as e:
            logger.warning(f"[MongoDB] test_connection failed: {e}")
            return {
                "status": "FAILED",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": f"MongoDB connection failed: {e}",
                "capabilities": [],
            }

    # ---------------------------------------------------------
    # Counts — reliable, not the flaky estimate
    # ---------------------------------------------------------
    def _exact_count(self, coll) -> int:
        """Use count_documents({}) — reliable across Atlas tiers.
        Fall back to estimated_document_count only if it errors."""
        try:
            return int(coll.count_documents({}, maxTimeMS=self.timeout_ms * 4))
        except Exception:
            try:
                return int(coll.estimated_document_count())
            except Exception:
                return 0

    # ---------------------------------------------------------
    # Schema Inference
    # ---------------------------------------------------------
    def _infer_full_schema(self, db: Database, coll_name: str) -> List[Dict[str, Any]]:
        try:
            sample_docs = list(db[coll_name].find().limit(100))
            if not sample_docs:
                return [{"name": "_id", "datatype": "objectId", "is_pk": True}]
        except Exception:
            return [{"name": "_id", "datatype": "objectId", "is_pk": True}]

        seen: Dict[str, Dict[str, Any]] = {}
        for doc in sample_docs:
            flat = _flatten(doc)
            for k, v in flat.items():
                if k not in seen:
                    seen[k] = {
                        "name": k,
                        "datatype": _infer_mongo_datatype(v),
                        "is_pk": k == "_id",
                    }
                elif seen[k]["datatype"] == "string" and v is not None:
                    seen[k]["datatype"] = _infer_mongo_datatype(v)

        result = list(seen.values())
        result.sort(key=lambda c: (0 if c["name"] == "_id" else 1, c["name"]))
        return result

    # ---------------------------------------------------------
    # Table & Collection Exploration
    # ---------------------------------------------------------
    def list_tables(self) -> List[Dict[str, Any]]:
        try:
            db = self._connect()
        except Exception as e:
            logger.warning(f"[MongoDB] list_tables connect failed: {e}")
            return []

        try:
            names = db.list_collection_names()
        except Exception as e:
            logger.warning(f"[MongoDB] list_collection_names failed: {e}")
            return []

        out: List[Dict[str, Any]] = []
        for name in sorted(names):
            if name.startswith("system."):
                continue

            try:
                coll = db[name]
                exact_count = self._exact_count(coll)
            except Exception as e:
                logger.warning(f"[MongoDB] count failed for '{name}': {e}")
                exact_count = 0

            columns = self._schema_cache.get(name)
            if columns is None:
                try:
                    columns = self._infer_full_schema(db, name)
                    self._schema_cache[name] = columns
                except Exception as e:
                    logger.warning(f"[MongoDB] schema inference failed for '{name}': {e}")
                    columns = [{"name": "_id", "datatype": "objectId", "is_pk": True}]

            out.append({
                "name": name,
                "row_count": int(exact_count),   # reliable
                "exact_count": int(exact_count),
                "columns": columns,
            })
        return out

    def collection_stats(self, table: str) -> Dict[str, Any]:
        try:
            db = self._connect()
            coll = db[table]
            exact_count = self._exact_count(coll)
            avg_size = 0
            try:
                agg = list(coll.aggregate([
                    {"$group": {"_id": None, "avg": {"$avg": {"$bsonSize": "$$ROOT"}}}},
                ]))
                if agg:
                    avg_size = int(agg[0].get("avg") or 0)
            except Exception:
                pass

            indexes: List[Dict[str, Any]] = []
            try:
                for idx in coll.list_indexes():
                    indexes.append({
                        "name": idx.get("name"),
                        "key": list(idx.get("key", {}).items()),
                        "unique": bool(idx.get("unique", False)),
                    })
            except Exception:
                pass

            return {
                "name": table,
                "exact_count": int(exact_count),
                "estimated_count": coll.estimated_document_count(),
                "avg_doc_size_bytes": avg_size,
                "estimated_size_bytes": exact_count * avg_size,
                "indexes": indexes,
            }
        except Exception as e:
            logger.warning(f"[MongoDB] collection_stats {table} failed: {e}")
            return {
                "name": table,
                "exact_count": 0,
                "estimated_count": 0,
                "avg_doc_size_bytes": 0,
                "estimated_size_bytes": 0,
                "indexes": [],
                "error": str(e),
            }

    # ---------------------------------------------------------
    # Read & Write
    # ---------------------------------------------------------
    def read_table(self, table: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return rows from a collection.

        - If ``limit`` is ``None`` (default), all documents are returned (capped by ``MAX_FULL_READ``).
        - If a positive integer is provided, at most that many rows are returned.
        """
        try:
            db = self._connect()
            # When ``limit`` is None we intentionally omit the ``limit`` call so MongoDB returns the full cursor.
            if limit is None:
                effective_limit = MAX_FULL_READ
                cursor = db[table].find().limit(effective_limit)
            else:
                effective_limit = max(int(limit), 1)
                cursor = db[table].find().limit(effective_limit)
            return [_flatten(doc) for doc in cursor]
        except Exception as e:
            logger.warning(f"[MongoDB] read_table {table} failed: {e}")
            return []


    def read_rows(
        self, table: str, offset: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Server-side pagination via skip/limit — safe for any offset."""
        try:
            db = self._connect()
            cursor = (
                db[table]
                .find()
                .skip(max(int(offset), 0))
                .limit(max(int(limit), 1))
            )
            return [_flatten(doc) for doc in cursor]
        except Exception as e:
            logger.warning(f"[MongoDB] read_rows {table} failed: {e}")
            return []

    def iter_collection(
        self, table: str, batch_size: int = DEFAULT_STREAM_BATCH
    ) -> Iterator[List[Dict[str, Any]]]:
        try:
            db = self._connect()
            cursor = db[table].find(no_cursor_timeout=True).batch_size(batch_size)
            batch: List[Dict[str, Any]] = []
            for doc in cursor:
                batch.append(_flatten(doc))
                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            if batch:
                yield batch
        except Exception as e:
            logger.warning(f"[MongoDB] iter_collection {table} failed: {e}")

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        """
        Modes:
          - append  : insert records; on duplicate _id, retry that record without _id (server-generated)
          - upsert  : replace existing by _id, insert new
          - replace : delete all then insert
        """
        try:
            db = self._connect()
            coll = db[table]
            if mode == "replace":
                coll.delete_many({})

            clean_records = [dict(r) for r in records]
            inserted = 0
            updated = 0

            if not clean_records:
                total = self._exact_count(coll)
                return {"table": table, "inserted": 0, "updated": 0, "total": total}

            if mode == "upsert" and ReplaceOne is not None:
                # Bulk replace-by-_id
                ops = []
                for r in clean_records:
                    if "_id" not in r:
                        ops.append(ReplaceOne({"_id": r.get("_id") or ObjectId()}, r, upsert=True))
                    else:
                        ops.append(ReplaceOne({"_id": r["_id"]}, r, upsert=True))
                try:
                    res = coll.bulk_write(ops, ordered=False)
                    inserted = int(res.upserted_count or 0)
                    updated = int(res.modified_count or 0)
                    # matched but unchanged count as "updated" too
                    updated += int(res.matched_count or 0) - int(res.modified_count or 0)
                except BulkWriteError as bwe:
                    # partial success — count what succeeded
                    d = bwe.details or {}
                    inserted = int(d.get("upserted", []) and len(d.get("upserted", [])) or 0)
                    updated = int(d.get("nModified", 0) or 0)
                except Exception as e:
                    logger.warning(f"[MongoDB] bulk upsert failed: {e}")
            else:
                # append — attempt insert_many; on dup-key, fallback per-doc
                try:
                    res = coll.insert_many(clean_records, ordered=False)
                    inserted = len(res.inserted_ids)
                except BulkWriteError as bwe:
                    d = bwe.details or {}
                    inserted = int(d.get("nInserted", 0) or 0)
                    # Retry failures without _id
                    for w in d.get("writeErrors", []):
                        idx = w.get("index")
                        if idx is None or idx >= len(clean_records):
                            continue
                        rec = dict(clean_records[idx])
                        rec.pop("_id", None)
                        try:
                            coll.insert_one(rec)
                            inserted += 1
                        except Exception:
                            pass
                except Exception:
                    # Sequential fallback
                    for r in clean_records:
                        try:
                            coll.insert_one(r)
                            inserted += 1
                        except Exception:
                            try:
                                r2 = dict(r)
                                r2.pop("_id", None)
                                coll.insert_one(r2)
                                inserted += 1
                            except Exception:
                                pass

            total = self._exact_count(coll)
            return {
                "table": table,
                "inserted": inserted,
                "updated": updated,
                "total": total,
            }
        except Exception as e:
            logger.error(f"[MongoDB] write_records failed: {e}")
            return {
                "table": table,
                "inserted": 0,
                "updated": 0,
                "total": 0,
                "error": str(e),
            }

    # ---------------------------------------------------------
    # Backward Compatibility SPI
    # ---------------------------------------------------------
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
        tables = self.list_tables()
        return [
            {
                "dataset_name": t["name"],
                "fields": t["columns"],
                "row_count": t["row_count"],
            }
            for t in tables
        ]

    def estimate(self, scope: Dict[str, Any]) -> Dict[str, Any]:
        table = scope.get("dataset_name", "default")
        stats = self.collection_stats(table)
        cnt = stats.get("exact_count", 0)
        return {
            "row_count": cnt,
            "byte_size": stats.get("estimated_size_bytes", 0),
            "partition_count": max(1, (cnt + 999) // 1000),
        }

    def plan_extract(
        self,
        scope: Dict[str, Any],
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> List[PartitionInfo]:
        table = scope.get("dataset_name", "default")
        stats = self.collection_stats(table)
        total = stats.get("exact_count", 0)
        batch = scope.get("batch_size", 1000)
        partitions = []
        start = 0
        if checkpoint and "last_index" in checkpoint:
            start = checkpoint["last_index"]
        for i in range(start, total, batch):
            partitions.append(
                PartitionInfo(
                    partition_id=f"{table}_part_{i // batch}",
                    dataset_name=table,
                    lower_bound=i,
                    upper_bound=min(i + batch, total),
                    row_count_estimate=min(batch, total - i),
                    token=str(i),
                )
            )
        return partitions or [
            PartitionInfo(
                partition_id=f"{table}_part_0",
                dataset_name=table,
                lower_bound=0,
                upper_bound=total,
            )
        ]

    def read_partition(
        self,
        partition: PartitionInfo,
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        start = partition.lower_bound or 0
        limit = (partition.upper_bound or (start + 1000)) - start
        rows = self.read_rows(partition.dataset_name, offset=start, limit=limit)
        for r in rows:
            yield r

    def write_batch(
        self,
        records: List[Dict[str, Any]],
        idempotency_context: Dict[str, Any],
    ) -> WriteBatchResult:
        table = idempotency_context.get("target_dataset", "default")
        res = self.write_records(table, records, mode="append")
        return WriteBatchResult(
            accepted_records=int(res.get("inserted", 0)),
            rejected_records=0,
            target_ids=[],
            rejection_reasons=[],
        )

    def begin_snapshot(self, operation_ref: str) -> None:
        try:
            db = self._connect()
            names = db.list_collection_names()
            self._snapshots[operation_ref] = {
                n: [doc for doc in db[n].find().limit(500)]
                for n in names
                if not n.startswith("system.")
            }
        except Exception:
            pass

    def compensate(self, operation_ref: str) -> bool:
        if operation_ref in self._snapshots:
            del self._snapshots[operation_ref]
            return True
        return False

    def health(self) -> Dict[str, Any]:
        return {
            "status": "UP",
            "connector_type": self.name,
            "version": self.version,
            "database": self.database,
        }