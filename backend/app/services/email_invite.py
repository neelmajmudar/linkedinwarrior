"""Transactional email service for organization invites via Resend."""

import logging
from app.config import settings

logger = logging.getLogger(__name__)


async def send_invite_email(
    to_email: str,
    org_name: str,
    inviter_name: str,
    role: str,
    token: str,
) -> bool:
    """Send a branded invite email via Resend.

    Returns True if the email was sent successfully, False otherwise.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("[email_invite] RESEND_API_KEY not configured, skipping email send")
        return False

    accept_url = f"{settings.FRONTEND_URL}/dashboard/team/invite?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 0;">
            <tr>
                <td align="center">
                    <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background-color:#1a1a1a;padding:24px 32px;text-align:center;">
                                <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.5px;">LinkedInWarrior</span>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding:32px;">
                                <h1 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;font-weight:600;">You're invited to join a team</h1>
                                <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.5;">
                                    <strong>{inviter_name}</strong> has invited you to join
                                    <strong>{org_name}</strong> as {_article(role)} <strong>{role}</strong>.
                                </p>
                                <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.5;">
                                    As a team member, you'll be able to coordinate LinkedIn content on a shared calendar,
                                    see what everyone is posting, and avoid topic conflicts.
                                </p>
                                <!-- CTA Button -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding:8px 0 24px;">
                                            <a href="{accept_url}"
                                               style="display:inline-block;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:9999px;">
                                                Accept Invitation
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                                    This invitation expires in 7 days. If you don't have an account yet,
                                    you'll be able to create one after clicking the link.
                                </p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
                                <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
                                    LinkedInWarrior &mdash; AI-Powered LinkedIn Content Engine
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    try:
        import resend
        resend.api_key = settings.RESEND_API_KEY

        result = resend.Emails.send({
            "from": "LinkedInWarrior <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"You're invited to join {org_name} on LinkedInWarrior",
            "html": html,
        })
        logger.info(f"[email_invite] Invite email sent to {to_email} for org {org_name}, id={result}")
        return True
    except Exception as e:
        logger.error(f"[email_invite] Failed to send invite email to {to_email}: {type(e).__name__}: {e}", exc_info=True)
        return False


def _article(role: str) -> str:
    """Return 'an' for roles starting with a vowel, 'a' otherwise."""
    return "an" if role[0].lower() in "aeiou" else "a"
