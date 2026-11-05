"""
Exception Case Management Service.
Manages ExceptionCase triage, clustering, remediation proposals, waivers, and closures.
"""

from typing import List, Optional
from app.models.canonical import ExceptionCase, ExceptionDisposition, RunState
from app.db.store import store
from app.core.errors import PlatformException, ErrorCategory


class ExceptionService:
    """Handles governed exception lifecycle, waivers, and dispositions."""

    def get_exception(self, tenant_id: str, exception_id: str) -> ExceptionCase:
        exc = store.get_exception(tenant_id, exception_id)
        if not exc:
            raise PlatformException(
                code="EXCEPTION_NOT_FOUND",
                message=f"Exception case '{exception_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        return exc

    def list_exceptions(self, tenant_id: str, run_id: Optional[str] = None) -> List[ExceptionCase]:
        return store.list_exceptions(tenant_id, run_id)

    def record_disposition(
        self,
        tenant_id: str,
        exception_id: str,
        disposition: ExceptionDisposition,
        resolution_note: str,
        actor: str = "analyst@company.com",
    ) -> ExceptionCase:
        exc = self.get_exception(tenant_id, exception_id)
        exc.disposition = disposition
        exc.resolution_note = f"[{actor}] {resolution_note}"
        store.save_exception(tenant_id, exc)

        # Check if all exceptions for the associated run are now resolved/waived
        run_exceptions = store.list_exceptions(tenant_id, exc.run_id)
        unresolved = [
            e for e in run_exceptions
            if e.disposition not in (ExceptionDisposition.RESOLVED_REMEDIATED, ExceptionDisposition.WAIVED, ExceptionDisposition.CLOSED)
        ]

        if not unresolved:
            run = store.get_run(tenant_id, exc.run_id)
            if run and run.state == RunState.EXCEPTION_REVIEW:
                run.state = RunState.COMPLETED
                store.save_run(tenant_id, run)

        return exc


exception_service = ExceptionService()
