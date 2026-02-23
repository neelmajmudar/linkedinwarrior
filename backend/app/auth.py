from fastapi import Depends, HTTPException, Request
from supabase import Client
from app.db import get_supabase


async def get_current_user(request: Request, db: Client = Depends(get_supabase)) -> dict:
    """Extract and verify the Supabase JWT from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        user_response = db.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.id, "email": user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")
