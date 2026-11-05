"""
User profile retrieval.
"""

from app.core.errors import PlatformException, ErrorCategory
from app.db.store import store
from app.models.canonical import UserProfileResponse


def get_user_profile(user_id: str) -> UserProfileResponse:
    user = store.get_user_by_id(user_id)

    if not user:
        raise PlatformException(
            code="USER_NOT_FOUND",
            message="User not found.",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    return UserProfileResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        tenant_id=user.tenant_id,
        role=user.role,
        is_verified=user.is_verified,
        is_active=user.is_active,
        created_at=user.created_at,
    )