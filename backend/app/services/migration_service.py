"""
Migration Service — the orchestrator.

Drives a run through phases, pausing at the two human gates.

This file contains ONLY business logic:
  - pre-flight gates
  - phase execution (extract → transform → validate → load)
  - the load gate (approve/abort)
  - the load phase
  - reconciliation
  - sign-off

No HTTP. No FastAPI. No Pydantic response models.
"""

import os
import time
import uuid
from typing import Any, Dict, List, Optional

from app.core.errors import ErrorCategory, PlatformException
from app.core.logging import get_logger
from app.core.security import compute_sha256
from app.db.mongo import mongo_manager
from app.db.store import store
from app.models.canonical import (
    Endpoint,
    ExceptionDisposition,
    RuleSeverity,
    RunState,
    TaskAttempt,
)
from app.models.migration import (
    LoadApproval,
    LoadMode,
    MigrationManifest,
    MigrationPhase,
    MigrationRun,
    PreflightGate,
    ReviewContext,
    ReviewMode,
    SignoffRecord,
    TableLoadConfig,
    TablePreview,
)
from app.sdk.connectors.registry import connector_registry
from app.services.evidence_service import evidence_service
from app.services.pair_mapping_service import pair_mapping_service
from app.workers.extract_worker import extract_worker
from app.workers.load_worker import load_worker
from app.workers.reconcile_worker import reconcile_worker
from app.workers.transform_worker import transform_worker
from app.workers.validate_worker import validate_worker

logger = get_logger("migration_service")

COLLECTION_MANIFESTS = "migration_manifests"
COLLECTION_RUNS = "migration_runs"

# Rows per read/write batch. Tuned for millions-of-rows migrations
# without OOMing the worker. Override via MIGRATION_BATCH_SIZE env.
DEFAULT_BATCH_SIZE = 5_000

# Safety cap: how many rows to keep per table in the in-memory cache
# used for the review card. Doesn't affect what gets written — only
# what we show the reviewer.
SAMPLE_CACHE_ROWS = 200

# Secret-ish keys that should never be echoed back in a config summary.
_SECRET_HINTS = ("secret", "key", "token", "password", "pass")


