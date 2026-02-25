"""Routes for polling async task status and notifications."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.task_manager import get_task, list_tasks, get_completed_unseen

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
async def get_all_tasks(
    pending_only: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    """List all tasks for the current user."""
    return {"tasks": list_tasks(user["id"], pending_only=pending_only)}


@router.get("/notifications")
async def get_notifications(
    since: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Get tasks completed since a given timestamp — used for toast notifications."""
    return {"tasks": get_completed_unseen(user["id"], since=since)}


@router.get("/{task_id}")
async def get_task_status(
    task_id: str,
    user: dict = Depends(get_current_user),
):
    """Get the status of a specific task."""
    info = get_task(user["id"], task_id)
    if not info:
        return {"task_id": task_id, "status": "not_found"}
    return info.to_dict()
