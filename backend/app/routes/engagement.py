"""Routes for the auto-commenting / engagement feature."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.db import get_supabase
from app.services.commenter import (
    search_linkedin_posts,
    get_post_details,
    post_comment,
    get_remaining_daily_comments,
    get_user_account_id,
    DAILY_COMMENT_LIMIT,
)
from app.agents.comment_generator import generate_comment_for_post
from app.task_manager import create_task, TaskType

router = APIRouter(prefix="/api/engagement", tags=["engagement"])


# --- Request / Response models ---

class TopicsRequest(BaseModel):
    topics: list[str] = Field(..., min_length=1, max_length=20)


class ApproveCommentRequest(BaseModel):
    comment_id: str
    edited_text: Optional[str] = None


class SearchPostsRequest(BaseModel):
    limit: int = Field(default=5, ge=1, le=15)


# --- Routes ---

@router.get("/topics")
async def get_topics(user: dict = Depends(get_current_user)):
    """Get the user's current engagement topics."""
    db = get_supabase()
    result = db.table("users").select("engagement_topics").eq("id", user["id"]).execute()
    if not result.data:
        return {"topics": []}
    return {"topics": result.data[0].get("engagement_topics") or []}


@router.post("/topics")
async def save_topics(
    payload: TopicsRequest,
    user: dict = Depends(get_current_user),
):
    """Save the user's engagement topics/keywords."""
    db = get_supabase()
    db.table("users").update({
        "engagement_topics": payload.topics,
    }).eq("id", user["id"]).execute()
    return {"topics": payload.topics}


@router.post("/search")
async def search_posts(
    payload: SearchPostsRequest,
    user: dict = Depends(get_current_user),
):
    """Search LinkedIn posts matching the user's topics and generate comment previews."""
    account_id = await get_user_account_id(user["id"])
    if not account_id:
        raise HTTPException(status_code=400, detail="LinkedIn account not connected")

    # Get user's topics
    db = get_supabase()
    user_result = db.table("users").select("engagement_topics").eq("id", user["id"]).execute()
    topics = (user_result.data[0].get("engagement_topics") or []) if user_result.data else []
    if not topics:
        raise HTTPException(status_code=400, detail="No engagement topics configured. Add topics first.")

    remaining = get_remaining_daily_comments(user["id"])
    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Daily comment limit of {DAILY_COMMENT_LIMIT} reached. Try again tomorrow.",
        )

    # Search for posts
    posts = await search_linkedin_posts(account_id, topics, limit=payload.limit)
    if not posts:
        return {"posts": [], "remaining_today": remaining}

    # For each post, get details and generate a comment preview
    previews = []
    for post in posts:
        post_id = post.get("id", "")
        social_id = post.get("social_id", "")
        text = post.get("text", "")
        share_url = post.get("share_url", "")
        author_name = ""
        author_public_id = ""
        author = post.get("author")
        if author:
            author_name = author.get("name", "") or author.get("public_identifier", "")
            author_public_id = author.get("public_identifier", "")

        # If we don't have social_id, try fetching post details
        if not social_id and post_id:
            try:
                details = await get_post_details(account_id, post_id)
                social_id = details.get("social_id", "")
                text = text or details.get("text", "")
                share_url = share_url or details.get("share_url", "")
                if not author_name:
                    det_author = details.get("author", {})
                    author_name = det_author.get("name", "") or det_author.get("public_identifier", "")
                    author_public_id = author_public_id or det_author.get("public_identifier", "")
            except Exception:
                continue

        if not social_id or not text:
            continue

        # Build author profile URL
        post_author_url = f"https://www.linkedin.com/in/{author_public_id}" if author_public_id else ""

        # Generate comment via LangGraph agent
        try:
            comment = await generate_comment_for_post(
                user_id=user["id"],
                post_content=text,
                post_author=author_name,
            )
        except Exception:
            comment = ""

        if not comment:
            continue

        # Save as pending auto_comment
        row = db.table("auto_comments").insert({
            "user_id": user["id"],
            "post_social_id": social_id,
            "post_author": author_name,
            "post_content": text[:2000],
            "comment_text": comment,
            "status": "pending",
            "share_url": share_url,
            "post_author_url": post_author_url,
        }).execute()

        comment_id = row.data[0]["id"] if row.data else ""

        previews.append({
            "comment_id": comment_id,
            "post_social_id": social_id,
            "post_author": author_name,
            "post_content": text[:2000],
            "comment_text": comment,
            "status": "pending",
            "share_url": share_url,
            "post_author_url": post_author_url,
        })

    return {"posts": previews, "remaining_today": remaining}


@router.post("/search-async")
async def search_posts_async(
    payload: SearchPostsRequest,
    user: dict = Depends(get_current_user),
):
    """Start engagement search as a background task. Returns a task_id for polling."""
    account_id = await get_user_account_id(user["id"])
    if not account_id:
        raise HTTPException(status_code=400, detail="LinkedIn account not connected")

    db = get_supabase()
    user_result = db.table("users").select("engagement_topics").eq("id", user["id"]).execute()
    topics = (user_result.data[0].get("engagement_topics") or []) if user_result.data else []
    if not topics:
        raise HTTPException(status_code=400, detail="No engagement topics configured. Add topics first.")

    remaining = get_remaining_daily_comments(user["id"])
    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Daily comment limit of {DAILY_COMMENT_LIMIT} reached. Try again tomorrow.",
        )

    task = create_task(
        user_id=user["id"],
        task_type=TaskType.engage,
        coro=_run_engage_search(
            user_id=user["id"],
            account_id=account_id,
            topics=topics,
            limit=payload.limit,
        ),
        meta={"topics": topics, "limit": payload.limit},
    )
    return {"task_id": task.id, "status": "pending"}


