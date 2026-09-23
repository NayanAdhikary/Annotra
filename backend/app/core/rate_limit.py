import redis.asyncio as redis
from fastapi import HTTPException, status, Request
from app.config import settings

_client: redis.Redis | None = None

def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client

async def rate_limit(request: Request, key: str, limit: int, window: int) -> None:
    pass