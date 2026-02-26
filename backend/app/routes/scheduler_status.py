"""API routes for monitoring the scheduling system health."""

from fastapi import APIRouter, Depends
from app.auth import get_current_user

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.get("/health")
async def scheduler_health(user: dict = Depends(get_current_user)):
    """Return the current scheduler mode and connectivity status."""
    from app.scheduler import _USE_CELERY

    result = {"mode": "celery" if _USE_CELERY else "apscheduler"}

    if _USE_CELERY:
        try:
            from app.celery_app import celery
            # Ping workers to check if any are alive
            inspect = celery.control.inspect(timeout=2)
            active = inspect.active()
            stats = inspect.stats()
            result["workers"] = {
                "online": len(active) if active else 0,
                "names": list(active.keys()) if active else [],
            }
            result["healthy"] = bool(active)
        except Exception as e:
            result["workers"] = {"online": 0, "error": str(e)}
            result["healthy"] = False
    else:
        from app.scheduler import _apscheduler
        result["healthy"] = _apscheduler is not None and _apscheduler.running
        if _apscheduler and _apscheduler.running:
            result["jobs"] = [
                {"id": job.id, "next_run": str(job.next_run_time)}
                for job in _apscheduler.get_jobs()
            ]

    return result


@router.get("/queue-depth")
async def queue_depth(user: dict = Depends(get_current_user)):
    """Return the number of pending tasks in each Celery queue."""
    from app.scheduler import _USE_CELERY

    if not _USE_CELERY:
        return {"mode": "apscheduler", "queues": {}}

    try:
        import redis as _redis
        from app.config import settings
        r = _redis.from_url(settings.REDIS_URL)

        queues = {}
        for queue_name in ["default", "publishing", "analytics"]:
            queues[queue_name] = r.llen(queue_name)

        return {"mode": "celery", "queues": queues}
    except Exception as e:
        return {"mode": "celery", "error": str(e)}
