"""Scheduler module — dual-mode support for APScheduler (legacy) and Celery (scalable).

When REDIS_URL is configured and reachable, tasks are delegated to Celery workers
via the distributed task queue. Otherwise, the system falls back to the original
in-process APScheduler for local development / single-server deployments.

Production:
  - Run Celery worker + beat separately (see celery_app.py docstring).
  - The FastAPI process only enqueues tasks; it does NOT run the scheduler.

Development / fallback:
  - APScheduler runs inside the FastAPI process as before.
"""

import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Detect whether Celery + Redis is available
# ---------------------------------------------------------------------------

_USE_CELERY: bool = False


def _redis_available() -> bool:
    """Quick connectivity check (non-blocking)."""
    try:
        import redis as _redis
        from app.config import settings
        r = _redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        return True
    except Exception:
        return False


def _init_mode() -> bool:
    global _USE_CELERY
    _USE_CELERY = _redis_available()
    if _USE_CELERY:
        logger.info("[scheduler] Redis detected — using Celery distributed task queue")
    else:
        logger.info("[scheduler] Redis not available — falling back to APScheduler")
    return _USE_CELERY


# ---------------------------------------------------------------------------
# APScheduler fallback (original implementation, kept for dev convenience)
# ---------------------------------------------------------------------------

_apscheduler = None


async def _fire_scheduled_posts_legacy():
    """Check for posts due to be published and publish them via Unipile."""
    from app.db import get_supabase
    from app.services.unipile import publish_post

    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    result = db.table("content_items") \
        .select("id, user_id, body") \
        .eq("status", "scheduled") \
        .lte("scheduled_at", now) \
        .execute()

    posts = result.data or []
    for post in posts:
        try:
            linkedin_post_id = await publish_post(post["user_id"], post["body"])
            db.table("content_items").update({
                "status": "published",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "linkedin_post_id": linkedin_post_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", post["id"]).execute()
            print(f"[scheduler] Published post {post['id']}")
        except Exception as e:
            db.table("content_items").update({
                "status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", post["id"]).execute()
            print(f"[scheduler] Failed to publish post {post['id']}: {e}")


async def _daily_analytics_snapshot_legacy():
    """Take an analytics snapshot for all users with connected LinkedIn accounts."""
    from app.db import get_supabase
    from app.services.analytics import take_snapshot

    db = get_supabase()
    result = db.table("users").select("id").neq("unipile_account_id", None).execute()
    users = result.data or []
    for user in users:
        try:
            await take_snapshot(user["id"])
            print(f"[scheduler] Analytics snapshot taken for user {user['id']}")
        except Exception as e:
            print(f"[scheduler] Analytics snapshot failed for user {user['id']}: {e}")


async def _purge_old_history_legacy():
    """Delete engagement comments and research reports older than 7 days to control storage costs."""
    from app.db import get_supabase

    db = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    try:
        db.table("auto_comments") \
            .delete() \
            .lt("created_at", cutoff) \
            .neq("status", "pending") \
            .execute()
        print(f"[scheduler] Purged old auto_comments before {cutoff}")
    except Exception as e:
        print(f"[scheduler] Failed to purge auto_comments: {e}")

    try:
        db.table("creator_reports") \
            .delete() \
            .lt("created_at", cutoff) \
            .execute()
        print(f"[scheduler] Purged old creator_reports before {cutoff}")
    except Exception as e:
        print(f"[scheduler] Failed to purge creator_reports: {e}")


async def _purge_expired_emails_legacy():
    """Delete emails (and cascade to drafts) whose 48-hour expiration has passed."""
    from app.db import get_supabase

    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    try:
        result = db.table("emails") \
            .delete() \
            .lt("expires_at", now) \
            .execute()
        count = len(result.data) if result.data else 0
        if count:
            print(f"[scheduler] Purged {count} expired emails (before {now})")
    except Exception as e:
        print(f"[scheduler] Failed to purge expired emails: {e}")


def _start_apscheduler():
    global _apscheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    _apscheduler = AsyncIOScheduler()
    _apscheduler.add_job(_fire_scheduled_posts_legacy, "interval", minutes=1,
                         id="fire_scheduled_posts", replace_existing=True)
    _apscheduler.add_job(_daily_analytics_snapshot_legacy, "cron", hour=6, minute=0,
                         id="daily_analytics_snapshot", replace_existing=True)
    _apscheduler.add_job(_purge_old_history_legacy, "interval", hours=6,
                         id="purge_old_history", replace_existing=True)
    _apscheduler.add_job(_purge_expired_emails_legacy, "interval", hours=1,
                         id="purge_expired_emails", replace_existing=True)
    _apscheduler.start()


def _stop_apscheduler():
    global _apscheduler
    if _apscheduler and _apscheduler.running:
        _apscheduler.shutdown(wait=False)
        _apscheduler = None


# ---------------------------------------------------------------------------
# Public API (called from main.py lifespan)
# ---------------------------------------------------------------------------

def start_scheduler():
    """Start the appropriate scheduler based on Redis availability."""
    if _init_mode():
        # Celery Beat + workers handle everything externally.
        # Nothing to start inside FastAPI — just log confirmation.
        logger.info("[scheduler] Celery mode active. Ensure worker & beat are running.")
    else:
        _start_apscheduler()


def stop_scheduler():
    """Shut down the scheduler gracefully."""
    if not _USE_CELERY:
        _stop_apscheduler()
