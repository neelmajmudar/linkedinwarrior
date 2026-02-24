"""Service for discovering LinkedIn posts and posting comments via Unipile."""

from datetime import datetime, timezone, date

import httpx
from app.config import settings
from app.db import get_supabase

DAILY_COMMENT_LIMIT = 15


async def search_linkedin_posts(account_id: str, keywords: list[str], limit: int = 10) -> list[dict]:
    """Search LinkedIn for posts matching keywords via Unipile."""
    async with httpx.AsyncClient(timeout=30) as client:
        all_posts = []
        for keyword in keywords:
            resp = await client.post(
                f"{settings.UNIPILE_DSN}/api/v1/linkedin/search",
                headers={
                    "X-API-KEY": settings.UNIPILE_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "api": "classic",
                    "category": "posts",
                    "keywords": keyword,
                },
                params={"account_id": account_id},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data if isinstance(data, list) else data.get("items", [])
            all_posts.extend(items)

        # Deduplicate by post id
        seen = set()
        unique = []
        for post in all_posts:
            pid = post.get("id") or post.get("social_id", "")
            if pid and pid not in seen:
                seen.add(pid)
                unique.append(post)

        return unique[:limit]


async def get_post_details(account_id: str, post_id: str) -> dict:
    """Retrieve full post details including social_id from Unipile."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.UNIPILE_DSN}/api/v1/posts/{post_id}",
            headers={"X-API-KEY": settings.UNIPILE_API_KEY},
            params={"account_id": account_id},
        )
        resp.raise_for_status()
        return resp.json()


async def post_comment(account_id: str, social_id: str, text: str) -> dict:
    """Post a comment on a LinkedIn post via Unipile."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.UNIPILE_DSN}/api/v1/posts/{social_id}/comments",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "account_id": account_id,
                "text": text,
            },
        )
        resp.raise_for_status()
        return resp.json()


def get_daily_comment_count(user_id: str) -> int:
    """Get how many comments the user has posted today."""
    db = get_supabase()
    today = date.today().isoformat()
    result = db.table("auto_comments") \
        .select("id", count="exact") \
        .eq("user_id", user_id) \
        .eq("status", "posted") \
        .gte("created_at", f"{today}T00:00:00Z") \
        .execute()
    return result.count or 0


def get_remaining_daily_comments(user_id: str) -> int:
    """Get how many comments the user can still post today."""
    used = get_daily_comment_count(user_id)
    return max(0, DAILY_COMMENT_LIMIT - used)


async def get_user_account_id(user_id: str) -> str | None:
    """Get the user's Unipile account_id from the database."""
    db = get_supabase()
    result = db.table("users").select("unipile_account_id").eq("id", user_id).execute()
    if not result.data:
        return None
    return result.data[0].get("unipile_account_id")
