from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.auth import get_current_user
from app.db import get_supabase
from app.agents.persona_analyzer import build_voice_profile

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
    """Re-generate the voice profile from existing scraped posts."""
    db = get_supabase()

    # Check that posts exist
    count_result = db.table("scraped_posts").select("id", count="exact").eq("user_id", user["id"]).execute()
    if not count_result.count:
        raise HTTPException(status_code=400, detail="No scraped posts found. Run a scrape first.")

    async def _rebuild(uid: str):
        try:
            await build_voice_profile(uid)
        except Exception as e:
            print(f"[persona rebuild error] user={uid}: {e}")

    background_tasks.add_task(_rebuild, user["id"])
    return {"status": "rebuilding", "message": "Voice profile rebuild started"}
