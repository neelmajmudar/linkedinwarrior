from datetime import datetime, timezone

import httpx
from app.config import settings
from app.db import get_supabase


async def scrape_linkedin_posts(user_id: str, linkedin_username: str, max_posts: int = 200) -> int:
    """Run the Apify LinkedIn Profile Posts actor and store results in Supabase.

    Returns the number of posts scraped.
    """
    db = get_supabase()

    # Mark scrape as running
    db.table("users").update({"scrape_status": "running"}).eq("id", user_id).execute()

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0)) as client:
            resp = await client.post(
                "https://api.apify.com/v2/acts/harvestapi~linkedin-post-search/run-sync-get-dataset-items",
                params={"token": settings.APIFY_API_TOKEN},
                json={
                    "searchQueries": ["*"],
                    "targetUrls": [f"https://www.linkedin.com/in/{linkedin_username}"],
                    "maxPosts": max_posts,
                    "scrapeReactions": False,
                    "scrapeComments": False,
                },
            )
            if resp.status_code >= 400:
                print(f"[scraper] Apify error {resp.status_code}: {resp.text[:500]}")
            resp.raise_for_status()
            posts = resp.json()
            print(f"[scraper] Apify returned {len(posts)} posts for {linkedin_username}")

        # Delete old scraped posts for this user (fresh scrape)
        db.table("scraped_posts").delete().eq("user_id", user_id).execute()

        # Insert new posts
        rows = []
        for post in posts:
            content = post.get("content", "")
            if not content or not content.strip():
                continue
            rows.append({
                "id": str(post.get("id", "")),
                "user_id": user_id,
                "content": content,
                "posted_at": post.get("postedAt", {}).get("date"),
                "engagement": post.get("engagement"),
                "linkedin_url": post.get("linkedinUrl"),
                "raw_json": post,
            })

        if rows:
            db.table("scraped_posts").upsert(rows, on_conflict="id").execute()

        # Update user status
        db.table("users").update({
            "scrape_status": "done",
            "last_scraped_at": datetime.now(timezone.utc).isoformat(),
            "linkedin_username": linkedin_username,
        }).eq("id", user_id).execute()

        return len(rows)

    except Exception as e:
        db.table("users").update({
            "scrape_status": "error",
        }).eq("id", user_id).execute()
        raise e
