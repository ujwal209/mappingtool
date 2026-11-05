"""
Rule Package Compiler.
Transforms high-level mapping specifications and validations into a compiled,
sandboxed deterministic execution plan signed with SHA-256 (Section 11).
"""

from typing import Any, Dict, List, Optional
from app.models.canonical import MappingSetVersion, RulePackageVersion, ArtifactStatus
from app.core.security import compute_sha256
from app.sdk.rules.dsl import evaluate_transformation_rule


class RuleCompiler:
    """Compiles and signs deterministic rule packages from mapping sets."""

    def compile_mapping_set(
        self,
        mapping_set: MappingSetVersion,
        semantic_version: str = "1.0.0",
        extra_validations: Optional[List[Dict[str, Any]]] = None,
        extra_reconciliations: Optional[List[Dict[str, Any]]] = None,
    ) -> RulePackageVersion:
        """
        Compiles an approved mapping set into a signed rule package version.
        """
        field_transforms: Dict[str, Dict[str, Any]] = {}
        
        for m in mapping_set.mappings:
            target_col = m.target_ref
            source_cols = m.source_refs
            
            # Infer appropriate transformation op
            op = "direct"
            if m.expression_ref:
                op = m.expression_ref
            elif m.target_ref.lower().endswith(("_id", "_key", "_code")):
                op = "trim"
            elif "hash" in m.target_ref.lower():
                op = "hash"
            elif "name" in m.target_ref.lower():
                op = "normalize_text"

            field_transforms[target_col] = {
                "op": op,
                "source_cols": source_cols,
                "default": m.default_value,
                "target_type": "string",
            }

        compiled_plan = {
            "source_dataset_id": mapping_set.source_dataset_id,
            "target_dataset_id": mapping_set.target_dataset_id,
            "transforms": field_transforms,
            "deterministic_version": "v1.0",
        }

        # Standard built-in validations if none provided
        validations = extra_validations or [
            {
                "rule_id": "VAL-SCHEMA-REQUIRED",
                "level": "Schema",
                "severity": "CRITICAL",
                "blocking": True,
                "check": "not_null",
                "target_fields": [m.target_ref for m in mapping_set.mappings if m.target_ref.lower().endswith(("_id", "key", "email"))],
            },
            {
                "rule_id": "VAL-RECORD-FORMAT",
                "level": "Record",
                "severity": "WARNING",
                "blocking": False,
                "check": "email_format",
                "target_fields": [m.target_ref for m in mapping_set.mappings if "email" in m.target_ref.lower()],
            },
        ]

        # Standard reconciliations
        reconciliations = extra_reconciliations or [
            {
                "control_id": "REC-ROW-COUNT",
                "control_name": "Source-to-Target Row Count Consistency",
                "type": "row_count",
                "tolerance": 0.0,  # 0% variance allowed for row counts
                "blocking": True,
            },
            {
                "control_id": "REC-HASH-TOTAL",
                "control_name": "Target Records Hash Total Verification",
                "type": "hash_total",
                "tolerance": 0.0,
                "blocking": False,
            },
        ]

        package = RulePackageVersion(
            project_id=mapping_set.project_id,
            semantic_version=semantic_version,
            status=ArtifactStatus.APPROVED,
            compiled_plan=compiled_plan,
            validations=validations,
            reconciliations=reconciliations,
        )

        # Cryptographic signing
        signature_repr = {
            "project_id": package.project_id,
            "semantic_version": package.semantic_version,
            "compiled_plan": package.compiled_plan,
            "validations": package.validations,
            "reconciliations": package.reconciliations,
        }
        package.signature = compute_sha256(signature_repr)
        return package


rule_compiler = RuleCompiler()
