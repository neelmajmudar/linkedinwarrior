"""API routes for Gmail email assistant feature.

Handles account connection, inbox listing, draft management, and sending replies.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.auth import get_current_user
from app.db import get_supabase
from app.services.email_service import (
    get_gmail_auth_url,
    handle_gmail_callback,
    check_gmail_connection,
    send_email_reply,
)

router = APIRouter(prefix="/api/email", tags=["email"])


# ── Connection management ──


@router.post("/connect")
async def connect_gmail(user: dict = Depends(get_current_user)):
    """Get a Unipile hosted auth URL to connect the user's Gmail account."""
    try:
        url = await get_gmail_auth_url(user["id"])
        return {"auth_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get Gmail auth URL: {e}")


@router.post("/callback")
async def gmail_callback(request: Request, user: dict = Depends(get_current_user)):
    """Handle the Unipile auth callback with the account_id (from frontend)."""
    body = await request.json()
    account_id = body.get("account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Missing account_id in callback")

    await handle_gmail_callback(user["id"], account_id)
    return {"status": "connected", "account_id": account_id}


@router.post("/callback/webhook")
async def gmail_callback_webhook(request: Request):
    """Handle the Unipile hosted auth notify_url callback (server-to-server).

    Unipile sends: {"status": "CREATION_SUCCESS", "account_id": "...", "name": "user_id"}
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    status = body.get("status", "")
    account_id = body.get("account_id", "")
    user_id = body.get("name", "")

    if status == "CREATION_SUCCESS" and account_id and user_id:
        await handle_gmail_callback(user_id, account_id)
        return {"status": "ok"}

    return {"status": "ignored"}


@router.get("/status")
async def gmail_status(user: dict = Depends(get_current_user)):
    """Check if the user has a connected Gmail account."""
    result = await check_gmail_connection(user["id"])
    return result


# ── Inbox ──


@router.get("/inbox")
async def list_emails(
    user: dict = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
):
    """List processed emails with classification, filterable by category/status/priority."""
    db = get_supabase()
    query = db.table("emails") \
        .select("id, from_name, from_email, to_email, subject, category, action_items, priority, status, auto_reply_eligible, has_attachments, received_at, created_at", count="exact") \
        .eq("user_id", user["id"]) \
        .order("received_at", desc=True)

    if category:
        query = query.eq("category", category)
    if status:
        query = query.eq("status", status)
    if priority:
        query = query.eq("priority", priority)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    result = query.execute()

    total = result.count if result.count is not None else len(result.data or [])

    return {
        "items": result.data or [],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": total > page * page_size,
    }


@router.get("/{email_id}")
async def get_email_detail(email_id: str, user: dict = Depends(get_current_user)):
    """Get a single email with its draft reply."""
    db = get_supabase()

    # Get the email
    email_result = db.table("emails") \
        .select("*") \
        .eq("id", email_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not email_result.data:
        raise HTTPException(status_code=404, detail="Email not found")

    email_data = email_result.data[0]

    # Get the draft reply (if any)
    draft_result = db.table("email_drafts") \
        .select("*") \
        .eq("email_id", email_id) \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    email_data["draft"] = draft_result.data[0] if draft_result.data else None

    return email_data


# ── Draft management ──


@router.patch("/{email_id}/draft")
async def update_draft(email_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Edit the draft reply for an email."""
    body = await request.json()
    new_body = body.get("body")
    new_subject = body.get("subject")

    if not new_body and not new_subject:
        raise HTTPException(status_code=400, detail="Provide body or subject to update")

    db = get_supabase()

    # Verify email belongs to user
    email_check = db.table("emails").select("id").eq("id", email_id).eq("user_id", user["id"]).execute()
    if not email_check.data:
        raise HTTPException(status_code=404, detail="Email not found")

    # Get existing draft
    draft_result = db.table("email_drafts") \
        .select("id") \
        .eq("email_id", email_id) \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if new_body:
        update_data["body"] = new_body
    if new_subject:
        update_data["subject"] = new_subject

    if draft_result.data:
        db.table("email_drafts").update(update_data).eq("id", draft_result.data[0]["id"]).execute()
        return {"status": "updated"}
    else:
        # Create a new draft if none exists
        db.table("email_drafts").insert({
            "user_id": user["id"],
            "email_id": email_id,
            "subject": new_subject or "",
            "body": new_body or "",
            "status": "draft",
        }).execute()
        return {"status": "created"}


