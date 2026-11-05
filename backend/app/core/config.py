"""
Application Settings & Environment Configuration.
Loads configuration parameters from environment variables and backend/.env file.

Environment variables (production-ready, no hardcoding):

  # Required in prod
  MONGODB_URI            mongodb+srv://host/db?retryWrites=true&w=majority
  MONGODB_USERNAME       db user (auto-injected into URI)
  MONGODB_PASSWORD       db password (auto-injected into URI)
  JWT_SECRET             >= 32 random chars (required in prod)

  # Optional
  DB_NAME                default: "mapping"
  GROQ_API_KEYS          comma-separated
  GEMINI_API_KEYS        comma-separated
  EMAIL / APP_PASSWORD   SMTP auth
  ENVIRONMENT            "production" | "development" | "test"
  CORS_ORIGINS           JSON list or comma-separated

The MONGODB_URI may include credentials already (mongodb+srv://user:pass@host/db).
If MONGODB_USERNAME / MONGODB_PASSWORD are also set and the URI has NO credentials,
they are injected automatically. If the URI already contains credentials, they win.
"""

import secrets
from typing import List, Optional
from urllib.parse import quote_plus, urlparse, urlunparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ============================================================
# Credential injection helper
# ============================================================
def _inject_credentials(
    uri: Optional[str],
    username: Optional[str],
    password: Optional[str],
) -> Optional[str]:
    """
    Inject MONGODB_USERNAME / MONGODB_PASSWORD into a MongoDB URI that lacks
    credentials. If the URI already has user:pass@host, it is returned unchanged.
    Handles both `mongodb://` and `mongodb+srv://` schemes.
    """
    if not uri:
        return None
    if not username or not password:
        return uri

    try:
        parsed = urlparse(uri)
    except Exception:
        return uri

    # Already credentialed?
    if "@" in (parsed.netloc or ""):
        return uri

    scheme = parsed.scheme or "mongodb"
    netloc = parsed.netloc or ""
    if not netloc:
        return uri

    new_netloc = f"{quote_plus(username)}:{quote_plus(password)}@{netloc}"
    return urlunparse(
        (
            scheme,
            new_netloc,
            parsed.path or "",
            parsed.params or "",
            parsed.query or "",
            parsed.fragment or "",
        )
    )


# ============================================================
# Settings
# ============================================================
class Settings(BaseSettings):
    """Centralized configuration. Fails fast in production if secrets are missing."""

    PROJECT_NAME: str = "AI-Powered Ontology-Driven Data Migration Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # ---------------------------------------------------------
    # MongoDB
    # ---------------------------------------------------------
    MONGODB_URI: Optional[str] = None
    MONGODB_USERNAME: Optional[str] = None
    MONGODB_PASSWORD: Optional[str] = None
    DB_NAME: str = "mapping"

    @property
    def resolved_mongo_uri(self) -> Optional[str]:
        """URI with credentials injected if not already present."""
        return _inject_credentials(
            self.MONGODB_URI, self.MONGODB_USERNAME, self.MONGODB_PASSWORD
        )

    # ---------------------------------------------------------
    # Groq / Gemini
    # ---------------------------------------------------------
    GROQ_API_KEYS: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None

    GEMINI_API_KEYS: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    GEMINI_EMBEDDING_DIMENSION: int = 768

    # ---------------------------------------------------------
    # Auth / JWT
    # ---------------------------------------------------------
    JWT_SECRET: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    VERIFY_TOKEN_EXPIRE_HOURS: int = 24
    RESET_TOKEN_EXPIRE_HOURS: int = 2

    # ---------------------------------------------------------
    # SMTP
    # ---------------------------------------------------------
    EMAIL: Optional[str] = None
    APP_PASSWORD: Optional[str] = None
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    FRONTEND_URL: str = "http://localhost:3000"

    # ---------------------------------------------------------
    # CORS — accept JSON list OR comma-separated string
    # ---------------------------------------------------------
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors(cls, v):
        """Accept `["a","b"]` or `a,b` or `a, b`."""
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return []
            if s.startswith("["):
                import json
                try:
                    return json.loads(s)
                except Exception:
                    pass
            return [x.strip() for x in s.split(",") if x.strip()]
        return v

    # ---------------------------------------------------------
    # Production hardening — fail fast if critical secrets missing
    # ---------------------------------------------------------
    def validate_production_readiness(self) -> None:
        """
        Called from main.py lifespan. Raises RuntimeError with a clear message
        if running in production without required secrets.
        """
        if self.ENVIRONMENT.lower() != "production":
            return

        errors: List[str] = []

        if not self.MONGODB_URI:
            errors.append(
                "MONGODB_URI is not set. Required in production."
            )
        elif not (self.MONGODB_USERNAME and self.MONGODB_PASSWORD) and "@" not in (
            urlparse(self.MONGODB_URI).netloc or ""
        ):
            errors.append(
                "MONGODB_URI has no credentials and MONGODB_USERNAME / "
                "MONGODB_PASSWORD are not set."
            )

        if not self.JWT_SECRET or len(self.JWT_SECRET) < 32:
            errors.append(
                "JWT_SECRET must be set to at least 32 random characters in production."
            )

        if self.JWT_SECRET and self.JWT_SECRET in {
            "mapping-platform-super-secret-jwt-key-2026-production",
            "changeme",
            "secret",
        }:
            errors.append("JWT_SECRET is still the default. Change it in production.")

        if self.DEBUG:
            errors.append("DEBUG must be False in production.")

        if errors:
            raise RuntimeError(
                "Production configuration invalid:\n  - " + "\n  - ".join(errors)
            )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()


# ============================================================
# Dev-only JWT fallback
# ============================================================
# If JWT_SECRET is unset and we're NOT in production, generate an ephemeral
# secret so dev machines don't crash. Production is guarded by
# validate_production_readiness() above.
if not settings.JWT_SECRET:
    if settings.ENVIRONMENT.lower() == "production":
        # Leave None — validate_production_readiness() will raise with clear message
        pass
    else:
        settings.JWT_SECRET = secrets.token_urlsafe(48)