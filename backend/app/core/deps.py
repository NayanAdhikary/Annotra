from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.models.api_key import ApiKey
from sqlalchemy import select
import hashlib
from datetime import datetime, timezone

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})

    token = credentials.credentials

    # API key path — starts with "ann_"
    if token.startswith("ann_"):
        key_hash = hashlib.sha256(token.encode()).hexdigest()
        api_key = (await db.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash)
        )).scalar_one_or_none()

        if api_key is None or api_key.revoked_at is not None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")

        if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API key expired")

        user = await db.get(User, api_key.user_id)
        if user is None or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User disabled")

        api_key.last_used_at = datetime.now(timezone.utc)
        await db.commit()
        return user

    # JWT path
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    user = await db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")
    return user


def require_role(*allowed: UserRole):
    allowed_values = {r.value for r in allowed}

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_values:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return _dep