class MigrationService:
    # ═════════════════════════════════════════════════════════
    # Endpoint / connector resolution
    # ═════════════════════════════════════════════════════════
    def _endpoint_for_system(
        self, tenant_id: str, system_id: str
    ) -> Optional[Endpoint]:
        """Look up the Endpoint attached to a system, hydrating from Mongo."""
        # In-memory first
        eps = getattr(store, "_endpoints", {}).get(tenant_id, {})
        for ep in eps.values():
            if ep.system_id == system_id:
                return ep

        # Mongo fallback
        doc = mongo_manager.find_one(
            "endpoints", {"tenant_id": tenant_id, "system_id": system_id}
        )
        if doc:
            try:
                doc.pop("_id", None)
                ep = Endpoint(**doc)
                store._endpoints.setdefault(tenant_id, {})[ep.endpoint_id] = ep
                return ep
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"[MigrationService] Could not parse endpoint for "
                    f"system '{system_id}': {e}"
                )
        return None

    def _resolve_connector_for_system(self, tenant_id: str, system):
        """
        Build a connector for a system using its real Endpoint config
        (connection_params + secret_ref), then rehydrate any persisted rows.
        """
        ep = self._endpoint_for_system(tenant_id, system.system_id)
        config = dict(ep.connection_params) if ep else {}
        config["endpoint_id"] = system.system_id

        return connector_registry.get_connector_with_persisted_data(
            connector_type=system.connector_type,
            endpoint_config=config,
            secret_ref=ep.secret_ref if ep else None,
            tenant_id=tenant_id,
            system_id=system.system_id,
        )

    # ═════════════════════════════════════════════════════════
    # Identity backfill (for runs created before name/version existed)
    # ═════════════════════════════════════════════════════════
    def _backfill_run_identity(self, tenant_id: str, run: MigrationRun) -> MigrationRun:
        """
        Ensure `run.name`, `run.description`, `run.version_tag` are populated.

        Old runs (created before the model gained these fields) will come
        back from Mongo without them. We derive:
          1. name       ← manifest.name  OR  <source> → <target>  OR  pair-set name
          2. version    ← manifest.version_tag  OR  pair-set version  OR  "1.0.0"
          3. description← manifest.description (if it ever lands) OR pair-set name
        """
        needs_name = not (run.name or "").strip()
        needs_version = not (run.version_tag or "").strip() or run.version_tag == "1.0.0"
        needs_desc = not (run.description or "").strip()

        if not (needs_name or needs_version or needs_desc):
            return run

        manifest = store.get_migration_manifest(tenant_id, run.manifest_id)

        # -- Name --------------------------------------------------
        if needs_name:
            if manifest and (manifest.name or "").strip():
                run.name = manifest.name.strip()
            elif manifest:
                src = store.get_system(tenant_id, manifest.source_system_id)
                tgt = store.get_system(tenant_id, manifest.target_system_id)
                if src and tgt:
                    run.name = f"{src.name} → {tgt.name}"
            if not run.name:
                pms = None
                if manifest:
                    pms = pair_mapping_service.get_set(
                        tenant_id, manifest.pair_mapping_set_id
                    )
                if pms and (pms.name or "").strip():
                    run.name = pms.name.strip()
            if not run.name:
                run.name = f"Migration {run.run_id}"

        # -- Version -----------------------------------------------
        if needs_version:
            if manifest and (manifest.version_tag or "").strip():
                run.version_tag = manifest.version_tag.strip()
            else:
                pms = None
                if manifest:
                    pms = pair_mapping_service.get_set(
                        tenant_id, manifest.pair_mapping_set_id
                    )
                if pms and (pms.version_tag or "").strip():
                    run.version_tag = pms.version_tag.strip()
                else:
                    run.version_tag = "1.0.0"

        # -- Description -------------------------------------------
        if needs_desc:
            if manifest and (getattr(manifest, "name", "") or "").strip():
                run.description = ""
            else:
                pms = None
                if manifest:
                    pms = pair_mapping_service.get_set(
                        tenant_id, manifest.pair_mapping_set_id
                    )
                if pms and (pms.name or "").strip():
                    run.description = pms.name.strip()
                else:
                    run.description = ""

        # Persist so we don't have to re-derive next time.
        try:
            store.save_migration_run(tenant_id, run)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[MigrationService] Could not persist backfilled identity "
                f"for run {run.run_id}: {e}"
            )
        return run

    # ═════════════════════════════════════════════════════════
    # PHASE 1 — Create a run (manifest + pre-flight + extract)
    # ═════════════════════════════════════════════════════════
    def create_run(
        self,
        tenant_id: str,
        project_id: str,
        pair_mapping_set_id: str,
        review_mode: str = "STANDARD",
        table_load_overrides: Optional[List[Dict[str, Any]]] = None,
        policy_waivers: Optional[List[str]] = None,
        actor: str = "system",
        name: Optional[str] = None,
        description: Optional[str] = None,
        version_tag: str = "1.0.0",
    ) -> MigrationRun:
        # 1. Validate the pair-mapping set
        pms = pair_mapping_service.get_set(tenant_id, pair_mapping_set_id)
        if not pms:
            raise PlatformException(
                code="PAIR_MAPPING_SET_NOT_FOUND",
                message=f"Pair mapping set '{pair_mapping_set_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        if pms.status != "APPROVED":
            raise PlatformException(
                code="PAIR_MAPPING_SET_NOT_APPROVED",
                message="Pair mapping set must be APPROVED before migration.",
                category=ErrorCategory.INVALID_STATE,
                status_code=409,
            )

        # 2. Resolve a stable human-readable name
        resolved_name = (name or "").strip()
        if not resolved_name:
            # Fall back to source → target so the list always has a title
            src_sys = store.get_system(tenant_id, pms.source_system_id or "")
            tgt_sys = store.get_system(tenant_id, pms.target_system_id or "")
            if src_sys and tgt_sys:
                resolved_name = f"{src_sys.name} → {tgt_sys.name}"
            elif (pms.name or "").strip():
                resolved_name = pms.name.strip()
            else:
                resolved_name = "Untitled Migration"

        resolved_desc = (description or "").strip()
        resolved_version = (version_tag or "").strip() or (pms.version_tag or "1.0.0")

        # 3. Build table load configs
        table_configs = self._build_table_configs(pms, table_load_overrides)

        # 4. Build the manifest
        manifest = MigrationManifest(
            tenant_id=tenant_id,
            project_id=project_id,
            name=resolved_name,
            version_tag=resolved_version,
            pair_mapping_set_id=pms.set_id,
            ontology_version_id=pms.ontology_version_id,
            source_system_id=pms.source_system_id or "",
            target_system_id=pms.target_system_id or "",
            table_load_configs=table_configs,
            review_mode=ReviewMode(review_mode.upper()),
            policy_waivers=policy_waivers or [],
            created_by=actor,
        )
        manifest.manifest_hash = compute_sha256(
            manifest.model_dump(mode="json", exclude={"manifest_hash"})
        )
        store.save_migration_manifest(tenant_id, manifest)

        # 5. Build the run — identity mirrored onto the run itself
        run = MigrationRun(
            manifest_id=manifest.manifest_id,
            project_id=project_id,
            tenant_id=tenant_id,
            name=resolved_name,
            description=resolved_desc,
            version_tag=resolved_version,
            state="QUEUED",
            phase=MigrationPhase.PREFLIGHT,
            tables_total=len(table_configs),
        )
        store.save_migration_run(tenant_id, run)

        # 6. Execute phases 2–5
        try:
            self._run_preflight(tenant_id, run, manifest)
            if self._has_blocking_failure(run):
                run.state = "FAILED"
                failed_gates = [
                    g.name
                    for g in run.preflight_gates
                    if g.blocking and g.status == "FAILED"
                ]
                run.error = (
                    "Pre-flight gates failed: " + ", ".join(failed_gates)
                    if failed_gates
                    else "Pre-flight gates failed"
                )
                store.save_migration_run(tenant_id, run)
                return run

            self._run_extract_transform_validate(tenant_id, run, manifest)

            # 7. Decide: halt at load gate or continue?
            if self._should_halt_at_load_gate(run, manifest):
                run.state = "AWAITING_LOAD_REVIEW"
                run.phase = MigrationPhase.AWAITING_LOAD_REVIEW
                store.save_migration_run(tenant_id, run)
            else:
                # Auto-approve and proceed to load
                self._run_load(tenant_id, run, manifest)
                self._run_reconcile(tenant_id, run, manifest)

                if not self._has_blocking_exceptions(tenant_id, run.run_id):
                    # Clean pass → auto sign off
                    try:
                        self.signoff(
                            tenant_id=tenant_id,
                            run_id=run.run_id,
                            actor=actor or "system",
                            comments="Auto sign-off after successful reconcile",
                        )
                        run = (
                            store.get_migration_run(tenant_id, run.run_id)
                            or run
                        )
                    except Exception as e:  # noqa: BLE001
                        logger.warning(
                            f"[MigrationService] Auto sign-off failed: {e}"
                        )
                        run.state = "COMPLETED"
                        run.phase = MigrationPhase.DONE
                        run.completed_at = time.time()
                        store.save_migration_run(tenant_id, run)
                else:
                    run.state = "EXCEPTION_REVIEW"
                    run.phase = MigrationPhase.DONE
                    run.completed_at = time.time()
                    store.save_migration_run(tenant_id, run)

        except Exception as e:  # noqa: BLE001
            logger.error(f"[MigrationService] Run failed: {e}", exc_info=True)
            run.state = "FAILED"
            run.error = str(e)
            store.save_migration_run(tenant_id, run)

        return run

    # ═════════════════════════════════════════════════════════
    # PHASE 2 — Pre-flight gates
    # ═════════════════════════════════════════════════════════
    def _probe_source_has_rows(
        self,
        connector,
        source_table: str,
    ) -> tuple[bool, str]:
        """
        Probe one source table. Returns (has_data, reason).

        A table 'has data' if EITHER:
          - connector.list_tables() reports row_count > 0
          - OR read_table(limit=1) returns at least one row
        """
        try:
            listed = {t["name"]: t for t in connector.list_tables()}
        except Exception as e:  # noqa: BLE001
            return False, f"list_tables() failed: {e}"

        meta = listed.get(source_table)
        if meta is None:
            return False, f"table '{source_table}' not found on source"

        reported = int(meta.get("row_count") or 0)
        if reported > 0:
            return True, f"'{source_table}' reports {reported} rows"

        try:
            probe = connector.read_table(source_table, limit=1)
        except Exception as e:  # noqa: BLE001
            return False, f"read_table('{source_table}') failed: {e}"

        if probe:
            return (
                True,
                f"'{source_table}' reported 0 rows but read_table returned data",
            )

        return False, f"table '{source_table}' exists but has 0 rows"

    def _run_preflight(
        self,
        tenant_id: str,
        run: MigrationRun,
        manifest: MigrationManifest,
    ) -> None:
        run.phase = MigrationPhase.PREFLIGHT

        src_sys = store.get_system(tenant_id, manifest.source_system_id)
        tgt_sys = store.get_system(tenant_id, manifest.target_system_id)

        src_conn = None
        tgt_conn = None

        if src_sys:
            try:
                src_conn = self._resolve_connector_for_system(
                    tenant_id, src_sys
                )
            except Exception as e:  # noqa: BLE001
                run.preflight_gates.append(
                    PreflightGate(
                        name="source_reachable",
                        status="FAILED",
                        message=f"Could not build source connector: {e}",
                        blocking=True,
                    )
                )

        if tgt_sys:
            try:
                tgt_conn = self._resolve_connector_for_system(
                    tenant_id, tgt_sys
                )
            except Exception as e:  # noqa: BLE001
                run.preflight_gates.append(
                    PreflightGate(
                        name="target_reachable",
                        status="FAILED",
                        message=f"Could not build target connector: {e}",
                        blocking=True,
                    )
                )

        store._migration_conn_cache = getattr(
            store, "_migration_conn_cache", {}
        )
        store._migration_conn_cache[run.run_id] = {
            "src": src_conn,
            "tgt": tgt_conn,
            "transformed": {},
            "spool": {},
        }

        # ── Gate 1: source reachable ─────────────────────────
        if not src_sys:
            already = any(
                g.name == "source_reachable" for g in run.preflight_gates
            )
            if not already:
                run.preflight_gates.append(
                    PreflightGate(
                        name="source_reachable",
                        status="FAILED",
                        message="Source system not found",
                        blocking=True,
                    )
                )
        elif src_conn is not None:
            try:
                health = src_conn.test_connection()
                run.preflight_gates.append(
                    PreflightGate(
                        name="source_reachable",
                        status=(
                            "PASSED"
                            if health.get("status") == "SUCCESS"
                            else "FAILED"
                        ),
                        message=health.get("message", ""),
                        details=health,
                        blocking=True,
                    )
                )
            except Exception as e:  # noqa: BLE001
                run.preflight_gates.append(
                    PreflightGate(
                        name="source_reachable",
                        status="FAILED",
                        message=str(e),
                        blocking=True,
                    )
                )

        # ── Gate 2: source has rows ──────────────────────────
        if src_conn is not None and manifest.table_load_configs:
            missing: List[str] = []
            empty: List[str] = []

            for cfg in manifest.table_load_configs:
                has_data, reason = self._probe_source_has_rows(
                    src_conn, cfg.source_table
                )
                if has_data:
                    continue
                if "not found" in reason:
                    missing.append(f"{cfg.source_table} ({reason})")
                else:
                    empty.append(f"{cfg.source_table} ({reason})")

            if missing or empty:
                msgs = []
                if missing:
                    msgs.append("Missing: " + "; ".join(missing[:5]))
                if empty:
                    msgs.append("Empty: " + "; ".join(empty[:5]))
                run.preflight_gates.append(
                    PreflightGate(
                        name="source_has_rows",
                        status="FAILED",
                        message=" | ".join(msgs),
                        details={"missing": missing, "empty": empty},
                        blocking=True,
                    )
                )
            else:
                run.preflight_gates.append(
                    PreflightGate(
                        name="source_has_rows",
                        status="PASSED",
                        message=(
                            f"All {len(manifest.table_load_configs)} "
                            f"source tables have data."
                        ),
                        blocking=True,
                    )
                )

        # ── Gate 3: mapping has columns ──────────────────────
        try:
            pms = pair_mapping_service.get_set(
                tenant_id, manifest.pair_mapping_set_id
            )
            if pms:
                empty_pairs: List[str] = []
                for pair in pms.pairs:
                    matched = sum(
                        1
                        for c in pair.columns
                        if c.matched_source_column
                    )
                    if matched == 0:
                        empty_pairs.append(
                            f"{pair.source_table} → {pair.target_table}"
                        )
                if empty_pairs:
                    run.preflight_gates.append(
                        PreflightGate(
                            name="mapping_has_columns",
                            status="FAILED",
                            message=(
                                f"{len(empty_pairs)} pair(s) have zero "
                                f"mapped columns: "
                                + "; ".join(empty_pairs[:3])
                            ),
                            details={"empty_pairs": empty_pairs},
                            blocking=True,
                        )
                    )
                else:
                    run.preflight_gates.append(
                        PreflightGate(
                            name="mapping_has_columns",
                            status="PASSED",
                            message="Every pair maps at least one column.",
                            blocking=True,
                        )
                    )
        except Exception as e:  # noqa: BLE001
            run.preflight_gates.append(
                PreflightGate(
                    name="mapping_has_columns",
                    status="FAILED",
                    message=f"Could not inspect mapping set: {e}",
                    blocking=True,
                )
            )

        # ── Gate 4: target reachable ─────────────────────────
        if not tgt_sys:
            already = any(
                g.name == "target_reachable" for g in run.preflight_gates
            )
            if not already:
                run.preflight_gates.append(
                    PreflightGate(
                        name="target_reachable",
                        status="FAILED",
                        message="Target system not found",
                        blocking=True,
                    )
                )
        elif tgt_conn is not None:
            try:
                health = tgt_conn.test_connection()
                run.preflight_gates.append(
                    PreflightGate(
                        name="target_reachable",
                        status=(
                            "PASSED"
                            if health.get("status") == "SUCCESS"
                            else "FAILED"
                        ),
                        message=health.get("message", ""),
                        details=health,
                        blocking=True,
                    )
                )
            except Exception as e:  # noqa: BLE001
                run.preflight_gates.append(
                    PreflightGate(
                        name="target_reachable",
                        status="FAILED",
                        message=str(e),
                        blocking=True,
                    )
                )

        # ── Gate 5: target state ─────────────────────────────
        if tgt_conn is not None:
            try:
                target_tables = {
                    t["name"]: t for t in tgt_conn.list_tables()
                }
                risky = []
                for cfg in manifest.table_load_configs:
                    t = target_tables.get(cfg.target_table)
                    if t and t.get("row_count", 0) > 0:
                        if cfg.load_mode == LoadMode.REPLACE:
                            risky.append(
                                f"{cfg.target_table} "
                                f"({t['row_count']} rows will be DELETED)"
                            )
                        elif cfg.load_mode == LoadMode.APPEND:
                            risky.append(
                                f"{cfg.target_table} (may duplicate "
                                f"{t['row_count']} rows)"
                            )
                if risky:
                    run.preflight_gates.append(
                        PreflightGate(
                            name="target_state",
                            status="WARNING",
                            message=(
                                "Some load modes will affect existing "
                                "data: " + "; ".join(risky)
                            ),
                            details={"risky_tables": risky},
                            blocking=False,
                        )
                    )
                    run.warnings.extend(risky)
                else:
                    run.preflight_gates.append(
                        PreflightGate(
                            name="target_state",
                            status="PASSED",
                            message=(
                                "All target tables are empty or append-safe"
                            ),
                            blocking=False,
                        )
                    )
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Target state check failed: {e}")

        store.save_migration_run(tenant_id, run)

    def _has_blocking_failure(self, run: MigrationRun) -> bool:
        return any(
            g.blocking and g.status == "FAILED" for g in run.preflight_gates
        )

    # ═════════════════════════════════════════════════════════
    # PHASE 3–5 — Batched Extract + Transform + Validate
    # ═════════════════════════════════════════════════════════
    def _run_extract_transform_validate(
        self,
        tenant_id: str,
        run: MigrationRun,
        manifest: MigrationManifest,
    ) -> None:
        run.started_at = time.time()
        run.state = "RUNNING"
        store.save_migration_run(tenant_id, run)

        src_sys = store.get_system(tenant_id, manifest.source_system_id)
        tgt_sys = store.get_system(tenant_id, manifest.target_system_id)
        if not src_sys or not tgt_sys:
            raise RuntimeError("Source or target system disappeared mid-run")

        pms = pair_mapping_service.get_set(
            tenant_id, manifest.pair_mapping_set_id
        )
        if not pms:
            raise RuntimeError("Pair mapping set disappeared mid-run")

        cache = getattr(store, "_migration_conn_cache", {}).get(
            run.run_id, {}
        )
        src_conn = cache.get("src")
        tgt_conn = cache.get("tgt")

        if src_conn is None:
            src_conn = self._resolve_connector_for_system(tenant_id, src_sys)
        if tgt_conn is None:
            tgt_conn = self._resolve_connector_for_system(tenant_id, tgt_sys)

        store._migration_conn_cache = getattr(
            store, "_migration_conn_cache", {}
        )
        store._migration_conn_cache.setdefault(run.run_id, {})
        store._migration_conn_cache[run.run_id].update(
            {
                "src": src_conn,
                "tgt": tgt_conn,
                "transformed": store._migration_conn_cache[run.run_id].get(
                    "transformed", {}
                ),
                "spool": store._migration_conn_cache[run.run_id].get(
                    "spool", {}
                ),
            }
        )

        BATCH_SIZE = int(
            os.getenv("MIGRATION_BATCH_SIZE", str(DEFAULT_BATCH_SIZE))
        )

        spool_dir = os.path.join(
            os.getenv("MIGRATION_SPOOL_DIR", "/tmp/migration_spool"),
            run.run_id,
        )
        os.makedirs(spool_dir, exist_ok=True)
        store._migration_conn_cache[run.run_id]["spool_dir"] = spool_dir

        total_rows_written = 0

        for cfg in manifest.table_load_configs:
            pair = next(
                (
                    p
                    for p in pms.pairs
                    if p.source_table == cfg.source_table
                    and p.target_table == cfg.target_table
                ),
                None,
            )
            if not pair:
                logger.info(
                    f"[MigrationService] no pair for "
                    f"{cfg.source_table} → {cfg.target_table}, skipping"
                )
                continue

            rule_pkg = self._build_rule_package_from_pair(pair)
            validation_rules = self._build_validations_from_pair(pair)

            run.phase = MigrationPhase.EXTRACT
            store.save_migration_run(tenant_id, run)

            try:
                est = src_conn.estimate(
                    {"dataset_name": cfg.source_table}
                )
                run.rows_extracted += int(est.get("row_count") or 0)
            except Exception:  # noqa: BLE001
                pass

            try:
                plan = src_conn.plan_extract(
                    {
                        "dataset_name": cfg.source_table,
                        "batch_size": BATCH_SIZE,
                    }
                )
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"[MigrationService] plan_extract failed for "
                    f"{cfg.source_table}: {e}"
                )
                plan = []

            spool_path = os.path.join(
                spool_dir,
                f"{cfg.source_table}__{cfg.target_table}.jsonl",
            )
            spool_file = open(spool_path, "w", encoding="utf-8")
            store._migration_conn_cache[run.run_id]["spool"][
                cfg.target_table
            ] = spool_path

            preview_cache: List[Dict[str, Any]] = []
            total_for_table = 0

            for part in plan:
                try:
                    batch_iter = src_conn.read_partition(part)
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        f"[MigrationService] read_partition failed for "
                        f"{cfg.source_table}/{part.partition_id}: {e}"
                    )
                    continue

                batch: List[Dict[str, Any]] = []
                for raw_rec in batch_iter:
                    batch.append(raw_rec)
                    if len(batch) >= BATCH_SIZE:
                        _, transformed_count = (
                            self._transform_validate_spool_batch(
                                tenant_id=tenant_id,
                                run=run,
                                cfg=cfg,
                                rule_pkg=rule_pkg,
                                validation_rules=validation_rules,
                                src_sys=src_sys,
                                tgt_sys=tgt_sys,
                                raw_batch=batch,
                                spool_file=spool_file,
                                preview_cache=preview_cache,
                            )
                        )
                        total_for_table += transformed_count
                        batch = []

                if batch:
                    _, transformed_count = (
                        self._transform_validate_spool_batch(
                            tenant_id=tenant_id,
                            run=run,
                            cfg=cfg,
                            rule_pkg=rule_pkg,
                            validation_rules=validation_rules,
                            src_sys=src_sys,
                            tgt_sys=tgt_sys,
                            raw_batch=batch,
                            spool_file=spool_file,
                            preview_cache=preview_cache,
                        )
                    )
                    total_for_table += transformed_count

            spool_file.close()

            store._migration_conn_cache[run.run_id]["transformed"][
                cfg.target_table
            ] = preview_cache[-SAMPLE_CACHE_ROWS:]

            run.tables_completed += 1
            run.rows_transformed += total_for_table
            total_rows_written += total_for_table
            store.save_migration_run(tenant_id, run)

            logger.info(
                f"[MigrationService] {cfg.source_table} → "
                f"{cfg.target_table}: {total_for_table} rows spooled"
            )

        store.save_migration_run(tenant_id, run)

        if total_rows_written == 0:
            raise RuntimeError(
                "Extract+transform produced zero rows across all tables. "
                "Check that the source connector has data and the "
                "mapping has matched columns."
            )

    def _transform_validate_spool_batch(
        self,
        tenant_id: str,
        run: MigrationRun,
        cfg: TableLoadConfig,
        rule_pkg: Any,
        validation_rules: List[Dict[str, Any]],
        src_sys: Any,
        tgt_sys: Any,
        raw_batch: List[Dict[str, Any]],
        spool_file: Any,
        preview_cache: List[Dict[str, Any]],
    ):
        import json

        if not raw_batch:
            return 0, 0

        run.phase = MigrationPhase.TRANSFORM
        try:
            transform_result = transform_worker.execute_partition(
                tenant_id=tenant_id,
                run_id=run.run_id,
                partition_id=f"{cfg.source_table}-batch",
                source_records=raw_batch,
                rule_package=rule_pkg,
                mapping_version_id=run.manifest_id,
                source_system_name=src_sys.name,
                target_system_name=tgt_sys.name,
            )
            transformed = transform_result["transformed_records"]
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[MigrationService] transform failed for "
                f"{cfg.source_table} batch ({len(raw_batch)} rows): {e}"
            )
            run.rows_failed += len(raw_batch)
            return 0, 0

        if not transformed:
            return 0, 0

        run.phase = MigrationPhase.VALIDATE
        try:
            val_results = validate_worker.execute_validations(
                run_id=run.run_id,
                records=transformed,
                validation_rules=validation_rules,
            )
            for vr in val_results:
                store.add_validation_result(tenant_id, vr)
                if not vr.passed and vr.severity in (
                    RuleSeverity.WARNING,
                    RuleSeverity.ERROR,
                    RuleSeverity.CRITICAL,
                ):
                    msg = (
                        f"{cfg.source_table}: {vr.rule_id} failed on "
                        f"{vr.failed_count} rows ({vr.severity.value})"
                    )
                    if msg not in run.warnings:
                        run.warnings.append(msg)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[MigrationService] validate failed for "
                f"{cfg.source_table} batch: {e}"
            )

        run.rows_validated += len(transformed)

        try:
            for rec in transformed:
                spool_file.write(json.dumps(rec, default=str) + "\n")
            spool_file.flush()
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"[MigrationService] spool write failed for "
                f"{cfg.target_table}: {e}"
            )
            return 0, len(transformed)

        preview_cache.extend(transformed)
        if len(preview_cache) > SAMPLE_CACHE_ROWS * 2:
            del preview_cache[: len(preview_cache) - SAMPLE_CACHE_ROWS]

        store.save_migration_run(tenant_id, run)
        return len(transformed), len(transformed)

    # ═════════════════════════════════════════════════════════
    # LOAD GATE — decide whether to halt
    # ═════════════════════════════════════════════════════════
    def _should_halt_at_load_gate(
        self,
        run: MigrationRun,
        manifest: MigrationManifest,
    ) -> bool:
        if manifest.review_mode == ReviewMode.STRICT:
            return True
        if run.warnings:
            return True
        if any(cfg.requires_masking for cfg in manifest.table_load_configs):
            return True
        if any(
            g.name == "target_state" and g.status == "WARNING"
            for g in run.preflight_gates
        ):
            return True
        return False

    # ═════════════════════════════════════════════════════════
    # BUILD REVIEW CONTEXT
    # ═════════════════════════════════════════════════════════
    def build_review_context(
        self, tenant_id: str, run_id: str
    ) -> ReviewContext:
        run = store.get_migration_run(tenant_id, run_id)
        if not run:
            raise PlatformException(
                code="RUN_NOT_FOUND",
                message=f"Run '{run_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        manifest = store.get_migration_manifest(tenant_id, run.manifest_id)
        if not manifest:
            raise PlatformException(
                code="MANIFEST_NOT_FOUND",
                message="Manifest not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        cache = getattr(store, "_migration_conn_cache", {}).get(run_id, {})
        tgt_conn = cache.get("tgt")
        preview_by_table = cache.get("transformed", {})

        previews: List[TablePreview] = []
        total_src = 0
        total_tgt_before = 0
        total_tgt_after = 0
        total_cols = 0
        warnings: List[str] = []
        pii_count = 0

        for cfg in manifest.table_load_configs:
            before = 0
            if tgt_conn:
                try:
                    tt = {t["name"]: t for t in tgt_conn.list_tables()}
                    before = tt.get(cfg.target_table, {}).get("row_count", 0)
                except Exception:  # noqa: BLE001
                    pass

            src_rows = len(preview_by_table.get(cfg.target_table, []))
            col_count = len(cfg.include_column_map) or 1

            if cfg.load_mode == LoadMode.REPLACE:
                after = src_rows
            elif cfg.load_mode == LoadMode.APPEND:
                after = before + src_rows
            else:
                after = max(before, src_rows)

            table_warns = [
                w for w in run.warnings if w.startswith(cfg.source_table)
            ]
            is_destructive = (
                cfg.load_mode == LoadMode.REPLACE and before > 0
            )

            previews.append(
                TablePreview(
                    source_table=cfg.source_table,
                    target_table=cfg.target_table,
                    load_mode=cfg.load_mode,
                    source_row_count=src_rows,
                    target_row_count_before=before,
                    target_row_count_after_estimate=after,
                    columns_mapped=col_count,
                    masked_columns=cfg.masking_columns,
                    warnings_count=len(table_warns),
                    warnings=table_warns,
                    is_destructive=is_destructive,
                )
            )

            total_src += src_rows
            total_tgt_before += before
            total_tgt_after += after
            total_cols += col_count
            warnings.extend(table_warns)
            if cfg.requires_masking:
                pii_count += 1

        if any(p.is_destructive for p in previews):
            rec = "REVIEW_REQUIRED"
            reason = (
                "At least one table uses REPLACE with existing target data."
            )
        elif pii_count > 0:
            rec = "REVIEW_REQUIRED"
            reason = (
                f"{pii_count} table(s) contain PII data that will be masked."
            )
        elif warnings:
            rec = "REVIEW_REQUIRED"
            reason = f"{len(warnings)} validation warning(s) detected."
        else:
            rec = "SAFE_TO_LOAD"
            reason = (
                "All pre-flight gates passed and no warnings detected."
            )

        return ReviewContext(
            run_id=run_id,
            phase=MigrationPhase.AWAITING_LOAD_REVIEW,
            total_source_rows=total_src,
            total_target_rows_before=total_tgt_before,
            total_target_rows_after_estimate=total_tgt_after,
            total_tables=len(manifest.table_load_configs),
            total_columns_mapped=total_cols,
            table_previews=previews,
            warning_count=len(warnings),
            warnings=warnings,
            pii_table_count=pii_count,
            preflight_gates=run.preflight_gates,
            recommendation=rec,
            recommendation_reason=reason,
        )

    # ═════════════════════════════════════════════════════════
    # GATE A — approve load
    # ═════════════════════════════════════════════════════════
    def approve_load(
        self,
        tenant_id: str,
        run_id: str,
        actor: str,
        comments: str = "",
        waivers_accepted: Optional[List[str]] = None,
    ) -> MigrationRun:
        run = store.get_migration_run(tenant_id, run_id)
        if not run:
            raise PlatformException(
                code="RUN_NOT_FOUND", message="Run not found", status_code=404
            )
        if run.state != "AWAITING_LOAD_REVIEW":
            raise PlatformException(
                code="INVALID_STATE",
                message=(
                    f"Run is in state '{run.state}', "
                    f"not AWAITING_LOAD_REVIEW"
                ),
                category=ErrorCategory.INVALID_STATE,
                status_code=409,
            )

        manifest = store.get_migration_manifest(tenant_id, run.manifest_id)
        if not manifest:
            raise PlatformException(
                code="MANIFEST_NOT_FOUND",
                message="Manifest not found",
                status_code=404,
            )

        run.load_approval = LoadApproval(
            approved_by=actor,
            comments=comments,
            waivers_accepted=waivers_accepted or [],
        )

        try:
            self._run_load(tenant_id, run, manifest)
            self._run_reconcile(tenant_id, run, manifest)

            if not self._has_blocking_exceptions(tenant_id, run.run_id):
                try:
                    self.signoff(
                        tenant_id=tenant_id,
                        run_id=run.run_id,
                        actor=actor or "system",
                        comments="Auto sign-off after approved load",
                    )
                    run = (
                        store.get_migration_run(tenant_id, run.run_id) or run
                    )
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        f"[MigrationService] Auto sign-off failed: {e}"
                    )
                    run.state = "COMPLETED"
                    run.phase = MigrationPhase.DONE
                    run.completed_at = time.time()
                    store.save_migration_run(tenant_id, run)
            else:
                run.state = "EXCEPTION_REVIEW"
                run.phase = MigrationPhase.DONE
                run.completed_at = time.time()
                store.save_migration_run(tenant_id, run)
        except Exception as e:  # noqa: BLE001
            logger.error(f"Load failed: {e}", exc_info=True)
            run.state = "FAILED"
            run.error = str(e)

        store.save_migration_run(tenant_id, run)
        return run

    # ═════════════════════════════════════════════════════════
    # GATE A — abort
    # ═════════════════════════════════════════════════════════
    def abort_load(
        self,
        tenant_id: str,
        run_id: str,
        actor: str,
        reason: str = "",
    ) -> MigrationRun:
        run = store.get_migration_run(tenant_id, run_id)
        if not run:
            raise PlatformException(
                code="RUN_NOT_FOUND", message="Run not found", status_code=404
            )
        if run.state != "AWAITING_LOAD_REVIEW":
            raise PlatformException(
                code="INVALID_STATE",
                message="Run is not awaiting load review",
                category=ErrorCategory.INVALID_STATE,
                status_code=409,
            )

        run.state = "ABORTED"
        run.phase = MigrationPhase.DONE
        run.error = f"Aborted by {actor}: {reason}"
        run.completed_at = time.time()
        store.save_migration_run(tenant_id, run)

        try:
            store.purge_transient_staging(tenant_id, run_id)
            self._cleanup_spool(run_id)
        except Exception:  # noqa: BLE001
            pass

        logger.info(f"[MigrationService] Run {run_id} aborted by {actor}")
        return run

    # ═════════════════════════════════════════════════════════
    # PHASE 7 — Batched Load
    # ═════════════════════════════════════════════════════════
    def _run_load(
        self,
        tenant_id: str,
        run: MigrationRun,
        manifest: MigrationManifest,
    ) -> None:
        import json

        run.phase = MigrationPhase.LOAD
        run.state = "LOADING"
        run.load_started_at = time.time()
        store.save_migration_run(tenant_id, run)

        cache = getattr(store, "_migration_conn_cache", {}).get(
            run.run_id, {}
        )
        tgt_conn = cache.get("tgt")
        spool = cache.get("spool", {})

        if not tgt_conn:
            tgt_sys = store.get_system(tenant_id, manifest.target_system_id)
            if not tgt_sys:
                raise RuntimeError("Target system disappeared mid-run")
            tgt_conn = self._resolve_connector_for_system(tenant_id, tgt_sys)
            store._migration_conn_cache.setdefault(run.run_id, {})[
                "tgt"
            ] = tgt_conn

        BATCH_SIZE = int(
            os.getenv("MIGRATION_BATCH_SIZE", str(DEFAULT_BATCH_SIZE))
        )

        for cfg in manifest.table_load_configs:
            spool_path = spool.get(cfg.target_table)
            if not spool_path or not os.path.exists(spool_path):
                logger.info(
                    f"[MigrationService] no spool for {cfg.target_table}, "
                    f"skipping"
                )
                continue

            try:
                tgt_conn.begin_snapshot(f"{run.run_id}:{cfg.target_table}")
            except Exception:  # noqa: BLE001
                pass

            if cfg.load_mode == LoadMode.REPLACE:
                try:
                    if hasattr(tgt_conn, "_tables"):
                        tgt_conn._tables[cfg.target_table] = []
                except Exception:  # noqa: BLE001
                    pass

            idem_key = f"{run.run_id}:{cfg.target_table}"

            batch: List[Dict[str, Any]] = []
            with open(spool_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                    except Exception:  # noqa: BLE001
                        continue
                    batch.append(rec)
                    if len(batch) >= BATCH_SIZE:
                        self._write_batch(
                            tgt_conn=tgt_conn,
                            target_table=cfg.target_table,
                            records=batch,
                            idem_key=idem_key,
                            run=run,
                            load_mode=cfg.load_mode,
                        )
                        batch = []

                if batch:
                    self._write_batch(
                        tgt_conn=tgt_conn,
                        target_table=cfg.target_table,
                        records=batch,
                        idem_key=idem_key,
                        run=run,
                        load_mode=cfg.load_mode,
                    )

        store.save_migration_run(tenant_id, run)

    def _write_batch(
        self,
        tgt_conn: Any,
        target_table: str,
        records: List[Dict[str, Any]],
        idem_key: str,
        run: MigrationRun,
        load_mode: LoadMode,
    ) -> None:
        if not records:
            return
        try:
            res = load_worker.execute_load(
                target_connector=tgt_conn,
                target_dataset_name=target_table,
                records=records,
                idempotency_key=idem_key,
            )
            run.rows_loaded += res.accepted_records
            run.rows_failed += res.rejected_records
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[MigrationService] write_batch failed for "
                f"{target_table} ({len(records)} rows): {e}"
            )
            run.rows_failed += len(records)

    def _cleanup_spool(self, run_id: str) -> None:
        cache = getattr(store, "_migration_conn_cache", {}).get(run_id, {})
        spool_dir = cache.get("spool_dir")
        if spool_dir and os.path.isdir(spool_dir):
            import shutil

            try:
                shutil.rmtree(spool_dir, ignore_errors=True)
            except Exception:  # noqa: BLE001
                pass

    # ═════════════════════════════════════════════════════════
    # PHASE 8 — Reconcile
    # ═════════════════════════════════════════════════════════
    def _run_reconcile(
        self,
        tenant_id: str,
        run: MigrationRun,
        manifest: MigrationManifest,
    ) -> None:
        run.phase = MigrationPhase.RECONCILE
        run.state = "RECONCILING"
        store.save_migration_run(tenant_id, run)

        cache = getattr(store, "_migration_conn_cache", {}).get(
            run.run_id, {}
        )
        tgt_conn = cache.get("tgt")
        transformed = cache.get("transformed", {})

        if not tgt_conn:
            return

        for cfg in manifest.table_load_configs:
            records = transformed.get(cfg.target_table, [])
            if not records:
                continue

            try:
                actual_rows = tgt_conn.read_table(
                    cfg.target_table, limit=10000
                )
            except Exception:  # noqa: BLE001
                actual_rows = []

            recon_results, _ = reconcile_worker.execute_controls(
                tenant_id=tenant_id,
                run_id=run.run_id,
                source_records=records,
                target_records=actual_rows,
                controls=[
                    {
                        "control_id": "REC-ROW-COUNT",
                        "type": "row_count",
                        "tolerance": 0.0,
                        "blocking": True,
                    },
                    {
                        "control_id": "REC-HASH-TOTAL",
                        "type": "hash_total",
                        "tolerance": 0.0,
                        "blocking": False,
                    },
                ],
            )
            for r in recon_results:
                store.add_reconciliation_result(tenant_id, r)

    def _has_blocking_exceptions(
        self, tenant_id: str, run_id: str
    ) -> bool:
        exceptions = store.list_exceptions(tenant_id, run_id)
        return any(
            e.disposition == ExceptionDisposition.OPEN for e in exceptions
        )

    # ═════════════════════════════════════════════════════════
    # GATE B — Sign off
    # ═════════════════════════════════════════════════════════
    def signoff(
        self,
        tenant_id: str,
        run_id: str,
        actor: str,
        comments: str = "",
    ) -> MigrationRun:
        run = store.get_migration_run(tenant_id, run_id)
        if not run:
            raise PlatformException(
                code="RUN_NOT_FOUND", message="Run not found", status_code=404
            )
        if run.state not in ("COMPLETED", "EXCEPTION_REVIEW"):
            raise PlatformException(
                code="INVALID_STATE",
                message=f"Run is in state '{run.state}', not COMPLETED",
                category=ErrorCategory.INVALID_STATE,
                status_code=409,
            )

        try:
            evidence = evidence_service.assemble_evidence_manifest(
                tenant_id, run_id
            )
            evidence_hash = evidence.get("evidence_hash", "")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Evidence assembly failed: {e}")
            evidence_hash = ""

        run.signoff = SignoffRecord(
            actor=actor,
            comments=comments,
            evidence_hash=evidence_hash,
        )
        run.state = "SIGNED_OFF"
        run.phase = MigrationPhase.DONE
        run.completed_at = run.completed_at or time.time()
        store.save_migration_run(tenant_id, run)

        try:
            store.purge_transient_staging(tenant_id, run_id)
            self._cleanup_spool(run_id)
        except Exception:  # noqa: BLE001
            pass

        logger.info(
            f"[MigrationService] Run {run_id} signed off by {actor}"
        )
        return run

    # ═════════════════════════════════════════════════════════
    # Internals
    # ═════════════════════════════════════════════════════════
    def _build_table_configs(
        self,
        pms: Any,
        overrides: Optional[List[Dict[str, Any]]],
    ) -> List[TableLoadConfig]:
        override_map = {
            (o.get("source_table"), o.get("target_table")): o
            for o in (overrides or [])
        }
        configs: List[TableLoadConfig] = []
        for pair in pms.pairs:
            key = (pair.source_table, pair.target_table)
            ovr = override_map.get(key) or {}

            col_map: Dict[str, str] = {}
            pk_cols: List[str] = []
            for c in pair.columns:
                if c.matched_source_column:
                    col_map[c.matched_source_column] = c.target_column
                    if not pk_cols and c.target_column.lower().endswith(
                        ("_id", "id", "key")
                    ):
                        pk_cols.append(c.target_column)

            resolved_pk = (
                ovr.get("primary_key_columns") or pk_cols or []
            )
            resolved_masking = ovr.get("masking_columns") or []
            resolved_load_mode = (
                (ovr.get("load_mode") or "APPEND").upper()
            )

            configs.append(
                TableLoadConfig(
                    source_table=pair.source_table,
                    target_table=pair.target_table,
                    load_mode=LoadMode(resolved_load_mode),
                    primary_key_columns=resolved_pk,
                    requires_masking=bool(pair.requires_masking),
                    masking_columns=resolved_masking,
                    include_column_map=col_map,
                )
            )
        return configs

    def _build_rule_package_from_pair(self, pair: Any) -> Any:
        from app.models.canonical import (
            ArtifactStatus,
            RulePackageVersion,
        )

        transforms: Dict[str, Dict[str, Any]] = {}
        for c in pair.columns:
            if not c.matched_source_column:
                continue
            transforms[c.target_column] = {
                "op": c.transformation_rule or "direct_cast",
                "source_cols": [c.matched_source_column],
                "default": c.default_value,
                "target_type": c.target_datatype or "string",
            }

        return RulePackageVersion(
            project_id=pair.target_table,
            semantic_version="1.0.0",
            status=ArtifactStatus.APPROVED,
            compiled_plan={
                "source_dataset_id": pair.source_dataset_id,
                "target_dataset_id": pair.target_dataset_id,
                "transforms": transforms,
            },
            validations=[],
            reconciliations=[],
        )

    def _build_validations_from_pair(
        self, pair: Any
    ) -> List[Dict[str, Any]]:
        rules: List[Dict[str, Any]] = []
        required_cols = [
            c.target_column
            for c in pair.columns
            if not c.target_nullable and c.matched_source_column
        ]
        if required_cols:
            rules.append(
                {
                    "rule_id": "VAL-NOT-NULL",
                    "level": "Schema",
                    "severity": "ERROR",
                    "check": "not_null",
                    "target_fields": required_cols,
                }
            )
        email_cols = [
            c.target_column
            for c in pair.columns
            if "email" in c.target_column.lower()
            and c.matched_source_column
        ]
        if email_cols:
            rules.append(
                {
                    "rule_id": "VAL-EMAIL",
                    "level": "Record",
                    "severity": "WARNING",
                    "check": "email_format",
                    "target_fields": email_cols,
                }
            )
        return rules


migration_service = MigrationService()  