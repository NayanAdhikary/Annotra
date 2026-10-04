import json
import hashlib
from typing import Any, Callable, Awaitable
from app.core.rate_limit import get_redis


def _key(namespace: str, *parts) -> str:
    raw = ":".join(str(p) for p in parts)
    return f"cache:{namespace}:{hashlib.sha1(raw.encode()).hexdigest()}"


async def get_or_set(
    namespace: str,
    parts: tuple,
    ttl: int,
    fn: Callable[[], Awaitable[Any]],
) -> Any:
    """Return cached JSON, or compute via `fn` and cache the result."""
    redis = get_redis()
    key = _key(namespace, *parts)
    try:
        raw = await redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        pass

    value = await fn()
    try:
        await redis.setex(key, ttl, json.dumps(value))
    except Exception:
        pass
    return value


async def invalidate(namespace: str, *parts) -> None:
    redis = get_redis()
    try:
        await redis.delete(_key(namespace, *parts))
    except Exception:
        pass


async def invalidate_prefix(namespace: str) -> None:
    """Delete every key under a namespace. Use sparingly."""
    redis = get_redis()
    try:
        cursor = 0
        pattern = f"cache:{namespace}:*"
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=100)
            if keys:
                await redis.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        pass