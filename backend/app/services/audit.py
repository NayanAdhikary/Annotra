from typing import Any, Optional
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.audit_log import AuditLog


async def audit(
    db: AsyncSession,
    *,
    user: Optional[User],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    meta: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Record an audit log entry. Non-blocking — the caller does not await
    the commit for correctness; if the audit write fails it should not
    break the underlying operation.

    Usage:
        await audit(db, user=user, action="user.role_change",
                    resource_type="user", resource_id=target.id,
                    meta={"from": old_role, "to": new_role},
                    request=request)
        await db.commit()
    """
    entry = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=request.client.host if request and request.client else None,
        user_agent=(request.headers.get("user-agent") or "")[:500] if request else None,
        meta=meta or {},
    )
    db.add(entry)