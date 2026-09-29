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
import json
from app.models.task import Project, Task, Label, ImageAsset, TaskComment
from app.models.annotation import Annotation
from app.models.audit_log import AuditLog
from app.models.task_assignment import TaskAssignment
from app.models.system_config import SystemConfig
from app.models.api_key import ApiKey
from app.models.admin_notification import AdminNotification
from app.services.audit import audit
from app.services import cache
from app.schemas.auth import UserResponse
from app.schemas.admin import (
    AdminCreateUser, AdminUpdateUser, AdminResetPassword, AdminUserDetail,
    SystemStats, AuditLogPage, AuditLogEntry, HealthReport,
    AssignTaskRequest, TaskAssignmentResponse, ReviewAction,
    AdminProjectRow, AdminTaskRow, ConfigEntry, ConfigPatch,
    ApiKeyCreate, ApiKeyResponse, ApiKeyCreated,
    BulkUserCreate, AnalyticsPoint, AnalyticsSeries,
    ImpersonateResponse, NotificationCreate, NotificationResponse,
)
from app.schemas.project import QualityRow, QualityReport
from app.routers.projects import _task_stats
from app.core.security import hash_password, generate_refresh_token

router = APIRouter()
ADMIN_ONLY = Depends(require_role(UserRole.ADMIN))


# ---------------- System stats ----------------

