"""
Login credential validation and JWT issuance.
"""

from app.core.config import settings
from app.core.errors import PlatformException, ErrorCategory
from app.core.logging import get_logger
from app.core.security import verify_password, create_access_token
from app.db.store import store
from app.models.canonical import UserLoginRequest, TokenResponse

logger = get_logger("auth.login")


def login(req: UserLoginRequest) -> TokenResponse:
    clean_email = req.email.lower().strip()
    user = store.get_user_by_email(clean_email)

    if not user or not verify_password(req.password, user.hashed_password):
        raise PlatformException(
            code="INVALID_CREDENTIALS",
            message="Invalid email or password.",
            category=ErrorCategory.ACCESS_DENIED,
            status_code=401,
        )

    if not user.is_active:
        raise PlatformException(
            code="ACCOUNT_DISABLED",
            message="This user account has been disabled.",
            category=ErrorCategory.ACCESS_DENIED,
            status_code=403,
        )

    access_token = create_access_token(
        {
            "sub": user.user_id,
            "email": user.email,
            "tenant_id": user.tenant_id,
            "role": user.role,
            "is_verified": user.is_verified,
        }
    )

    logger.info(f"Login → {user.email} role={user.role}")

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.user_id,
        email=user.email,
        tenant_id=user.tenant_id,
        role=user.role,
        is_verified=user.is_verified,
    )