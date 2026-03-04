"""Routes for organization / team management."""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user, require_org_role
from app.config import settings
from app.db import get_supabase
from app.models import (
    CreateOrgRequest,
    UpdateOrgRequest,
    InviteRequest,
    UpdateMemberRoleRequest,
    AcceptInviteRequest,
)

router = APIRouter(prefix="/api/orgs", tags=["organizations"])

# Colors assigned to new members (cycle through)
MEMBER_COLORS = [
    "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
]


def _slugify(name: str) -> str:
    """Generate a URL-friendly slug from a name."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "org"


# ── CRUD ──

@router.post("")
async def create_org(
    payload: CreateOrgRequest,
    user: dict = Depends(get_current_user),
):
    """Create a new organization. The caller becomes the owner."""
    db = get_supabase()
    slug = payload.slug or _slugify(payload.name)

    # Check slug uniqueness
    existing = db.table("organizations").select("id").eq("slug", slug).execute()
    if existing.data:
        # Append random suffix
        import secrets
        slug = f"{slug}-{secrets.token_hex(3)}"

    # Create org
    org_result = db.table("organizations").insert({
        "name": payload.name,
        "slug": slug,
        "created_by": user["id"],
    }).execute()

    if not org_result.data:
        raise HTTPException(status_code=500, detail="Failed to create organization")

    org = org_result.data[0]

    # Add creator as owner
    db.table("org_members").insert({
        "org_id": org["id"],
        "user_id": user["id"],
        "role": "owner",
        "display_name": user.get("email", "").split("@")[0],
        "color": MEMBER_COLORS[0],
    }).execute()

    # Set as active org
    db.table("users").update({"active_org_id": org["id"]}).eq("id", user["id"]).execute()

    return {**org, "role": "owner", "member_count": 1}


@router.get("")
async def list_orgs(user: dict = Depends(get_current_user)):
    """List all organizations the current user belongs to."""
    db = get_supabase()
    memberships = db.table("org_members") \
        .select("org_id, role, organizations(id, name, slug, created_by, settings, created_at)") \
        .eq("user_id", user["id"]) \
        .execute()

    orgs = []
    for m in memberships.data or []:
        org = m.get("organizations", {})
        if not org:
            continue
        # Get member count
        count_result = db.table("org_members").select("id", count="exact").eq("org_id", org["id"]).execute()
        orgs.append({
            **org,
            "role": m["role"],
            "member_count": count_result.count or 0,
        })

    return {"orgs": orgs, "active_org_id": user.get("active_org_id")}


# ── Accept invite (MUST be before /{org_id} parametric routes) ──

@router.post("/accept-invite")
async def accept_invite(
    payload: AcceptInviteRequest,
    user: dict = Depends(get_current_user),
):
    """Accept an organization invite by token."""
    db = get_supabase()

    # Look up invite
    invite_result = db.table("org_invites") \
        .select("*") \
        .eq("token", payload.token) \
        .eq("status", "pending") \
        .execute()

    if not invite_result.data:
        raise HTTPException(status_code=404, detail="Invite not found or already used")

    invite = invite_result.data[0]

    # Check expiry
    expires_at = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        db.table("org_invites").update({"status": "expired"}).eq("id", invite["id"]).execute()
        raise HTTPException(status_code=410, detail="Invite has expired")

    # Check not already a member
    existing = db.table("org_members") \
        .select("id") \
        .eq("org_id", invite["org_id"]) \
        .eq("user_id", user["id"]) \
        .execute()
    if existing.data:
        # Mark invite as accepted anyway
        db.table("org_invites").update({"status": "accepted"}).eq("id", invite["id"]).execute()
        return {"status": "already_member", "org_id": invite["org_id"]}

    # Determine color (cycle through based on member count)
    count_result = db.table("org_members").select("id", count="exact").eq("org_id", invite["org_id"]).execute()
    color_idx = (count_result.count or 0) % len(MEMBER_COLORS)

    # Add as member (handle race condition where duplicate insert hits UNIQUE constraint)
    try:
        db.table("org_members").insert({
            "org_id": invite["org_id"],
            "user_id": user["id"],
            "role": invite["role"],
            "display_name": user.get("email", "").split("@")[0],
            "color": MEMBER_COLORS[color_idx],
        }).execute()
    except Exception:
        # UNIQUE(org_id, user_id) violation — user was added by a concurrent request
        db.table("org_invites").update({"status": "accepted"}).eq("id", invite["id"]).execute()
        return {"status": "already_member", "org_id": invite["org_id"]}

    # Mark invite as accepted
    db.table("org_invites").update({"status": "accepted"}).eq("id", invite["id"]).execute()

    # Set as active org
    db.table("users").update({"active_org_id": invite["org_id"]}).eq("id", user["id"]).execute()

    return {"status": "accepted", "org_id": invite["org_id"], "role": invite["role"]}


@router.post("/switch-personal")
async def switch_personal(user: dict = Depends(get_current_user)):
    """Switch back to personal (no org) context."""
    db = get_supabase()
    db.table("users").update({"active_org_id": None}).eq("id", user["id"]).execute()
    return {"status": "switched", "org_id": None}


@router.get("/{org_id}")
async def get_org(org_id: str, user: dict = Depends(get_current_user)):
    """Get organization details including members."""
    db = get_supabase()

    # Verify membership
    member = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not member.data:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    org_result = db.table("organizations").select("*").eq("id", org_id).execute()
    if not org_result.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Get all members with their emails from users table
    members_result = db.table("org_members") \
        .select("id, user_id, role, display_name, color, joined_at, users(id)") \
        .eq("org_id", org_id) \
        .order("joined_at") \
        .execute()

    # Resolve emails from auth — use users table join
    members = []
    for m in members_result.data or []:
        members.append({
            "id": m["id"],
            "user_id": m["user_id"],
            "role": m["role"],
            "display_name": m.get("display_name"),
            "color": m.get("color"),
            "joined_at": m.get("joined_at"),
        })

    # Get pending invites (only for admin+)
    invites = []
    if member.data[0]["role"] in ("owner", "admin"):
        invites_result = db.table("org_invites") \
            .select("id, email, role, status, created_at, expires_at") \
            .eq("org_id", org_id) \
            .eq("status", "pending") \
            .order("created_at", desc=True) \
            .execute()
        invites = invites_result.data or []

    return {
        **org_result.data[0],
        "role": member.data[0]["role"],
        "members": members,
        "pending_invites": invites,
    }


@router.patch("/{org_id}", dependencies=[Depends(require_org_role("owner", "admin"))])
async def update_org(
    org_id: str,
    payload: UpdateOrgRequest,
    user: dict = Depends(get_current_user),
):
    """Update organization name or settings."""
    db = get_supabase()

    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name
    if payload.settings is not None:
        update_data["settings"] = payload.settings

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.table("organizations").update(update_data).eq("id", org_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    return result.data[0]


@router.delete("/{org_id}")
async def delete_org(org_id: str, user: dict = Depends(get_current_user)):
    """Delete an organization. Only the owner can do this."""
    db = get_supabase()

    member = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not member.data or member.data[0]["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can delete an organization")

    # Clear active_org_id for all members
    members = db.table("org_members").select("user_id").eq("org_id", org_id).execute()
    for m in members.data or []:
        db.table("users").update({"active_org_id": None}).eq("id", m["user_id"]).eq("active_org_id", org_id).execute()

    db.table("organizations").delete().eq("id", org_id).execute()
    return {"status": "deleted"}


# ── Invites ──

@router.post("/{org_id}/invite")
async def invite_member(
    org_id: str,
    payload: InviteRequest,
    user: dict = Depends(get_current_user),
):
    """Send an email invite to join the organization."""
    db = get_supabase()

    # Verify caller is admin+
    member = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not member.data or member.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can invite members")

    # If a pending invite already exists for this email, delete it so we can resend
    existing_invite = db.table("org_invites") \
        .select("id") \
        .eq("org_id", org_id) \
        .eq("email", payload.email) \
        .eq("status", "pending") \
        .execute()
    if existing_invite.data:
        db.table("org_invites").delete().eq("id", existing_invite.data[0]["id"]).execute()

    # Create invite
    invite_result = db.table("org_invites").insert({
        "org_id": org_id,
        "email": payload.email,
        "role": payload.role,
        "invited_by": user["id"],
    }).execute()

    if not invite_result.data:
        raise HTTPException(status_code=500, detail="Failed to create invite")

    invite = invite_result.data[0]

    # Get org name for the email
    org_result = db.table("organizations").select("name").eq("id", org_id).execute()
    org_name = org_result.data[0]["name"] if org_result.data else "Unknown"

    # Send email
    from app.services.email_invite import send_invite_email
    inviter_name = user.get("email", "A team member").split("@")[0]
    email_sent = await send_invite_email(
        to_email=payload.email,
        org_name=org_name,
        inviter_name=inviter_name,
        role=payload.role,
        token=invite["token"],
    )

    invite_url = f"{settings.FRONTEND_URL}/dashboard/team/invite?token={invite['token']}"

    return {
        "invite_id": invite["id"],
        "email": payload.email,
        "role": payload.role,
        "email_sent": email_sent,
        "invite_url": invite_url if not email_sent else None,
    }


# ── Member management ──

@router.patch("/{org_id}/members/{member_user_id}")
async def update_member_role(
    org_id: str,
    member_user_id: str,
    payload: UpdateMemberRoleRequest,
    user: dict = Depends(get_current_user),
):
    """Change a member's role. Only admin+ can do this."""
    db = get_supabase()

    # Verify caller is admin+
    caller = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not caller.data or caller.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can change roles")

    # Cannot change owner's role
    target = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", member_user_id) \
        .execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.data[0]["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")

    # Admin cannot promote to owner
    if payload.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot assign owner role")

    db.table("org_members").update({
        "role": payload.role,
    }).eq("org_id", org_id).eq("user_id", member_user_id).execute()

    return {"status": "updated", "user_id": member_user_id, "role": payload.role}


