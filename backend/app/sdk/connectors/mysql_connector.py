"""
MySQL and MariaDB Connector Plugin.

Connects to MySQL / MariaDB instances (Localhost, AWS RDS, PlanetScale, DigitalOcean, Azure Database for MySQL):
  • Localhost: mysql://root:password@localhost:3306/dbname
  • Cloud RDS: mysql://user:password@rds.endpoint:3306/dbname?ssl=require
"""

from __future__ import annotations

import time
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import parse_qsl, quote_plus, urlparse

from app.core.logging import get_logger
from app.sdk.connectors.base import (
    BaseConnector,
    ConnectorCapabilities,
    PartitionInfo,
    WriteBatchResult,
)

try:
    import pymysql
    import pymysql.cursors
    PYMYSQL_AVAILABLE = True
except ImportError:
    PYMYSQL_AVAILABLE = False
    pymysql = None  # type: ignore

logger = get_logger("mysql_connector")


def _json_safe(value: Any) -> Any:
    """Coerce MySQL native types (Decimal, datetime, bytes) into JSON-serializable types."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            return value.hex()
    try:
        return str(value)
    except Exception:
        return repr(value)


def _safe_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: _json_safe(v) for k, v in row.items()}


class MySQLConnector(BaseConnector):
    name = "mysql"

    def __init__(
        self,
        endpoint_config: Optional[Dict[str, Any]] = None,
        secret_ref: Optional[str] = None,
    ):
        super().__init__(endpoint_config, secret_ref)
        self.version = "1.0.0"
        cfg = self.config or {}

        # ── Parse DSN or individual fields ────────────────────
        dsn = (
            cfg.get("dsn")
            or cfg.get("uri")
            or cfg.get("connection_string")
            or cfg.get("database_url")
            or ""
        ).strip()

        self.host: str = "localhost"
        self.port: int = 3306
        self.user: str = "root"
        self.password: str = ""
        self.database: str = ""
        self.ssl_required: bool = False

        if dsn and "://" in dsn:
            try:
                p = urlparse(dsn)
                self.host = p.hostname or "localhost"
                self.port = p.port or 3306
                self.user = p.username or "root"
                self.password = p.password or ""
                self.database = (p.path or "").lstrip("/")
                q = dict(parse_qsl(p.query))
                if q.get("ssl") in ("require", "true", "1") or q.get("sslmode") in ("require", "verify-ca", "verify-full"):
                    self.ssl_required = True
            except Exception as e:
                logger.warning(f"Failed to parse MySQL DSN '{dsn}': {e}")
        else:
            self.host = (cfg.get("host") or "localhost").strip()
            self.port = int(cfg.get("port") or 3306)
            self.user = (cfg.get("user") or cfg.get("username") or "root").strip()
            self.password = (cfg.get("password") or "").strip()
            self.database = (cfg.get("database") or cfg.get("db") or "").strip()
            self.ssl_required = bool(cfg.get("ssl") or cfg.get("ssl_required"))

        # Injected password if provided separately
        if cfg.get("password"):
            self.password = str(cfg["password"]).strip()

        self.connect_timeout = int(cfg.get("connect_timeout") or 10)

    def _connect(self):
        if not PYMYSQL_AVAILABLE:
            raise RuntimeError("pymysql is not installed. Run: uv add pymysql cryptography")

        ssl_kwargs = {}
        if self.ssl_required and self.host not in ("localhost", "127.0.0.1", "::1"):
            ssl_kwargs["ssl"] = {"ssl_mode": "REQUIRED"}

        return pymysql.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=self.database or None,
            connect_timeout=self.connect_timeout,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
            **ssl_kwargs,
        )

    def test_connection(self) -> Dict[str, Any]:
        """Validates connection to MySQL/MariaDB and measures ping latency."""
        t0 = time.time()
        try:
            conn = self._connect()
            with conn.cursor() as cur:
                cur.execute("SELECT VERSION() AS ver, DATABASE() AS cur_db")
                res = cur.fetchone() or {}
                ver = res.get("ver", "unknown")
                cur_db = res.get("cur_db") or self.database or "default"
            conn.close()
            latency = round((time.time() - t0) * 1000, 2)
            return {
                "status": "SUCCESS",
                "latency_ms": latency,
                "message": f"Connected to MySQL {ver} at {self.host}:{self.port} (db: '{cur_db}')",
                "capabilities": [
                    "schema_discovery",
                    "read_batch",
                    "write_batch",
                    "pushdown_filters",
                    "idempotent_write",
                ],
                "database": cur_db,
                "version": ver,
            }
        except Exception as e:
            return {
                "status": "FAILED",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": f"MySQL connection failed: {e}",
                "capabilities": [],
            }

    def list_tables(self) -> List[Dict[str, Any]]:
        """Introspects tables, columns, data types, and primary keys from information_schema."""
        conn = self._connect()
        out: List[Dict[str, Any]] = []
        try:
            with conn.cursor() as cur:
                # Find current database name
                cur.execute("SELECT DATABASE() AS cur_db")
                row = cur.fetchone()
                target_db = (row and row.get("cur_db")) or self.database

                if not target_db:
                    # If no database is selected, list visible databases
                    cur.execute("SHOW DATABASES")
                    dbs = [r["Database"] for r in cur.fetchall() if r["Database"] not in ("information_schema", "mysql", "performance_schema", "sys")]
                    if dbs:
                        target_db = dbs[0]
                    else:
                        return []

                # Fetch all tables
                cur.execute(
                    """
                    SELECT TABLE_NAME, TABLE_ROWS
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
                    ORDER BY TABLE_NAME
                    """,
                    (target_db,),
                )
                tables = cur.fetchall()

                for tbl in tables:
                    tbl_name = tbl["TABLE_NAME"]
                    row_count = int(tbl["TABLE_ROWS"] or 0)

                    # Fetch columns
                    cur.execute(
                        """
                        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                        ORDER BY ORDINAL_POSITION
                        """,
                        (target_db, tbl_name),
                    )
                    cols = cur.fetchall()
                    columns = [
                        {
                            "name": c["COLUMN_NAME"],
                            "datatype": c["DATA_TYPE"],
                            "is_pk": c["COLUMN_KEY"] == "PRI",
                            "nullable": c["IS_NULLABLE"] == "YES",
                        }
                        for c in cols
                    ]

                    out.append({
                        "name": tbl_name,
                        "row_count": row_count,
                        "columns": columns,
                    })
        finally:
            conn.close()
        return out

    def read_table(self, table: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Reads a preview slice from the specified table."""
        clean_tbl = table.replace("`", "").strip()
        conn = self._connect()
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM `{clean_tbl}` LIMIT %s", (limit,))
                rows = cur.fetchall()
                return [_safe_row(r) for r in rows]
        finally:
            conn.close()

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        """Inserts records into a MySQL table with support for append or replace."""
        if not records:
            return {"table": table, "inserted": 0, "updated": 0, "total": 0}

        clean_tbl = table.replace("`", "").strip()
        conn = self._connect()
        inserted = 0
        try:
            with conn.cursor() as cur:
                if mode == "replace":
                    cur.execute(f"TRUNCATE TABLE `{clean_tbl}`")

                cols = list(records[0].keys())
                col_names = ", ".join(f"`{c}`" for c in cols)
                placeholders = ", ".join(["%s"] * len(cols))
                sql = f"INSERT INTO `{clean_tbl}` ({col_names}) VALUES ({placeholders})"

                batch = [[r.get(c) for c in cols] for r in records]
                cur.executemany(sql, batch)
                inserted = len(records)
        finally:
            conn.close()

        return {
            "table": table,
            "inserted": inserted,
            "updated": 0,
            "total": inserted,
        }

    def discover(self) -> List[Dict[str, Any]]:
        """Generates canonical dataset representations for all tables."""
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
                "source_format": "MYSQL_TABLE",
                "estimated_volume": f"{t.get('row_count', 0)} rows",
                "fields": fields,
            })
        return datasets
