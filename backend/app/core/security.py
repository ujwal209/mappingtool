"""
Security, cryptographic hashing, password hashing, JWT, and secret masking utilities.
Implements requirements from:
- Section 17 (Security Architecture)
- Section 17.1 (Suggested Role Matrix & Segregation of Duties)
- TA-008 (Zero Secret Leakage in APIs, logs, and telemetry)
- User Authentication, Email Verification & Password Reset
"""

import hashlib
import json
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from enum import Enum
import bcrypt
import jwt
from pydantic import BaseModel, Field

from app.core.config import settings


class Role(str, Enum):
    """Platform RBAC roles defined in PRD Section 17.1."""
    ANALYST = "Analyst"
    ENGINEER = "Engineer"
    APPROVER = "Approver"
    OPERATOR = "Operator"
    ADMIN = "Admin"


class AuthContext(BaseModel):
    """Security context parsed from authentication headers."""
    tenant_id: str = Field(default="tenant-default", description="Top-level isolation boundary")
    user_id: str = Field(default="usr-anonymous", description="Authenticated actor ID")
    role: Role = Field(default=Role.ADMIN, description="Assigned role for RBAC/ABAC")
    project_id: Optional[str] = Field(default=None, description="Current scoped project")


def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using bcrypt with a generated salt.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a stored bcrypt hash.
    """
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Encodes a signed JWT bearer token with claims, subject, tenant_id, role, and expiration.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and cryptographically validates a JWT bearer token.
    Raises jwt.PyJWTError if expired, signature invalid, or malformed.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def create_email_token(email: str, token_type: str = "verify", expires_hours: int = 24) -> str:
    """
    Generates a cryptographically signed one-time token for email verification or password reset.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=expires_hours)
    payload = {
        "sub": email,
        "type": token_type,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_email_token(token: str, expected_type: str = "verify") -> Optional[str]:
    """
    Verifies an email verification or password reset token and returns the email if valid.
    Returns None if token is invalid, expired, or of the wrong type.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != expected_type:
            return None
        return payload.get("sub")
    except Exception:
        return None


def compute_sha256(data: Any) -> str:
    """
    Computes a deterministic SHA-256 hexadecimal hash of any serializable Python object.
    Ensures canonical JSON serialization with sorted keys for tamper-evident evidence.
    """
    if isinstance(data, (bytes, bytearray)):
        return hashlib.sha256(data).hexdigest()
    
    serialized = json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def mask_secret(secret: Optional[str]) -> str:
    """
    Masks a sensitive secret string so that it never leaks to logs or APIs (TA-008).
    Example: 'gsk_abcdef1234567890abcdef1234567890abcdef1234' -> 'gsk_...1234'
    """
    if not secret:
        return "[NOT_SET]"
    clean = str(secret).strip()
    if len(clean) <= 8:
        return "****"
    prefix = clean[:4]
    suffix = clean[-4:]
    return f"{prefix}...{suffix}"


def sanitize_dict_for_logging(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively scans and sanitizes dictionary values to redact any password, key,
    or token before passing to telemetry or logs.
    """
    sensitive_keys = {
        "password", "secret", "secret_ref", "key", "api_key", "token",
        "access_token", "private_key", "credential", "auth", "app_password"
    }
    sanitized: Dict[str, Any] = {}
    for k, v in data.items():
        k_lower = k.lower()
        if any(sk in k_lower for sk in sensitive_keys):
            sanitized[k] = mask_secret(str(v))
        elif isinstance(v, dict):
            sanitized[k] = sanitize_dict_for_logging(v)
        elif isinstance(v, list):
            sanitized[k] = [
                sanitize_dict_for_logging(item) if isinstance(item, dict) else item
                for item in v
            ]
        else:
            sanitized[k] = v
    return sanitized


def check_permission(context: AuthContext, required_permission: str) -> bool:
    """
    Evaluates role permissions against the matrix defined in Section 17.1.
    Permissions include:
    - metadata:read
    - mapping:edit
    - rule:build
    - artifact:approve
    - run:execute
    - run:operate
    - secret:manage
    - gate:override
    - policy:change
    """
    role = context.role
    
    matrix = {
        "metadata:read": [Role.ANALYST, Role.ENGINEER, Role.APPROVER, Role.OPERATOR, Role.ADMIN],
        "mapping:edit": [Role.ANALYST, Role.ENGINEER, Role.ADMIN],
        "rule:build": [Role.ENGINEER, Role.ADMIN],
        "artifact:approve": [Role.APPROVER], # Admin cannot be sole approver (Segregation of Duties)
        "run:execute": [Role.OPERATOR, Role.ADMIN],
        "run:operate": [Role.OPERATOR, Role.ADMIN],
        "secret:manage": [Role.ADMIN],
        "gate:override": [Role.APPROVER],
        "policy:change": [Role.ADMIN],
    }

    allowed_roles = matrix.get(required_permission, [Role.ADMIN])
    return role in allowed_roles
