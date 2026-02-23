from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db import get_supabase
from app.services.unipile import publish_post

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


def start_scheduler():
    """Start the APScheduler with a 1-minute interval job."""
    scheduler.add_job(fire_scheduled_posts, "interval", minutes=1, id="fire_scheduled_posts", replace_existing=True)
    scheduler.start()


def stop_scheduler():
    """Shut down the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
