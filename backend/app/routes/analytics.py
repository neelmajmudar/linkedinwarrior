from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import get_supabase
from app.services.analytics import (
    take_snapshot,
    get_follower_history,
    get_post_performance,
    get_engagement_summary,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
async def get_analytics(user: dict = Depends(get_current_user)):
    """Get full analytics dashboard data."""
    summary = get_engagement_summary(user["id"])
    followers = get_follower_history(user["id"], days=90)
    posts = get_post_performance(user["id"], limit=20)

    return {
        "summary": summary,
        "follower_history": followers,
        "top_posts": posts,
    }


@router.get("/followers")
async def get_followers(
    days: int = 90,
    user: dict = Depends(get_current_user),
):
    """Get follower count history."""
    history = get_follower_history(user["id"], days=days)
    return {"follower_history": history}


@router.get("/posts")
async def get_posts_analytics(
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    """Get per-post performance metrics."""
    posts = get_post_performance(user["id"], limit=limit)
    return {"posts": posts}


@router.post("/refresh")
async def refresh_analytics(user: dict = Depends(get_current_user)):
    """Manually trigger an analytics snapshot (fetches latest data from Unipile)."""
    result = await take_snapshot(user["id"])
    if "error" in result:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=result["error"])
    return result
