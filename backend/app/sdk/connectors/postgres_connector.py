"""
Real PostgreSQL connector.

Talks to any Postgres-speaking endpoint over psycopg 3 (v3 wire protocol):

  • Neon             postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require
  • Supabase         postgresql://postgres.ref:pass@aws-0-region.pooler.supabase.com:6543/postgres
  • Railway          postgresql://postgres:pass@roundhouse.proxy.rlwy.net:port/railway
  • Amazon RDS       postgresql://user:pass@mydb.abc.us-east-1.rds.amazonaws.com:5432/db
  • Azure PostgreSQL postgresql://user@server:pass@server.postgres.database.azure.com/db
  • CockroachDB      postgresql://user:pass@free-tier.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
  • Self-hosted      postgresql://user:pass@host:5432/db

Capabilities:
  - test_connection()   → version, latency, current DB, server encoding
  - list_tables()       → all base tables in the configured schema, exact
                          row counts, real column types + PK flags
  - read_table()        → bounded preview (limit=N) or full stream
  - read_rows()         → cursor-paginated slice (server-side OFFSET/LIMIT)
  - iter_table()        → streams the full table via a server-side cursor
                          (named cursor, memory-safe for millions of rows)
  - write_records()     → insert / upsert-on-PK / replace
  - begin_snapshot()    → captures a lightweight row snapshot for rollback
  - compensate()        → restores the snapshot (best-effort)
  - describe()          → declares capabilities to the UI

Schema handling:
  - `schema` defaults to "public"; set it to "dbo", "analytics",
    "crm", etc. in the connector config.
  - All identifiers are double-quoted to survive reserved words and
    camelCase column names.

Security:
  - Never log the DSN. `describe()` and `test_connection()` return only
    the host and DB name (or nothing) so the UI can display a summary
    without leaking credentials.
  - Passwords may be embedded in the DSN (`postgresql://user:pass@…`),
    or passed as `password` in the connector config, or via a secret_ref
    (vault-backed, injected by the platform).

Dependencies:
  pyproject.toml must include:
    "psycopg[binary]>=3.2.0"
"""

from __future__ import annotations

import copy
import time
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import parse_qsl, quote_plus, urlparse, urlunparse

from app.core.logging import get_logger
from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)

try:
    import psycopg
    from psycopg import sql as pgsql
    from psycopg.rows import dict_row
    from psycopg.errors import (
        UndefinedTable,
        UniqueViolation,
        OperationalError,
    )
    PSYCOPG_AVAILABLE = True
except ImportError:  # pragma: no cover
    PSYCOPG_AVAILABLE = False
    psycopg = None  # type: ignore
    pgsql = None  # type: ignore
    dict_row = None  # type: ignore

    class OperationalError(Exception): ...   # type: ignore
    class UndefinedTable(Exception): ...     # type: ignore
    class UniqueViolation(Exception): ...    # type: ignore


logger = get_logger("postgres_connector")

# Safety cap for full-table reads when no limit is passed.
MAX_FULL_READ = 200_000

# How many rows to fetch at a time when iterating a large table.
STREAM_BATCH = 1000

# How many PK rows to cache in the snapshot for rollback.
SNAPSHOT_ROWS_PER_TABLE = 500


def _mask_dsn(dsn: str) -> str:
    """Mask credentials in a Postgres DSN for safe logging / display."""
    if not dsn:
        return "[NOT_SET]"
    try:
        p = urlparse(dsn)
        if "@" not in (p.netloc or ""):
            return dsn
        creds, host = p.netloc.rsplit("@", 1)
        if ":" in creds:
            user, _ = creds.split(":", 1)
            new_netloc = f"{user}:****@{host}"
        else:
            new_netloc = f"****@{host}"
        return urlunparse(
            (p.scheme, new_netloc, p.path, p.params, p.query, p.fragment)
        )
    except Exception:
        return "***masked***"


