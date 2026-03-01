"""Celery task definitions for the scalable scheduling system.

All tasks are synchronous (Celery workers run in their own process pool)
and use httpx synchronously where needed. Each task is idempotent and
safe to retry.
"""

import logging
from datetime import datetime, timezone, timedelta

import httpx
from celery import shared_task
from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_db() -> Client:
    """Create a fresh Supabase client per-task (process-safe)."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def _publish_via_unipile(account_id: str, post_text: str,
                          image_url: str | None = None) -> str:
    """Synchronous Unipile publish — called inside Celery worker processes.

    Unipile's POST /api/v1/posts requires multipart/form-data.
    Fields are sent via the ``files`` parameter as (None, value) tuples
    for plain text fields, and (filename, bytes, content_type) for attachments.
    """
    with httpx.Client(timeout=60) as client:
        # Base multipart fields
        form_fields: list[tuple[str, tuple]] = [
            ("account_id", (None, account_id)),
            ("text", (None, post_text)),
        ]

        # If image, download it first then attach
        if image_url:
            try:
                img_resp = client.get(image_url, timeout=15)
                img_resp.raise_for_status()
                image_bytes = img_resp.content
                ct = img_resp.headers.get("content-type", "image/jpeg")
                ext = ct.split("/")[-1].split(";")[0]
                form_fields.append(
                    ("attachments", (f"post_image.{ext}", image_bytes, ct))
                )
            except Exception as img_err:
                logger.warning("Image download failed, publishing without image: %s", img_err)

        resp = client.post(
            f"{settings.UNIPILE_DSN}/api/v1/posts",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "accept": "application/json",
            },
            files=form_fields,
        )
        if resp.status_code >= 400:
            logger.error("[unipile] %s %s — body: %s", resp.status_code, resp.reason_phrase, resp.text[:500])
        resp.raise_for_status()
        data = resp.json()
        return data.get("post_id", data.get("id", ""))


# ---------------------------------------------------------------------------
# Task: Publish a single scheduled post
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name="app.tasks.publish_post_task",
    max_retries=3,
    default_retry_delay=60,
    rate_limit="30/m",  # max 30 publishes per minute per worker
    acks_late=True,
)
def publish_post_task(self, post_id: str, user_id: str, body: str,
                      image_url: str | None = None):
    """Publish a single post to LinkedIn via Unipile.

    On failure the task retries with exponential backoff (60s, 120s, 240s).
    The post status is updated in Supabase regardless of outcome.
    """
    db = _get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Mark as publishing (prevents double-enqueue)
    # On first attempt, transition from 'scheduled' to 'publishing'.
    # On retries, the post is already 'publishing' — skip the update.
    if self.request.retries == 0:
        db.table("content_items").update({
            "status": "publishing",
            "updated_at": now_iso,
        }).eq("id", post_id).eq("status", "scheduled").execute()

    try:
        # Resolve the user's Unipile account
        user_result = db.table("users") \
            .select("unipile_account_id") \
            .eq("id", user_id).single().execute()
        account_id = user_result.data.get("unipile_account_id")
        if not account_id:
            raise ValueError(f"User {user_id} has no connected LinkedIn account")

        linkedin_post_id = _publish_via_unipile(account_id, body, image_url)

        db.table("content_items").update({
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "linkedin_post_id": linkedin_post_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", post_id).execute()

        logger.info("[task] Published post %s for user %s", post_id, user_id)
        return {"post_id": post_id, "linkedin_post_id": linkedin_post_id}

    except Exception as exc:
        logger.error("[task] Failed to publish post %s: %s", post_id, exc)

        if self.request.retries >= self.max_retries:
            # Final failure — mark as failed
            db.table("content_items").update({
                "status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", post_id).execute()
            raise

        # Keep status as 'publishing' — Celery's own retry mechanism
        # will re-run this task. We do NOT revert to 'scheduled' because
        # that would cause enqueue_due_posts to create a duplicate task,
        # resetting the retry counter and creating an infinite loop.

        # Exponential backoff: 60s, 120s, 240s
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


# ---------------------------------------------------------------------------
# Task: Enqueue posts due in the next scheduling window
# ---------------------------------------------------------------------------

@shared_task(name="app.tasks.enqueue_due_posts")
def enqueue_due_posts():
    """Periodic task (every 2 min): find scheduled posts due in the next
    3-minute window and fan them out as individual publish tasks.

    The 3-min window with 2-min interval creates a 1-min overlap to ensure
    no posts slip through the cracks.
    """
    db = _get_db()
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(minutes=3)

    result = db.table("content_items") \
        .select("id, user_id, body, image_url, scheduled_at") \
        .eq("status", "scheduled") \
        .lte("scheduled_at", window_end.isoformat()) \
        .execute()

    posts = result.data or []
    enqueued = 0

    for post in posts:
        scheduled_at = post.get("scheduled_at")
        if scheduled_at:
            # Parse the scheduled time and calculate exact delay
            try:
                sched_dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
                delay = max(0, (sched_dt - now).total_seconds())
            except (ValueError, TypeError):
                delay = 0
        else:
            delay = 0

        publish_post_task.apply_async(
            args=[post["id"], post["user_id"], post["body"]],
            kwargs={"image_url": post.get("image_url")},
            countdown=delay,
            task_id=f"publish-{post['id']}",  # dedup: same ID won't enqueue twice
        )
        enqueued += 1

    if enqueued:
        logger.info("[beat] Enqueued %d posts for publishing", enqueued)

    return {"enqueued": enqueued}


# ---------------------------------------------------------------------------
# Task: Daily analytics snapshot
# ---------------------------------------------------------------------------

def _fetch_provider_id(account_id: str) -> str | None:
    """Get LinkedIn provider_id from Unipile /users/me."""
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/me",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            return resp.json().get("provider_id")
    except Exception as e:
        logger.warning("Failed to fetch provider_id for %s: %s", account_id, e)
        return None


def _fetch_follower_count(account_id: str, provider_id: str) -> int | None:
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/{provider_id}",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("follower_count") or data.get("connections_count")
    except Exception as e:
        logger.warning("Failed to fetch follower count: %s", e)
        return None


def _fetch_user_posts(account_id: str, provider_id: str, limit: int = 30) -> list[dict]:
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/{provider_id}/posts",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id, "limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else data.get("items", [])
    except Exception as e:
        logger.warning("Failed to fetch user posts: %s", e)
        return []


@shared_task(
    bind=True,
    name="app.tasks.analytics_snapshot_task",
    max_retries=2,
    default_retry_delay=120,
    rate_limit="10/m",
)
def analytics_snapshot_task(self, user_id: str):
    """Take an analytics snapshot for a single user."""
    from datetime import date

    db = _get_db()
    user_result = db.table("users").select(
        "unipile_account_id, linkedin_username"
    ).eq("id", user_id).execute()

    if not user_result.data:
        return {"error": "User not found"}

    account_id = user_result.data[0].get("unipile_account_id")
    if not account_id:
        return {"error": "LinkedIn not connected"}

    provider_id = _fetch_provider_id(account_id)
    if not provider_id:
        return {"error": "Could not resolve provider_id"}

    today = date.today().isoformat()

    # Follower snapshot
    followers = _fetch_follower_count(account_id, provider_id)
    if followers is not None:
        db.table("analytics_snapshots").upsert({
            "user_id": user_id,
            "followers_count": followers,
            "snapshot_date": today,
        }, on_conflict="user_id,snapshot_date").execute()

    # Post metrics
    posts = _fetch_user_posts(account_id, provider_id)
    post_count = 0
    for post in posts:
        pid = post.get("id", "")
        if not pid:
            continue
        db.table("post_analytics").upsert({
            "user_id": user_id,
            "linkedin_post_id": pid,
            "social_id": post.get("social_id", ""),
            "post_text": (post.get("text") or "")[:500],
            "reactions": post.get("reaction_counter", 0),
            "comments": post.get("comment_counter", 0),
            "reposts": post.get("repost_counter", 0),
            "impressions": post.get("impressions_counter", 0),
            "snapshot_date": today,
        }, on_conflict="linkedin_post_id,snapshot_date").execute()
        post_count += 1

    logger.info("[task] Analytics snapshot for user %s: %d posts", user_id, post_count)
    return {"user_id": user_id, "followers": followers, "posts_tracked": post_count}


@shared_task(name="app.tasks.daily_analytics_snapshot")
def daily_analytics_snapshot():
    """Fan-out analytics snapshots: enqueue one task per connected user."""
    db = _get_db()
    result = db.table("users").select("id").neq("unipile_account_id", None).execute()
    users = result.data or []

    for user in users:
        analytics_snapshot_task.delay(user["id"])

    logger.info("[beat] Enqueued analytics snapshots for %d users", len(users))
    return {"users_enqueued": len(users)}


# ---------------------------------------------------------------------------
# Task: Purge old history
# ---------------------------------------------------------------------------

@shared_task(name="app.tasks.purge_old_history")
def purge_old_history():
    """Delete engagement comments and research reports older than 7 days."""
    db = _get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    try:
        db.table("auto_comments") \
            .delete() \
            .lt("created_at", cutoff) \
            .neq("status", "pending") \
            .execute()
        logger.info("[task] Purged old auto_comments before %s", cutoff)
    except Exception as e:
        logger.error("[task] Failed to purge auto_comments: %s", e)

    try:
        db.table("creator_reports") \
            .delete() \
            .lt("created_at", cutoff) \
            .execute()
        logger.info("[task] Purged old creator_reports before %s", cutoff)
    except Exception as e:
        logger.error("[task] Failed to purge creator_reports: %s", e)

    return {"cutoff": cutoff}


# ---------------------------------------------------------------------------
# Task: Purge expired emails (older than 48 hours)
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name="app.tasks.purge_expired_emails",
    max_retries=1,
    default_retry_delay=60,
)
def purge_expired_emails(self):
    """Delete emails (and cascade to drafts) whose expires_at has passed."""
    db = _get_db()
    now = datetime.now(timezone.utc).isoformat()

    try:
        result = db.table("emails") \
            .delete() \
            .lt("expires_at", now) \
            .execute()
        count = len(result.data) if result.data else 0
        logger.info("[task] Purged %d expired emails (before %s)", count, now)
        return {"purged": count, "cutoff": now}
    except Exception as e:
        logger.error("[task] Failed to purge expired emails: %s", e)
        raise self.retry(exc=e)


# ---------------------------------------------------------------------------
# Task: Process an incoming email through the AI agent
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name="app.tasks.process_email_task",
    max_retries=3,
    default_retry_delay=30,
    rate_limit="20/m",
    acks_late=True,
)
def process_email_task(self, email_id: str, user_id: str,
                       subject: str, body: str, from_name: str, from_email: str):
    """Process an incoming email: classify, extract action items, generate reply draft.

    Runs the LangGraph email_responder agent synchronously via asyncio.
    On failure, retries with exponential backoff (30s, 60s, 120s).
    """
    import asyncio

    db = _get_db()

    # Mark as processing
    db.table("emails").update({
        "status": "processing",
    }).eq("id", email_id).execute()

    try:
        from app.agents.email_responder import process_email

        result = asyncio.run(process_email(
            user_id=user_id,
            email_id=email_id,
            email_subject=subject,
            email_body=body,
            from_name=from_name,
            from_email=from_email,
        ))

        logger.info(
            "[task] Processed email %s for user %s — category: %s",
            email_id, user_id, result.get("category"),
        )

        # Check if auto-send is enabled for this category
        if not result.get("should_skip", False):
            _maybe_auto_send(db, email_id, user_id, result.get("category", ""))

        return {"email_id": email_id, "category": result.get("category")}

    except Exception as exc:
        logger.error("[task] Failed to process email %s: %s", email_id, exc)

        if self.request.retries >= self.max_retries:
            db.table("emails").update({
                "status": "new",
            }).eq("id", email_id).execute()
            raise

        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))


def _maybe_auto_send(db: Client, email_id: str, user_id: str, category: str):
    """If the user has auto-send enabled for this category, send the reply."""
    user_result = db.table("users") \
        .select("email_auto_send_categories") \
        .eq("id", user_id).execute()

    if not user_result.data:
        return

    auto_categories = user_result.data[0].get("email_auto_send_categories") or []
    if category not in auto_categories:
        return

    # Get the draft
    draft_result = db.table("email_drafts") \
        .select("id, subject, body") \
        .eq("email_id", email_id) \
        .eq("user_id", user_id) \
        .eq("status", "draft") \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if not draft_result.data:
        return

    draft = draft_result.data[0]

    # Get email details
    email_result = db.table("emails") \
        .select("unipile_email_id, from_name, from_email, email_account_id") \
        .eq("id", email_id).execute()

    if not email_result.data:
        return

    email_data = email_result.data[0]

    acct_result = db.table("email_accounts") \
        .select("unipile_account_id") \
        .eq("id", email_data["email_account_id"]).execute()

    if not acct_result.data:
        return

    account_id = acct_result.data[0]["unipile_account_id"]

    try:
        from app.services.email_service import send_email_reply_sync

        send_email_reply_sync(
            account_id=account_id,
            reply_to_email_id=email_data["unipile_email_id"],
            to_email=email_data["from_email"],
            to_name=email_data.get("from_name") or "",
            subject=draft["subject"],
            body=draft["body"],
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        db.table("email_drafts").update({
            "status": "sent",
            "updated_at": now_iso,
        }).eq("id", draft["id"]).execute()

        db.table("emails").update({
            "status": "replied",
        }).eq("id", email_id).execute()

        logger.info("[task] Auto-sent reply for email %s (category: %s)", email_id, category)
    except Exception as e:
        logger.error("[task] Auto-send failed for email %s: %s", email_id, e)
