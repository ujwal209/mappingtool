"""Secure OTP code generation for email verification."""

import secrets


def generate_otp_code() -> str:
    """Return a cryptographically random 6-digit OTP as a zero-padded string."""
    return f"{secrets.randbelow(900_000) + 100_000}"