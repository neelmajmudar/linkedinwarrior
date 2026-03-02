"""Webhook endpoint for receiving Unipile email notifications.

Unipile sends a POST request here when a new email is received in a connected
Gmail account. We validate the auth header, store the email, and enqueue
processing via Celery (or process inline in dev mode).
"""

import logging
import re
from datetime import datetime, timezone
from html.parser import HTMLParser

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

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


async def _process_email_background(
    db_email_id: str, user_id: str, subject: str, body: str,
    from_name: str, from_email: str,
) -> None:
    """Background task: process an email through the AI agent.

    Tries Celery first (if Redis is available), otherwise processes inline.
    This runs as a FastAPI BackgroundTask so the webhook returns immediately.
    """
    # Try Celery first (offloads to a separate worker process)
    try:
        from app.tasks import process_email_task
        process_email_task.delay(
            db_email_id, user_id, subject, body, from_name, from_email
        )
        logger.info("[webhook] Enqueued email via Celery: %s for user %s", db_email_id, user_id)
        return
    except Exception as e:
        logger.warning(
            "[webhook] Celery unavailable for %s (%s) — processing inline",
            db_email_id, e,
        )

    # Fallback: process inline via the LangGraph agent
    try:
        from app.agents.email_responder import process_email
        await process_email(
            user_id=user_id,
            email_id=db_email_id,
            email_subject=subject,
            email_body=body,
            from_name=from_name,
            from_email=from_email,
        )
        logger.info("[webhook] Processed email inline: %s for user %s", db_email_id, user_id)
    except Exception as inline_err:
        logger.error(
            "[webhook] Inline processing failed for %s: %s — email saved as 'new'",
            db_email_id, inline_err,
        )


@router.post("/email")
async def email_webhook(request: Request, background_tasks: BackgroundTasks):
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

    # Schedule processing as a FastAPI background task.
    # Returns 202 immediately; _process_email_background tries Celery first,
    # then falls back to inline processing if Redis/Celery is unavailable.
    background_tasks.add_task(
        _process_email_background,
        db_email_id, user_id, subject, body[:10000], from_name, from_email,
    )
    logger.info("[webhook] Accepted email %s for user %s — processing scheduled", db_email_id, user_id)

    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=202,
        content={"status": "accepted", "email_id": db_email_id},
    )
