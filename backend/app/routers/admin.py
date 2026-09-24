from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, update
import os, shutil

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.rate_limit import get_redis
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.models.task import Project, Task, Label, ImageAsset
from app.models.annotation import Annotation
from app.models.audit_log import AuditLog
from app.services.audit import audit
from app.schemas.auth import UserResponse
from app.schemas.admin import (
    AdminCreateUser, AdminUpdateUser, AdminResetPassword, AdminUserDetail,
    SystemStats, AuditLogPage, AuditLogEntry, HealthReport,
)

router = APIRouter()
ADMIN_ONLY = Depends(require_role(UserRole.ADMIN))


# ---------------- System stats ----------------

@router.get("/stats", response_model=SystemStats)
async def system_stats(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_users_7d = (await db.execute(
        select(func.count()).select_from(User).where(User.last_login_at >= week_ago)
    )).scalar_one()
    total_projects = (await db.execute(select(func.count()).select_from(Project))).scalar_one()
    total_tasks = (await db.execute(select(func.count()).select_from(Task))).scalar_one()
    total_images = (await db.execute(select(func.count()).select_from(ImageAsset))).scalar_one()
    total_annotations = (await db.execute(select(func.count()).select_from(Annotation))).scalar_one()
    annotations_today = (await db.execute(
        select(func.count()).select_from(Annotation).where(Annotation.created_at >= today_start)
    )).scalar_one()

    # Storage: sum sizes of the images directory
    total_bytes = 0
    for root, _, files in os.walk("/data/images"):
        for f in files:
            try:
                total_bytes += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass

    try:
        disk = shutil.disk_usage("/data")
        disk_free = disk.free
    except OSError:
        disk_free = 0

    return SystemStats(
        total_users=total_users,
        active_users_7d=active_users_7d,
        total_projects=total_projects,
        total_tasks=total_tasks,
        total_images=total_images,
        total_videos=0,   # wired on Day 14
        total_annotations=total_annotations,
        annotations_today=annotations_today,
        storage_bytes=total_bytes,
        disk_free_bytes=disk_free,
    )


# ---------------- Users ----------------

@router.get("/users", response_model=list[AdminUserDetail])
async def list_users(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = ADMIN_ONLY,
):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            func.lower(User.email).like(like) |
            func.lower(User.username).like(like) |
            func.lower(func.coalesce(User.full_name, "")).like(like)
        )
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    stmt = stmt.limit(limit).offset(offset)

    users = (await db.execute(stmt)).scalars().all()

    out = []
    for u in users:
        proj_count = (await db.execute(
            select(func.count()).select_from(Project).where(Project.owner_id == u.id)
        )).scalar_one()
        ann_count = (await db.execute(
            select(func.count()).select_from(Annotation).where(Annotation.created_at >= u.created_at)
        )).scalar_one()  # simplification; full query would join on user_id once we add it
        sessions = (await db.execute(
            select(func.count()).select_from(RefreshToken)
            .where(RefreshToken.user_id == u.id,
                   RefreshToken.revoked_at.is_(None),
                   RefreshToken.expires_at > datetime.now(timezone.utc))
        )).scalar_one()

        out.append(AdminUserDetail(
            id=u.id, email=u.email, username=u.username, full_name=u.full_name,
            role=u.role, is_active=u.is_active,
            last_login_at=u.last_login_at, created_at=u.created_at,
            project_count=proj_count, task_count=0,
            annotation_count=ann_count, active_sessions=sessions,
        ))
    return out


