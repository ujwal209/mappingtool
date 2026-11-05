"""
Core error handling and standard error models as mandated by Section 6 and Section 22
of the Technical Specification Document.
"""

from typing import Any, Dict, Optional
from enum import Enum
from pydantic import BaseModel, Field


class ErrorCategory(str, Enum):
    """Error categories defining system behavior and retry classification (Section 22)."""
    TRANSIENT_NETWORK = "TRANSIENT_NETWORK"
    THROTTLED = "THROTTLED"
    AUTH_EXPIRED = "AUTH_EXPIRED"
    DATA_REJECTED = "DATA_REJECTED"
    CONFLICT = "CONFLICT"
    RULE_ERROR = "RULE_ERROR"
    SCHEMA_DRIFT = "SCHEMA_DRIFT"
    PLATFORM_RESOURCE = "PLATFORM_RESOURCE"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    RECONCILIATION_FAILED = "RECONCILIATION_FAILED"
    ACCESS_DENIED = "ACCESS_DENIED"
    NOT_FOUND = "NOT_FOUND"
    INVALID_STATE = "INVALID_STATE"


class PlatformErrorEnvelope(BaseModel):
    """
    Standardized error envelope returned across all platform APIs (Section 6).
    Guarantees stable machine-readable contracts for callers and automated retry logic.
    """
    code: str = Field(..., description="Machine-readable error identifier")
    message: str = Field(..., description="Human-readable error explanation")
    category: ErrorCategory = Field(..., description="Classification category for retry logic")
    retryable: bool = Field(False, description="Whether caller may safely retry the operation")
    correlation_id: str = Field(..., description="Request tracing correlation identifier")
    details: Dict[str, Any] = Field(default_factory=dict, description="Structured diagnostics context")
    remediation_hint: Optional[str] = Field(None, description="Recommended remediation action")


class PlatformException(Exception):
    """Base application exception supporting standard error envelope formatting."""

    def __init__(
        self,
        code: str,
        message: str,
        category: ErrorCategory = ErrorCategory.PLATFORM_RESOURCE,
        retryable: bool = False,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
        remediation_hint: Optional[str] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.category = category
        self.retryable = retryable
        self.status_code = status_code
        self.details = details or {}
        self.remediation_hint = remediation_hint

    def to_envelope(self, correlation_id: str) -> PlatformErrorEnvelope:
        return PlatformErrorEnvelope(
            code=self.code,
            message=self.message,
            category=self.category,
            retryable=self.retryable,
            correlation_id=correlation_id,
            details=self.details,
            remediation_hint=self.remediation_hint,
        )
