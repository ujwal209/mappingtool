"""
Forgot-password and reset-password flows.
"""

import time

from app.core.config import settings
from app.core.errors import PlatformException, ErrorCategory
from app.core.logging import get_logger
from app.core.security import (
    create_email_token,
    verify_email_token,
    hash_password,
)
from app.db.store import store
from app.models.canonical import User
from app.services.email_service import email_service

logger = get_logger("auth.password")


def forgot_password(email: str) -> str:
    """
    Issue a signed reset JWT, persist it, and email it to the user.
    Returns the raw token so callers can echo it in dev/testing.
    """
    clean_email = email.lower().strip()
    user = store.get_user_by_email(clean_email)

    if not user:
        raise PlatformException(
            code="USER_NOT_FOUND",
            message=f"No account associated with '{clean_email}'.",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    reset_token = create_email_token(
        clean_email,
        token_type="reset",
        expires_hours=settings.RESET_TOKEN_EXPIRE_HOURS,
    )

    user.reset_token = reset_token
    user.reset_token_expires_at = (
        time.time() + settings.RESET_TOKEN_EXPIRE_HOURS * 3600
    )
    user.updated_at = time.time()
    store.save_user(user)

    try:
        email_service.send_password_reset_email(
            clean_email, reset_token, user.full_name
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Password reset email not sent → {e}")

    logger.info(f"Password reset token issued → {clean_email}")
    return reset_token


def reset_password(token: str, new_password: str) -> User:
    """
    Validate the reset token (JWT preferred, raw token accepted as fallback)
    and persist the new bcrypt password hash.
    """
    email = verify_email_token(token, expected_type="reset")
    user = store.get_user_by_email(email) if email else None

    if user is None:
        user = store.get_user_by_reset_token(token)

    if user is None:
        raise PlatformException(
            code="INVALID_RESET_TOKEN",
            message="Invalid or expired password reset token.",
            category=ErrorCategory.AUTH_EXPIRED,
            status_code=400,
        )

    if user.reset_token_expires_at and time.time() > user.reset_token_expires_at:
        raise PlatformException(
            code="RESET_TOKEN_EXPIRED",
            message="Password reset token has expired. Please request a new one.",
            category=ErrorCategory.AUTH_EXPIRED,
            status_code=400,
        )

    user.hashed_password = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    user.updated_at = time.time()
    saved = store.save_user(user)

    logger.info(f"Password reset → {user.email}")
    return saved