@router.get("/stats", response_model=SystemStats)
async def system_stats(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    async def compute():
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

        return {
            "total_users": total_users,
            "active_users_7d": active_users_7d,
            "total_projects": total_projects,
            "total_tasks": total_tasks,
            "total_images": total_images,
            "total_videos": 0,
            "total_annotations": total_annotations,
            "annotations_today": annotations_today,
            "storage_bytes": total_bytes,
            "disk_free_bytes": disk_free,
        }
    
    data = await cache.get_or_set("admin_stats", ("global",), 30, compute)
    return SystemStats(**data)


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
    if not users:
        return out
        
    u_ids = [u.id for u in users]
    proj_counts = dict((await db.execute(
        select(Project.owner_id, func.count()).where(Project.owner_id.in_(u_ids)).group_by(Project.owner_id)
    )).all())
    
    ann_counts = dict((await db.execute(
        select(Annotation.created_by, func.count())
        .where(Annotation.created_by.in_(u_ids))
        .group_by(Annotation.created_by)
    )).all())
    
    session_counts = dict((await db.execute(
        select(RefreshToken.user_id, func.count())
        .where(RefreshToken.user_id.in_(u_ids), RefreshToken.revoked_at.is_(None), RefreshToken.expires_at > datetime.now(timezone.utc))
        .group_by(RefreshToken.user_id)
    )).all())

    for u in users:
        out.append(AdminUserDetail(
            id=u.id, email=u.email, username=u.username, full_name=u.full_name,
            role=u.role, is_active=u.is_active,
            last_login_at=u.last_login_at, created_at=u.created_at,
            project_count=proj_counts.get(u.id, 0), task_count=0,
            annotation_count=ann_counts.get(u.id, 0), active_sessions=session_counts.get(u.id, 0),
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

import asyncio

from sqlalchemy import text
import psutil
import time
from app.main import _START_TIME

@router.get("/health")
async def health(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    t0 = time.perf_counter()
    await db.execute(text("SELECT 1"))
    db_ping_ms = int((time.perf_counter() - t0) * 1000)

    redis_ok = False
    redis_ping_ms = 0
    try:
        r = get_redis()
        t1 = time.perf_counter()
        await asyncio.wait_for(r.ping(), timeout=1.0)
        redis_ping_ms = int((time.perf_counter() - t1) * 1000)
        redis_ok = True
    except Exception:
        pass

    # DB pool stats
    from app.core.database import engine
    pool = engine.pool
    pool_stats = {
        "size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }

    # Disk usage
    disk = psutil.disk_usage("/data")

    celery_workers = 0
    try:
        from app.workers import celery_app
        inspect = celery_app.control.inspect(timeout=1.0)
        pong = await asyncio.to_thread(inspect.ping) or {}
        celery_workers = len(pong)
    except Exception:
        pass

    return {
        "database": {"ok": True, "ping_ms": db_ping_ms, "pool": pool_stats},
        "redis": {"ok": redis_ok, "ping_ms": redis_ping_ms},
        "celery": {"workers": celery_workers},
        "storage": {
            "total_gb": round(disk.total / 1e9, 2),
            "used_gb": round(disk.used / 1e9, 2),
            "free_gb": round(disk.free / 1e9, 2),
            "percent": disk.percent,
        },
        "uptime_sec": int(time.time() - _START_TIME),
    }


# ---------------- Projects (admin view) ----------------

@router.get("/projects", response_model=list[AdminProjectRow])
async def list_all_projects(
    q: str | None = Query(default=None),
    owner_id: int | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = ADMIN_ONLY,
):
    stmt = select(Project).order_by(Project.created_at.desc())
    if q:
        stmt = stmt.where(func.lower(Project.name).like(f"%{q.lower()}%"))
    if owner_id is not None:
        stmt = stmt.where(Project.owner_id == owner_id)
    stmt = stmt.limit(limit).offset(offset)
    projects = (await db.execute(stmt)).scalars().all()

    out = []
    if not projects:
        return out
        
    p_ids = [p.id for p in projects]
    owner_ids = list({p.owner_id for p in projects})
    users_dict = dict((await db.execute(select(User.id, User).where(User.id.in_(owner_ids)))).all())
    
    task_counts = dict((await db.execute(select(Task.project_id, func.count()).where(Task.project_id.in_(p_ids)).group_by(Task.project_id))).all())
    
    img_counts = dict((await db.execute(
        select(Task.project_id, func.count(ImageAsset.id))
        .join(Task, Task.id == ImageAsset.task_id)
        .where(Task.project_id.in_(p_ids))
        .group_by(Task.project_id)
    )).all())
    
    ann_counts = dict((await db.execute(
        select(Task.project_id, func.count(Annotation.id))
        .join(Task, Task.id == Annotation.task_id)
        .where(Task.project_id.in_(p_ids))
        .group_by(Task.project_id)
    )).all())

    for p in projects:
        owner = users_dict.get(p.owner_id)
        out.append(AdminProjectRow(
            id=p.id, name=p.name, description=p.description,
            owner_id=p.owner_id,
            owner_email=owner.email if owner else None,
            owner_name=(owner.full_name or owner.username) if owner else None,
            task_count=task_counts.get(p.id, 0), image_count=img_counts.get(p.id, 0),
            annotation_count=ann_counts.get(p.id, 0), created_at=p.created_at,
        ))
    return out


@router.get("/projects/{project_id}", response_model=AdminProjectRow)
async def get_admin_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = ADMIN_ONLY,
):
    p = await db.get(Project, project_id)
    if p is None:
        raise HTTPException(404, "Project not found")

    owner = await db.get(User, p.owner_id)
    task_count = (await db.execute(
        select(func.count()).select_from(Task).where(Task.project_id == project_id)
    )).scalar_one()
    image_count = (await db.execute(
        select(func.count()).select_from(ImageAsset)
        .join(Task, Task.id == ImageAsset.task_id)
        .where(Task.project_id == project_id)
    )).scalar_one()
    ann_count = (await db.execute(
        select(func.count()).select_from(Annotation)
        .join(Task, Task.id == Annotation.task_id)
        .where(Task.project_id == project_id)
    )).scalar_one()

    return AdminProjectRow(
        id=p.id, name=p.name, description=p.description,
        owner_id=p.owner_id,
        owner_email=owner.email if owner else None,
        owner_name=(owner.full_name or owner.username) if owner else None,
        task_count=task_count, image_count=image_count,
        annotation_count=ann_count, created_at=p.created_at,
    )


@router.post("/projects/{project_id}/reassign", status_code=204)
async def reassign_project(
    project_id: int, new_owner_id: int, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    new_owner = await db.get(User, new_owner_id)
    if new_owner is None:
        raise HTTPException(404, "New owner not found")

    old_owner_id = project.owner_id
    project.owner_id = new_owner_id
    await audit(db, user=admin, action="project.reassign",
                resource_type="project", resource_id=project_id,
                meta={"from_user_id": old_owner_id, "to_user_id": new_owner_id},
                request=request)
    await db.commit()


# ---------------- Tasks (admin view) ----------------

@router.get("/tasks", response_model=list[AdminTaskRow])
async def list_all_tasks(
    project_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    assignee_id: int | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = ADMIN_ONLY,
):
    stmt = select(Task).order_by(Task.created_at.desc())
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    if assignee_id is not None:
        stmt = stmt.join(TaskAssignment, TaskAssignment.task_id == Task.id).where(
            TaskAssignment.user_id == assignee_id
        )
    stmt = stmt.limit(limit).offset(offset)
    tasks = (await db.execute(stmt)).scalars().all()

    out = []
    if not tasks:
        return out
        
    t_ids = [t.id for t in tasks]
    p_ids = list({t.project_id for t in tasks})
    projects_dict = dict((await db.execute(select(Project.id, Project.name).where(Project.id.in_(p_ids)))).all())
    
    img_counts = dict((await db.execute(select(ImageAsset.task_id, func.count()).where(ImageAsset.task_id.in_(t_ids)).group_by(ImageAsset.task_id))).all())
    label_counts = dict((await db.execute(select(Label.task_id, func.count()).where(Label.task_id.in_(t_ids)).group_by(Label.task_id))).all())
    ann_counts = dict((await db.execute(select(Annotation.task_id, func.count(func.distinct(Annotation.image_id))).where(Annotation.task_id.in_(t_ids)).group_by(Annotation.task_id))).all())
    
    assigns = (await db.execute(select(TaskAssignment).where(TaskAssignment.task_id.in_(t_ids)))).scalars().all()
    user_ids = list({a.user_id for a in assigns})
    users_dict = dict((await db.execute(select(User.id, User).where(User.id.in_(user_ids)))).all()) if user_ids else {}
    
    assigns_by_task = {}
    for a in assigns:
        u = users_dict.get(a.user_id)
        assigns_by_task.setdefault(a.task_id, []).append({
            "user_id": a.user_id, "role": a.role,
            "name": (u.full_name or u.username) if u else None,
            "email": u.email if u else None,
        })

    for t in tasks:
        assignees = assigns_by_task.get(t.id, [])
        out.append(AdminTaskRow(
            id=t.id, project_id=t.project_id,
            project_name=projects_dict.get(t.project_id, ""),
            name=t.name, task_type=t.task_type, status=t.status,
            image_count=img_counts.get(t.id, 0), 
            label_count=label_counts.get(t.id, 0), 
            annotated_count=ann_counts.get(t.id, 0),
            annotator_count=sum(1 for a in assignees if a["role"] == "annotator"),
            reviewer_count=sum(1 for a in assignees if a["role"] == "reviewer"),
            assignees=assignees,
            created_at=t.created_at,
        ))
    return out


@router.post("/tasks/{task_id}/assign", response_model=TaskAssignmentResponse,
             status_code=201)
async def assign_task(
    task_id: int, payload: AssignTaskRequest, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    user = await db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(404, "User not found")

    # Deduplicate
    existing = (await db.execute(
        select(TaskAssignment).where(
            TaskAssignment.task_id == task_id,
            TaskAssignment.user_id == payload.user_id,
            TaskAssignment.role == payload.role,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Already assigned")

    assignment = TaskAssignment(
        task_id=task_id, user_id=payload.user_id,
        role=payload.role, assigned_by=admin.id,
    )
    db.add(assignment)
    await db.flush()

    from app.services.notification import notify
    await notify(
        db,
        user_id=payload.user_id,
        kind="task_assigned",
        title=f"You've been assigned to {task.name}",
        body=f"Role: {payload.role}",
        link=f"/tasks/{task.id}",
        resource_type="task",
        resource_id=task.id,
    )

    await audit(db, user=admin, action="task.assign",
                resource_type="task", resource_id=task_id,
                meta={"user_id": payload.user_id, "role": payload.role},
                request=request)
    await db.commit()
    await db.refresh(assignment)

    return TaskAssignmentResponse(
        id=assignment.id, task_id=task_id, user_id=payload.user_id,
        role=payload.role, assigned_at=assignment.assigned_at,
        user_email=user.email, user_name=user.full_name or user.username,
    )


@router.delete("/tasks/{task_id}/assign/{user_id}", status_code=204)
async def unassign_task(
    task_id: int, user_id: int, request: Request,
    role: str = Query(...),
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    result = await db.execute(
        delete(TaskAssignment).where(
            TaskAssignment.task_id == task_id,
            TaskAssignment.user_id == user_id,
            TaskAssignment.role == role,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Assignment not found")

    await audit(db, user=admin, action="task.unassign",
                resource_type="task", resource_id=task_id,
                meta={"user_id": user_id, "role": role},
                request=request)
    await db.commit()


# ---------------- Review workflow ----------------

@router.post("/tasks/{task_id}/review")
async def review_annotations(
    task_id: int, payload: ReviewAction, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    if task.status == "completed":
        raise HTTPException(423, "This task is completed and locked for editing")
    if task.status == "archived":
        raise HTTPException(423, "This task is archived")

    status_map = {
        "accept": "accepted",
        "reject": "rejected",
        "fix": "fixed",
    }
    new_status = status_map[payload.action]
    now = datetime.now(timezone.utc)

    res = await db.execute(
        select(Annotation).where(
            Annotation.id.in_(payload.annotation_ids),
            Annotation.task_id == task_id,
        )
    )
    anns = res.scalars().all()

    for a in anns:
        a.review_status = new_status
        a.reviewed_by = admin.id
        a.reviewed_at = now
        a.review_comment = payload.comment
        
    await cache.invalidate("review_queue", task_id)
    await audit(db, user=admin, action=f"annotation.review_{payload.action}",
                resource_type="task", resource_id=task_id,
                meta={"count": len(anns), "annotation_ids": payload.annotation_ids[:20]},
                request=request)
    
    if payload.action == "reject":
        task = await db.get(Task, task_id)
        from app.services.notification import notify
        for ann in anns:
            if ann.created_by and ann.created_by != admin.id:
                await notify(
                    db,
                    user_id=ann.created_by,
                    kind="review_rejected",
                    title=f"Annotation rejected on '{task.name}'",
                    body=payload.comment or "Reviewer rejected this annotation.",
                    link=f"/tasks/{task.id}?annotation={ann.id}",
                    resource_type="annotation",
                    resource_id=ann.id,
                )

    await db.commit()
    return {"updated": len(anns), "status": new_status}


# ---------------- Sessions ----------------

@router.get("/users/{user_id}/sessions")
async def list_user_sessions(
    user_id: int, db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY,
):
    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(RefreshToken)
        .where(RefreshToken.user_id == user_id)
        .order_by(RefreshToken.created_at.desc())
        .limit(50)
    )).scalars().all()

    return [
        {
            "id": r.id,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
            "revoked_at": r.revoked_at,
            "user_agent": r.user_agent,
            "ip_address": r.ip_address,
            "is_active": r.revoked_at is None and r.expires_at > now,
        }
        for r in rows
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def kill_session(
    session_id: int, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    rt = await db.get(RefreshToken, session_id)
    if rt is None:
        raise HTTPException(404, "Session not found")
    rt.revoked_at = datetime.now(timezone.utc)
    await audit(db, user=admin, action="session.kill",
                resource_type="user", resource_id=rt.user_id,
                meta={"session_id": session_id}, request=request)
    await db.commit()


# ---------------- Audit export ----------------

@router.get("/audit/export")
async def export_audit(
    action: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY,
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(50000)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if since:
        stmt = stmt.where(AuditLog.created_at >= since)
    if until:
        stmt = stmt.where(AuditLog.created_at <= until)

    rows = (await db.execute(stmt)).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "user_id", "user_email", "action",
        "resource_type", "resource_id", "ip_address", "user_agent", "meta",
    ])
    for r in rows:
        writer.writerow([
            r.id, r.created_at.isoformat() if r.created_at else "",
            r.user_id, r.user_email, r.action,
            r.resource_type, r.resource_id, r.ip_address,
            r.user_agent, json.dumps(r.meta or {}),
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit-log.csv"'},
    )


# ---------------- System config ----------------

@router.get("/config", response_model=list[ConfigEntry])
async def get_config(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    from app.services.config import get_all_config
    merged = await get_all_config(db)
    out = []
    for key, spec in merged.items():
        # Look up updated_at from DB if overridden
        updated_at = None
        updated_by_email = None
        if spec["is_overridden"]:
            row = (await db.execute(
                select(SystemConfig).where(SystemConfig.key == key)
            )).scalar_one_or_none()
            if row:
                updated_at = row.updated_at
                if row.updated_by:
                    u = await db.get(User, row.updated_by)
                    updated_by_email = u.email if u else None
        out.append(ConfigEntry(
            key=key, value=spec["value"], category=spec["category"],
            description=spec.get("description"),
            updated_at=updated_at or datetime.now(timezone.utc),
            updated_by_email=updated_by_email,
        ))
    return out


@router.patch("/config", status_code=204)
async def patch_config(
    payload: ConfigPatch, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    from app.services.config import set_value
    for entry in payload.entries:
        key = entry.get("key")
        value = entry.get("value")
        if not key:
            continue
        try:
            await set_value(db, key, value, admin.id)
        except ValueError as e:
            raise HTTPException(422, str(e))

    await audit(db, user=admin, action="config.update",
                meta={"keys": [e.get("key") for e in payload.entries]},
                request=request)
    await db.commit()


# ---------------- API keys ----------------

@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    keys = (await db.execute(
        select(ApiKey).where(ApiKey.revoked_at.is_(None)).order_by(ApiKey.created_at.desc())
    )).scalars().all()
    return [ApiKeyResponse.model_validate(k) for k in keys]


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=201)
async def create_api_key(
    payload: ApiKeyCreate, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    import secrets as py_secrets
    import hashlib

    raw = "ann_" + py_secrets.token_urlsafe(40)
    prefix = raw[:12]
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    key = ApiKey(
        user_id=admin.id, name=payload.name, prefix=prefix,
        key_hash=key_hash, expires_at=expires_at,
    )
    db.add(key)
    await db.flush()

    await audit(db, user=admin, action="apikey.create",
                resource_type="api_key", resource_id=key.id,
                meta={"name": payload.name, "prefix": prefix},
                request=request)
    await db.commit()
    await db.refresh(key)

    return ApiKeyCreated(
        id=key.id, name=key.name, prefix=key.prefix,
        last_used_at=key.last_used_at, expires_at=key.expires_at,
        created_at=key.created_at, revoked_at=key.revoked_at,
        raw_key=raw,
    )


@router.delete("/api-keys/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: int, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    key = await db.get(ApiKey, key_id)
    if key is None:
        raise HTTPException(404, "API key not found")
    key.revoked_at = datetime.now(timezone.utc)
    await audit(db, user=admin, action="apikey.revoke",
                resource_type="api_key", resource_id=key_id,
                meta={"prefix": key.prefix}, request=request)
    await db.commit()


# ---------------- Bulk user create ----------------

@router.post("/users/bulk", status_code=201)
async def bulk_create_users(
    payload: BulkUserCreate, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    created = []
    skipped = []
    for u in payload.users:
        existing = (await db.execute(
            select(User).where((User.email == u.email) | (User.username == u.username))
        )).scalar_one_or_none()
        if existing:
            skipped.append({"email": u.email, "reason": "already exists"})
            continue
        if u.role not in {r.value for r in UserRole}:
            skipped.append({"email": u.email, "reason": f"invalid role {u.role}"})
            continue
        user = User(
            email=u.email, username=u.username, full_name=u.full_name,
            hashed_password=hash_password(u.password), role=u.role,
        )
        db.add(user)
        created.append(u.email)

    await audit(db, user=admin, action="user.bulk_create",
                meta={"created": len(created), "skipped": len(skipped)},
                request=request)
    await db.commit()
    return {"created": created, "skipped": skipped}


# ---------------- Analytics ----------------

@router.get("/analytics/timeseries", response_model=AnalyticsSeries)
async def analytics(
    days: int = Query(default=30, le=180),
    db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY,
):
    now = datetime.now(timezone.utc)
    points = []

    for i in range(days - 1, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        ann_count = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.created_at >= day_start, Annotation.created_at < day_end)
        )).scalar_one()

        active = (await db.execute(
            select(func.count(func.distinct(RefreshToken.user_id))).select_from(RefreshToken)
            .where(RefreshToken.created_at >= day_start, RefreshToken.created_at < day_end)
        )).scalar_one()

        uploaded = (await db.execute(
            select(func.count()).select_from(ImageAsset)
            .where(ImageAsset.created_at >= day_start, ImageAsset.created_at < day_end)
        )).scalar_one()

        points.append(AnalyticsPoint(
            date=day_start.date().isoformat(),
            annotations=ann_count, active_users=active,
            images_uploaded=uploaded,
        ))
    return AnalyticsSeries(days=days, points=points)


# ---------------- Notifications ----------------

@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(db: AsyncSession = Depends(get_db), _: User = ADMIN_ONLY):
    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(AdminNotification)
        .where((AdminNotification.expires_at.is_(None)) | (AdminNotification.expires_at > now))
        .order_by(AdminNotification.created_at.desc())
        .limit(50)
    )).scalars().all()

    out = []
    for r in rows:
        creator = await db.get(User, r.created_by) if r.created_by else None
        out.append(NotificationResponse(
            id=r.id, title=r.title, message=r.message, severity=r.severity,
            created_at=r.created_at, expires_at=r.expires_at,
            created_by_email=creator.email if creator else None,
            read=False,
        ))
    return out


@router.post("/notifications", response_model=NotificationResponse, status_code=201)
async def create_notification(
    payload: NotificationCreate, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)
    n = AdminNotification(
        title=payload.title, message=payload.message,
        severity=payload.severity, created_by=admin.id,
        expires_at=expires_at,
    )
    db.add(n)
    await db.flush()
    await audit(db, user=admin, action="notification.broadcast",
                resource_type="notification", resource_id=n.id,
                meta={"title": payload.title, "severity": payload.severity},
                request=request)
    await db.commit()
    await db.refresh(n)
    return NotificationResponse(
        id=n.id, title=n.title, message=n.message, severity=n.severity,
        created_at=n.created_at, expires_at=n.expires_at,
        created_by_email=admin.email, read=False,
    )


@router.delete("/notifications/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: int, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    n = await db.get(AdminNotification, notification_id)
    if n is None:
        raise HTTPException(404, "Notification not found")
    await audit(db, user=admin, action="notification.delete",
                resource_type="notification", resource_id=notification_id,
                request=request)
    await db.delete(n)
    await db.commit()


# ---------------- Impersonation ----------------

@router.post("/impersonate/{user_id}", response_model=ImpersonateResponse)
async def impersonate(
    user_id: int, request: Request,
    db: AsyncSession = Depends(get_db), admin: User = ADMIN_ONLY,
):
    if user_id == admin.id:
        raise HTTPException(400, "Cannot impersonate yourself")

    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(404, "User not found")
    if not target.is_active:
        raise HTTPException(400, "Target user is disabled")

    # Issue tokens as the target user, but tag them with the admin's id
    from app.core.security import create_access_token
    from jose import jwt
    from app.config import settings
    from datetime import timezone as _tz

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(target.id),
        "role": target.role,
        "type": "access",
        "impersonated_by": admin.id,
        "impersonated_by_email": admin.email,
        "iat": now,
        "exp": now + timedelta(minutes=30),  # short-lived
    }
    access = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    raw_refresh, refresh_hash, expires_at = generate_refresh_token()
    db.add(RefreshToken(
        user_id=target.id, token_hash=refresh_hash, expires_at=expires_at,
        user_agent=f"impersonation-by-{admin.email}",
        ip_address=request.client.host if request.client else None,
    ))

    await audit(db, user=admin, action="admin.impersonate",
                resource_type="user", resource_id=target.id,
                meta={"target_email": target.email}, request=request)
    await db.commit()

    return ImpersonateResponse(
        access_token=access, refresh_token=raw_refresh,
        expires_in=1800, impersonated_user_id=target.id,
        impersonated_email=target.email,
    )


@router.get("/quality", response_model=QualityReport)
async def quality_report(
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = ADMIN_ONLY,
):
    """
    Per-user annotation quality. Acceptance rate is the key metric.
    Uses `review_status` on annotations (set in Day 13C) and `reviewed_by`.
    """
    if not since:
        since = datetime.now(timezone.utc) - timedelta(days=30)
    if not until:
        until = datetime.now(timezone.utc)

    users = (await db.execute(
        select(User).where(User.is_active.is_(True)).order_by(User.email)
    )).scalars().all()

    rows = []
    for u in users:
        # Annotations this user created in the window
        created = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.created_at >= since,
                   Annotation.created_at <= until,
                   Annotation.created_by == u.id)
        )).scalar_one()

        accepted = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.review_status == "accepted",
                   Annotation.created_by == u.id)
        )).scalar_one()
        rejected = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.review_status == "rejected",
                   Annotation.created_by == u.id)
        )).scalar_one()
        fixed = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.review_status == "fixed",
                   Annotation.created_by == u.id)
        )).scalar_one()
        pending = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.review_status == "pending",
                   Annotation.created_by == u.id)
        )).scalar_one()

        denom = accepted + rejected + fixed
        rate = (accepted / denom) if denom else 0.0

        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        count_7d = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.created_at >= week_ago,
                   Annotation.created_by == u.id)
        )).scalar_one()
        avg_per_day = count_7d / 7.0

        rows.append(QualityRow(
            user_id=u.id, user_email=u.email,
            user_name=u.full_name or u.username,
            role=u.role,
            annotated_count=created,
            accepted_count=accepted,
            rejected_count=rejected,
            fixed_count=fixed,
            pending_count=pending,
            acceptance_rate=round(rate, 4),
            avg_per_day_7d=round(avg_per_day, 1),
        ))

    return QualityReport(since=since, until=until, rows=rows)

