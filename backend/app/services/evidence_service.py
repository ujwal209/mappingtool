"""
Evidence & Lineage Service.
Fulfills requirements from:
- Section 14.1 & 16 (Immutable Evidence Bundles and WORM sign-off)
- TA-007 (Evidence Bundle Content Hash Verification after Transient Staging Purged)
- TA-012 (Target-to-Source Lineage Traceability)
"""

import time
from typing import Any, Dict, List, Optional
from app.models.canonical import Run, RunState, Approval
from app.models.schemas import LineageTraceResponse
from app.db.store import store
from app.core.security import compute_sha256
from app.core.errors import PlatformException, ErrorCategory


class EvidenceService:
    """Manages immutable evidence bundle assembly, sign-off hashing, and lineage lookups."""

    def assemble_evidence_manifest(self, tenant_id: str, run_id: str) -> Dict[str, Any]:
        """Collects all quality, reconciliation, task, and manifest records for a run."""
        run = store.get_run(tenant_id, run_id)
        if not run:
            raise PlatformException(code="RUN_NOT_FOUND", message="Run not found", status_code=404)

        manifest = store.get_manifest(tenant_id, run.manifest_id)
        validations = store.list_validations_for_run(tenant_id, run_id)
        reconciliations = store.list_reconciliations_for_run(tenant_id, run_id)
        tasks = store.list_tasks_for_run(tenant_id, run_id)

        evidence_payload = {
            "run_id": run_id,
            "manifest_id": run.manifest_id,
            "manifest_hash": manifest.manifest_hash if manifest else None,
            "project_id": run.project_id,
            "completed_at": run.completed_at,
            "tasks_summary": [
                {"node_id": t.node_id, "state": t.state, "checkpoint": t.checkpoint}
                for t in tasks
            ],
            "validations_summary": [
                {"rule_id": v.rule_id, "passed": v.passed, "failed_count": v.failed_count}
                for v in validations
            ],
            "reconciliations_summary": [
                {"control_id": r.control_id, "passed": r.passed, "variance": r.variance}
                for r in reconciliations
            ],
        }

        # Deterministic SHA-256 evidence bundle hash
        evidence_hash = compute_sha256(evidence_payload)
        return {
            "evidence_hash": evidence_hash,
            "payload": evidence_payload,
            "is_signed_off": run.state == RunState.SIGNED_OFF,
        }

    def signoff_run(
        self,
        tenant_id: str,
        run_id: str,
        actor: str = "business-approver@company.com",
        comments: str = "Approved for cutover",
    ) -> Dict[str, Any]:
        """
        Signs off a completed run, locks the evidence hash, and purges transient staging data (TA-007).
        """
        run = store.get_run(tenant_id, run_id)
        if not run:
            raise PlatformException(code="RUN_NOT_FOUND", message="Run not found", status_code=404)

        if run.state != RunState.COMPLETED and run.state != RunState.SIGNED_OFF:
            raise PlatformException(
                code="INVALID_STATE_FOR_SIGNOFF",
                message=f"Cannot sign off run in state '{run.state}'. Run must be COMPLETED.",
                category=ErrorCategory.INVALID_STATE,
                status_code=400,
            )

        # Assemble and hash evidence
        evidence = self.assemble_evidence_manifest(tenant_id, run_id)
        evidence_hash = evidence["evidence_hash"]

        # Lock evidence hash and record signoff
        run.evidence_bundle_hash = evidence_hash
        run.state = RunState.SIGNED_OFF
        run.signoff_record = {
            "actor": actor,
            "timestamp": time.time(),
            "evidence_hash": evidence_hash,
            "comments": comments,
        }
        store.save_run(tenant_id, run)

        approval = Approval(
            object_type="run_signoff",
            object_version=run_id,
            actor=actor,
            decision="APPROVED",
            comments=comments,
        )
        store.add_approval(tenant_id, approval)

        # Purge transient staging data while retaining evidence (TA-007)
        store.purge_transient_staging(tenant_id, run_id)

        return {
            "run_id": run_id,
            "state": run.state,
            "evidence_bundle_hash": evidence_hash,
            "staging_purged": True,
            "signoff_record": run.signoff_record,
        }

    def verify_evidence_bundle(self, tenant_id: str, run_id: str) -> bool:
        """
        Verifies that the stored sign-off evidence hash matches the recomputed evidence hash (TA-007).
        """
        run = store.get_run(tenant_id, run_id)
        if not run or not run.evidence_bundle_hash:
            return False

        current_evidence = self.assemble_evidence_manifest(tenant_id, run_id)
        return current_evidence["evidence_hash"] == run.evidence_bundle_hash

    def get_record_lineage(
        self,
        tenant_id: str,
        run_id: str,
        target_record_id: str,
    ) -> LineageTraceResponse:
        """
        Retrieves record-level lineage trace (TA-012).
        """
        lineage = store.get_lineage(tenant_id, run_id, target_record_id)
        if not lineage:
            raise PlatformException(
                code="LINEAGE_NOT_FOUND",
                message=f"No lineage found for record '{target_record_id}' in run '{run_id}'",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        return LineageTraceResponse(**lineage)


evidence_service = EvidenceService()
