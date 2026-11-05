"""
Email verification — accepts either a 6-digit OTP or a signed JWT token.
"""

import time
from typing import Optional

from app.core.errors import PlatformException, ErrorCategory
from app.core.logging import get_logger
from app.core.security import verify_email_token
from app.db.store import store
from app.models.canonical import User

logger = get_logger("auth.verification")


def verify_email(token: str, email: Optional[str] = None) -> User:
    """
    Validate the OTP / token and mark the account as verified.

    Lookup strategy (first match wins):
      1. email provided + OTP matches that user's verification_token
      2. email provided + token is a valid JWT whose sub == email
      3. token matches any user's verification_token (OTP-only lookup)
      4. token is a valid JWT → look up user by sub
    """
    clean_token = str(token).strip()
    user: Optional[User] = None

    if email:
        candidate = store.get_user_by_email(email.lower().strip())
        if candidate:
            if candidate.verification_token == clean_token:
                user = candidate
            else:
                jwt_email = verify_email_token(clean_token, expected_type="verify")
                if jwt_email and jwt_email.lower().strip() == candidate.email.lower():
                    user = candidate

    if user is None:
        user = store.get_user_by_verification_token(clean_token)

    if user is None:
        jwt_email = verify_email_token(clean_token, expected_type="verify")
        if jwt_email:
            user = store.get_user_by_email(jwt_email)

    if user is None:
        raise PlatformException(
            code="INVALID_VERIFICATION_TOKEN",
            message="Invalid or expired verification code.",
            category=ErrorCategory.AUTH_EXPIRED,
            status_code=400,
        )

    user.is_verified = True
    user.verification_token = None
    user.updated_at = time.time()
    saved = store.save_user(user)
    logger.info(f"Email verified → {user.email}")
    return saved