async def _run_engage_search(
    user_id: str,
    account_id: str,
    topics: list[str],
    limit: int,
) -> dict:
    """Background coroutine that searches posts and generates comments."""
    db = get_supabase()
    posts = await search_linkedin_posts(account_id, topics, limit=limit)
    if not posts:
        return {"posts": [], "remaining_today": get_remaining_daily_comments(user_id)}

    previews = []
    for post in posts:
        post_id = post.get("id", "")
        social_id = post.get("social_id", "")
        text = post.get("text", "")
        share_url = post.get("share_url", "")
        author_name = ""
        author_public_id = ""
        author = post.get("author")
        if author:
            author_name = author.get("name", "") or author.get("public_identifier", "")
            author_public_id = author.get("public_identifier", "")

        if not social_id and post_id:
            try:
                details = await get_post_details(account_id, post_id)
                social_id = details.get("social_id", "")
                text = text or details.get("text", "")
                share_url = share_url or details.get("share_url", "")
                if not author_name:
                    det_author = details.get("author", {})
                    author_name = det_author.get("name", "") or det_author.get("public_identifier", "")
                    author_public_id = author_public_id or det_author.get("public_identifier", "")
            except Exception:
                continue

        if not social_id or not text:
            continue

        post_author_url = f"https://www.linkedin.com/in/{author_public_id}" if author_public_id else ""

        try:
            comment = await generate_comment_for_post(
                user_id=user_id,
                post_content=text,
                post_author=author_name,
            )
        except Exception:
            comment = ""

        if not comment:
            continue

        row = db.table("auto_comments").insert({
            "user_id": user_id,
            "post_social_id": social_id,
            "post_author": author_name,
            "post_content": text[:2000],
            "comment_text": comment,
            "status": "pending",
            "share_url": share_url,
            "post_author_url": post_author_url,
        }).execute()

        comment_id = row.data[0]["id"] if row.data else ""

        previews.append({
            "comment_id": comment_id,
            "post_social_id": social_id,
            "post_author": author_name,
            "post_content": text[:2000],
            "comment_text": comment,
            "status": "pending",
            "share_url": share_url,
            "post_author_url": post_author_url,
        })

    return {"posts": previews, "remaining_today": get_remaining_daily_comments(user_id)}


@router.post("/approve")
async def approve_comment(
    payload: ApproveCommentRequest,
    user: dict = Depends(get_current_user),
):
    """Approve a pending comment and post it to LinkedIn."""
    db = get_supabase()

    # Verify ownership and status
    result = db.table("auto_comments") \
        .select("*") \
        .eq("id", payload.comment_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment = result.data[0]
    if comment["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Comment is already {comment['status']}")

    # Check daily limit
    remaining = get_remaining_daily_comments(user["id"])
    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Daily comment limit of {DAILY_COMMENT_LIMIT} reached.",
        )

    account_id = await get_user_account_id(user["id"])
    if not account_id:
        raise HTTPException(status_code=400, detail="LinkedIn account not connected")

    # Use edited text if provided
    final_text = payload.edited_text if payload.edited_text else comment["comment_text"]

    try:
        await post_comment(account_id, comment["post_social_id"], final_text)
        now = datetime.now(timezone.utc).isoformat()
        db.table("auto_comments").update({
            "status": "posted",
            "comment_text": final_text,
        }).eq("id", payload.comment_id).execute()
        return {"status": "posted", "comment_id": payload.comment_id}
    except Exception as e:
        db.table("auto_comments").update({
            "status": "failed",
        }).eq("id", payload.comment_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to post comment: {e}")


@router.post("/skip/{comment_id}")
async def skip_comment(
    comment_id: str,
    user: dict = Depends(get_current_user),
):
    """Skip a pending comment (mark as skipped)."""
    db = get_supabase()
    result = db.table("auto_comments") \
        .select("id, status") \
        .eq("id", comment_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Comment not found")
    if result.data[0]["status"] != "pending":
        raise HTTPException(status_code=400, detail="Comment is not pending")

    db.table("auto_comments").update({"status": "skipped"}).eq("id", comment_id).execute()
    return {"status": "skipped"}


@router.get("/history")
async def get_history(
    status: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """List past auto-comments with optional status filter."""
    db = get_supabase()
    query = db.table("auto_comments") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .order("created_at", desc=True) \
        .limit(limit)

    if status:
        query = query.eq("status", status)

    result = query.execute()
    remaining = get_remaining_daily_comments(user["id"])
    return {
        "comments": result.data or [],
        "remaining_today": remaining,
        "daily_limit": DAILY_COMMENT_LIMIT,
    }


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a comment from the user's history."""
    db = get_supabase()
    result = db.table("auto_comments") \
        .select("id") \
        .eq("id", comment_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Comment not found")

    db.table("auto_comments").delete().eq("id", comment_id).execute()
    return {"status": "deleted"}


@router.get("/remaining")
async def get_remaining(user: dict = Depends(get_current_user)):
    """Get the remaining daily comment count."""
    remaining = get_remaining_daily_comments(user["id"])
    return {
        "remaining_today": remaining,
        "daily_limit": DAILY_COMMENT_LIMIT,
    }
