"""Simple in-process rate limit (per client IP). Disable with RATE_LIMIT_PER_MINUTE=0."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.config import settings

_lock = asyncio.Lock()
# client_ip -> list of request timestamps (monotonic) in the last 60s
_buckets: dict[str, list[float]] = defaultdict(list)
_WINDOW_SEC = 60.0


async def rate_limit_dependency(request: Request) -> None:
    limit = settings.rate_limit_per_minute
    if limit <= 0:
        return

    client = request.client
    key = client.host if client else "unknown"
    now = time.monotonic()

    async with _lock:
        ts = _buckets[key]
        cutoff = now - _WINDOW_SEC
        ts[:] = [t for t in ts if t >= cutoff]
        if len(ts) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded; retry later.",
            )
        ts.append(now)
