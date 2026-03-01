"""Webhook endpoint for receiving Unipile email notifications.

Unipile sends a POST request here when a new email is received in a connected
Gmail account. We validate the auth header, store the email, and enqueue
processing via Celery (or process inline in dev mode).
"""

import logging
import re
from datetime import datetime, timezone
from html.parser import HTMLParser

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


class _HTMLStripper(HTMLParser):
    """Minimal HTML → plain text converter."""
    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._block_tags = {
            "p", "div", "br", "li", "tr", "h1", "h2", "h3",
            "h4", "h5", "h6", "blockquote",
        }

    def handle_starttag(self, tag, attrs):
        if tag in self._block_tags:
            self._parts.append("\n")

    def handle_data(self, data):
        self._parts.append(data)

    def get_text(self) -> str:
        text = "".join(self._parts)
        # Collapse 3+ newlines to 2, strip leading/trailing whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def html_to_text(html: str) -> str:
    """Strip HTML tags and return clean plain text."""
    if not html:
        return ""
    # Quick check — if no tags present just return as-is
    if "<" not in html:
        return html.strip()
    stripper = _HTMLStripper()
    try:
        stripper.feed(html)
        return stripper.get_text()
    except Exception:
        # Fallback: crude regex strip
        return re.sub(r"<[^>]+>", " ", html).strip()


@router.post("/email")
async def email_webhook(request: Request):
    """Receive Unipile new-email webhook events.

    Expected payload (mail_received):
    {
        "email_id": "...",
        "account_id": "...",
        "event": "mail_received",
        "from_attendee": {"display_name": "...", "identifier": "..."},
        "to_attendees": [...],
        "subject": "...",
        "body": "...",
        ...
    }
    """
    # Validate webhook secret
    if settings.UNIPILE_WEBHOOK_SECRET:
        auth_header = request.headers.get("Unipile-Auth", "")
        if auth_header != settings.UNIPILE_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid webhook auth")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event", "")

    # Only process received emails (not sent/moved)
    if event != "mail_received":
        return {"status": "ignored", "event": event}

    email_id = payload.get("email_id", "")
    account_id = payload.get("account_id", "")
    if not email_id or not account_id:
        return {"status": "ignored", "reason": "missing email_id or account_id"}

    # Look up the user from the email account
    db = get_supabase()
    acct_result = db.table("email_accounts") \
        .select("user_id") \
        .eq("unipile_account_id", account_id) \
        .eq("status", "active") \
        .execute()

    if not acct_result.data:
        logger.warning("[webhook] No user found for account_id: %s", account_id)
        return {"status": "ignored", "reason": "unknown account"}

    user_id = acct_result.data[0]["user_id"]

    # Extract email fields from webhook payload
    from_attendee = payload.get("from_attendee", {})
    from_name = from_attendee.get("display_name", "")
    from_email = from_attendee.get("identifier", "")
    to_attendees = payload.get("to_attendees", [])
    to_email = to_attendees[0].get("identifier", "") if to_attendees else ""
    subject = payload.get("subject", "")
    body_raw = payload.get("body", "") or payload.get("body_plain", "")
    body = html_to_text(body_raw)
    has_attachments = payload.get("has_attachments", False)
    received_at = payload.get("date")

    # Check for duplicate
    existing = db.table("emails") \
        .select("id") \
        .eq("unipile_email_id", email_id) \
        .execute()

    if existing.data:
        return {"status": "duplicate", "email_id": email_id}

    # Get the email_account record id
    acct_full = db.table("email_accounts") \
        .select("id") \
        .eq("unipile_account_id", account_id) \
        .eq("user_id", user_id) \
        .execute()
    email_account_id = acct_full.data[0]["id"] if acct_full.data else None

    # Store the email
    insert_data = {
        "user_id": user_id,
        "email_account_id": email_account_id,
        "unipile_email_id": email_id,
        "from_name": from_name,
        "from_email": from_email,
        "to_email": to_email,
        "subject": subject,
        "body_text": body[:10000] if body else "",
        "has_attachments": has_attachments,
        "received_at": received_at or datetime.now(timezone.utc).isoformat(),
        "status": "new",
    }

    result = db.table("emails").insert(insert_data).execute()
    db_email_id = result.data[0]["id"] if result.data else None

    if not db_email_id:
        logger.error("[webhook] Failed to insert email for user %s", user_id)
        return {"status": "error", "reason": "insert failed"}

    # Enqueue processing via Celery, or fall back to inline processing
    processed_via = "pending"
    try:
        from app.tasks import process_email_task
        process_email_task.delay(
            db_email_id, user_id, subject, body[:10000], from_name, from_email
        )
        processed_via = "celery"
        logger.info("[webhook] Enqueued email processing: %s for user %s", db_email_id, user_id)
    except Exception as e:
        logger.warning("[webhook] Celery not available (%s), processing inline...", e)
        try:
            from app.agents.email_responder import process_email
            result = await process_email(
                user_id=user_id,
                email_id=db_email_id,
                email_subject=subject,
                email_body=body[:10000] if body else "",
                from_name=from_name,
                from_email=from_email,
            )
            processed_via = "inline"
            logger.info(
                "[webhook] Inline processed email %s — category: %s",
                db_email_id, result.get("category"),
            )
        except Exception as proc_err:
            logger.error("[webhook] Inline processing failed for %s: %s", db_email_id, proc_err)

    return {"status": "accepted", "email_id": db_email_id, "processed_via": processed_via}
