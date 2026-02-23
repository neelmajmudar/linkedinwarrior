import httpx
from app.config import settings
from app.db import get_supabase


async def get_hosted_auth_url(user_id: str) -> str:
    """Request a Unipile hosted auth URL for LinkedIn connection."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.UNIPILE_DSN}/api/v1/hosted/accounts/link",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "type": "LINKEDIN",
                "api_url": settings.UNIPILE_DSN,
                "expiresOn": "2099-01-01T00:00:00.000Z",
                "notify_url": f"{settings.FRONTEND_URL}/api/linkedin/callback",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("url", "")


async def handle_auth_callback(user_id: str, account_id: str) -> None:
    """Store the Unipile account_id on the user record after successful auth."""
    db = get_supabase()
    db.table("users").update({
        "unipile_account_id": account_id,
    }).eq("id", user_id).execute()


async def publish_post(user_id: str, post_text: str) -> str:
    """Publish a text post to LinkedIn via Unipile.

    Returns the LinkedIn post ID.
    """
    db = get_supabase()

    # Get the user's Unipile account_id
    user_result = db.table("users").select("unipile_account_id").eq("id", user_id).single().execute()
    account_id = user_result.data.get("unipile_account_id")
    if not account_id:
        raise ValueError("LinkedIn account not connected. Please connect via Unipile first.")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.UNIPILE_DSN}/api/v1/posts",
            headers={
                "X-API-KEY": settings.UNIPILE_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "account_id": account_id,
                "text": post_text,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("id", "")


async def check_connection(user_id: str) -> dict:
    """Check if the user has a connected LinkedIn account via Unipile."""
    db = get_supabase()
    user_result = db.table("users").select("unipile_account_id").eq("id", user_id).execute()
    if not user_result.data:
        return {"connected": False}
    account_id = user_result.data[0].get("unipile_account_id")
    return {
        "connected": bool(account_id),
    }
