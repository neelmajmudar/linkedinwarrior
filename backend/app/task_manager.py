"""In-memory async task manager for long-running generation jobs.

Tasks are stored per-user so the frontend can poll for completion and
display notifications even after the user navigates away from the tab.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine


class TaskStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class TaskType(str, Enum):
    generate = "generate"
    engage = "engage"
    research = "research"


class TaskInfo:
    __slots__ = ("id", "user_id", "task_type", "status", "result", "error", "created_at", "completed_at", "meta")

    def __init__(self, task_id: str, user_id: str, task_type: TaskType, meta: dict | None = None):
        self.id = task_id
        self.user_id = user_id
        self.task_type = task_type
        self.status = TaskStatus.pending
        self.result: Any = None
        self.error: str | None = None
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.completed_at: str | None = None
        self.meta = meta or {}

    def to_dict(self) -> dict:
        return {
            "task_id": self.id,
            "task_type": self.task_type.value,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "meta": self.meta,
        }


# Global task store: user_id -> list[TaskInfo]
_tasks: dict[str, list[TaskInfo]] = {}
_MAX_TASKS_PER_USER = 50


def _get_user_tasks(user_id: str) -> list[TaskInfo]:
    if user_id not in _tasks:
        _tasks[user_id] = []
    return _tasks[user_id]


def _prune(user_id: str) -> None:
    """Keep only the most recent tasks per user."""
    tasks = _get_user_tasks(user_id)
    if len(tasks) > _MAX_TASKS_PER_USER:
        _tasks[user_id] = tasks[-_MAX_TASKS_PER_USER:]


def create_task(
    user_id: str,
    task_type: TaskType,
    coro: Coroutine,
    meta: dict | None = None,
) -> TaskInfo:
    """Create a task entry and schedule the coroutine as a background asyncio task."""
    task_id = str(uuid.uuid4())
    info = TaskInfo(task_id, user_id, task_type, meta)
    _get_user_tasks(user_id).append(info)
    _prune(user_id)

    async def _wrapper():
        info.status = TaskStatus.running
        try:
            info.result = await coro
            info.status = TaskStatus.completed
        except Exception as exc:
            info.status = TaskStatus.failed
            info.error = str(exc)
        finally:
            info.completed_at = datetime.now(timezone.utc).isoformat()

    asyncio.create_task(_wrapper())
    return info


def get_task(user_id: str, task_id: str) -> TaskInfo | None:
    for t in _get_user_tasks(user_id):
        if t.id == task_id:
            return t
    return None


def list_tasks(user_id: str, pending_only: bool = False) -> list[dict]:
    """Return tasks for a user, optionally filtering to non-completed ones."""
    tasks = _get_user_tasks(user_id)
    if pending_only:
        tasks = [t for t in tasks if t.status in (TaskStatus.pending, TaskStatus.running)]
    return [t.to_dict() for t in tasks]


def get_completed_unseen(user_id: str, since: str | None = None) -> list[dict]:
    """Return tasks completed after *since* (ISO timestamp) — for notification polling."""
    tasks = _get_user_tasks(user_id)
    out = []
    for t in tasks:
        if t.status not in (TaskStatus.completed, TaskStatus.failed):
            continue
        if since and t.completed_at and t.completed_at <= since:
            continue
        out.append(t.to_dict())
    return out