from fastapi import UploadFile, File
from typing import List
import os, uuid, io
from PIL import Image as PILImage


ALLOWED_IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
UPLOAD_ROOT = "/data/images"


@router.post("/tasks/{task_id}/images/bulk")
async def bulk_upload_images(
    task_id: int,
    files: List[UploadFile] = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    admin: User = ADMIN_ONLY,
):
    """
    Upload N images into a task in a single request. Validates each with PIL,
    stores under /data/images/{task_id}/, returns per-file results.
    """
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    if task.task_type != "image":
        raise HTTPException(422, "This task is not an image task")

    task_dir = os.path.join(UPLOAD_ROOT, str(task_id))
    os.makedirs(task_dir, exist_ok=True)

    created = []
    skipped = []

    for f in files:
        ext = os.path.splitext(f.filename or "")[1].lower()
        if ext not in ALLOWED_IMG_EXT:
            skipped.append({"filename": f.filename, "reason": "unsupported extension"})
            continue

        raw = await f.read()
        try:
            img = PILImage.open(io.BytesIO(raw))
            img.verify()
            img = PILImage.open(io.BytesIO(raw))
            w, h = img.width, img.height
        except Exception:
            skipped.append({"filename": f.filename, "reason": "invalid image"})
            continue

        safe = f"{uuid.uuid4().hex}{ext}"
        abs_path = os.path.join(task_dir, safe)
        with open(abs_path, "wb") as out:
            out.write(raw)

        asset = ImageAsset(
            task_id=task_id,
            filename=f.filename,
            width=w, height=h,
            storage_path=abs_path,
        )
        db.add(asset)
        created.append(f.filename)

    await audit(
        db, user=admin, action="project.data_upload",
        resource_type="task", resource_id=task_id,
        meta={"created": len(created), "skipped": len(skipped)},
        request=request,
    )
    await db.commit()

    return {"created": created, "skipped": skipped, "total": len(files)}


