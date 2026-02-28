import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from fastapi.responses import StreamingResponse
from app.auth import get_current_user
from app.db import get_supabase
from app.models import GenerateRequest, UpdateContentRequest, ScheduleRequest, ContentItem, PaginatedResponse
from app.agents.post_generator import generate_post_stream, generate_post
from app.task_manager import create_task, TaskType
from app.rate_limit import rate_limit

router = APIRouter(prefix="/api/content", tags=["content"])


@router.post("/generate", dependencies=[Depends(rate_limit("content_generate", 20, 3600))])
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


@router.post("/generate-async", dependencies=[Depends(rate_limit("content_generate", 20, 3600))])
async def generate_content_async(
    payload: GenerateRequest,
    user: dict = Depends(get_current_user),
):
    """Start post generation as a background task. Returns a task_id for polling."""
    task = create_task(
        user_id=user["id"],
        task_type=TaskType.generate,
        coro=_run_generate(user["id"], payload.prompt),
        meta={"prompt": payload.prompt},
    )
    return {"task_id": task.id, "status": "pending"}


async def _run_generate(user_id: str, prompt: str) -> dict:
    """Background coroutine that generates a post and returns the draft info."""
    full_text = await generate_post(user_id, prompt)
    db = get_supabase()
    # Fetch the latest draft that was just saved by generate_post
    result = db.table("content_items") \
        .select("id, body, status, created_at") \
        .eq("user_id", user_id) \
        .eq("status", "draft") \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
    draft = result.data[0] if result.data else None
    return {"draft_id": draft["id"] if draft else None, "body": full_text, "prompt": prompt}


@router.get("")
async def list_content(
    status: str | None = None,
    exclude_status: str | None = None,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    user: dict = Depends(get_current_user),
):
    """List all content items for the current user, optionally filtered by status."""
    db = get_supabase()
    offset = (page - 1) * page_size

    # Count query (separate from data query to avoid chaining issues)
    count_query = db.table("content_items").select("id", count="exact").eq("user_id", user["id"])
    if status:
        count_query = count_query.eq("status", status)
    if exclude_status:
        count_query = count_query.neq("status", exclude_status)
    count_result = count_query.execute()
    total = count_result.count or 0

    # Data query
    data_query = db.table("content_items").select("*").eq("user_id", user["id"]).order("created_at", desc=True)
    if status:
        data_query = data_query.eq("status", status)
    if exclude_status:
        data_query = data_query.neq("status", exclude_status)
    data_result = data_query.range(offset, offset + page_size - 1).execute()

    return {
        "items": data_result.data or [],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (offset + page_size) < total,
    }


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


@router.post("/{content_id}/image")
async def upload_image(
    content_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload an image for a content item. Stores in Supabase Storage."""
    db = get_supabase()

    existing = db.table("content_items").select("id, status").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")
    if existing.data[0]["status"] == "published":
        raise HTTPException(status_code=400, detail="Cannot add image to a published post")

    # Read file and upload to Supabase Storage
    contents = await file.read()
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1]
    storage_path = f"{user['id']}/{content_id}.{ext}"

    try:
        db.storage.from_("post-images").upload(
            storage_path,
            contents,
            file_options={"content-type": file.content_type or "image/jpeg", "upsert": "true"},
        )
    except Exception:
        # If bucket doesn't exist or upload fails, try removing first
        try:
            db.storage.from_("post-images").remove([storage_path])
            db.storage.from_("post-images").upload(
                storage_path,
                contents,
                file_options={"content-type": file.content_type or "image/jpeg"},
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload image: {e}")

    image_url = db.storage.from_("post-images").get_public_url(storage_path)

    db.table("content_items").update({
        "image_url": image_url,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", content_id).execute()

    return {"image_url": image_url}


@router.delete("/{content_id}/image")
async def remove_image(
    content_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove the image from a content item."""
    db = get_supabase()

    existing = db.table("content_items").select("id, status, image_url").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")
    if existing.data[0]["status"] == "published":
        raise HTTPException(status_code=400, detail="Cannot modify a published post")

    db.table("content_items").update({
        "image_url": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", content_id).execute()

    return {"status": "removed"}


@router.post("/{content_id}/publish")
async def publish_content(
    content_id: str,
    user: dict = Depends(get_current_user),
):
    """Publish a content item to LinkedIn immediately via Unipile, with optional image."""
    from app.services.unipile import publish_post

    db = get_supabase()

    existing = db.table("content_items").select("*").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")

    item = existing.data[0]
    if item["status"] == "published":
        raise HTTPException(status_code=400, detail="Already published")

    # If the post has an image, download it and pass to publish
    image_bytes = None
    image_filename = "image.jpg"
    image_content_type = "image/jpeg"
    if item.get("image_url"):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=15) as http:
                img_resp = await http.get(item["image_url"])
                img_resp.raise_for_status()
                image_bytes = img_resp.content
                ct = img_resp.headers.get("content-type", "image/jpeg")
                image_content_type = ct
                ext = ct.split("/")[-1].split(";")[0]
                image_filename = f"post_image.{ext}"
        except Exception as img_err:
            print(f"[publish] Failed to download image for post {content_id}: {img_err}")
            # Continue publishing without image

    try:
        linkedin_post_id = await publish_post(
            user["id"],
            item["body"],
            image_bytes=image_bytes,
            image_filename=image_filename,
            image_content_type=image_content_type,
        )
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
    """Schedule a content item for future publishing.

    If Celery is available and the post is due within 5 minutes, it is
    immediately enqueued as a delayed task for precise timing. Otherwise
    the periodic beat task will pick it up.
    """
    db = get_supabase()

    existing = db.table("content_items").select("id, status, body, image_url").eq("id", content_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Content item not found")
    if existing.data[0]["status"] == "published":
        raise HTTPException(status_code=400, detail="Already published")

    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    sched_dt = payload.scheduled_at.replace(tzinfo=timezone.utc) if payload.scheduled_at.tzinfo is None else payload.scheduled_at

    db.table("content_items").update({
        "status": "scheduled",
        "scheduled_at": payload.scheduled_at.isoformat(),
        "updated_at": now,
    }).eq("id", content_id).execute()

    # If Celery is available and post is due soon, enqueue it immediately
    # for precise timing instead of waiting for the next beat cycle
    try:
        from app.scheduler import _USE_CELERY
        if _USE_CELERY:
            delay = max(0, (sched_dt - now_dt).total_seconds())
            if delay <= 300:  # due within 5 minutes
                from app.tasks import publish_post_task
                item = existing.data[0]
                publish_post_task.apply_async(
                    args=[content_id, user["id"], item["body"]],
                    kwargs={"image_url": item.get("image_url")},
                    countdown=delay,
                    task_id=f"publish-{content_id}",
                )
    except Exception:
        pass  # Celery enqueue is best-effort; beat will catch it regardless

    return {"status": "scheduled", "scheduled_at": payload.scheduled_at.isoformat()}
