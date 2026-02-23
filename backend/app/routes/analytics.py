from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import get_supabase

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
async def get_analytics(user: dict = Depends(get_current_user)):
    """Get aggregate analytics across all published posts."""
    db = get_supabase()

    # Get all published content items
    result = db.table("content_items") \
        .select("id, body, published_at, linkedin_post_id, engagement") \
        .eq("user_id", user["id"]) \
        .eq("status", "published") \
        .order("published_at", desc=True) \
        .execute()

    posts = result.data or []

    total_posts = len(posts)
    total_likes = 0
    total_comments = 0
    total_shares = 0

    for post in posts:
        eng = post.get("engagement") or {}
        total_likes += eng.get("likes", 0)
        total_comments += eng.get("comments", 0)
        total_shares += eng.get("shares", 0)

    return {
        "total_published": total_posts,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "posts": posts,
    }
