from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, status

_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def enforce_rate_limit(*, key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    bucket = _BUCKETS[key]

    while bucket and (now - bucket[0]) > window_seconds:
        bucket.popleft()

    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Retry in {window_seconds}s window.",
        )

    bucket.append(now)
