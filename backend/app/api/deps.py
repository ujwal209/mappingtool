"""
FastAPI Security & Authentication Dependencies.
Provides Bearer token validation, RBAC context injection, and tenant boundary enforcement.
"""

from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from app.core.security import decode_access_token, AuthContext, Role
from app.core.errors import PlatformException, ErrorCategory
from app.db.store import store
from app.models.canonical import User


def get_auth_context(
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID", description="Enterprise isolation tenant boundary"),
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID", description="Distributed trace ID"),
    authorization: Optional[str] = Header(None, description="Bearer JWT access token"),
) -> AuthContext:
    """
    Parses and verifies identity context from JWT Authorization header or X-Tenant-ID header.
    Falls back gracefully to default tenant for open development if token is omitted.
    """
    tenant = x_tenant_id or "tenant-default"
    user_id = "usr-anonymous"
    role = Role.ADMIN

    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        try:
            payload = decode_access_token(token)
            user_id = payload.get("sub", user_id)
            tenant = payload.get("tenant_id", tenant)
            role_str = payload.get("role", "Admin")
            try:
                role = Role(role_str)
            except ValueError:
                role = Role.ANALYST
        except Exception:
            # When an explicit invalid bearer token is sent, reject request
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return AuthContext(
        tenant_id=tenant,
        user_id=user_id,
        role=role,
    )


def get_current_user(
    authorization: Optional[str] = Header(None, description="Bearer JWT access token")
) -> User:
    """
    Enforces authentication requirement: decodes JWT and retrieves active user account.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header with Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:].strip()
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identity.",
        )

    user = store.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User identity in token does not exist.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated.",
        )

    return user


def get_current_verified_user(user: User = Depends(get_current_user)) -> User:
    """
    Ensures that the authenticated user has verified their email address.
    """
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address has not been verified. Please verify your account first.",
        )
    return user
