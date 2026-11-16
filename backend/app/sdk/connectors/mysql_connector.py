"""
MySQL and MariaDB Connector Plugin.

Connects to MySQL / MariaDB instances (Localhost, XAMPP, Docker, AWS RDS, PlanetScale, DigitalOcean):
  • Localhost URI: mysql://root:password@localhost:3306/dbname
  • Localhost (no password): mysql://root@127.0.0.1:3306/dbname
  • Cloud RDS URI: mysql://user:password@rds.endpoint:3306/dbname?ssl=require
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
        self.version = "1.1.0"
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

    def _connect(self, host_override: Optional[str] = None):
        if not PYMYSQL_AVAILABLE:
            raise RuntimeError("pymysql is not installed. Run: uv add pymysql cryptography")

        host = host_override or self.host
        ssl_kwargs = {}
        if self.ssl_required and host not in ("localhost", "127.0.0.1", "::1"):
            ssl_kwargs["ssl"] = {"ssl_mode": "REQUIRED"}

        try:
            return pymysql.connect(
                host=host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database or None,
                connect_timeout=self.connect_timeout,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=True,
                **ssl_kwargs,
            )
        except Exception as e:
            # On Windows, 'localhost' often resolves to IPv6 '::1' while MySQL listens on IPv4 '127.0.0.1'.
            # If localhost fails, automatically attempt 127.0.0.1 fallback for local databases.
            if host.lower() == "localhost" and not host_override:
                logger.info("Retrying local MySQL connection with 127.0.0.1...")
                try:
                    return self._connect(host_override="127.0.0.1")
                except Exception:
                    pass
            raise e

    def test_connection(self) -> Dict[str, Any]:
        """Validates connection to MySQL/MariaDB and measures ping latency."""
        t0 = time.time()
        try:
            conn = self._connect()
            with conn.cursor() as cur:
                cur.execute("SELECT VERSION() AS ver, DATABASE() AS cur_db")
                res = cur.fetchone() or {}
                ver = res.get("ver", "unknown")
                cur_db = res.get("cur_db") or self.database

                # Inspect available user databases
                cur.execute("SHOW DATABASES")
                all_dbs = [
                    r["Database"]
                    for r in cur.fetchall()
                    if r.get("Database") not in ("information_schema", "mysql", "performance_schema", "sys")
                ]

            conn.close()
            latency = round((time.time() - t0) * 1000, 2)

            db_info = f"db: '{cur_db}'" if cur_db else f"databases: {', '.join(all_dbs[:5]) or 'none'}"

            return {
                "status": "SUCCESS",
                "latency_ms": latency,
                "message": f"Connected to MySQL {ver} at {self.host}:{self.port} ({db_info})",
                "capabilities": [
                    "schema_discovery",
                    "read_batch",
                    "write_batch",
                    "pushdown_filters",
                    "idempotent_write",
                ],
                "database": cur_db or (all_dbs[0] if all_dbs else None),
                "available_databases": all_dbs,
                "version": ver,
            }
        except Exception as e:
            err_msg = str(e)
            if "Access denied" in err_msg:
                err_msg = f"Access denied for user '{self.user}'. Check your password or user permissions."
            elif "Can't connect to MySQL server" in err_msg or "Connection refused" in err_msg:
                err_msg = f"Cannot reach MySQL server at {self.host}:{self.port}. Ensure MySQL service is running locally."
            elif "Unknown database" in err_msg:
                err_msg = f"Database '{self.database}' does not exist on MySQL server at {self.host}:{self.port}."

            return {
                "status": "FAILED",
                "latency_ms": round((time.time() - t0) * 1000, 2),
                "message": f"MySQL connection failed: {err_msg}",
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

                if target_db:
                    # Specific database selected
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

                    cur.execute(
                        """
                        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = %s
                        ORDER BY TABLE_NAME, ORDINAL_POSITION
                        """,
                        (target_db,),
                    )
                    all_cols = cur.fetchall()

                    cols_by_table: Dict[str, List[Dict[str, Any]]] = {}
                    for c in all_cols:
                        t_name = c["TABLE_NAME"]
                        if t_name not in cols_by_table:
                            cols_by_table[t_name] = []
                        cols_by_table[t_name].append({
                            "name": c["COLUMN_NAME"],
                            "datatype": c["DATA_TYPE"],
                            "is_pk": c["COLUMN_KEY"] == "PRI",
                            "nullable": c["IS_NULLABLE"] == "YES",
                        })

                    for tbl in tables:
                        tbl_name = tbl["TABLE_NAME"]
                        row_count = int(tbl.get("TABLE_ROWS") or 0)
                        out.append({
                            "name": tbl_name,
                            "row_count": row_count,
                            "columns": cols_by_table.get(tbl_name, []),
                        })
                else:
                    # No specific database selected; introspect visible user databases
                    cur.execute(
                        """
                        SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_ROWS
                        FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                          AND TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_SCHEMA, TABLE_NAME
                        """
                    )
                    tables = cur.fetchall()

                    cur.execute(
                        """
                        SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
                        """
                    )
                    all_cols = cur.fetchall()

                    cols_by_table: Dict[str, List[Dict[str, Any]]] = {}
                    for c in all_cols:
                        key = f"{c['TABLE_SCHEMA']}.{c['TABLE_NAME']}"
                        if key not in cols_by_table:
                            cols_by_table[key] = []
                        cols_by_table[key].append({
                            "name": c["COLUMN_NAME"],
                            "datatype": c["DATA_TYPE"],
                            "is_pk": c["COLUMN_KEY"] == "PRI",
                            "nullable": c["IS_NULLABLE"] == "YES",
                        })

                    for tbl in tables:
                        schema_name = tbl["TABLE_SCHEMA"]
                        tbl_name = tbl["TABLE_NAME"]
                        display_name = f"{schema_name}.{tbl_name}" if len(set(t["TABLE_SCHEMA"] for t in tables)) > 1 else tbl_name
                        row_count = int(tbl.get("TABLE_ROWS") or 0)
                        out.append({
                            "name": display_name,
                            "database": schema_name,
                            "row_count": row_count,
                            "columns": cols_by_table.get(f"{schema_name}.{tbl_name}", []),
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
                if "." in clean_tbl:
                    db_p, tbl_p = clean_tbl.split(".", 1)
                    sql = f"SELECT * FROM `{db_p}`.`{tbl_p}` LIMIT %s"
                else:
                    sql = f"SELECT * FROM `{clean_tbl}` LIMIT %s"
                cur.execute(sql, (limit,))
                rows = cur.fetchall()
                return [_safe_row(r) for r in rows]
        finally:
            conn.close()

    def read_rows(self, table: str, offset: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Paginated row read for serverless UI inspection."""
        clean_tbl = table.replace("`", "").strip()
        conn = self._connect()
        try:
            with conn.cursor() as cur:
                if "." in clean_tbl:
                    db_p, tbl_p = clean_tbl.split(".", 1)
                    sql = f"SELECT * FROM `{db_p}`.`{tbl_p}` LIMIT %s OFFSET %s"
                else:
                    sql = f"SELECT * FROM `{clean_tbl}` LIMIT %s OFFSET %s"
                cur.execute(sql, (limit, offset))
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
                tbl_expr = f"`{clean_tbl.split('.', 1)[0]}`.`{clean_tbl.split('.', 1)[1]}`" if "." in clean_tbl else f"`{clean_tbl}`"

                if mode == "replace":
                    cur.execute(f"TRUNCATE TABLE {tbl_expr}")

                cols = list(records[0].keys())
                col_names = ", ".join(f"`{c}`" for c in cols)
                placeholders = ", ".join(["%s"] * len(cols))
                sql = f"INSERT INTO {tbl_expr} ({col_names}) VALUES ({placeholders})"

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
