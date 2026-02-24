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
                "notify_url": f"{settings.FRONTEND_URL}/linkedin/callback",
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


async def publish_post(
    user_id: str,
    post_text: str,
    image_bytes: bytes | None = None,
    image_filename: str = "image.jpg",
    image_content_type: str = "image/jpeg",
) -> str:
    """Publish a post to LinkedIn via Unipile, optionally with an image.

    Returns the LinkedIn post ID.
    """
    db = get_supabase()

    # Get the user's Unipile account_id
    user_result = db.table("users").select("unipile_account_id").eq("id", user_id).single().execute()
    account_id = user_result.data.get("unipile_account_id")
    if not account_id:
        raise ValueError("LinkedIn account not connected. Please connect via Unipile first.")

    async with httpx.AsyncClient(timeout=60) as client:
        if image_bytes:
            # Multipart form-data with image attachment
            resp = await client.post(
                f"{settings.UNIPILE_DSN}/api/v1/posts",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
                data={
                    "account_id": account_id,
                    "text": post_text,
                },
                files={
                    "attachments": (image_filename, image_bytes, image_content_type),
                },
            )
        else:
            # JSON text-only post
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
        return data.get("post_id", data.get("id", ""))


async def check_connection(user_id: str) -> dict:
    """Check if the user has a connected LinkedIn account via Unipile.

    First checks the local DB. If no account_id is stored, queries the
    Unipile API for existing LinkedIn accounts and syncs the first one found.
    """
    db = get_supabase()
    user_result = db.table("users").select("unipile_account_id").eq("id", user_id).execute()
    if not user_result.data:
        return {"connected": False}

    account_id = user_result.data[0].get("unipile_account_id")
    if account_id:
        return {"connected": True}

    # No account_id stored locally — check Unipile for existing LinkedIn accounts
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{settings.UNIPILE_DSN}/api/v1/accounts",
                headers={"X-API-KEY": settings.UNIPILE_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
            accounts = data if isinstance(data, list) else data.get("items", [])
            for acct in accounts:
                if acct.get("type", "").upper() == "LINKEDIN":
                    found_id = acct.get("id")
                    if found_id:
                        # Sync to local DB
                        db.table("users").update({
                            "unipile_account_id": found_id,
                        }).eq("id", user_id).execute()
                        return {"connected": True}
    except Exception:
        pass

    return {"connected": False}
