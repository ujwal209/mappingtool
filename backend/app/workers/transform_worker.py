"""
Deterministic Transformation Worker.
Fulfills requirements from:
- Section 11 (Transformation Engine)
- TA-002 (Byte-Equivalent Deterministic Output Replay)
- TA-012 (Record-Level Lineage Tracking)
"""

import json
from typing import Any, Dict, List, Optional, Tuple
from app.models.canonical import RulePackageVersion
from app.sdk.rules.dsl import evaluate_transformation_rule
from app.db.store import store


class TransformWorker:
    """Executes compiled rule packages against extracted record partitions."""

    def execute_partition(
        self,
        tenant_id: str,
        run_id: str,
        partition_id: str,
        source_records: List[Dict[str, Any]],
        rule_package: RulePackageVersion,
        mapping_version_id: str,
        source_system_name: str = "SourceSystem",
        target_system_name: str = "TargetSystem",
        manifest_constants: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Executes deterministic rules over records, recording field-level lineage (TA-012)
        and producing normalized output records (TA-002).
        """
        compiled_plan = rule_package.compiled_plan
        transforms: Dict[str, Dict[str, Any]] = compiled_plan.get("transforms", {})
        
        transformed_records: List[Dict[str, Any]] = []
        statuses: List[Dict[str, Any]] = []

        for idx, src_rec in enumerate(source_records):
            target_record: Dict[str, Any] = {}
            lineage_ops: List[Dict[str, Any]] = []

            for target_col, rule_spec in transforms.items():
                rule_output = evaluate_transformation_rule(
                    rule_spec=rule_spec,
                    source_record=src_rec,
                    manifest_constants=manifest_constants
                )
                target_record[target_col] = rule_output.value
                
                lineage_ops.append({
                    "target_column": target_col,
                    "applied_op": rule_output.applied_op,
                    "status": rule_output.status.value,
                    "source_columns": rule_spec.get("source_cols", []),
                })

            transformed_records.append(target_record)

            # Helper to extract business ID from record (TA-012)
            def extract_id(rec: Dict[str, Any], fallback: str) -> str:
                for target_k in ["id", "account_id", "client_id", "contact_id", "customer_id", "sku", "code"]:
                    for k, v in rec.items():
                        if k.lower().replace(" ", "_") == target_k and v is not None:
                            return str(v)
                return fallback

            target_id = extract_id(target_record, str(idx + 1))
            source_id = extract_id(src_rec, str(idx + 1))
            
            store.record_lineage(
                tenant_id=tenant_id,
                run_id=run_id,
                target_record_id=str(target_id),
                source_record_id=str(source_id),
                source_system=source_system_name,
                target_system=target_system_name,
                mapping_version_id=mapping_version_id,
                rule_package_id=rule_package.rule_package_id,
                transformations_applied=lineage_ops,
            )

        # Compute normalized partition byte string for deterministic verification (TA-002)
        normalized_bytes = json.dumps(transformed_records, sort_keys=True, separators=(",", ":")).encode("utf-8")

        return {
            "partition_id": partition_id,
            "transformed_records": transformed_records,
            "record_count": len(transformed_records),
            "normalized_bytes": normalized_bytes,
        }


transform_worker = TransformWorker()
