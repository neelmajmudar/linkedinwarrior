from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.auth import get_current_user
from app.db import get_supabase
from app.agents.persona_analyzer import build_voice_profile
from app.services.embeddings import reembed_all_posts_for_user, embed_posts_for_user

router = APIRouter(prefix="/api/persona", tags=["persona"])


@router.get("")
async def get_persona(user: dict = Depends(get_current_user)):
    """Get the user's current voice profile."""
    db = get_supabase()
    result = db.table("users").select("voice_profile, linkedin_username").eq("id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User profile not found")
    return result.data[0]


@router.post("/rebuild")
async def rebuild_persona(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Re-generate embeddings and voice profile from existing scraped posts."""
    db = get_supabase()

    # Check that posts exist
    count_result = db.table("scraped_posts").select("id", count="exact").eq("user_id", user["id"]).execute()
    if not count_result.count:
        raise HTTPException(status_code=400, detail="No scraped posts found. Run a scrape first.")

    async def _rebuild(uid: str):
        try:
            # Re-embed all posts before rebuilding persona
            count = await reembed_all_posts_for_user(uid)
            print(f"[persona rebuild] Re-embedded {count} posts for user={uid}")
        except Exception as e:
            print(f"[persona rebuild] Embedding failed (continuing): {e}")
        try:
            await build_voice_profile(uid)
        except Exception as e:
            print(f"[persona rebuild error] user={uid}: {e}")

    background_tasks.add_task(_rebuild, user["id"])
    return {"status": "rebuilding", "message": "Embeddings + voice profile rebuild started"}


@router.post("/embed")
async def embed_posts(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Generate vector embeddings for the user's scraped posts (backfill).

    Only embeds posts that don't already have embeddings.
    """
    db = get_supabase()

    count_result = db.table("scraped_posts").select("id", count="exact").eq("user_id", user["id"]).execute()
    if not count_result.count:
        raise HTTPException(status_code=400, detail="No scraped posts found. Run a scrape first.")

    async def _embed(uid: str):
        try:
            count = await embed_posts_for_user(uid)
            print(f"[embed backfill] Embedded {count} posts for user={uid}")
        except Exception as e:
            print(f"[embed backfill error] user={uid}: {e}")

    background_tasks.add_task(_embed, user["id"])
    return {"status": "started", "message": f"Embedding {count_result.count} posts in background"}
