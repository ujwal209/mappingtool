"""
AuthService — thin orchestrator that preserves the existing
`auth_service.signup(...)`, `auth_service.login(...)`, etc. API.
"""

from typing import Optional, Tuple

from app.models.canonical import (
    User,
    UserCreateRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfileResponse,
)

from app.services.auth import (
    signup_service,
    verification_service,
    login_service,
    password_service,
    profile_service,
)


class AuthService:
    # -------- Signup & Verification --------
    def signup(
        self, req: UserCreateRequest, tenant_id: Optional[str] = None
    ) -> Tuple[User, str]:
        return signup_service.signup(req, tenant_id=tenant_id)

    def verify_email(self, token: str, email: Optional[str] = None) -> User:
        return verification_service.verify_email(token, email=email)

    def resend_verification(self, email: str) -> str:
        return signup_service.resend_verification(email)

    # -------- Login --------
    def login(self, req: UserLoginRequest) -> TokenResponse:
        return login_service.login(req)

    # -------- Password --------
    def forgot_password(self, email: str) -> str:
        return password_service.forgot_password(email)

    def reset_password(self, token: str, new_password: str) -> User:
        return password_service.reset_password(token, new_password)

    # -------- Profile --------
    def get_user_profile(self, user_id: str) -> UserProfileResponse:
        return profile_service.get_user_profile(user_id)


auth_service = AuthService()