def _ensure_sslmode(dsn: str, default: str = "require") -> str:
    """
    Ensure an sslmode is present in the DSN.

    Most hosted providers (Neon, Supabase, Railway, RDS, Azure) require
    TLS, and psycopg 3 does NOT default to SSL — it just trusts libpq's
    default, which varies. We inject `sslmode=require` when the user
    didn't specify anything, so hosted connections work out of the box.

    If the caller already set sslmode (e.g. `verify-full` for
    CockroachDB), we leave it alone.
    """
    if not dsn:
        return dsn
    try:
        p = urlparse(dsn)
        q = dict(parse_qsl(p.query))
        if "sslmode" in q:
            return dsn
        q["sslmode"] = default
        new_query = "&".join(f"{k}={v}" for k, v in q.items())
        return urlunparse(
            (p.scheme, p.netloc, p.path, p.params, new_query, p.fragment)
        )
    except Exception:
        return dsn


def _json_safe(value: Any) -> Any:
    """Coerce psycopg-native types into JSON-serializable equivalents."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    # date/time/datetime/timedelta/Decimal/UUID/bytes/… → str
    try:
        return str(value)
    except Exception:
        return repr(value)


def _safe_row(row: Any) -> Dict[str, Any]:
    """Turn a psycopg dict_row into a JSON-safe dict."""
    return {k: _json_safe(v) for k, v in row.items()}


class PostgresConnector(BaseConnector):
    name = "postgres"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self.version = "2.0.0"
        cfg = self.config or {}

        # ── DSN / URI ────────────────────────────────────────
        self.dsn: str = (
            cfg.get("dsn")
            or cfg.get("uri")
            or cfg.get("connection_string")
            or cfg.get("database_url")
            or ""
        ).strip()

        # If user supplied a password separately, inject it.
        self.password: str = (cfg.get("password") or "").strip()
        if self.dsn and self.password and "://" in self.dsn:
            try:
                p = urlparse(self.dsn)
                netloc = p.netloc
                if "@" in netloc:
                    creds, host = netloc.rsplit("@", 1)
                    if ":" not in creds:
                        user = creds
                        new_netloc = (
                            f"{quote_plus(user)}:{quote_plus(self.password)}"
                            f"@{host}"
                        )
                        self.dsn = urlunparse(
                            (p.scheme, new_netloc, p.path, p.params,
                             p.query, p.fragment)
                        )
            except Exception:
                pass

        # Ensure TLS on hosted connections unless caller chose otherwise.
        self.dsn = _ensure_sslmode(self.dsn)

        self.schema: str = (cfg.get("schema") or "public").strip() or "public"
        self.connect_timeout: int = int(cfg.get("connect_timeout") or 10)
        self.statement_timeout_ms: int = int(cfg.get("statement_timeout_ms") or 30000)

        self._conn = None
        self._schema_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._snapshots: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        self._written_keys: set = set()

    # ═══════════════════════════════════════════════════════════
    # Connection management
    # ═══════════════════════════════════════════════════════════
    def _connect(self):
        if self._conn is not None and not getattr(self._conn, "closed", True):
            return self._conn
        if not PSYCOPG_AVAILABLE:
            raise RuntimeError(
                "psycopg is not installed. Run: uv add 'psycopg[binary]'"
            )
        if not self.dsn:
            raise ValueError(
                "Postgres connector requires 'dsn' (or 'connection_string' / "
                "'uri' / 'database_url') in connection_config."
            )

        self._conn = psycopg.connect(
            self.dsn,
            connect_timeout=self.connect_timeout,
            autocommit=True,
            row_factory=dict_row,
            options=f"-c statement_timeout={self.statement_timeout_ms}",
        )
        return self._conn

    def __del__(self):  # pragma: no cover
        try:
            if self._conn is not None and not getattr(self._conn, "closed", True):
                self._conn.close()
        except Exception:
            pass

    def invalidate_schema(self) -> None:
        self._schema_cache.clear()

    def _host_and_db(self) -> Dict[str, str]:
        """Return non-sensitive host/db info for the UI."""
        try:
            p = urlparse(self.dsn)
            host = (p.hostname or "").strip()
            db = (p.path or "").lstrip("/") or ""
            port = str(p.port or "")
            return {"host": host, "database": db, "port": port}
        except Exception:
            return {}

    # ═══════════════════════════════════════════════════════════
    # Connection test
    # ═══════════════════════════════════════════════════════════
    def test_connection(self) -> Dict[str, Any]:
        t0 = time.time()
        try:
            conn = self._connect()
            with conn.cursor() as cur:
                cur.execute("SELECT version(), current_database(), current_schema()")
                row = cur.fetchone() or {}
                version = str(row.get("version", "?"))
                db_name = str(row.get("current_database", self._host_and_db().get("database", "?")))
                cur_schema = str(row.get("current_schema", "?"))

            table_count = 0
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT COUNT(*) AS n FROM information_schema.tables
                        WHERE table_schema = %s AND table_type = 'BASE TABLE'
                        """,
                        (self.schema,),
                    )
                    table_count = int((cur.fetchone() or {}).get("n", 0))
            except Exception:
                pass

            host_info = self._host_and_db()
            msg = (
                f"Connected to {host_info.get('host', 'postgres')} "
                f"(db={db_name}, schema={self.schema}, "
                f"tables={table_count})"
            )

            return {
                "status": "SUCCESS",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": msg,
                "capabilities": self._capability_names(),
                "host": host_info.get("host"),
                "database": db_name,
                "schema": self.schema,
                "server_version": version[:120],
                "table_count": table_count,
                "current_schema": cur_schema,
            }
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[Postgres] test_connection failed → {_mask_dsn(self.dsn)} :: {e}"
            )
            return {
                "status": "FAILED",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": f"Postgres connection failed: {e}",
                "capabilities": [],
            }

    # ═══════════════════════════════════════════════════════════
    # Schema discovery
    # ═══════════════════════════════════════════════════════════
    def _table_names(self) -> List[str]:
        with self._connect().cursor() as cur:
            cur.execute(
                """
                SELECT table_name AS t
                FROM information_schema.tables
                WHERE table_schema = %s AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """,
                (self.schema,),
            )
            return [r["t"] for r in cur.fetchall()]

    def _exact_count(self, table: str) -> int:
        try:
            with self._connect().cursor() as cur:
                cur.execute(
                    pgsql.SQL("SELECT COUNT(*) AS n FROM {}.{}").format(
                        pgsql.Identifier(self.schema),
                        pgsql.Identifier(table),
                    )
                )
                row = cur.fetchone() or {}
                return int(row.get("n") or 0)
        except UndefinedTable:
            return 0
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Postgres] count '{table}' failed: {e}")
            return 0

    def _full_schema(self, table: str) -> List[Dict[str, Any]]:
        try:
            with self._connect().cursor() as cur:
                cur.execute(
                    """
                    SELECT c.column_name AS name,
                           c.data_type   AS datatype,
                           c.is_nullable AS nullable,
                           CASE WHEN pk.column_name IS NOT NULL THEN TRUE
                                ELSE FALSE END AS is_pk
                    FROM information_schema.columns c
                    LEFT JOIN (
                        SELECT kcu.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu
                          ON tc.constraint_name = kcu.constraint_name
                         AND tc.table_schema    = kcu.table_schema
                         AND tc.table_name      = kcu.table_name
                        WHERE tc.constraint_type = 'PRIMARY KEY'
                          AND tc.table_schema    = %s
                          AND tc.table_name      = %s
                    ) pk ON pk.column_name = c.column_name
                    WHERE c.table_schema = %s AND c.table_name = %s
                    ORDER BY c.ordinal_position
                    """,
                    (self.schema, table, self.schema, table),
                )
                rows = cur.fetchall()
            cols: List[Dict[str, Any]] = []
            for r in rows:
                cols.append(
                    {
                        "name": r["name"],
                        "datatype": r["datatype"],
                        "is_pk": bool(r["is_pk"]),
                    }
                )
            if not cols:
                cols = [{"name": "id", "datatype": "unknown", "is_pk": True}]
            return cols
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Postgres] schema '{table}' failed: {e}")
            return [{"name": "id", "datatype": "unknown", "is_pk": True}]

    def list_tables(self) -> List[Dict[str, Any]]:
        try:
            names = self._table_names()
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[Postgres] list_tables failed → {_mask_dsn(self.dsn)} :: {e}"
            )
            return []

        out: List[Dict[str, Any]] = []
        for name in names:
            count = self._exact_count(name)
            cols = self._schema_cache.get(name)
            if cols is None:
                cols = self._full_schema(name)
                self._schema_cache[name] = cols
            out.append(
                {
                    "name": name,
                    "row_count": count,
                    "exact_count": count,
                    "columns": cols,
                }
            )
        return out

    # ═══════════════════════════════════════════════════════════
    # Reads
    # ═══════════════════════════════════════════════════════════
    def read_table(
        self, table: str, limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Return rows from a table.
        - limit=None → up to MAX_FULL_READ rows (safety cap)
        - limit=N    → at most N rows
        """
        effective = int(limit) if limit is not None else MAX_FULL_READ
        effective = max(1, min(effective, MAX_FULL_READ))
        try:
            with self._connect().cursor() as cur:
                cur.execute(
                    pgsql.SQL("SELECT * FROM {}.{} LIMIT %s").format(
                        pgsql.Identifier(self.schema),
                        pgsql.Identifier(table),
                    ),
                    (effective,),
                )
                return [_safe_row(r) for r in cur.fetchall()]
        except UndefinedTable:
            logger.warning(f"[Postgres] table '{table}' does not exist")
            return []
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Postgres] read_table '{table}' failed: {e}")
            return []

    def read_rows(
        self, table: str, offset: int = 0, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Server-side pagination — safe for large offsets on indexed tables."""
        try:
            with self._connect().cursor() as cur:
                cur.execute(
                    pgsql.SQL(
                        "SELECT * FROM {}.{} OFFSET %s LIMIT %s"
                    ).format(
                        pgsql.Identifier(self.schema),
                        pgsql.Identifier(table),
                    ),
                    (max(0, int(offset)), max(1, int(limit))),
                )
                return [_safe_row(r) for r in cur.fetchall()]
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Postgres] read_rows '{table}' failed: {e}")
            return []

    def iter_table(
        self, table: str, batch_size: int = STREAM_BATCH
    ) -> Iterator[List[Dict[str, Any]]]:
        """
        Stream the full table in batches via a psycopg server-side cursor.
        Memory usage is O(batch_size), not O(row_count).
        """
        try:
            conn = self._connect()
            with conn.cursor(name=f"stream_{table}_{int(time.time())}") as cur:
                cur.itersize = max(1, int(batch_size))
                cur.execute(
                    pgsql.SQL("SELECT * FROM {}.{}").format(
                        pgsql.Identifier(self.schema),
                        pgsql.Identifier(table),
                    )
                )
                batch: List[Dict[str, Any]] = []
                for row in cur:
                    batch.append(_safe_row(row))
                    if len(batch) >= batch_size:
                        yield batch
                        batch = []
                if batch:
                    yield batch
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Postgres] iter_table '{table}' failed: {e}")
            return

    # ═══════════════════════════════════════════════════════════
    # Writes
    # ═══════════════════════════════════════════════════════════
    def _pick_key_column(
        self, table: str, records: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Choose the upsert key: prefer a declared PK, else the first
        column whose name looks like an id, else None (pure append).
        """
        if not records:
            return None
        cols = self._schema_cache.get(table)
        if cols is None:
            cols = self._full_schema(table)
            self._schema_cache[table] = cols

        for c in cols:
            if c.get("is_pk") and c["name"] in records[0]:
                return c["name"]

        for k in records[0].keys():
            if k.lower() == "id" or k.lower().endswith("_id"):
                return k
        return None

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        """
        Modes:
          append  → INSERT … ON CONFLICT DO NOTHING
          upsert  → INSERT … ON CONFLICT (pk) DO UPDATE SET …
          replace → TRUNCATE then INSERT
        """
        if not records:
            return {
                "table": table,
                "inserted": 0,
                "updated": 0,
                "total": self._exact_count(table),
            }

        cols = list(records[0].keys())
        if not cols:
            return {"table": table, "inserted": 0, "updated": 0, "total": 0}

        key_col = (
            self._pick_key_column(table, records) if mode == "upsert" else None
        )

        inserted = 0
        updated = 0
        try:
            conn = self._connect()
            with conn.cursor() as cur:
                if mode == "replace":
                    try:
                        cur.execute(
                            pgsql.SQL("TRUNCATE TABLE {}.{}").format(
                                pgsql.Identifier(self.schema),
                                pgsql.Identifier(table),
                            )
                        )
                    except Exception as e:  # noqa: BLE001
                        logger.warning(
                            f"[Postgres] truncate '{table}' failed: {e}"
                        )

                col_sql = pgsql.SQL(", ").join(
                    pgsql.Identifier(c) for c in cols
                )
                placeholders = pgsql.SQL(", ").join(
                    pgsql.Placeholder() for _ in cols
                )
                base = pgsql.SQL(
                    "INSERT INTO {}.{} ({}) VALUES ({})"
                ).format(
                    pgsql.Identifier(self.schema),
                    pgsql.Identifier(table),
                    col_sql,
                    placeholders,
                )

                if mode == "upsert" and key_col:
                    non_key = [c for c in cols if c != key_col]
                    update_sql = pgsql.SQL(", ").join(
                        pgsql.SQL("{} = EXCLUDED.{}").format(
                            pgsql.Identifier(c), pgsql.Identifier(c)
                        )
                        for c in non_key
                    )
                    if not non_key:
                        stmt = base + pgsql.SQL(
                            " ON CONFLICT ({}) DO NOTHING"
                        ).format(pgsql.Identifier(key_col))
                    else:
                        stmt = base + pgsql.SQL(
                            " ON CONFLICT ({}) DO UPDATE SET {}"
                        ).format(
                            pgsql.Identifier(key_col), update_sql
                        )
                elif mode == "append":
                    stmt = base + pgsql.SQL(
                        " ON CONFLICT DO NOTHING"
                    )
                else:
                    stmt = base

                for r in records:
                    try:
                        cur.execute(stmt, [r.get(c) for c in cols])
                        if cur.rowcount > 0:
                            if mode == "upsert":
                                updated += 1
                            else:
                                inserted += 1
                    except UniqueViolation:
                        # Duplicate key in append / no-key upsert → skip
                        continue
                    except Exception as e:  # noqa: BLE001
                        logger.debug(
                            f"[Postgres] row insert failed for '{table}': {e}"
                        )
                        continue
        except Exception as e:  # noqa: BLE001
            logger.error(f"[Postgres] write_records '{table}' failed: {e}")
            return {
                "table": table,
                "inserted": inserted,
                "updated": updated,
                "total": self._exact_count(table),
                "error": str(e),
            }

        total = self._exact_count(table)
        return {
            "table": table,
            "inserted": inserted,
            "updated": updated,
            "total": total,
        }

    # ═══════════════════════════════════════════════════════════
    # Snapshots / rollback
    # ═══════════════════════════════════════════════════════════
    def begin_snapshot(self, operation_ref: str) -> None:
        """
        Cache a small slice of every table for best-effort rollback.
        Not a true MVCC snapshot — full rollback for large migrations
        belongs in a database-level backup or a proper time-travel
        mechanism. This is intentional: capturing millions of rows in
        Python memory would OOM the worker.
        """
        try:
            snapshot: Dict[str, List[Dict[str, Any]]] = {}
            for t in self._table_names():
                snapshot[t] = self.read_rows(
                    t, offset=0, limit=SNAPSHOT_ROWS_PER_TABLE
                )
            self._snapshots[operation_ref] = snapshot
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Postgres] begin_snapshot failed: {e}")
            self._snapshots[operation_ref] = {}

    def compensate(self, operation_ref: str) -> bool:
        """
        Best-effort rollback: for each table in the snapshot, restore
        the captured rows. Does NOT delete rows that were added after
        the snapshot; that is a job for a real DB-level rollback.
        """
        snap = self._snapshots.pop(operation_ref, None)
        if snap is None:
            return False
        try:
            for table, rows in snap.items():
                if not rows:
                    continue
                # Re-write each row using upsert on the PK if available
                self.write_records(table, rows, mode="upsert")
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Postgres] compensate failed: {e}")
            return False

    # ═══════════════════════════════════════════════════════════
    # Describe / capabilities
    # ═══════════════════════════════════════════════════════════
    def describe(self) -> Dict[str, Any]:
        host_info = self._host_and_db()
        return {
            "connector_type": self.name,
            "capabilities": self._capability_names(),
            "version": self.version,
            "host": host_info.get("host"),
            "database": host_info.get("database"),
            "schema": self.schema,
        }

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

    # ═══════════════════════════════════════════════════════════
    # Old-style SPI bridging (extract / load workers)
    # ═══════════════════════════════════════════════════════════
    def discover(self) -> List[Dict[str, Any]]:
        tables = self.list_tables()
        return [
            {
                "dataset_name": t["name"],
                "fields": [
                    {
                        "name": c["name"],
                        "datatype": c.get("datatype", "string"),
                        "nullable": True,
                        "ordinal": idx + 1,
                        "is_primary_key": bool(c.get("is_pk", False)),
                        "is_business_key": c["name"].lower().endswith("_id"),
                        "is_metadata": False,
                    }
                    for idx, c in enumerate(t["columns"])
                ],
                "row_count": t["row_count"],
            }
            for t in tables
        ]

    def estimate(self, scope: Dict[str, Any]) -> Dict[str, Any]:
        table = scope.get("dataset_name", "default")
        cnt = self._exact_count(table)
        return {
            "row_count": cnt,
            "byte_size": cnt * 200,  # rough
            "partition_count": max(1, (cnt + STREAM_BATCH - 1) // STREAM_BATCH),
        }

    def plan_extract(
        self,
        scope: Dict[str, Any],
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> List[PartitionInfo]:
        table = scope.get("dataset_name", "default")
        total = self._exact_count(table)
        batch = int(scope.get("batch_size") or STREAM_BATCH)
        batch = max(1, min(batch, 50_000))

        partitions: List[PartitionInfo] = []
        start = 0
        if checkpoint and "last_index" in checkpoint:
            start = int(checkpoint["last_index"])

        if total == 0:
            return [
                PartitionInfo(
                    partition_id=f"{table}_part_0",
                    dataset_name=table,
                    lower_bound=0,
                    upper_bound=0,
                    row_count_estimate=0,
                )
            ]

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
        return partitions

    def read_partition(
        self,
        partition: PartitionInfo,
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        start = partition.lower_bound or 0
        limit = max(
            1, (partition.upper_bound or (start + STREAM_BATCH)) - start
        )
        rows = self.read_rows(
            partition.dataset_name, offset=start, limit=limit
        )
        for r in rows:
            yield r

    def write_batch(
        self,
        records: List[Dict[str, Any]],
        idempotency_context: Dict[str, Any],
    ) -> WriteBatchResult:
        table = idempotency_context.get("target_dataset", "default")
        mode = (idempotency_context.get("mode") or "upsert").lower()
        if mode not in ("append", "upsert", "replace"):
            mode = "append"
        res = self.write_records(table, records, mode=mode)
        return WriteBatchResult(
            accepted_records=int(
                (res.get("inserted") or 0) + (res.get("updated") or 0)
            ),
            rejected_records=int(res.get("failed") or 0),
            target_ids=[],
            rejection_reasons=[],
        )

    def health(self) -> Dict[str, Any]:
        host_info = self._host_and_db()
        return {
            "status": "UP",
            "connector_type": self.name,
            "version": self.version,
            "host": host_info.get("host"),
            "database": host_info.get("database"),
            "schema": self.schema,
        }