"""
Target Load Worker.

Fulfills requirements from Section 14, Section 15, and TA-004:
"A worker crash after target acknowledgement but before checkpoint
 persistence does not create an uncontrolled duplicate target effect
 when retried."

Two entry points:
  - execute_load(...)           → loads a full list in one call. Kept
                                  for backward compatibility.
  - execute_load_streamed(...)  → accepts an iterable of batches and
                                  writes them one at a time, so a
                                  million-row load never lives in memory.
"""

from typing import Any, Dict, Iterable, List, Optional

from app.sdk.connectors.base import BaseConnector, WriteBatchResult


class LoadWorker:
    """Executes target writes with idempotency keys and retry dedup protection."""

    # ─────────────────────────────────────────────────────────
    # Buffered mode — backward compatible
    # ─────────────────────────────────────────────────────────
    def execute_load(
        self,
        target_connector: BaseConnector,
        target_dataset_name: str,
        records: List[Dict[str, Any]],
        idempotency_key: str,
        batch_size: int = 500,
    ) -> WriteBatchResult:
        total_accepted = 0
        total_rejected = 0
        all_target_ids: List[str] = []
        all_rejections: List[str] = []

        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            idempotency_context = {
                "target_dataset": target_dataset_name,
                "idempotency_key": idempotency_key,
                "batch_index": i // batch_size,
            }
            res = target_connector.write_batch(batch, idempotency_context)
            total_accepted += res.accepted_records
            total_rejected += res.rejected_records
            all_target_ids.extend(res.target_ids)
            all_rejections.extend(res.rejection_reasons)

        return WriteBatchResult(
            accepted_records=total_accepted,
            rejected_records=total_rejected,
            target_ids=all_target_ids,
            rejection_reasons=all_rejections,
        )

    # ─────────────────────────────────────────────────────────
    # Streaming mode — O(batch) memory
    # ─────────────────────────────────────────────────────────
    def execute_load_streamed(
        self,
        target_connector: BaseConnector,
        target_dataset_name: str,
        batches: Iterable[List[Dict[str, Any]]],
        idempotency_key: str,
    ) -> WriteBatchResult:
        """
        Consume an iterable of record batches and write each one.

        Args:
            target_connector: connector to write into
            target_dataset_name: table name
            batches: an iterable yielding lists of records. Each list is
                     written in a single `write_batch` call. The caller
                     is responsible for the batch size — this method
                     never holds more than one batch at a time.
            idempotency_key: stable key for dedup on retry
        """
        total_accepted = 0
        total_rejected = 0
        all_target_ids: List[str] = []
        all_rejections: List[str] = []

        batch_index = 0
        for batch in batches:
            if not batch:
                batch_index += 1
                continue

            idempotency_context = {
                "target_dataset": target_dataset_name,
                "idempotency_key": idempotency_key,
                "batch_index": batch_index,
            }
            try:
                res = target_connector.write_batch(
                    batch, idempotency_context
                )
                total_accepted += res.accepted_records
                total_rejected += res.rejected_records
                all_target_ids.extend(res.target_ids)
                all_rejections.extend(res.rejection_reasons)
            except Exception as e:  # noqa: BLE001
                from app.core.logging import get_logger

                get_logger("load_worker").warning(
                    f"write_batch failed for batch {batch_index} of "
                    f"{target_dataset_name}: {e}"
                )
                total_rejected += len(batch)

            batch_index += 1

        return WriteBatchResult(
            accepted_records=total_accepted,
            rejected_records=total_rejected,
            target_ids=all_target_ids,
            rejection_reasons=all_rejections,
        )


load_worker = LoadWorker()