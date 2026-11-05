"""
Correlation ID & Request Tracing Middleware.
Fulfills Section 6:
"Every mutation accepts X-Correlation-Id; the platform creates one if absent
and returns it on all responses and audit events."
"""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.logging import correlation_id_ctx, tenant_id_ctx


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract or generate X-Correlation-Id
        corr_id = request.headers.get("X-Correlation-Id") or f"corr-{uuid.uuid4().hex[:12]}"
        correlation_id_ctx.set(corr_id)

        # Extract X-Tenant-Id
        tenant_id = request.headers.get("X-Tenant-Id") or "tenant-default"
        tenant_id_ctx.set(tenant_id)

        response: Response = await call_next(request)
        
        # Inject X-Correlation-Id into response headers
        response.headers["X-Correlation-Id"] = corr_id
        response.headers["X-Tenant-Id"] = tenant_id
        return response
