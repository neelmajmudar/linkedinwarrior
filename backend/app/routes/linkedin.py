from fastapi import APIRouter, Depends, HTTPException, Request
from app.auth import get_current_user
from app.services.unipile import get_hosted_auth_url, handle_auth_callback, check_connection

router = APIRouter(prefix="/api/linkedin", tags=["linkedin"])


@router.post("/connect")
async def connect_linkedin(user: dict = Depends(get_current_user)):
    """Get a Unipile hosted auth URL to connect the user's LinkedIn account."""
    try:
        url = await get_hosted_auth_url(user["id"])
        return {"auth_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get auth URL: {e}")


@router.post("/callback")
async def linkedin_callback(request: Request, user: dict = Depends(get_current_user)):
    """Handle the Unipile auth callback with the account_id."""
    body = await request.json()
    account_id = body.get("account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Missing account_id in callback")

    await handle_auth_callback(user["id"], account_id)
    return {"status": "connected", "account_id": account_id}


@router.get("/status")
async def linkedin_status(user: dict = Depends(get_current_user)):
    """Check if the user has a connected LinkedIn account."""
    result = await check_connection(user["id"])
    return result
