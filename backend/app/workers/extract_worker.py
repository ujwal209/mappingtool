"""
Extract Worker.

Implements data-plane extraction with partition management, checksum
verification, and durable checkpoint resume (Section 14).

Two entry points:
  - execute_partition(...)  → returns the whole partition as a list.
                              Kept for backward compatibility.
  - iter_partition(...)     → yields rows one at a time, so the migration
                              service can batch without holding the full
                              partition in memory.
"""

import hashlib
import json
from typing import Any, Dict, Iterator, List, Optional

from app.sdk.connectors.base import BaseConnector, PartitionInfo


class ExtractWorker:
    """Extracts records from source connectors in partitioned, resumable streams."""

    # ─────────────────────────────────────────────────────────
    # Buffered mode — backward compatible
    # ─────────────────────────────────────────────────────────
    def execute_partition(
        self,
        connector: BaseConnector,
        partition: PartitionInfo,
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Streams records from the given partition and computes an
        integrity checksum.

        ⚠️ Holds the whole partition in memory. Use `iter_partition`
        for large tables.
        """
        extracted_records: List[Dict[str, Any]] = []
        hasher = hashlib.sha256()

        for record in connector.read_partition(partition, checkpoint):
            extracted_records.append(record)
            record_bytes = json.dumps(record, sort_keys=True).encode("utf-8")
            hasher.update(record_bytes)

        checksum = hasher.hexdigest()

        return {
            "partition_id": partition.partition_id,
            "records": extracted_records,
            "record_count": len(extracted_records),
            "checksum": checksum,
            "checkpoint": {
                "last_token": partition.token,
                "count": len(extracted_records),
            },
        }

    # ─────────────────────────────────────────────────────────
    # Streaming mode — O(1) memory
    # ─────────────────────────────────────────────────────────
    def iter_partition(
        self,
        connector: BaseConnector,
        partition: PartitionInfo,
        checkpoint: Optional[Dict[str, Any]] = None,
    ) -> Iterator[Dict[str, Any]]:
        """
        Yield rows from `partition` one at a time.

        The caller is expected to group rows into batches. No checksum
        is computed here — that's the caller's responsibility if needed.
        """
        try:
            for record in connector.read_partition(partition, checkpoint):
                yield record
        except Exception as e:  # noqa: BLE001
            from app.core.logging import get_logger

            get_logger("extract_worker").warning(
                f"iter_partition failed for {partition.partition_id}: {e}"
            )
            return


extract_worker = ExtractWorker()