import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.core.config import settings


class SlidingWindowLimiter:
    """Lightweight in-memory sliding-window rate limiter keyed by scope and client IP."""

    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        now = time.monotonic()
        cutoff = now - window_seconds
        bucket = self._buckets[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= max_requests:
            retry_after = max(1, int(bucket[0] + window_seconds - now) + 1)
            return False, retry_after
        bucket.append(now)
        return True, 0

    def reset(self) -> None:
        self._buckets.clear()


_limiter = SlidingWindowLimiter()


def reset_rate_limiter() -> None:
    """Clear all rate-limit counters (used by tests)."""
    _limiter.reset()


def rate_limit(scope: str, *, max_requests: int, window_seconds: int) -> Callable[[Request], None]:
    """FastAPI dependency enforcing a per-IP sliding window limit for sensitive endpoints."""

    def _dependency(request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        client_ip = request.client.host if request.client else "unknown"
        allowed, retry_after = _limiter.check(
            f"{scope}:{client_ip}", max_requests=max_requests, window_seconds=window_seconds
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente."
                ),
                headers={"Retry-After": str(retry_after)},
            )

    return _dependency
