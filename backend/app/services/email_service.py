"""Service layer for Gmail integration via Unipile.

Handles account connection, webhook registration, email fetching, and sending replies.
"""

import logging

import httpx
from app.config import settings
from app.db import get_supabase

logger = logging.getLogger(__name__)

# Categories that should be skipped (not processed by the AI agent)
SKIP_CATEGORIES = {"newsletter", "promotional"}


async def get_gmail_auth_url(user_id: str) -> str:
    """Request a Unipile hosted auth URL for Gmail (Google) connection."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.UNIPILE_DSN}/api/v1/hosted/accounts/link",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "type": "create",
                "providers": ["GOOGLE"],
                "api_url": settings.UNIPILE_DSN,
                "expiresOn": "2099-01-01T00:00:00.000Z",
                "notify_url": f"{settings.BACKEND_URL}/api/email/callback/webhook",
                "name": user_id,
                "success_redirect_url": f"{settings.FRONTEND_URL}/dashboard/email?connected=true",
                "failure_redirect_url": f"{settings.FRONTEND_URL}/dashboard/email?connected=false",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("url", "")


async def handle_gmail_callback(user_id: str, account_id: str) -> None:
    """Store the Unipile Gmail account_id in email_accounts after successful auth."""
    db = get_supabase()
    db.table("email_accounts").upsert({
        "user_id": user_id,
        "unipile_account_id": account_id,
        "status": "active",
    }, on_conflict="user_id,unipile_account_id").execute()


async def check_gmail_connection(user_id: str) -> dict:
    """Check if the user has a connected Gmail account via Unipile.

    First checks local DB. If not found, queries Unipile for existing Google accounts
    and syncs the first one found.
    """
    db = get_supabase()
    result = db.table("email_accounts") \
        .select("unipile_account_id, email_address, status") \
        .eq("user_id", user_id) \
        .eq("status", "active") \
        .execute()

    if result.data:
        return {
            "connected": True,
            "email_address": result.data[0].get("email_address"),
        }

    # No local record — check Unipile for existing Google accounts
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/accounts",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
            accounts = data if isinstance(data, list) else data.get("items", [])
            for acct in accounts:
                acct_type = acct.get("type", "").upper()
                if acct_type in ("GOOGLE", "GMAIL"):
                    found_id = acct.get("id")
                    if found_id:
                        db.table("email_accounts").upsert({
                            "user_id": user_id,
                            "unipile_account_id": found_id,
                            "status": "active",
                        }, on_conflict="user_id,unipile_account_id").execute()
                        return {"connected": True, "email_address": None}
    except Exception:
        pass

    return {"connected": False, "email_address": None}


async def register_email_webhook() -> None:
    """Register the Unipile webhook for new email events (idempotent).

    Called on app startup. If a webhook already exists for our URL, skip creation.
    """
    webhook_url = f"{settings.BACKEND_URL}/api/webhooks/email"

    if not settings.BACKEND_URL or settings.BACKEND_URL.startswith("http://localhost"):
        logger.warning(
            "[email] BACKEND_URL is localhost — Unipile webhooks won't reach this server. "
            "Set BACKEND_URL to a public URL or use a tunnel (ngrok)."
        )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Check existing webhooks to avoid duplicates
            list_resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/webhooks",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
            )
            if list_resp.status_code == 200:
                existing = list_resp.json()
                items = existing if isinstance(existing, list) else existing.get("items", [])
                for wh in items:
                    if wh.get("request_url") == webhook_url:
                        logger.info("[email] Webhook already registered: %s", webhook_url)
                        return

            # Create new webhook
            resp = await client.post(
                f"{settings.UNIPILE_DSN}/api/v1/webhooks",
                headers={
                    "X-API-KEY": settings.UNIPILE_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "request_url": webhook_url,
                    "source": "mail",
                    "headers": [
                        {"key": "Content-Type", "value": "application/json"},
                        {"key": "Unipile-Auth", "value": settings.UNIPILE_WEBHOOK_SECRET},
                    ],
                },
            )
            resp.raise_for_status()
            logger.info("[email] Webhook registered: %s", webhook_url)
    except Exception as e:
        logger.error("[email] Failed to register email webhook: %s", e)


async def fetch_email_details(email_id: str) -> dict:
    """Fetch full email details from Unipile by email_id."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.UNIPILE_DSN}/api/v1/emails/{email_id}",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "accept": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def send_email_reply(
    account_id: str,
    reply_to_email_id: str,
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
) -> dict:
    """Send an email reply via Unipile, threading it to the original email."""
    async with httpx.AsyncClient(timeout=60) as client:
        form_fields: list[tuple[str, tuple]] = [
            ("account_id", (None, account_id)),
            ("subject", (None, subject)),
            ("body", (None, body)),
            ("to", (None, f'[{{"display_name": "{to_name}", "identifier": "{to_email}"}}]')),
            ("reply_to", (None, reply_to_email_id)),
        ]

        resp = await client.post(
            f"{settings.UNIPILE_DSN}/api/v1/emails",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "accept": "application/json",
            },
            files=form_fields,
        )
        resp.raise_for_status()
        return resp.json()


def get_user_email_account_sync(user_id: str) -> dict | None:
    """Synchronous helper to get user's email account (for Celery tasks)."""
    from supabase import create_client
    db = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    result = db.table("email_accounts") \
        .select("unipile_account_id") \
        .eq("user_id", user_id) \
        .eq("status", "active") \
        .execute()
    return result.data[0] if result.data else None


def send_email_reply_sync(
    account_id: str,
    reply_to_email_id: str,
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
) -> dict:
    """Synchronous version of send_email_reply for Celery tasks."""
    import json

    with httpx.Client(timeout=60) as client:
        form_fields: list[tuple[str, tuple]] = [
            ("account_id", (None, account_id)),
            ("subject", (None, subject)),
            ("body", (None, body)),
            ("to", (None, json.dumps([{"display_name": to_name, "identifier": to_email}]))),
            ("reply_to", (None, reply_to_email_id)),
        ]

        resp = client.post(
            f"{settings.UNIPILE_DSN}/api/v1/emails",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "accept": "application/json",
            },
            files=form_fields,
        )
        resp.raise_for_status()
        return resp.json()