@router.post("/tasks/{task_id}/videos/bulk")
async def bulk_upload_videos(
    task_id: int,
    files: List[UploadFile] = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    admin: User = ADMIN_ONLY,
):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    if task.task_type != "video":
        raise HTTPException(422, "This task is not a video task")

    from app.models.video import VideoAsset
    from app.workers.video_worker import extract_video_frames

    video_root = "/data/videos"
    os.makedirs(os.path.join(video_root, str(task_id)), exist_ok=True)

    created = []
    for f in files:
        ext = os.path.splitext(f.filename or "")[1].lower()
        if ext not in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
            continue

        safe = f"{uuid.uuid4().hex}{ext}"
        abs_path = os.path.join(video_root, str(task_id), safe)
        with open(abs_path, "wb") as out:
            while True:
                chunk = await f.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

        video = VideoAsset(
            task_id=task_id,
            filename=f.filename or safe,
            storage_path=abs_path,
            frames_dir="",  # set after flush
            extraction_status="pending",
        )
        db.add(video)
        await db.flush()
        video.frames_dir = f"/data/frames/{video.id}"
        os.makedirs(video.frames_dir, exist_ok=True)
        created.append(video.id)

    await db.commit()
    for vid in created:
        extract_video_frames.delay(vid)

    return {"video_ids": created, "count": len(created)}


