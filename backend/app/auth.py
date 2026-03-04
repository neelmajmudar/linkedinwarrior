from fastapi import Depends, HTTPException, Request
from supabase import Client
from app.db import get_supabase


async def get_current_user(request: Request, db: Client = Depends(get_supabase)) -> dict:
    """Extract and verify the Supabase JWT from the Authorization header.

    Returns dict with id, email, active_org_id, and org_role (if in an org).
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        user_response = db.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        result = {"id": user.id, "email": user.email, "active_org_id": None, "org_role": None}

        # Load active org context
        user_row = db.table("users").select("active_org_id").eq("id", user.id).execute()
        if user_row.data and user_row.data[0].get("active_org_id"):
            org_id = user_row.data[0]["active_org_id"]
            # Verify membership and get role
            member = db.table("org_members") \
                .select("role") \
                .eq("org_id", org_id) \
                .eq("user_id", user.id) \
                .execute()
            if member.data:
                result["active_org_id"] = org_id
                result["org_role"] = member.data[0]["role"]

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


def require_org_role(*roles: str):
    """FastAPI dependency that verifies the user has one of the required roles in their active org.

    Usage:
        @router.post("/...", dependencies=[Depends(require_org_role("owner", "admin"))])
    """
    async def _check(user: dict = Depends(get_current_user)):
        if not user.get("active_org_id"):
            raise HTTPException(status_code=400, detail="No active organization context")
        if user.get("org_role") not in roles:
            raise HTTPException(status_code=403, detail=f"Requires one of roles: {', '.join(roles)}")
        return user
    return _check


def require_org_member():
    """FastAPI dependency that verifies the user is a member of their active org (any role)."""
    async def _check(user: dict = Depends(get_current_user)):
        if not user.get("active_org_id"):
            raise HTTPException(status_code=400, detail="No active organization context")
        return user
    return _check