@router.post("/{email_id}/send")
async def send_reply(email_id: str, user: dict = Depends(get_current_user)):
    """Send the approved draft reply via Unipile."""
    db = get_supabase()

    # Get the email
    email_result = db.table("emails") \
        .select("unipile_email_id, from_name, from_email, email_account_id") \
        .eq("id", email_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not email_result.data:
        raise HTTPException(status_code=404, detail="Email not found")

    email_data = email_result.data[0]

    # Get the draft
    draft_result = db.table("email_drafts") \
        .select("id, subject, body") \
        .eq("email_id", email_id) \
        .eq("user_id", user["id"]) \
        .eq("status", "draft") \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if not draft_result.data:
        raise HTTPException(status_code=404, detail="No draft found for this email")

    draft = draft_result.data[0]

    # Get the Unipile account_id
    acct_result = db.table("email_accounts") \
        .select("unipile_account_id") \
        .eq("id", email_data["email_account_id"]) \
        .execute()

    if not acct_result.data:
        raise HTTPException(status_code=400, detail="Gmail account not found")

    account_id = acct_result.data[0]["unipile_account_id"]

    try:
        await send_email_reply(
            account_id=account_id,
            reply_to_email_id=email_data["unipile_email_id"],
            to_email=email_data["from_email"],
            to_name=email_data["from_name"] or "",
            subject=draft["subject"],
            body=draft["body"],
        )

        # Update draft and email status
        now_iso = datetime.now(timezone.utc).isoformat()
        db.table("email_drafts").update({
            "status": "sent",
            "updated_at": now_iso,
        }).eq("id", draft["id"]).execute()

        db.table("emails").update({
            "status": "replied",
        }).eq("id", email_id).execute()

        return {"status": "sent"}
    except Exception as e:
        db.table("email_drafts").update({"status": "failed"}).eq("id", draft["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Failed to send reply: {e}")


@router.post("/{email_id}/reprocess")
async def reprocess_email(email_id: str, user: dict = Depends(get_current_user)):
    """Re-generate the draft for an email by re-running the AI agent."""
    db = get_supabase()

    email_result = db.table("emails") \
        .select("id, subject, body_text, from_name, from_email") \
        .eq("id", email_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not email_result.data:
        raise HTTPException(status_code=404, detail="Email not found")

    email_data = email_result.data[0]

    # Delete existing drafts
    db.table("email_drafts").delete().eq("email_id", email_id).eq("user_id", user["id"]).execute()

    # Mark email as processing
    db.table("emails").update({"status": "processing"}).eq("id", email_id).execute()

    # Enqueue reprocessing
    try:
        from app.tasks import process_email_task
        process_email_task.delay(
            email_id,
            user["id"],
            email_data["subject"] or "",
            email_data["body_text"] or "",
            email_data["from_name"] or "",
            email_data["from_email"] or "",
        )
        return {"status": "reprocessing"}
    except Exception:
        # Fallback: process inline
        from app.agents.email_responder import process_email
        await process_email(
            user_id=user["id"],
            email_id=email_id,
            email_subject=email_data["subject"] or "",
            email_body=email_data["body_text"] or "",
            from_name=email_data["from_name"] or "",
            from_email=email_data["from_email"] or "",
        )
        return {"status": "reprocessed"}


@router.post("/reprocess-all")
async def reprocess_all_new_emails(user: dict = Depends(get_current_user)):
    """Process all emails stuck in 'new' status, stripping HTML before passing to the AI."""
    import re
    from html.parser import HTMLParser

    class _Stripper(HTMLParser):
        _block = {"p","div","br","li","tr","h1","h2","h3","h4","h5","h6","blockquote"}
        def __init__(self):
            super().__init__()
            self._parts: list[str] = []
        def handle_starttag(self, tag, attrs):
            if tag in self._block:
                self._parts.append("\n")
        def handle_data(self, data):
            self._parts.append(data)
        def get_text(self):
            return re.sub(r"\n{3,}", "\n\n", "".join(self._parts)).strip()

    def strip_html(html: str) -> str:
        if not html or "<" not in html:
            return (html or "").strip()
        s = _Stripper()
        try:
            s.feed(html)
            return s.get_text()
        except Exception:
            return re.sub(r"<[^>]+>", " ", html).strip()

    db = get_supabase()
    emails_result = db.table("emails") \
        .select("id, subject, body_text, from_name, from_email") \
        .eq("user_id", user["id"]) \
        .eq("status", "new") \
        .execute()

    if not emails_result.data:
        return {"processed": 0, "message": "No unprocessed emails found"}

    from app.agents.email_responder import process_email

    processed = 0
    errors = 0
    for email_data in emails_result.data:
        try:
            clean_body = strip_html(email_data["body_text"] or "")
            # Persist the cleaned body back to DB
            db.table("emails").update({
                "status": "processing",
                "body_text": clean_body,
            }).eq("id", email_data["id"]).execute()

            await process_email(
                user_id=user["id"],
                email_id=email_data["id"],
                email_subject=email_data["subject"] or "",
                email_body=clean_body,
                from_name=email_data["from_name"] or "",
                from_email=email_data["from_email"] or "",
            )
            processed += 1
        except Exception as e:
            errors += 1
            db.table("emails").update({"status": "new"}).eq("id", email_data["id"]).execute()
            import logging
            logging.getLogger(__name__).error("Reprocess failed for %s: %s", email_data["id"], e)

    return {"processed": processed, "errors": errors, "total": len(emails_result.data)}


# ── Auto-send preferences ──


@router.get("/preferences/auto-send")
async def get_auto_send_preferences(user: dict = Depends(get_current_user)):
    """Get the user's auto-send category preferences."""
    db = get_supabase()
    result = db.table("users").select("email_auto_send_categories").eq("id", user["id"]).execute()
    categories = []
    if result.data:
        categories = result.data[0].get("email_auto_send_categories") or []
    return {"auto_send_categories": categories}


@router.post("/preferences/auto-send")
async def set_auto_send_preferences(request: Request, user: dict = Depends(get_current_user)):
    """Set which email categories should be auto-sent after AI draft generation."""
    body = await request.json()
    categories = body.get("categories", [])

    # Validate categories
    valid = {"meeting_request", "follow_up", "introduction", "question", "personal", "other"}
    invalid = set(categories) - valid
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid categories: {invalid}")

    db = get_supabase()
    db.table("users").update({
        "email_auto_send_categories": categories,
    }).eq("id", user["id"]).execute()

    return {"auto_send_categories": categories}