@router.post("/users", response_model=AdminUserDetail, status_code=201)
async def create_user(
    payload: AdminCreateUser,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = ADMIN_ONLY,
):
    if payload.role not in {r.value for r in UserRole}:
        raise HTTPException(422, f"Invalid role: {payload.role}")

    existing = (await db.execute(
        select(User).where((User.email == payload.email) | (User.username == payload.username))
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Email or username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()  # get user.id before commit

    await audit(
        db, user=admin, action="user.create",
        resource_type="user", resource_id=user.id,
        meta={"email": user.email, "role": user.role},
        request=request,
    )
    await db.commit()
    await db.refresh(user)

    return AdminUserDetail(
        id=user.id, email=user.email, username=user.username, full_name=user.full_name,
        role=user.role, is_active=user.is_active,
        last_login_at=user.last_login_at, created_at=user.created_at,
        project_count=0, task_count=0, annotation_count=0, active_sessions=0,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    u = await db.get(User, user_id)
    if u is None:
        raise HTTPException(404, "User not found")

    proj_count = (await db.execute(
        select(func.count()).select_from(Project).where(Project.owner_id == u.id)
    )).scalar_one()
    task_count = (await db.execute(
        select(func.count()).select_from(Task).join(Project).where(Project.owner_id == u.id)
    )).scalar_one()
    ann_count = (await db.execute(
        select(func.count()).select_from(Annotation).where(Annotation.created_at >= u.created_at)
    )).scalar_one()
    sessions = (await db.execute(
        select(func.count()).select_from(RefreshToken)
        .where(RefreshToken.user_id == u.id,
               RefreshToken.revoked_at.is_(None),
               RefreshToken.expires_at > datetime.now(timezone.utc))
    )).scalar_one()

    return AdminUserDetail(
        id=u.id, email=u.email, username=u.username, full_name=u.full_name,
        role=u.role, is_active=u.is_active,
        last_login_at=u.last_login_at, created_at=u.created_at,
        project_count=proj_count, task_count=task_count,
        annotation_count=ann_count, active_sessions=sessions,
    )


@router.patch("/users/{user_id}", response_model=AdminUserDetail)
async def update_user(
    user_id: int, payload: AdminUpdateUser, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "User not found")

    changes = {}
    if payload.full_name is not None and payload.full_name != target.full_name:
        changes["full_name"] = (target.full_name, payload.full_name)
        target.full_name = payload.full_name
    if payload.role is not None and payload.role != target.role:
        if target.id == admin.id:
            raise HTTPException(400, "Cannot change your own role")
        if payload.role not in {r.value for r in UserRole}:
            raise HTTPException(422, f"Invalid role: {payload.role}")
        changes["role"] = (target.role, payload.role)
        target.role = payload.role
    if payload.is_active is not None and payload.is_active != target.is_active:
        if target.id == admin.id:
            raise HTTPException(400, "Cannot deactivate yourself")
        changes["is_active"] = (target.is_active, payload.is_active)
        target.is_active = payload.is_active
        if not payload.is_active:
            # Kill all sessions immediately
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == target.id, RefreshToken.revoked_at.is_(None))
                .values(revoked_at=datetime.now(timezone.utc))
            )

    if changes:
        await audit(
            db, user=admin, action="user.update",
            resource_type="user", resource_id=target.id,
            meta={"changes": {k: {"from": v[0], "to": v[1]} for k, v in changes.items()}},
            request=request,
        )
    await db.commit()
    await db.refresh(target)
    return await get_user(target.id, db, admin)


@router.post("/users/{user_id}/reset-password", status_code=204)
async def reset_password(
    user_id: int, payload: AdminResetPassword, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "User not found")

    target.hashed_password = hash_password(payload.new_password)
    # Revoke all existing sessions — standard practice after a password reset.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == target.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await audit(
        db, user=admin, action="user.reset_password",
        resource_type="user", resource_id=target.id,
        request=request,
    )
    await db.commit()


@router.post("/users/{user_id}/revoke-sessions", status_code=204)
async def revoke_sessions(
    user_id: int, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "User not found")

    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == target.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await audit(
        db, user=admin, action="user.revoke_sessions",
        resource_type="user", resource_id=target.id,
        request=request,
    )
    await db.commit()


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    if user_id == admin.id:
        raise HTTPException(400, "Cannot delete yourself")
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "User not found")

    # Block deletion if the user owns projects (forces explicit cleanup)
    owned = (await db.execute(
        select(func.count()).select_from(Project).where(Project.owner_id == target.id)
    )).scalar_one()
    if owned > 0:
        raise HTTPException(
            409,
            f"User owns {owned} project(s). Reassign or delete them first, or deactivate the user instead.",
        )

    await audit(
        db, user=admin, action="user.delete",
        resource_type="user", resource_id=target.id,
        meta={"email": target.email, "username": target.username},
        request=request,
    )
    await db.delete(target)
    await db.commit()


# ---------------- Audit log ----------------

@router.get("/audit", response_model=AuditLogPage)
async def list_audit(
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = ADMIN_ONLY,
):
    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)

    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
        count_stmt = count_stmt.where(AuditLog.resource_type == resource_type)
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
        count_stmt = count_stmt.where(AuditLog.user_id == user_id)
    if since:
        stmt = stmt.where(AuditLog.created_at >= since)
        count_stmt = count_stmt.where(AuditLog.created_at >= since)
    if until:
        stmt = stmt.where(AuditLog.created_at <= until)
        count_stmt = count_stmt.where(AuditLog.created_at <= until)

    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(
        stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()

    return AuditLogPage(
        total=total,
        items=[AuditLogEntry.model_validate(r) for r in rows],
    )


# ---------------- Health ----------------

@router.get("/health", response_model=HealthReport)
async def health(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    report = HealthReport(
        database=False, redis=False, storage_writable=False,
        celery_workers=0, pending_jobs=0,
        versions={"api": "0.1.0"},
    )

    try:
        await db.execute(select(1))
        report.database = True
    except Exception:
        pass

    try:
        r = get_redis()
        await r.ping()
        report.redis = True
        # Celery uses Redis as broker; check for a known key
        # (queue names depend on your Celery config)
        try:
            report.pending_jobs = await r.llen("celery") + await r.llen("default")
        except Exception:
            pass
    except Exception:
        pass

    try:
        test_path = "/data/.healthcheck"
        os.makedirs("/data", exist_ok=True)
        with open(test_path, "w") as f:
            f.write("ok")
        os.remove(test_path)
        report.storage_writable = True
    except Exception:
        pass

    return report