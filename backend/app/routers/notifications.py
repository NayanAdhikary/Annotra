from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter()


@router.get("/notifications")
async def list_notifications(
    only_unread: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Notification).where(Notification.user_id == user.id)
    if only_unread:
        q = q.where(Notification.read_at.is_(None))
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    unread = (await db.execute(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )).scalar_one()

    return {
        "unread": unread,
        "items": [
            {
                "id": n.id, "kind": n.kind,
                "title": n.title, "body": n.body,
                "link": n.link, "read": n.read_at is not None,
                "resource_type": n.resource_type, "resource_id": n.resource_id,
                "created_at": n.created_at.isoformat(),
            }
            for n in rows
        ],
    }


@router.post("/notifications/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(404)
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        await db.commit()


@router.post("/notifications/read-all", status_code=204)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()