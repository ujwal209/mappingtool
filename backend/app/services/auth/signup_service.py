"""
Signup and verification-email resend flows.
"""

import time
from typing import Optional, Tuple

from app.core.errors import PlatformException, ErrorCategory
from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.store import store
from app.models.canonical import User, UserCreateRequest
from app.services.auth.otp import generate_otp_code
from app.services.email_service import email_service

logger = get_logger("auth.signup")


def signup(
    req: UserCreateRequest, tenant_id: Optional[str] = None
) -> Tuple[User, str]:
    """
    Register a new user.

    - Hashes password with bcrypt.
    - Generates a 6-digit OTP.
    - Sends the OTP via email_service.
    - Returns (user, otp_code) so callers can echo it in dev/testing.
    """
    clean_email = req.email.lower().strip()

    if store.get_user_by_email(clean_email):
        raise PlatformException(
            code="USER_ALREADY_EXISTS",
            message=f"An account with email '{clean_email}' already exists.",
            category=ErrorCategory.CONFLICT,
            status_code=409,
        )

    # Determine tenant — per-organization tenant if provided
    target_tenant = tenant_id or (
        f"tenant-{req.organization.lower().replace(' ', '-')}"
        if req.organization
        else "tenant-default"
    )
    store.ensure_tenant(target_tenant)

    otp = generate_otp_code()

    user = User(
        email=clean_email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        tenant_id=target_tenant,
        role=req.role or "Analyst",
        is_verified=False,
        is_active=True,
        verification_token=otp,
    )

    saved = store.save_user(user)
    logger.info(f"Signup → {clean_email} tenant={target_tenant}")

    # Best-effort email dispatch — don't fail signup if SMTP is down
    try:
        email_service.send_verification_email(clean_email, otp, req.full_name)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Verification email not sent → {e}")

    return saved, otp


def resend_verification(email: str) -> str:
    """
    Generate a fresh OTP and re-send it to an unverified account.
    Returns the new OTP.
    """
    clean_email = email.lower().strip()
    user = store.get_user_by_email(clean_email)

    if not user:
        raise PlatformException(
            code="USER_NOT_FOUND",
            message=f"No account found with email '{clean_email}'.",
            category=ErrorCategory.NOT_FOUND,
            status_code=404,
        )

    if user.is_verified:
        raise PlatformException(
            code="ACCOUNT_ALREADY_VERIFIED",
            message=f"Account '{clean_email}' is already verified.",
            category=ErrorCategory.VALIDATION_FAILED,
            status_code=400,
        )

    otp = generate_otp_code()
    user.verification_token = otp
    user.updated_at = time.time()
    store.save_user(user)

    try:
        email_service.send_verification_email(clean_email, otp, user.full_name)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Verification email not sent → {e}")

    logger.info(f"Resent verification OTP → {clean_email}")
    return otp