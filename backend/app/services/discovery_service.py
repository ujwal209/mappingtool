"""
Discovery & Profiling Service.
Computes immutable profiling snapshots, statistical distribution metrics,
and schema structure without blowing up coordinator memory (Section 19).
"""

from typing import Any, Dict, List, Optional
import pandas as pd
from app.models.canonical import ProfileSnapshot
from app.db.store import store
from app.core.security import compute_sha256
from app.core.errors import PlatformException, ErrorCategory


class DiscoveryService:
    """Profiles datasets and persists immutable snapshots for drift detection."""

    def profile_records(
        self,
        tenant_id: str,
        dataset_id: str,
        records: List[Dict[str, Any]],
        sample_size: int = 1000,
    ) -> ProfileSnapshot:
        if not records:
            raise PlatformException(
                code="EMPTY_DATASET",
                message="Cannot profile an empty dataset",
                category=ErrorCategory.DATA_REJECTED,
                status_code=400,
            )

        df = pd.DataFrame(records[:sample_size])
        row_count = len(records)
        col_count = len(df.columns)
        
        column_metrics: Dict[str, Dict[str, Any]] = {}

        for col in df.columns:
            series = df[col]
            null_count = int(series.isnull().sum())
            unique_count = int(series.nunique(dropna=True))
            sample_vals = [v for v in series.dropna().unique()[:3].tolist()]

            # Determine inferred type
            inferred_type = "string"
            if pd.api.types.is_numeric_dtype(series):
                inferred_type = "numeric"
            elif pd.api.types.is_datetime64_any_dtype(series):
                inferred_type = "datetime"
            elif pd.api.types.is_bool_dtype(series):
                inferred_type = "boolean"

            column_metrics[str(col)] = {
                "inferred_type": inferred_type,
                "null_count": null_count,
                "null_percentage": round((null_count / max(1, len(df))) * 100.0, 2),
                "unique_count": unique_count,
                "sample_values": sample_vals,
                "is_metadata": str(col).startswith("meta_"),
            }

        # Deterministic scope hash based on column structure & metadata
        scope_hash = compute_sha256({"dataset_id": dataset_id, "columns": sorted(list(df.columns))})

        snapshot = ProfileSnapshot(
            dataset_id=dataset_id,
            scope_hash=scope_hash,
            row_count=row_count,
            column_count=col_count,
            column_metrics=column_metrics,
            sample_rows=records[:3],
        )

        return store.save_profile(tenant_id, snapshot)


discovery_service = DiscoveryService()
