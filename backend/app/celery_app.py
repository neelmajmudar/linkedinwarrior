"""Celery application factory and configuration.

This module creates the Celery instance used by workers and Beat scheduler.
It is intentionally separate from FastAPI so workers can import it without
loading the entire web application.

Run worker:   celery -A app.celery_app worker --loglevel=info --concurrency=4
Run beat:     celery -A app.celery_app beat --loglevel=info
Run both:     celery -A app.celery_app worker --beat --loglevel=info  (dev only)
"""

from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery = Celery(
    "linkedinwarrior",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Reliability: acknowledge tasks only after execution succeeds
    task_acks_late=True,
    worker_prefetch_multiplier=1,

    # Result expiry (1 hour — we persist outcomes in Supabase, not Redis)
    result_expires=3600,

    # Retry broker connection on startup
    broker_connection_retry_on_startup=True,

    # Default queue
    task_default_queue="default",

    # Rate-limit LinkedIn API calls globally across all workers
    task_routes={
        "app.tasks.publish_post_task": {"queue": "publishing"},
        "app.tasks.analytics_snapshot_task": {"queue": "analytics"},
        "app.tasks.*": {"queue": "default"},
    },

    # Celery Beat schedule — replaces APScheduler periodic jobs
    beat_schedule={
        "enqueue-due-posts-every-2-min": {
            "task": "app.tasks.enqueue_due_posts",
            "schedule": 120.0,  # every 2 minutes
        },
        "daily-analytics-snapshot": {
            "task": "app.tasks.daily_analytics_snapshot",
            "schedule": crontab(hour=6, minute=0),
        },
        "purge-old-history-every-6h": {
            "task": "app.tasks.purge_old_history",
            "schedule": crontab(minute=0, hour="*/6"),
        },
    },
)

# Auto-discover tasks in app.tasks module
celery.autodiscover_tasks(["app"])
