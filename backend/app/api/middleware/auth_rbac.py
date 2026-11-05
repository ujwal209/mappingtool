"""
Authentication, Multi-Tenant Context, and RBAC / Segregation of Duties Dependency.
Fulfills Section 17 & 17.1 (Suggested Role Matrix).
"""

from fastapi import Header, HTTPException, Depends
from typing import Optional
from app.core.security import AuthContext, Role, check_permission
from app.core.errors import PlatformException, ErrorCategory
from app.db.store import store


def get_auth_context(
    x_tenant_id: Optional[str] = Header(default="tenant-default", alias="X-Tenant-Id"),
    x_user_id: Optional[str] = Header(default="usr-developer", alias="X-User-Id"),
    x_user_role: Optional[str] = Header(default="Admin", alias="X-User-Role"),
    x_project_id: Optional[str] = Header(default=None, alias="X-Project-Id"),
    authorization: Optional[str] = Header(default=None),
) -> AuthContext:
    """Extracts tenant isolation boundary and RBAC identity from headers and optional JWT Bearer token."""
    tenant = x_tenant_id or "tenant-default"
    user_id = x_user_id or "usr-developer"
    role_str = x_user_role or "Admin"

    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        try:
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            if payload.get("tenant_id"):
                tenant = payload["tenant_id"]
            if payload.get("sub"):
                user_id = payload["sub"]
            if payload.get("role"):
                role_str = payload["role"]
        except Exception:
            pass

    # Ensure tenant exists
    store.ensure_tenant(tenant)

    # Parse role
    try:
        role_enum = Role(role_str)
    except ValueError:
        role_enum = Role.ADMIN

    return AuthContext(
        tenant_id=tenant,
        user_id=user_id,
        role=role_enum,
        project_id=x_project_id,
    )


def require_permission(permission: str):
    """FastAPI dependency factory enforcing RBAC permission checks."""
    def dependency(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not check_permission(auth, permission):
            raise PlatformException(
                code="INSUFFICIENT_PERMISSIONS",
                message=f"Role '{auth.role.value}' does not have permission '{permission}'",
                category=ErrorCategory.ACCESS_DENIED,
                status_code=403,
                details={"required_permission": permission, "user_role": auth.role.value},
                remediation_hint="Ensure request is authorized with an appropriate role (Section 17.1).",
            )
        return auth
    return dependency
