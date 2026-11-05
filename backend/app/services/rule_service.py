"""
Rule Service.
Compiles approved mapping sets into signed executable rule packages (Section 11).
"""

from typing import Any, Dict, List, Optional
from app.models.canonical import RulePackageVersion, ArtifactStatus
from app.db.store import store
from app.sdk.rules.compiler import rule_compiler
from app.core.errors import PlatformException, ErrorCategory


class RuleService:
    """Manages compilation, testing, and promotion of deterministic rule packages."""

    def build_rule_package(
        self,
        tenant_id: str,
        mapping_version_id: str,
        semantic_version: str = "1.0.0",
        validations: Optional[List[Dict[str, Any]]] = None,
        reconciliations: Optional[List[Dict[str, Any]]] = None,
    ) -> RulePackageVersion:
        mapping_set = store.get_mapping_set(tenant_id, mapping_version_id)
        if not mapping_set:
            raise PlatformException(
                code="MAPPING_NOT_FOUND",
                message=f"Mapping version '{mapping_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        if mapping_set.status != ArtifactStatus.APPROVED:
            raise PlatformException(
                code="UNAPPROVED_MAPPING",
                message="Cannot build executable rule package from unapproved draft mapping. Approve mapping version first.",
                category=ErrorCategory.CONFLICT,
                status_code=409,
            )

        package = rule_compiler.compile_mapping_set(
            mapping_set=mapping_set,
            semantic_version=semantic_version,
            extra_validations=validations,
            extra_reconciliations=reconciliations,
        )

        return store.save_rule_package(tenant_id, package)


rule_service = RuleService()
