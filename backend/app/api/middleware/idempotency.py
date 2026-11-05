"""
Idempotency Middleware & Request Cache.
Fulfills Section 6:
"Create/run endpoints accept Idempotency-Key. Reusing the same key with the same request
returns the original operation; reuse with different payload returns HTTP 409."
"""

import threading
from typing import Any, Dict, Optional, Tuple
from app.core.security import compute_sha256
from app.core.errors import PlatformException, ErrorCategory


class IdempotencyManager:
    """Thread-safe idempotency registry checking request hashes against idempotency keys."""

    def __init__(self):
        self._lock = threading.Lock()
        # [tenant_id][key] -> (request_hash, response_status, response_body)
        self._records: Dict[str, Dict[str, Tuple[str, int, Any]]] = {}

    def check_or_store(
        self,
        tenant_id: str,
        idempotency_key: str,
        request_payload: Any
    ) -> Optional[Tuple[int, Any]]:
        """
        Returns cached (status_code, response_body) if identical key and payload are reused.
        Raises PlatformException with HTTP 409 if the same key is reused with a different payload.
        """
        req_hash = compute_sha256(request_payload)

        with self._lock:
            if tenant_id not in self._records:
                self._records[tenant_id] = {}

            if idempotency_key in self._records[tenant_id]:
                saved_hash, status_code, body = self._records[tenant_id][idempotency_key]
                if saved_hash == req_hash:
                    return status_code, body
                else:
                    raise PlatformException(
                        code="IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
                        message="Idempotency-Key reused with a different request payload",
                        category=ErrorCategory.CONFLICT,
                        status_code=409,
                        details={"idempotency_key": idempotency_key},
                    )

            return None

    def record_response(
        self,
        tenant_id: str,
        idempotency_key: str,
        request_payload: Any,
        status_code: int,
        response_body: Any
    ):
        req_hash = compute_sha256(request_payload)
        with self._lock:
            if tenant_id not in self._records:
                self._records[tenant_id] = {}
            self._records[tenant_id][idempotency_key] = (req_hash, status_code, response_body)


idempotency_manager = IdempotencyManager()
