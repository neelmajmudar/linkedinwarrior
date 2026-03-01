from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.auth import get_current_user
from app.db import get_supabase
from app.services.analytics import (
    take_snapshot,
    get_follower_history,
    get_post_performance,
    get_post_performance_count,
    get_engagement_summary,
    get_metric_trends,
    get_post_interacting_profiles,
    send_connection_request,
)


class ConnectionRequestBody(BaseModel):
    provider_id: str
    message: str = ""

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
async def get_analytics(user: dict = Depends(get_current_user)):
    """Get full analytics dashboard data."""
    summary = get_engagement_summary(user["id"])
    followers = get_follower_history(user["id"], days=90)
    posts = get_post_performance(user["id"], limit=20)

    trends = get_metric_trends(user["id"], days=90)

    return {
        "summary": summary,
        "follower_history": followers,
        "top_posts": posts,
        "metric_trends": trends,
    }


@router.get("/trends")
async def get_trends(
    days: int = 30,
    user: dict = Depends(get_current_user),
):
    """Get daily aggregated metric trends."""
    trends = get_metric_trends(user["id"], days=days)
    return {"metric_trends": trends}


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
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    user: dict = Depends(get_current_user),
):
    """Get per-post performance metrics."""
    offset = (page - 1) * page_size
    posts = get_post_performance(user["id"], limit=page_size, offset=offset)
    total = get_post_performance_count(user["id"])
    return {
        "posts": posts,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (offset + page_size) < total,
    }


@router.get("/posts/{linkedin_post_id}/interactions")
async def get_post_interactions(
    linkedin_post_id: str,
    user: dict = Depends(get_current_user),
):
    """Get all profiles that interacted with a post (reactions + comments).

    Returns profiles even when partial errors occur (e.g. reactions API fails
    but comments succeed). The `error` and `api_errors` fields signal issues
    to the frontend without breaking the entire request.
    """
    return await get_post_interacting_profiles(user["id"], linkedin_post_id)


@router.post("/connect")
async def send_connect_request(
    body: ConnectionRequestBody,
    user: dict = Depends(get_current_user),
):
    """Send a LinkedIn connection request to a profile via Unipile."""
    result = await send_connection_request(user["id"], body.provider_id, body.message)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/refresh")
async def refresh_analytics(user: dict = Depends(get_current_user)):
    """Manually trigger an analytics snapshot (fetches latest data from Unipile)."""
    result = await take_snapshot(user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
