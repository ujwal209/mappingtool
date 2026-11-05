"""
Email Service for User Authentication, Email Verification & Password Reset.
Utilizes Python smtplib with STARTTLS and Gmail SMTP authentication.
Includes responsive HTML templates and graceful fallback for testing/offline environments.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("email_service")


class EmailService:
    """
    Handles transactional emails for user onboarding, email verification,
    and password reset flows.
    """

    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.sender_email = settings.EMAIL
        self.sender_password = settings.APP_PASSWORD
        self.frontend_url = settings.FRONTEND_URL

    def _is_configured(self) -> bool:
        """Checks if SMTP credentials are provided."""
        return bool(self.sender_email and self.sender_password)

    def test_connection(self) -> bool:
        """Tests live SMTP connectivity and credentials."""
        if not self._is_configured():
            logger.warning("SMTP credentials not configured.")
            return False
        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                return True
        except Exception as e:
            logger.error(f"SMTP connection test failed: {e}")
            return False

    def send_verification_email(self, to_email: str, token: str, user_name: str = "User") -> bool:
        """
        Sends a 6-digit OTP verification code to the user.
        No verification links or hyperlinks are included.
        """
        otp_code = str(token).strip()
        subject = f"Your Verification Code: {otp_code} - Data Bride"
        
        plain_text = f"""Hello {user_name},

Thank you for registering on Data Bride.
Your 6-digit account verification code is:

{otp_code}

Please enter this verification code on the screen to activate your account.
This verification code is valid for 24 hours.

If you did not create this account, please ignore this email.
"""

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; margin: 0; padding: 24px; color: #f8fafc; }}
            .container {{ max-width: 520px; margin: 0 auto; background: #0f172a; border-radius: 12px; border: 1px solid #1e293b; overflow: hidden; }}
            .header {{ background: #020617; padding: 24px; text-align: center; border-bottom: 1px solid #1e293b; }}
            .header h1 {{ margin: 0; font-size: 18px; font-weight: 600; color: #f8fafc; }}
            .content {{ padding: 32px 28px; color: #cbd5e1; line-height: 1.6; font-size: 14px; }}
            .otp-box {{ margin: 28px 0; text-align: center; }}
            .otp-code {{ display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #38bdf8; background: #020617; border: 1px solid #0284c7; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(56, 189, 248, 0.15); }}
            .footer {{ background: #020617; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Hi <strong>{user_name}</strong>,</p>
              <p>Thank you for signing up. Please enter this 6-digit code on the verification screen to activate your account:</p>
              <div class="otp-box">
                <div class="otp-code">{otp_code}</div>
              </div>
              <p style="font-size: 13px; color: #94a3b8;">This code will expire in 24 hours.</p>
              <p style="font-size: 13px; color: #64748b; margin-top: 24px;">If you did not request this verification, please safely disregard this email.</p>
            </div>
            <div class="footer">
              Secure Account Verification
            </div>
          </div>
        </body>
        </html>
        """

        return self._send_email(to_email, subject, plain_text, html_content)

    def send_password_reset_email(self, to_email: str, token: str, user_name: str = "User") -> bool:
        """
        Sends a password reset link and token to the user.
        """
        reset_url = f"{self.frontend_url}/auth/reset-password?token={token}"
        subject = "Reset Your Password - AI Data Migration Platform"
        
        plain_text = f"""Hello {user_name},

We received a request to reset your password for the AI Data Migration Platform.

Click the link below or paste it into your browser to choose a new password:
{reset_url}

Reset Token:
{token}

This token is valid for 2 hours. If you did not make this request, you can safely ignore this email.
"""

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }}
            .header {{ background: #0f172a; padding: 24px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.5px; }}
            .content {{ padding: 32px 24px; color: #334155; line-height: 1.6; }}
            .btn {{ display: inline-block; background: #dc2626; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 20px 0; }}
            .token-box {{ background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; word-break: break-all; margin: 16px 0; border: 1px solid #cbd5e1; }}
            .footer {{ background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Enterprise Data Migration Platform</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Hi <strong>{user_name}</strong>,</p>
              <p>We received a request to reset your password. Click the button below to proceed:</p>
              <p style="text-align: center;">
                <a href="{reset_url}" class="btn">Reset Password</a>
              </p>
              <p>Or use your reset token directly in the API or UI:</p>
              <div class="token-box">{token}</div>
              <p style="font-size: 13px; color: #64748b;">This reset token will expire in 2 hours.</p>
            </div>
            <div class="footer">
              If you did not request a password reset, please contact security immediately.
            </div>
          </div>
        </body>
        </html>
        """

        return self._send_email(to_email, subject, plain_text, html_content)

    def _send_email(self, to_email: str, subject: str, plain_text: str, html_content: str) -> bool:
        """
        Internal sender that establishes SMTP connection with STARTTLS.
        """
        if not self._is_configured():
            logger.warning(f"SMTP not configured. Mocking email delivery to {to_email} (Subject: {subject})")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"AI Migration Platform <{self.sender_email}>"
            msg["To"] = to_email

            part1 = MIMEText(plain_text, "plain")
            part2 = MIMEText(html_content, "html")
            msg.attach(part1)
            msg.attach(part2)

            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, [to_email], msg.as_string())

            logger.info(f"Successfully sent email to {to_email} via {self.smtp_host}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False


email_service = EmailService()
