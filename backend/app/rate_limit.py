"""Simple in-memory per-user rate limiter for generation endpoints."""

import time
from collections import defaultdict
from fastapi import HTTPException, Request, Depends
from app.auth import get_current_user


class RateLimiter:
    """Token-bucket style rate limiter keyed by (user_id, bucket_name)."""

    def __init__(self) -> None:
        # (user_id, bucket) -> list of timestamps
        self._hits: dict[tuple[str, str], list[float]] = defaultdict(list)

    def check(self, user_id: str, bucket: str, max_requests: int, window_seconds: int) -> None:
        """Raise 429 if the user has exceeded max_requests within the rolling window."""
        key = (user_id, bucket)
        now = time.time()
        cutoff = now - window_seconds

        # Prune old entries
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]

        if len(self._hits[key]) >= max_requests:
            retry_after = int(self._hits[key][0] + window_seconds - now) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds // 60} minutes. Try again in {retry_after}s.",
            )

        self._hits[key].append(now)


# Singleton instance
_limiter = RateLimiter()


def rate_limit(bucket: str, max_requests: int = 10, window_seconds: int = 3600):
    """FastAPI dependency factory that enforces a per-user rate limit.

    Usage:
        @router.post("/generate", dependencies=[Depends(rate_limit("generate", 10, 3600))])
    """
    async def _check(user: dict = Depends(get_current_user)):
        _limiter.check(user["id"], bucket, max_requests, window_seconds)
    return _check
