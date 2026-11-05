"""
User Authentication, Email Verification & Self-Service Password Recovery API.
Endpoints for:
- User signup with automatic email verification token dispatch
- Email token validation via POST & GET (direct email hyperlink support)
- Resend verification email
- Secure login and JWT access token generation
- Self-service forgot password email dispatch
- Password reset token verification and password update
- Authenticated user profile retrieval (/me)
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from fastapi.responses import HTMLResponse

from app.models.canonical import (
    UserCreateRequest, UserLoginRequest, TokenResponse,
    VerifyEmailRequest, ResendVerificationRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    UserProfileResponse, User
)
from app.services.auth_service import auth_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["User Authentication & Security"])


@router.post(
    "/signup",
    summary="Register a new user account",
    description="Creates a new user, hashes password with bcrypt, generates an email verification token, and sends an activation email.",
    status_code=status.HTTP_201_CREATED,
)
def signup(
    req: UserCreateRequest,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID", description="Optional tenant boundary override"),
):
    user, verify_token = auth_service.signup(req, tenant_id=x_tenant_id)
    return {
        "status": "success",
        "message": "User registered successfully. An activation email has been sent to your inbox.",
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "tenant_id": user.tenant_id,
        "role": user.role,
        "is_verified": user.is_verified,
        "verification_token": verify_token,  # Provided for immediate automated testing/API flows
    }


@router.post(
    "/verify-email",
    summary="Verify user email address (JSON payload)",
    description="Validates the cryptographically signed email verification token and activates the account.",
)
def verify_email_post(req: VerifyEmailRequest):
    user = auth_service.verify_email(req.token)
    return {
        "status": "success",
        "message": "Email verified successfully. Your account is now active.",
        "user_id": user.user_id,
        "email": user.email,
        "is_verified": user.is_verified,
    }


@router.get(
    "/verify-email",
    summary="Verify user email address (Direct Link from Email)",
    description="Handles direct link clicks from verification emails in web browsers.",
    response_class=HTMLResponse,
)
def verify_email_get(token: str = Query(..., description="Email verification token")):
    user = auth_service.verify_email(token)
    html_response = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Verified - AI Migration Platform</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f1f5f9; }}
        .card {{ background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 450px; }}
        h1 {{ color: #16a34a; font-size: 24px; margin-bottom: 12px; }}
        p {{ color: #475569; line-height: 1.5; }}
        .btn {{ display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 20px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Email Verified!</h1>
        <p>Your email <strong>{user.email}</strong> has been successfully verified.</p>
        <p>You can now log in to the Data Migration Platform.</p>
        <a href="/docs" class="btn">Go to API Documentation</a>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_response, status_code=200)


@router.post(
    "/resend-verification",
    summary="Resend verification email",
    description="Dispatches a fresh email verification link and token if the previous one expired.",
)
def resend_verification(req: ResendVerificationRequest):
    new_token = auth_service.resend_verification(req.email)
    return {
        "status": "success",
        "message": f"Verification email resent to {req.email}.",
        "email": req.email,
        "verification_token": new_token,
    }


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and issue JWT token",
    description="Validates email and password, returning a signed JWT access token for Bearer authentication.",
)
def login(req: UserLoginRequest):
    return auth_service.login(req)


@router.post(
    "/forgot-password",
    summary="Request password reset email",
    description="Generates a signed, time-limited password recovery token and emails it to the user.",
)
def forgot_password(req: ForgotPasswordRequest):
    reset_token = auth_service.forgot_password(req.email)
    return {
        "status": "success",
        "message": "Password reset instructions have been sent to your email.",
        "email": req.email,
        "reset_token": reset_token,  # Provided for immediate automated testing/API flows
    }


@router.post(
    "/reset-password",
    summary="Reset account password",
    description="Validates the recovery token and securely updates the user's password hash.",
)
def reset_password(req: ResetPasswordRequest):
    user = auth_service.reset_password(req.token, req.new_password)
    return {
        "status": "success",
        "message": "Password has been successfully updated. You may now log in with your new password.",
        "email": user.email,
    }


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user profile",
    description="Returns the profile details of the currently authenticated user from the Bearer token.",
)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return auth_service.get_user_profile(user.user_id)
