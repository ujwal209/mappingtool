"""
Structured logging module ensuring:
- Correlation IDs, tenant IDs, and run IDs are tagged on every log record (Section 18).
- Sensitive secrets, credentials, and tokens are redacted before output (TA-008).
"""

import logging
import json
from contextvars import ContextVar
from typing import Any, Dict, Optional
from app.core.security import sanitize_dict_for_logging

# Context variables for request and run correlation
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id_ctx", default="")
tenant_id_ctx: ContextVar[str] = ContextVar("tenant_id_ctx", default="tenant-default")
run_id_ctx: ContextVar[Optional[str]] = ContextVar("run_id_ctx", default=None)


class StructuredLogFormatter(logging.Formatter):
    """Formats log records as structured JSON with contextual correlation metadata."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_ctx.get(),
            "tenant_id": tenant_id_ctx.get(),
        }
        
        current_run_id = run_id_ctx.get()
        if current_run_id:
            log_obj["run_id"] = current_run_id

        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_obj["data"] = sanitize_dict_for_logging(record.extra_data)

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def get_logger(name: str = "migration_platform") -> logging.Logger:
    """Returns a contextual logger configured with structured JSON formatting."""
    log = logging.getLogger(name)
    log.setLevel(logging.INFO)
    return log


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configures structured JSON logging for the application."""
    logger = logging.getLogger("migration_platform")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredLogFormatter())
        logger.addHandler(handler)
        
    return logger


logger = setup_logging()
