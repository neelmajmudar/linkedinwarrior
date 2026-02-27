"""Service for fetching LinkedIn analytics from Unipile and storing snapshots."""

from datetime import date

import httpx
from app.config import settings
from app.db import get_supabase


async def get_own_profile(account_id: str) -> dict | None:
    """Fetch the authenticated user's own profile from Unipile /users/me."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/me",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"[analytics] Failed to fetch own profile: {e}")
        return None


async def _get_provider_id(account_id: str) -> str | None:
    """Get the user's LinkedIn provider_id from /users/me."""
    profile = await get_own_profile(account_id)
    if not profile:
        return None
    return profile.get("provider_id")


async def fetch_follower_count(account_id: str) -> int | None:
    """Fetch the current follower count by looking up own profile via provider_id.

    The /users/me endpoint doesn't return follower_count, so we fetch the
    provider_id first, then query /users/{provider_id} which returns it.
    """
    provider_id = await _get_provider_id(account_id)
    if not provider_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/{provider_id}",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("follower_count") or data.get("connections_count")
    except Exception as e:
        print(f"[analytics] Failed to fetch follower count: {e}")
        return None


async def fetch_user_posts(account_id: str, limit: int = 20) -> list[dict]:
    """Fetch the user's own LinkedIn posts with engagement metrics from Unipile."""
    provider_id = await _get_provider_id(account_id)
    if not provider_id:
        return []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/users/{provider_id}/posts",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                params={"account_id": account_id, "limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else data.get("items", [])
    except Exception as e:
        print(f"[analytics] Failed to fetch posts: {e}")
        return []


async def take_snapshot(user_id: str) -> dict:
    """Take a full analytics snapshot: follower count + post metrics."""
    db = get_supabase()

    # Get user's Unipile account and LinkedIn identifier
    user_result = db.table("users").select(
        "unipile_account_id, linkedin_username"
    ).eq("id", user_id).execute()

    if not user_result.data:
        return {"error": "User not found"}

    account_id = user_result.data[0].get("unipile_account_id")
    linkedin_username = user_result.data[0].get("linkedin_username", "")

    if not account_id:
        return {"error": "LinkedIn not connected"}

    today = date.today().isoformat()
    result = {"snapshot_date": today}

    # Follower snapshot
    followers = await fetch_follower_count(account_id)
    if followers is not None:
        db.table("analytics_snapshots").upsert({
            "user_id": user_id,
            "followers_count": followers,
            "snapshot_date": today,
        }, on_conflict="user_id,snapshot_date").execute()
        result["followers_count"] = followers

    # Post metrics snapshot
    posts = await fetch_user_posts(account_id, limit=30)
    post_count = 0
    for post in posts:
        post_id = post.get("id", "")
        social_id = post.get("social_id", "")
        if not post_id:
            continue

        db.table("post_analytics").upsert({
            "user_id": user_id,
            "linkedin_post_id": post_id,
            "social_id": social_id,
            "post_text": (post.get("text") or "")[:500],
            "reactions": post.get("reaction_counter", 0),
            "comments": post.get("comment_counter", 0),
            "reposts": post.get("repost_counter", 0),
            "impressions": post.get("impressions_counter", 0),
            "snapshot_date": today,
        }, on_conflict="linkedin_post_id,snapshot_date").execute()
        post_count += 1

    result["posts_tracked"] = post_count

    return result


def get_follower_history(user_id: str, days: int = 30) -> list[dict]:
    """Get follower count history for the past N days."""
    db = get_supabase()
    result = db.table("analytics_snapshots") \
        .select("followers_count, snapshot_date") \
        .eq("user_id", user_id) \
        .order("snapshot_date", desc=False) \
        .limit(days) \
        .execute()
    return result.data or []


def get_post_performance_count(user_id: str) -> int:
    """Return the count of distinct posts with analytics for a user."""
    db = get_supabase()
    result = db.table("post_analytics") \
        .select("linkedin_post_id") \
        .eq("user_id", user_id) \
        .execute()
    seen = set()
    for row in result.data or []:
        pid = row.get("linkedin_post_id")
        if pid:
            seen.add(pid)
    return len(seen)


def get_post_performance(user_id: str, limit: int = 20, offset: int = 0) -> list[dict]:
    """Get the latest post performance metrics with pagination."""
    db = get_supabase()

    # Fetch enough rows to deduplicate and satisfy the page window.
    # We over-fetch relative to the farthest row we might need.
    fetch_limit = (offset + limit) * 2
    result = db.table("post_analytics") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("snapshot_date", desc=True) \
        .limit(fetch_limit) \
        .execute()

    # Deduplicate by linkedin_post_id (keep latest snapshot)
    seen = set()
    unique = []
    for row in result.data or []:
        pid = row.get("linkedin_post_id")
        if pid and pid not in seen:
            seen.add(pid)
            unique.append(row)

    return unique[offset: offset + limit]


def get_metric_trends(user_id: str, days: int = 30) -> list[dict]:
    """Get daily aggregated metric trends from post_analytics snapshots."""
    db = get_supabase()
    result = db.table("post_analytics") \
        .select("snapshot_date, reactions, comments, reposts, impressions") \
        .eq("user_id", user_id) \
        .order("snapshot_date", desc=False) \
        .execute()

    # Aggregate by snapshot_date
    daily: dict[str, dict] = {}
    for row in result.data or []:
        d = row.get("snapshot_date", "")
        if not d:
            continue
        if d not in daily:
            daily[d] = {"date": d, "impressions": 0, "reactions": 0, "comments": 0, "reposts": 0, "post_count": 0}
        daily[d]["impressions"] += row.get("impressions", 0)
        daily[d]["reactions"] += row.get("reactions", 0)
        daily[d]["comments"] += row.get("comments", 0)
        daily[d]["reposts"] += row.get("reposts", 0)
        daily[d]["post_count"] += 1

    # Calculate engagement rate per day
    sorted_days = sorted(daily.values(), key=lambda x: x["date"])
    for day in sorted_days:
        total_eng = day["reactions"] + day["comments"] + day["reposts"]
        day["engagement_rate"] = round(total_eng / day["impressions"] * 100, 2) if day["impressions"] > 0 else 0.0

    return sorted_days[-days:]


def get_engagement_summary(user_id: str) -> dict:
    """Calculate engagement summary from stored post analytics."""
    posts = get_post_performance(user_id, limit=50)

    if not posts:
        return {
            "total_posts": 0,
            "total_reactions": 0,
            "total_comments": 0,
            "total_reposts": 0,
            "total_impressions": 0,
            "avg_engagement_rate": 0.0,
        }

    total_reactions = sum(p.get("reactions", 0) for p in posts)
    total_comments = sum(p.get("comments", 0) for p in posts)
    total_reposts = sum(p.get("reposts", 0) for p in posts)
    total_impressions = sum(p.get("impressions", 0) for p in posts)

    engagement_rate = 0.0
    if total_impressions > 0:
        engagement_rate = (total_reactions + total_comments + total_reposts) / total_impressions * 100

    return {
        "total_posts": len(posts),
        "total_reactions": total_reactions,
        "total_comments": total_comments,
        "total_reposts": total_reposts,
        "total_impressions": total_impressions,
        "avg_engagement_rate": round(engagement_rate, 2),
    }
