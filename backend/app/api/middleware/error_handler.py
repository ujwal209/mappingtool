"""
Standardized API Error Handler Middleware.
Fulfills Section 6:
"Errors use a stable envelope: code, message, category, retryable, correlation_id,
details and optional remediation_hint."
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.errors import PlatformException, PlatformErrorEnvelope, ErrorCategory
from app.core.logging import correlation_id_ctx, logger


async def platform_exception_handler(request: Request, exc: PlatformException) -> JSONResponse:
    corr_id = correlation_id_ctx.get() or request.headers.get("X-Correlation-Id", "unknown-corr-id")
    envelope = exc.to_envelope(correlation_id=corr_id)
    
    logger.warning(
        f"PlatformException [{envelope.code}]: {envelope.message}",
        extra={"extra_data": envelope.model_dump()}
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope.model_dump(),
        headers={"X-Correlation-Id": corr_id},
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    corr_id = correlation_id_ctx.get() or request.headers.get("X-Correlation-Id", "unknown-corr-id")
    
    envelope = PlatformErrorEnvelope(
        code="INTERNAL_SERVER_ERROR",
        message=str(exc) or "An unexpected server error occurred",
        category=ErrorCategory.PLATFORM_RESOURCE,
        retryable=True,
        correlation_id=corr_id,
        details={"type": type(exc).__name__},
        remediation_hint="Contact platform operations with the correlation ID.",
    )

    logger.error(f"Uncaught server exception: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content=envelope.model_dump(),
        headers={"X-Correlation-Id": corr_id},
    )
