from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db import get_supabase
from app.services.unipile import publish_post
from app.services.analytics import take_snapshot

scheduler = AsyncIOScheduler()


async def fire_scheduled_posts():
    """Check for posts due to be published and publish them via Unipile."""
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Find all scheduled posts that are due
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


async def daily_analytics_snapshot():
    """Take an analytics snapshot for all users with connected LinkedIn accounts."""
    db = get_supabase()
    result = db.table("users").select("id").neq("unipile_account_id", None).execute()
    users = result.data or []
    for user in users:
        try:
            await take_snapshot(user["id"])
            print(f"[scheduler] Analytics snapshot taken for user {user['id']}")
        except Exception as e:
            print(f"[scheduler] Analytics snapshot failed for user {user['id']}: {e}")


def start_scheduler():
    """Start the APScheduler with scheduled jobs."""
    scheduler.add_job(fire_scheduled_posts, "interval", minutes=1, id="fire_scheduled_posts", replace_existing=True)
    scheduler.add_job(daily_analytics_snapshot, "cron", hour=6, minute=0, id="daily_analytics_snapshot", replace_existing=True)
    scheduler.start()


def stop_scheduler():
    """Shut down the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
