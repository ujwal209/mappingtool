"""
Metadata & Schema Drift Service.
Manages Systems, Endpoints, Datasets, Fields, and Schema Drift Detection (TA-005, TA-008).
"""

from typing import Any, Dict, List, Optional
from app.models.canonical import (
    System,
    SystemKind,
    Endpoint,
    Dataset,
    FieldDefinition,
    ProfileSnapshot,
)
from app.models.schemas import DriftAnalysisResponse
from app.db.store import store
from app.sdk.connectors.registry import connector_registry
from app.core.security import mask_secret
from app.core.errors import PlatformException, ErrorCategory


class MetadataService:
    """Manages systems, datasets, endpoints, and schema drift detection."""

    def register_system(
        self,
        tenant_id: str,
        project_id: str,
        name: str,
        kind: SystemKind,
        connector_type: str,
        classification: str = "CONFIDENTIAL",
    ) -> System:
        system = System(
            project_id=project_id,
            name=name,
            kind=kind,
            connector_type=connector_type,
            classification=classification,
        )
        return store.save_system(tenant_id, system)

    def create_endpoint(
        self,
        tenant_id: str,
        system_id: str,
        environment_id: str,
        name: str,
        connection_params: Dict[str, Any],
        secret_ref: Optional[str] = None,
    ) -> Endpoint:
        endpoint = Endpoint(
            system_id=system_id,
            environment_id=environment_id,
            name=name,
            connection_params=connection_params,
            secret_ref=secret_ref,
        )
        return store.save_endpoint(tenant_id, endpoint)

    def test_endpoint(self, tenant_id: str, endpoint_id: str) -> Dict[str, Any]:
        """
        Tests connectivity without exposing secret material (TA-008).
        """
        endpoint = store.get_endpoint(tenant_id, endpoint_id)
        if not endpoint:
            raise PlatformException(
                code="ENDPOINT_NOT_FOUND",
                message=f"Endpoint '{endpoint_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        system = store.get_system(tenant_id, endpoint.system_id)
        connector_type = system.connector_type if system else "memory"
        
        connector = connector_registry.get_connector(
            connector_type=connector_type,
            endpoint_config=endpoint.connection_params,
            secret_ref=endpoint.secret_ref,
        )

        test_result = connector.test_connection()
        return {
            "endpoint_id": endpoint_id,
            "status": test_result.get("status", "SUCCESS"),
            "latency_ms": test_result.get("latency_ms", 1.0),
            "message": test_result.get("message", "Connection verified"),
            "capabilities": test_result.get("capabilities", []),
            "secret_ref_masked": mask_secret(endpoint.secret_ref),
        }

    def register_dataset(
        self,
        tenant_id: str,
        system_id: str,
        physical_name: str,
        namespace: str = "default",
        fields: Optional[List[FieldDefinition]] = None,
    ) -> Dataset:
        dataset = Dataset(
            system_id=system_id,
            namespace=namespace,
            physical_name=physical_name,
            fields=fields or [],
        )
        return store.save_dataset(tenant_id, dataset)

    def detect_schema_drift(
        self,
        tenant_id: str,
        dataset_id: str,
        baseline_profile_id: str,
        current_profile_id: str,
    ) -> DriftAnalysisResponse:
        """
        Evaluates schema drift between baseline and current profiles (TA-005).
        Blocking drift triggers if columns were removed or data types changed.
        """
        baseline = store.get_profile(tenant_id, baseline_profile_id)
        current = store.get_profile(tenant_id, current_profile_id)

        if not baseline or not current:
            raise PlatformException(
                code="PROFILE_NOT_FOUND",
                message="Both baseline and current profile snapshots are required for drift detection",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        base_cols = set(baseline.column_metrics.keys())
        curr_cols = set(current.column_metrics.keys())

        added_cols = sorted(list(curr_cols - base_cols))
        removed_cols = sorted(list(base_cols - curr_cols))

        type_mismatches = []
        for col in base_cols.intersection(curr_cols):
            base_type = baseline.column_metrics[col].get("inferred_type")
            curr_type = current.column_metrics[col].get("inferred_type")
            if base_type and curr_type and base_type != curr_type:
                type_mismatches.append({
                    "column": col,
                    "baseline_type": base_type,
                    "current_type": curr_type,
                })

        # Schema drift is blocking if existing columns were removed or types became incompatible
        is_blocking = len(removed_cols) > 0 or len(type_mismatches) > 0
        has_drift = len(added_cols) > 0 or len(removed_cols) > 0 or len(type_mismatches) > 0

        explanation = None
        if has_drift:
            parts = []
            if removed_cols:
                parts.append(f"Removed columns: {', '.join(removed_cols)}")
            if added_cols:
                parts.append(f"Added columns: {', '.join(added_cols)}")
            if type_mismatches:
                parts.append(f"Data type mismatches: {type_mismatches}")
            explanation = " | ".join(parts)

        return DriftAnalysisResponse(
            dataset_id=dataset_id,
            baseline_profile_id=baseline_profile_id,
            current_profile_id=current_profile_id,
            has_drift=has_drift,
            is_blocking=is_blocking,
            added_columns=added_cols,
            removed_columns=removed_cols,
            type_mismatches=type_mismatches,
            explanation=explanation,
        )


metadata_service = MetadataService()
