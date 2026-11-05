"""
Backward-compatible re-export.
Real implementation lives in app/services/auth/ (split into focused modules).
"""
from app.services.auth.facade import AuthService, auth_service

__all__ = ["AuthService", "auth_service"]