from app.models.task_assignment import TaskAssignment
from sqlalchemy import delete as sql_delete


@router.post("/tasks/{task_id}/assign/bulk")
async def bulk_assign(
    task_id: int,
    payload: dict,   # {"annotator_ids": [1,2], "reviewer_ids": [3]}
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = ADMIN_ONLY,
):
    """
    Replace the entire assignment list for a task. Idempotent — pass the full
    desired state; the endpoint reconciles add/remove.
    """
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")

    desired: list[tuple[int, str]] = []
    for uid in payload.get("annotator_ids", []) or []:
        desired.append((int(uid), "annotator"))
    for uid in payload.get("reviewer_ids", []) or []:
        desired.append((int(uid), "reviewer"))

    # Validate users exist
    for uid, _ in desired:
        if await db.get(User, uid) is None:
            raise HTTPException(404, f"User {uid} not found")

    current = (await db.execute(
        select(TaskAssignment).where(TaskAssignment.task_id == task_id)
    )).scalars().all()
    current_set = {(a.user_id, a.role) for a in current}
    desired_set = set(desired)

    # Remove entries not in the desired set
    for a in current:
        if (a.user_id, a.role) not in desired_set:
            await db.delete(a)

    # Add new entries
    from app.services.notification import notify
    for uid, role in desired:
        if (uid, role) not in current_set:
            db.add(TaskAssignment(
                task_id=task_id, user_id=uid, role=role,
                assigned_by=admin.id,
            ))
            await db.flush()
            await notify(
                db,
                user_id=uid,
                kind="task_assigned",
                title=f"You've been assigned to {task.name}",
                body=f"Role: {role}",
                link=f"/tasks/{task.id}",
                resource_type="task",
                resource_id=task.id,
            )

    await audit(
        db, user=admin, action="task.assign_bulk",
        resource_type="task", resource_id=task_id,
        meta={"annotators": payload.get("annotator_ids", []),
              "reviewers": payload.get("reviewer_ids", [])},
        request=request,
    )
    await db.commit()
    return {"ok": True, "assigned": len(desired)}