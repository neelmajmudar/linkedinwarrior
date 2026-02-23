from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.auth import get_current_user
from app.db import get_supabase
from app.models import ScrapeRequest, ScrapeStatusResponse
from app.services.scraper import scrape_linkedin_posts
from app.services.embeddings import embed_and_store_posts
from app.services.persona import build_voice_profile

router = APIRouter(prefix="/api/scrape", tags=["scrape"])


async def _run_full_pipeline(user_id: str, linkedin_username: str, max_posts: int):
    """Background task: scrape → embed → build persona."""
    db = get_supabase()
    try:
        print(f"[pipeline] Starting scrape for {linkedin_username}")
        await scrape_linkedin_posts(user_id, linkedin_username, max_posts)
    except Exception as e:
        db.table("users").update({"scrape_status": "error"}).eq("id", user_id).execute()
        print(f"[pipeline] Scrape failed for user={user_id}: {e}")
        return

    try:
        print(f"[pipeline] Starting embeddings for user={user_id}")
        count = await embed_and_store_posts(user_id)
        print(f"[pipeline] Created {count} embeddings")
    except Exception as e:
        db.table("users").update({"scrape_status": "error"}).eq("id", user_id).execute()
        print(f"[pipeline] Embeddings failed for user={user_id}: {e}")
        return

    try:
        print(f"[pipeline] Building voice profile for user={user_id}")
        await build_voice_profile(user_id)
        print(f"[pipeline] Voice profile built successfully")
    except Exception as e:
        # Scrape + embed succeeded, so keep status as 'done' but log the error
        print(f"[pipeline] Voice profile failed for user={user_id}: {e}")


@router.post("")
async def trigger_scrape(
    payload: ScrapeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Trigger a full pipeline: scrape LinkedIn posts → embed → build voice profile."""
    db = get_supabase()

    # Ensure user row exists
    existing = db.table("users").select("id").eq("id", user["id"]).execute()
    if not existing.data:
        db.table("users").insert({
            "id": user["id"],
            "linkedin_username": payload.linkedin_username,
            "scrape_status": "pending",
        }).execute()
    else:
        db.table("users").update({
            "scrape_status": "pending",
            "linkedin_username": payload.linkedin_username,
        }).eq("id", user["id"]).execute()

    background_tasks.add_task(
        _run_full_pipeline, user["id"], payload.linkedin_username, payload.max_posts
    )

    return {"status": "started", "message": "Scrape pipeline started in background"}


@router.get("/status", response_model=ScrapeStatusResponse)
async def get_scrape_status(user: dict = Depends(get_current_user)):
    """Poll the current scrape/embed/persona pipeline status."""
    db = get_supabase()

    user_result = db.table("users").select("scrape_status").eq("id", user["id"]).execute()
    if not user_result.data:
        return ScrapeStatusResponse(scrape_status="none", posts_count=0, embeddings_count=0)

    scrape_status = user_result.data[0].get("scrape_status", "none")

    posts_count = db.table("scraped_posts").select("id", count="exact").eq("user_id", user["id"]).execute().count or 0
    embeddings_count = db.table("post_embeddings").select("id", count="exact").eq("user_id", user["id"]).execute().count or 0

    return ScrapeStatusResponse(
        scrape_status=scrape_status,
        posts_count=posts_count,
        embeddings_count=embeddings_count,
    )
