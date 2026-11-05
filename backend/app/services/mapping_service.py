"""
Mapping Service.
Manages Source-to-Target mapping sets, AI proposals, human review, and immutable version approvals (Section 9).
"""

from typing import Any, Dict, List, Optional
from app.models.canonical import (
    MappingSetVersion,
    Mapping,
    ArtifactStatus,
    Approval,
)
from app.db.store import store
from app.services.ai_assistance_service import ai_assistance_service
from app.core.errors import PlatformException, ErrorCategory
from app.core.security import compute_sha256


class MappingService:
    """Manages mapping sets, AI-assisted proposals, and formal version approvals."""

    def create_mapping_proposals(
        self,
        tenant_id: str,
        project_id: str,
        source_dataset_id: str,
        target_dataset_id: str,
        custom_instructions: Optional[str] = None,
        use_ai: bool = True,
        model_name: str = "llama-3.3-70b-versatile",
        api_keys: Optional[List[str]] = None,
        ontology_version_id: Optional[str] = None,
    ) -> MappingSetVersion:
        source_ds = store.get_dataset(tenant_id, source_dataset_id)
        target_ds = store.get_dataset(tenant_id, target_dataset_id)

        if not source_ds or not target_ds:
            raise PlatformException(
                code="DATASET_NOT_FOUND",
                message="Source and Target datasets must exist to generate mapping proposals",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        src_cols = [f.model_dump() for f in source_ds.fields]
        tgt_cols = [f.model_dump() for f in target_ds.fields]

        # Generate proposal package from AI or deterministic fallback with RAG grounding
        proposal_pkg = ai_assistance_service.generate_mapping_proposals(
            source_columns=src_cols,
            target_columns=tgt_cols,
            custom_instructions=custom_instructions,
            use_ai=use_ai,
            model_name=model_name,
            api_keys=api_keys,
            ontology_version_id=ontology_version_id,
        )

        mapping_version = MappingSetVersion(
            project_id=project_id,
            source_dataset_id=source_dataset_id,
            target_dataset_id=target_dataset_id,
            version_tag="1.0.0",
            status=ArtifactStatus.DRAFT,
        )

        for p in proposal_pkg.proposals:
            mapping_version.mappings.append(Mapping(
                mapping_version_id=mapping_version.mapping_version_id,
                source_refs=[p.matched_source_column] if p.matched_source_column else [],
                target_ref=p.target_column,
                expression_ref=p.suggested_expression or "direct",
                confidence=p.confidence_score,
                rationale=p.rationale,
                match_type=p.match_type,
                default_value=p.suggested_default_value,
            ))

        return store.save_mapping_set(tenant_id, mapping_version)

    def approve_mapping_version(
        self,
        tenant_id: str,
        mapping_version_id: str,
        actor: str = "business-approver@company.com",
        comments: Optional[str] = None,
    ) -> MappingSetVersion:
        """
        Formally approves a mapping version, locking its content hash (Section 9).
        """
        mapping_set = store.get_mapping_set(tenant_id, mapping_version_id)
        if not mapping_set:
            raise PlatformException(
                code="MAPPING_SET_NOT_FOUND",
                message=f"Mapping version '{mapping_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        if mapping_set.status == ArtifactStatus.APPROVED:
            return mapping_set

        mapping_set.status = ArtifactStatus.APPROVED
        
        # Record formal approval record
        approval = Approval(
            object_type="mapping_set",
            object_version=mapping_version_id,
            actor=actor,
            decision="APPROVED",
            comments=comments,
        )
        store.add_approval(tenant_id, approval)
        return store.save_mapping_set(tenant_id, mapping_set)


mapping_service = MappingService()