@router.delete("/{org_id}/members/{member_user_id}")
async def remove_member(
    org_id: str,
    member_user_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a member from the organization. Admin+ or self-leave."""
    db = get_supabase()

    is_self = member_user_id == user["id"]

    if not is_self:
        # Verify caller is admin+
        caller = db.table("org_members") \
            .select("role") \
            .eq("org_id", org_id) \
            .eq("user_id", user["id"]) \
            .execute()
        if not caller.data or caller.data[0]["role"] not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Only admins can remove members")

    # Cannot remove owner
    target = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", member_user_id) \
        .execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.data[0]["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner. Transfer ownership or delete the org.")

    db.table("org_members").delete().eq("org_id", org_id).eq("user_id", member_user_id).execute()

    # Clear active_org_id if it was this org
    db.table("users").update({"active_org_id": None}).eq("id", member_user_id).eq("active_org_id", org_id).execute()

    return {"status": "removed", "user_id": member_user_id}


# ── Context switching ──

@router.post("/{org_id}/switch")
async def switch_org(org_id: str, user: dict = Depends(get_current_user)):
    """Set the user's active organization context."""
    db = get_supabase()

    # Verify membership
    member = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not member.data:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    db.table("users").update({"active_org_id": org_id}).eq("id", user["id"]).execute()
    return {"status": "switched", "org_id": org_id, "role": member.data[0]["role"]}


# ── Conflict detection ──

class ConflictCheckRequest(BaseModel):
    scheduled_at: str
    body: str
    exclude_content_id: str | None = None

@router.post("/{org_id}/content/check-conflicts")
async def check_content_conflicts(
    org_id: str,
    payload: ConflictCheckRequest,
    user: dict = Depends(get_current_user),
):
    """Check for time and topic conflicts when scheduling a post in an org."""
    db = get_supabase()

    # Verify membership
    member = db.table("org_members") \
        .select("role") \
        .eq("org_id", org_id) \
        .eq("user_id", user["id"]) \
        .execute()
    if not member.data:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    from app.services.conflict_detector import check_conflicts
    result = await check_conflicts(
        org_id=org_id,
        scheduled_at=payload.scheduled_at,
        body=payload.body,
        exclude_content_id=payload.exclude_content_id,
    )
    return result
