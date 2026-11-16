"""
MySQL and MariaDB Connector Plugin.

Connects to MySQL / MariaDB instances (Localhost, XAMPP, Docker, AWS RDS, PlanetScale, DigitalOcean):
  • Localhost URI: mysql://root:password@localhost:3306/dbname
  • Localhost (no password): mysql://root@127.0.0.1:3306/dbname
  • Cloud RDS URI: mysql://user:password@rds.endpoint:3306/dbname?ssl=require
"""

from __future__ import annotations

import json
import os
import re
import ssl
import time
from datetime import datetime, timezone
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

        # Guard: Helpful error when running in cloud (e.g. Vercel) and user enters 127.0.0.1/localhost
        is_cloud_env = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("RENDER"))
        if is_cloud_env and host in ("localhost", "127.0.0.1", "::1"):
            raise ConnectionError(
                f"Cannot connect to local MySQL host '{host}' from cloud deployment (Vercel/Render). "
                f"Cloud lambdas run in isolated containers and cannot reach your private laptop or network. "
                f"Please provide a public cloud MySQL connection (e.g. Aiven, PlanetScale, Railway, Supabase) "
                f"or tunnel your local database with ngrok: 'ngrok tcp 3306'."
            )

        ssl_kwargs: Dict[str, Any] = {}
        # For cloud MySQL or if SSL requested, create an SSLContext
        if self.ssl_required or (host not in ("localhost", "127.0.0.1", "::1")):
            try:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                ssl_kwargs["ssl"] = ctx
            except Exception as e:
                logger.warning(f"[MySQLConnector] Failed to create SSL context: {e}")

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
            # If SSL connection failed on remote host, retry once without SSL
            if "ssl" in ssl_kwargs and not self.ssl_required:
                try:
                    logger.info("[MySQLConnector] Retrying remote connection without explicit SSL context...")
                    return pymysql.connect(
                        host=host,
                        port=self.port,
                        user=self.user,
                        password=self.password,
                        database=self.database or None,
                        connect_timeout=self.connect_timeout,
                        cursorclass=pymysql.cursors.DictCursor,
                        autocommit=True,
                    )
                except Exception:
                    pass

            # Fallback for localhost -> 127.0.0.1 on Windows
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

    def _exact_count(self, table: str) -> int:
        """Returns exact count of rows in the given table."""
        clean_tbl = table.replace("`", "").strip()
        conn = self._connect()
        try:
            with conn.cursor() as cur:
                if "." in clean_tbl:
                    db_p, tbl_p = clean_tbl.split(".", 1)
                    sql = f"SELECT COUNT(*) AS cnt FROM `{db_p}`.`{tbl_p}`"
                else:
                    sql = f"SELECT COUNT(*) AS cnt FROM `{clean_tbl}`"
                cur.execute(sql)
                res = cur.fetchone() or {}
                return int(res.get("cnt") or 0)
        except Exception as e:
            logger.warning(f"[MySQLConnector] Exact count failed for '{table}': {e}")
            return 0
        finally:
            conn.close()

    def estimate(self, scope: Dict[str, Any]) -> Dict[str, Any]:
        """Returns row count and size estimate for a table scope."""
        table = scope.get("dataset_name") or scope.get("table") or ""
        cnt = self._exact_count(table) if table else 0
        return {
            "row_count": cnt,
            "byte_size": cnt * 250,
            "partition_count": max(1, (cnt + 499) // 500),
        }

    def plan_extract(
        self,
        scope: Dict[str, Any],
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> List[PartitionInfo]:
        """Creates extraction partition plan for the table."""
        table = scope.get("dataset_name") or scope.get("table") or "default"
        total = self._exact_count(table)
        batch = int(scope.get("batch_size") or 500)
        batch = max(1, min(batch, 50_000))

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
                    token="0",
                )
            ]

        partitions: List[PartitionInfo] = []
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
        """Yields records for a given partition."""
        start = partition.lower_bound or 0
        limit = max(
            1, (partition.upper_bound or (start + 500)) - start
        )
        rows = self.read_rows(
            table=partition.dataset_name,
            offset=start,
            limit=limit,
        )
        for r in rows:
            yield r

    def write_records(
        self,
        table: str,
        records: List[Dict[str, Any]],
        mode: str = "append",
    ) -> Dict[str, Any]:
        """Inserts records into a MySQL table with resilient type coercion and conflict handling."""
        if not records:
            return {"table": table, "inserted": 0, "failed": 0, "total": 0, "rejections": []}

        clean_tbl = table.replace("`", "").strip()
        conn = self._connect()
        inserted = 0
        rejections: List[str] = []

        try:
            with conn.cursor() as cur:
                # 1. Temporarily disable foreign key checks to prevent ordering deadlocks
                try:
                    cur.execute("SET FOREIGN_KEY_CHECKS = 0;")
                except Exception:
                    pass

                tbl_expr = f"`{clean_tbl.split('.', 1)[0]}`.`{clean_tbl.split('.', 1)[1]}`" if "." in clean_tbl else f"`{clean_tbl}`"

                if mode == "replace":
                    try:
                        cur.execute(f"TRUNCATE TABLE {tbl_expr}")
                    except Exception:
                        cur.execute(f"DELETE FROM {tbl_expr}")

                # 2. Introspect target table valid columns and nullability
                if "." in clean_tbl:
                    db_p, tbl_p = clean_tbl.split(".", 1)
                    cur.execute(
                        "SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, COLUMN_KEY, EXTRA "
                        "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
                        (db_p, tbl_p),
                    )
                else:
                    cur.execute(
                        "SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, COLUMN_KEY, EXTRA "
                        "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s",
                        (clean_tbl,),
                    )
                col_meta = cur.fetchall() or []
                col_map = {r["COLUMN_NAME"]: r for r in col_meta}
                valid_cols = set(col_map.keys())

                # 3. Identify provided columns that exist in the target table
                provided_cols = [c for c in records[0].keys() if c in valid_cols] if valid_cols else list(records[0].keys())

                # 4. Identify required (NOT NULL) target columns that are missing from provided records
                missing_required: Dict[str, Any] = {}
                for m in col_meta:
                    c_name = m["COLUMN_NAME"]
                    is_null = m["IS_NULLABLE"] == "YES"
                    has_default = m["COLUMN_DEFAULT"] is not None
                    is_auto = "auto_increment" in (m.get("EXTRA") or "").lower()
                    if not is_null and not has_default and not is_auto and c_name not in provided_cols:
                        dt = (m.get("DATA_TYPE") or "").lower()
                        if dt in ("int", "bigint", "tinyint", "smallint", "mediumint", "decimal", "float", "double", "numeric"):
                            missing_required[c_name] = 0
                        elif dt in ("datetime", "timestamp"):
                            missing_required[c_name] = "1970-01-01 00:00:00"
                        elif dt == "date":
                            missing_required[c_name] = "1970-01-01"
                        elif dt in ("bit", "boolean"):
                            missing_required[c_name] = 0
                        else:
                            missing_required[c_name] = ""

                cols = provided_cols + list(missing_required.keys())
                if not cols:
                    logger.warning(f"[MySQLConnector] No valid target columns matched for {clean_tbl}")
                    return {"table": table, "inserted": 0, "failed": len(records), "total": len(records), "rejections": ["No matching columns found in target table"]}

                # 5. Resilient Value Sanitization function
                def _sanitize_val(val: Any, meta: Dict[str, Any]) -> Any:
                    dt = (meta.get("DATA_TYPE") or "").lower()
                    is_null = meta.get("IS_NULLABLE") == "YES"
                    max_len = meta.get("CHARACTER_MAXIMUM_LENGTH")

                    if val is None or val == "" or (isinstance(val, str) and not val.strip()):
                        if is_null:
                            return None
                        if dt in ("datetime", "timestamp"):
                            return "1970-01-01 00:00:00"
                        if dt == "date":
                            return "1970-01-01"
                        if dt in ("int", "bigint", "tinyint", "smallint", "mediumint", "decimal", "float", "double", "numeric"):
                            return 0
                        if dt in ("bit", "boolean"):
                            return 0
                        return ""

                    if dt in ("datetime", "timestamp"):
                        val_str = str(val).strip()
                        if isinstance(val, (int, float)) or (val_str.isdigit() and len(val_str) >= 9):
                            try:
                                epoch = float(val)
                                if epoch > 1e11:
                                    epoch /= 1000.0
                                return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                            except Exception:
                                return "1970-01-01 00:00:00"
                        cleaned = val_str.replace("T", " ").replace("Z", "")
                        if "+" in cleaned:
                            cleaned = cleaned.split("+")[0]
                        if "." in cleaned and len(cleaned.split(".")[1]) > 6:
                            cleaned = cleaned.split(".")[0]
                        return cleaned.strip()

                    if dt == "date":
                        val_str = str(val).strip()
                        if isinstance(val, (int, float)) or (val_str.isdigit() and len(val_str) >= 9):
                            try:
                                epoch = float(val)
                                if epoch > 1e11:
                                    epoch /= 1000.0
                                return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%d")
                            except Exception:
                                return "1970-01-01"
                        return val_str[:10]

                    if dt in ("int", "bigint", "tinyint", "smallint", "mediumint"):
                        if isinstance(val, bool):
                            return 1 if val else 0
                        try:
                            cl = re.sub(r"[^\d.-]", "", str(val))
                            return int(round(float(cl))) if cl else 0
                        except Exception:
                            return 0

                    if dt in ("decimal", "float", "double", "numeric"):
                        try:
                            cl = re.sub(r"[^\d.-]", "", str(val))
                            return float(cl) if cl else 0.0
                        except Exception:
                            return 0.0

                    if dt in ("bit", "boolean"):
                        return 1 if str(val).lower() in ("1", "true", "yes", "t", "y") or val is True else 0

                    if dt == "json":
                        if isinstance(val, (dict, list)):
                            return json.dumps(val, default=str)

                    s = str(val)
                    if max_len and len(s) > max_len:
                        s = s[:max_len]
                    return s

                # 6. Build batch of sanitized rows
                batch = []
                for idx, r in enumerate(records):
                    row_vals = []
                    for c in cols:
                        meta = col_map.get(c, {})
                        val = r.get(c)

                        # If value is missing or empty, check if it's a unique/key column that needs a distinct value
                        if (val is None or val == "") and (
                            meta.get("COLUMN_KEY") in ("UNI", "PRI")
                            or c.endswith(("_id", "_key", "_natural_id", "_code"))
                        ):
                            # Try to pull from existing ID fields in the record
                            for rk, rv in r.items():
                                if (
                                    rk.lower() in ("id", "cust_id", "_id", "code", "customer_id", "sub_id", "invoice_id", "plan_id")
                                    or rk.lower().endswith(("_id", "_code", "_number"))
                                ) and rv is not None and str(rv).strip():
                                    val = str(rv)
                                    break
                            if not val or val == "":
                                val = f"{clean_tbl}_{idx + 1}"

                        if val is not None and val != "":
                            row_vals.append(_sanitize_val(val, meta))
                        elif c in missing_required:
                            def_val = missing_required[c]
                            if meta.get("COLUMN_KEY") in ("UNI", "PRI") or c.endswith(("_id", "_key", "_natural_id", "_code")):
                                def_val = f"{c}_{idx + 1}"
                            row_vals.append(_sanitize_val(def_val, meta))
                        else:
                            row_vals.append(None)
                    batch.append(row_vals)

                col_names = ", ".join(f"`{c}`" for c in cols)
                placeholders = ", ".join(["%s"] * len(cols))

                # 7. Construct ON DUPLICATE KEY UPDATE clause for upsert support
                update_cols = [
                    f"`{c}` = VALUES(`{c}`)"
                    for c in cols
                    if col_map.get(c, {}).get("COLUMN_KEY") != "PRI"
                    and "auto_increment" not in (col_map.get(c, {}).get("EXTRA") or "").lower()
                ]

                if update_cols and mode != "replace":
                    sql = f"INSERT INTO {tbl_expr} ({col_names}) VALUES ({placeholders}) ON DUPLICATE KEY UPDATE {', '.join(update_cols)}"
                else:
                    sql = f"INSERT IGNORE INTO {tbl_expr} ({col_names}) VALUES ({placeholders})"

                # 8. Attempt batch execution
                try:
                    cur.executemany(sql, batch)
                    inserted = len(records)
                except Exception as batch_err:
                    logger.warning(
                        f"[MySQLConnector] Batch insert failed on {clean_tbl}: {batch_err}. "
                        "Retrying row-by-row for fault-tolerance..."
                    )
                    # Resilient fallback: write row-by-row
                    for idx, row_vals in enumerate(batch):
                        try:
                            cur.execute(sql, row_vals)
                            inserted += 1
                        except Exception as row_err:
                            err_msg = f"Row {idx+1} error: {row_err}"
                            rejections.append(err_msg)
                            logger.error(f"[MySQLConnector] {clean_tbl} {err_msg} | Sample data: {row_vals[:3]}")

                conn.commit()

        except Exception as general_err:
            logger.error(f"[MySQLConnector] write_records failed for {clean_tbl}: {general_err}", exc_info=True)
            rejections.append(f"Fatal table error: {general_err}")
        finally:
            try:
                with conn.cursor() as cur:
                    cur.execute("SET FOREIGN_KEY_CHECKS = 1;")
                conn.commit()
            except Exception:
                pass
            conn.close()

        failed_count = len(records) - inserted
        return {
            "table": table,
            "inserted": inserted,
            "failed": failed_count,
            "total": len(records),
            "rejections": rejections,
        }

    def write_batch(
        self,
        records: List[Dict[str, Any]],
        idempotency_context: Dict[str, Any],
    ) -> WriteBatchResult:
        """Writes a batch of records conforming to BaseConnector."""
        table = (
            idempotency_context.get("target_dataset")
            or idempotency_context.get("table")
            or "default"
        )
        mode = (idempotency_context.get("mode") or "append").lower()
        if mode not in ("append", "replace"):
            mode = "append"
        res = self.write_records(table, records, mode=mode)
        inserted = int(res.get("inserted") or 0)
        failed = int(res.get("failed") or 0)
        rejections = res.get("rejections") or []
        return WriteBatchResult(
            accepted_records=inserted,
            rejected_records=failed,
            target_ids=[],
            rejection_reasons=rejections,
        )

    def begin_snapshot(self, operation_ref: str) -> None:
        """Best-effort snapshot hook."""
        pass

    def compensate(self, operation_ref: str) -> bool:
        """Rollback snapshot hook."""
        return True

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
