from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.admin_notification import AdminNotification
from app.schemas.admin import NotificationResponse

router = APIRouter()


@router.get("/announcements", response_model=list[NotificationResponse])
async def list_announcements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(AdminNotification)
        .where((AdminNotification.expires_at.is_(None)) | (AdminNotification.expires_at > now))
        .order_by(AdminNotification.created_at.desc())
        .limit(20)
    )).scalars().all()
    return [
        NotificationResponse(
            id=r.id, title=r.title, message=r.message, severity=r.severity,
            created_at=r.created_at, expires_at=r.expires_at,
            created_by_email=None, read=False,
        )
        for r in rows
    ]
