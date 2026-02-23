import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.auth import get_current_user
from app.db import get_supabase
from app.models import GenerateRequest, UpdateContentRequest, ScheduleRequest, ContentItem
from app.services.generator import generate_post_stream

router = APIRouter(prefix="/api/content", tags=["content"])


@router.post("/generate")
async def generate_content(
    payload: GenerateRequest,
    user: dict = Depends(get_current_user),
):
    """Generate a LinkedIn post draft via SSE streaming."""

    async def event_stream():
        async for token in generate_post_stream(user["id"], payload.prompt):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("")
async def list_content(
    status: str | None = None,
    user: dict = Depends(get_current_user),
):
    """List all content items for the current user, optionally filtered by status."""
    db = get_supabase()
    query = db.table("content_items").select("*").eq("user_id", user["id"]).order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return result.data


@router.get("/{content_id}")
async def get_content(content_id: str, user: dict = Depends(get_current_user)):
    """Get a single content item."""
    db = get_supabase()
    result = db.table("content_items").select("*").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Content item not found")
    return result.data[0]


@router.patch("/{content_id}")
async def update_content(
    content_id: str,
    payload: UpdateContentRequest,
    user: dict = Depends(get_current_user),
):
    """Update a content item (body, status, scheduled_at)."""
    db = get_supabase()

    # Verify ownership
    existing = db.table("content_items").select("id, status").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")

    # Don't allow editing published posts
    if existing.data[0]["status"] == "published":
        raise HTTPException(status_code=400, detail="Cannot edit a published post")

    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.body is not None:
        update_data["body"] = payload.body
    if payload.status is not None:
        update_data["status"] = payload.status.value
    if payload.scheduled_at is not None:
        update_data["scheduled_at"] = payload.scheduled_at.isoformat()
        update_data["status"] = "scheduled"

    result = db.table("content_items").update(update_data).eq("id", content_id).execute()
    return result.data[0] if result.data else {"status": "updated"}


@router.delete("/{content_id}")
async def delete_content(content_id: str, user: dict = Depends(get_current_user)):
    """Delete a draft content item."""
    db = get_supabase()

    existing = db.table("content_items").select("id, status").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")
    if existing.data[0]["status"] == "published":
        raise HTTPException(status_code=400, detail="Cannot delete a published post")

    db.table("content_items").delete().eq("id", content_id).eq("user_id", user["id"]).execute()
    return {"status": "deleted"}


@router.post("/{content_id}/publish")
async def publish_content(content_id: str, user: dict = Depends(get_current_user)):
    """Publish a content item to LinkedIn immediately via Unipile."""
    from app.services.unipile import publish_post

    db = get_supabase()

    existing = db.table("content_items").select("*").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")

    item = existing.data[0]
    if item["status"] == "published":
        raise HTTPException(status_code=400, detail="Already published")

    try:
        linkedin_post_id = await publish_post(user["id"], item["body"])
        now = datetime.now(timezone.utc).isoformat()
        db.table("content_items").update({
            "status": "published",
            "published_at": now,
            "linkedin_post_id": linkedin_post_id,
            "updated_at": now,
        }).eq("id", content_id).execute()
        return {"status": "published", "linkedin_post_id": linkedin_post_id}
    except Exception as e:
        db.table("content_items").update({
            "status": "failed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", content_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to publish: {e}")


@router.post("/{content_id}/schedule")
async def schedule_content(
    content_id: str,
    payload: ScheduleRequest,
    user: dict = Depends(get_current_user),
):
    """Schedule a content item for future publishing."""
    db = get_supabase()

    existing = db.table("content_items").select("id, status").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")
    if existing.data[0]["status"] == "published":
        raise HTTPException(status_code=400, detail="Already published")

    now = datetime.now(timezone.utc).isoformat()
    db.table("content_items").update({
        "status": "scheduled",
        "scheduled_at": payload.scheduled_at.isoformat(),
        "updated_at": now,
    }).eq("id", content_id).execute()

    return {"status": "scheduled", "scheduled_at": payload.scheduled_at.isoformat()}
