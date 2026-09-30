from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, distinct
from typing import List
from app.services.audit import audit
from app.services import cache
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.task import Project, Task, Label, ImageAsset, TaskComment
from app.models.task_assignment import TaskAssignment
from app.models.annotation import Annotation
from app.schemas.project import (
    ProjectCreate, ProjectResponse, TaskCreate, TaskResponse, TaskUpdate, TaskTransition,
    CommentCreate, CommentResponse, CommentUpdate, MyTaskRow
)
from app.services.task_workflow import transition_task

router = APIRouter()


async def _project_stats(db: AsyncSession, project_id: int) -> tuple[int, int, int, int, int]:
    task_count = (await db.execute(
        select(func.count()).select_from(Task).where(Task.project_id == project_id)
    )).scalar_one()
    image_count = (await db.execute(
        select(func.count()).select_from(ImageAsset)
        .join(Task, Task.id == ImageAsset.task_id)
        .where(Task.project_id == project_id)
    )).scalar_one()

    statuses = (await db.execute(
        select(Task.status, func.count()).where(Task.project_id == project_id).group_by(Task.status)
    )).all()
    by_status = {s: c for s, c in statuses}

    return (
        task_count, image_count,
        by_status.get("completed", 0),
        by_status.get("review", 0),
        by_status.get("annotation", 0),
    )


async def _assert_project_access(db: AsyncSession, project_id: int, user: User) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if project.owner_id != user.id and user.role not in (
        UserRole.ADMIN.value, UserRole.MANAGER.value,
    ):
        raise HTTPException(403, "Not your project")
    return project


async def _assert_can_read_task(db: AsyncSession, task_id: int, user: User) -> Task:
    """Allow admins/managers OR any assigned user to read a task."""
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    if user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        return task
    # Check if the user is assigned to this task
    from app.models.task_assignment import TaskAssignment
    assignment = (await db.execute(
        select(TaskAssignment).where(
            TaskAssignment.task_id == task_id,
            TaskAssignment.user_id == user.id,
        )
    )).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(403, "Not assigned to this task")
    return task


# ---------------- Projects ----------------

@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        # Admins and managers see all projects
        q = select(Project).order_by(Project.created_at.desc())
    else:
        # Regular users see projects where they have assigned tasks
        assigned_project_ids_subq = (
            select(distinct(Task.project_id))
            .join(TaskAssignment, TaskAssignment.task_id == Task.id)
            .where(TaskAssignment.user_id == user.id)
        ).scalar_subquery()
        q = (
            select(Project)
            .where(Project.id.in_(assigned_project_ids_subq))
            .order_by(Project.created_at.desc())
        )

    projects = (await db.execute(q)).scalars().all()
    out = []
    if not projects:
        return out
        
    p_ids = [p.id for p in projects]
    task_counts = dict((await db.execute(select(Task.project_id, func.count()).where(Task.project_id.in_(p_ids)).group_by(Task.project_id))).all())
    
    img_counts = dict((await db.execute(
        select(Task.project_id, func.count(ImageAsset.id))
        .join(Task, Task.id == ImageAsset.task_id)
        .where(Task.project_id.in_(p_ids))
        .group_by(Task.project_id)
    )).all())
    
    status_counts = (await db.execute(
        select(Task.project_id, Task.status, func.count())
        .where(Task.project_id.in_(p_ids))
        .group_by(Task.project_id, Task.status)
    )).all()
    
    by_status = {}
    for pid, st, c in status_counts:
        by_status.setdefault(pid, {})[st] = c

    for p in projects:
        st = by_status.get(p.id, {})
        out.append(ProjectResponse(
            id=p.id, name=p.name, description=p.description,
            owner_id=p.owner_id, 
            task_count=task_counts.get(p.id, 0), 
            image_count=img_counts.get(p.id, 0),
            created_at=p.created_at,
            completed_task_count=st.get('completed', 0),
            in_review_task_count=st.get('review', 0),
            annotation_task_count=st.get('annotation', 0),
        ))
    return out


@router.post("/projects", response_model=ProjectResponse,
             status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(
        name=payload.name,
        description=payload.description,
        owner_id=user.id,
    )
    db.add(project)
    await db.flush()
    await audit(db, user=user, action="project.create",
                resource_type="project", resource_id=project.id,
                meta={"name": project.name}, request=request)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        owner_id=project.owner_id, task_count=0, image_count=0,
        created_at=project.created_at,
    )


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _assert_project_access(db, project_id, user)
    tc, ic, cc, rc, ac = await _project_stats(db, project_id)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        owner_id=project.owner_id, task_count=tc, image_count=ic,
        created_at=project.created_at,
        completed_task_count=cc,
        in_review_task_count=rc,
        annotation_task_count=ac,
    )


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _assert_project_access(db, project_id, user)
    await audit(db, user=user, action="project.delete",
                resource_type="project", resource_id=project.id,
                meta={"name": project.name}, request=request)
    await db.delete(project)
    await db.commit()


# ---------------- Tasks ----------------

async def _task_stats(db: AsyncSession, task_id: int) -> tuple[int, int, int]:
    ic = (await db.execute(
        select(func.count()).select_from(ImageAsset).where(ImageAsset.task_id == task_id)
    )).scalar_one()
    lc = (await db.execute(
        select(func.count()).select_from(Label).where(Label.task_id == task_id)
    )).scalar_one()
    ac = (await db.execute(
        select(func.count(func.distinct(Annotation.image_id)))
        .where(Annotation.task_id == task_id)
    )).scalar_one()
    return ic, lc, ac

async def _task_response(db: AsyncSession, t: Task) -> TaskResponse:
    project = await db.get(Project, t.project_id)
    ic, lc, ac = await _task_stats(db, t.id)

    comment_count = (await db.execute(
        select(func.count()).select_from(TaskComment).where(TaskComment.task_id == t.id)
    )).scalar_one()
    open_comments = (await db.execute(
        select(func.count()).select_from(TaskComment)
        .where(TaskComment.task_id == t.id, TaskComment.resolved.is_(False))
    )).scalar_one()

    assigns = (await db.execute(
        select(TaskAssignment).where(TaskAssignment.task_id == t.id)
    )).scalars().all()
    assignees = []
    for a in assigns:
        u = await db.get(User, a.user_id)
        assignees.append({
            "user_id": a.user_id, "role": a.role,
            "name": (u.full_name or u.username) if u else None,
            "email": u.email if u else None,
        })

    return TaskResponse(
        id=t.id, project_id=t.project_id,
        project_name=project.name if project else None,
        name=t.name, task_type=t.task_type, status=t.status,
        priority=t.priority, due_at=t.due_at,
        description=t.description, instructions=t.instructions,
        image_count=ic, label_count=lc, annotated_count=ac,
        comment_count=comment_count, open_comment_count=open_comments,
        assignees=assignees,
        archived_at=t.archived_at, completed_at=t.completed_at,
        created_at=t.created_at, updated_at=t.updated_at,
        last_submitted_at=t.last_submitted_at, last_submitted_by=t.last_submitted_by,
    )


@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")

    if user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        # Admins and managers see all tasks
        tasks = (await db.execute(
            select(Task).where(Task.project_id == project_id).order_by(Task.created_at.desc())
        )).scalars().all()
    else:
        # Regular users only see tasks they are assigned to
        tasks = (await db.execute(
            select(Task)
            .join(TaskAssignment, TaskAssignment.task_id == Task.id)
            .where(Task.project_id == project_id, TaskAssignment.user_id == user.id)
            .order_by(Task.created_at.desc())
        )).scalars().all()

    out = []
    if not tasks:
        return out
        
    t_ids = [t.id for t in tasks]
    img_counts = dict((await db.execute(select(ImageAsset.task_id, func.count()).where(ImageAsset.task_id.in_(t_ids)).group_by(ImageAsset.task_id))).all())
    label_counts = dict((await db.execute(select(Label.task_id, func.count()).where(Label.task_id.in_(t_ids)).group_by(Label.task_id))).all())
    ann_counts = dict((await db.execute(select(Annotation.task_id, func.count(func.distinct(Annotation.image_id))).where(Annotation.task_id.in_(t_ids)).group_by(Annotation.task_id))).all())
    
    com_counts = dict((await db.execute(select(TaskComment.task_id, func.count()).where(TaskComment.task_id.in_(t_ids)).group_by(TaskComment.task_id))).all())
    open_com_counts = dict((await db.execute(select(TaskComment.task_id, func.count()).where(TaskComment.task_id.in_(t_ids), TaskComment.resolved.is_(False)).group_by(TaskComment.task_id))).all())
    
    assigns = (await db.execute(select(TaskAssignment).where(TaskAssignment.task_id.in_(t_ids)))).scalars().all()
    user_ids = list({a.user_id for a in assigns})
    users_dict = dict((await db.execute(select(User.id, User).where(User.id.in_(user_ids)))).all()) if user_ids else {}
    
    assigns_by_task = {}
    for a in assigns:
        u = users_dict.get(a.user_id)
        assigns_by_task.setdefault(a.task_id, []).append({
            'user_id': a.user_id, 'role': a.role,
            'name': (u.full_name or u.username) if u else None,
            'email': u.email if u else None,
        })

    for t in tasks:
        assignees = assigns_by_task.get(t.id, [])
        out.append(TaskResponse(
            id=t.id, project_id=t.project_id,
            project_name=project.name if project else None,
            name=t.name, task_type=t.task_type, status=t.status,
            priority=t.priority, due_at=t.due_at,
            description=t.description, instructions=t.instructions,
            image_count=img_counts.get(t.id, 0), label_count=label_counts.get(t.id, 0),
            annotated_count=ann_counts.get(t.id, 0),
            comment_count=com_counts.get(t.id, 0), open_comment_count=open_com_counts.get(t.id, 0),
            assignees=assignees,
            archived_at=t.archived_at, completed_at=t.completed_at,
            created_at=t.created_at, updated_at=t.updated_at,
            last_submitted_at=t.last_submitted_at, last_submitted_by=t.last_submitted_by,
        ))
    return out


@router.post("/projects/{project_id}/tasks", response_model=TaskResponse,
             status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: int,
    payload: TaskCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_project_access(db, project_id, user)
    if payload.task_type not in ("image", "video"):
        raise HTTPException(422, "task_type must be 'image' or 'video'")

    task = Task(
        project_id=project_id, name=payload.name, task_type=payload.task_type,
        priority=payload.priority, due_at=payload.due_at,
        description=payload.description, instructions=payload.instructions
    )
    db.add(task)
    await db.flush()
    await audit(db, user=user, action="task.create",
                resource_type="task", resource_id=task.id,
                meta={"name": task.name}, request=request)
    await db.commit()
    await db.refresh(task)
    return await _task_response(db, task)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db),
                   user: User = Depends(get_current_user)):
    async def compute():
        t = await db.get(Task, task_id)
        if t is None:
            raise HTTPException(404, "Task not found")
        resp = await _task_response(db, t)
        # return a dict so it can be cached cleanly as JSON
        # datetime fields need to be handled, but model_dump with mode='json' is great
        return resp.model_dump(mode='json')
        
    data = await cache.get_or_set("task_stats", (task_id,), 10, compute)
    return TaskResponse(**data)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int, payload: TaskUpdate, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = await db.get(Task, task_id)
    if t is None:
        raise HTTPException(404, "Task not found")
    project = await db.get(Project, t.project_id)
    if project.owner_id != user.id and user.role not in (
        UserRole.ADMIN.value, UserRole.MANAGER.value,
    ):
        raise HTTPException(403, "Not your task")

    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(t, k, v)

    if changes:
        await audit(db, user=user, action="task.update",
                    resource_type="task", resource_id=t.id,
                    meta={"fields": list(changes.keys())}, request=request)
    await db.commit()
    await db.refresh(t)
    return await _task_response(db, t)


@router.post("/tasks/{task_id}/transition", response_model=TaskResponse)
async def task_transition(
    task_id: int, payload: TaskTransition, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = await db.get(Task, task_id)
    if t is None:
        raise HTTPException(404, "Task not found")

    old_status = t.status
    t = await transition_task(db, t, payload.to_status, user)

    from datetime import datetime, timezone
    if t.status == "review":
        t.last_submitted_at = datetime.now(timezone.utc)
        t.last_submitted_by = user.id

    from app.services.notification import notify_task_assignees
    # Notifications on status change
    if old_status != t.status:
        if t.status == "review":
            await notify_task_assignees(
                db, task=t, exclude_user_id=user.id,
                kind="task_submitted_for_review",
                title=f"'{t.name}' is ready for review",
                body=f"Submitted by {user.full_name or user.username}",
                role_filter="reviewer",
            )
        elif t.status == "annotation" and old_status == "review":
            await notify_task_assignees(
                db, task=t, exclude_user_id=user.id,
                kind="review_rejected",
                title=f"'{t.name}' was sent back",
                body=f"Reopened by {user.full_name or user.username}",
                role_filter="annotator",
            )
        elif t.status == "completed":
            await notify_task_assignees(
                db, task=t, exclude_user_id=user.id,
                kind="task_completed",
                title=f"'{t.name}' was approved",
                body="The task is now complete.",
            )

    await cache.invalidate_prefix("admin_stats")
    await cache.invalidate("task_stats", task_id)
    await audit(db, user=user, action="task.transition",
                resource_type="task", resource_id=t.id,
                meta={"from": old_status, "to": t.status}, request=request)
    await db.commit()
    return await _task_response(db, t)


# ---------------- Comments ----------------

@router.get("/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    task_id: int,
    include_resolved: bool = True,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(TaskComment).where(TaskComment.task_id == task_id)
    if not include_resolved:
        q = q.where(TaskComment.resolved.is_(False))
    q = q.order_by(TaskComment.created_at.asc())
    rows = (await db.execute(q)).scalars().all()
    return [CommentResponse.model_validate(r) for r in rows]


@router.post("/tasks/{task_id}/comments", response_model=CommentResponse,
             status_code=201)
async def create_comment(
    task_id: int, payload: CommentCreate, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = await db.get(Task, task_id)
    if t is None:
        raise HTTPException(404, "Task not found")

    c = TaskComment(
        task_id=task_id, user_id=user.id,
        user_email=user.email,
        user_name=user.full_name or user.username,
        body=payload.body, frame=payload.frame,
        annotation_id=payload.annotation_id,
    )
    db.add(c)
    await db.flush()

    from app.services.notification import notify_task_assignees
    link = f"/tasks/{task_id}"
    if payload.annotation_id:
        link += f"?annotation={payload.annotation_id}"
    
    await notify_task_assignees(
        db, task=t, exclude_user_id=user.id,
        kind="new_comment",
        title=f"New comment on '{t.name}'",
        body=payload.body,
        link=link,
    )

    await audit(db, user=user, action="task.comment_create",
                resource_type="task", resource_id=task_id,
                meta={"comment_id": c.id, "frame": payload.frame},
                request=request)
    await db.commit()
    await db.refresh(c)
    return CommentResponse.model_validate(c)


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int, payload: CommentUpdate, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await db.get(TaskComment, comment_id)
    if c is None:
        raise HTTPException(404, "Comment not found")

    # Only the author can edit the body; anyone with task access can resolve
    if payload.body is not None and c.user_id != user.id:
        raise HTTPException(403, "Only the author can edit a comment")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)

    await audit(db, user=user, action="task.comment_update",
                resource_type="task", resource_id=c.task_id,
                meta={"comment_id": comment_id}, request=request)
    await db.commit()
    await db.refresh(c)
    return CommentResponse.model_validate(c)


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await db.get(TaskComment, comment_id)
    if c is None:
        raise HTTPException(404, "Comment not found")
    if c.user_id != user.id and user.role not in (
        UserRole.ADMIN.value, UserRole.MANAGER.value,
    ):
        raise HTTPException(403, "Not allowed")

    await audit(db, user=user, action="task.comment_delete",
                resource_type="task", resource_id=c.task_id,
                meta={"comment_id": comment_id}, request=request)
    await db.delete(c)
    await db.commit()


# ---------------- My tasks ----------------

@router.get("/me/tasks", response_model=list[MyTaskRow])
async def my_tasks(
    status_filter: str | None = Query(default=None, alias="status"),
    role: str | None = Query(default=None),  # "annotator" | "reviewer"
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Task, TaskAssignment.role)
        .join(TaskAssignment, TaskAssignment.task_id == Task.id)
        .where(TaskAssignment.user_id == user.id)
    )
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    if role:
        stmt = stmt.where(TaskAssignment.role == role)
    if not include_archived:
        stmt = stmt.where(Task.status != "archived")

    rows = (await db.execute(stmt.order_by(Task.due_at.asc().nulls_last(),
                                            Task.created_at.desc()))).all()

    out = []
    if not rows:
        return out
        
    task_ids = [t.id for t, _ in rows]
    project_ids = list({t.project_id for t, _ in rows})
    
    projects = dict((await db.execute(select(Project.id, Project.name).where(Project.id.in_(project_ids)))).all())
    
    img_counts = dict((await db.execute(
        select(ImageAsset.task_id, func.count())
        .where(ImageAsset.task_id.in_(task_ids))
        .group_by(ImageAsset.task_id)
    )).all())
    
    ann_counts = dict((await db.execute(
        select(Annotation.task_id, func.count(func.distinct(Annotation.image_id)))
        .where(Annotation.task_id.in_(task_ids))
        .group_by(Annotation.task_id)
    )).all())
    
    open_c_counts = dict((await db.execute(
        select(TaskComment.task_id, func.count())
        .where(TaskComment.task_id.in_(task_ids), TaskComment.resolved.is_(False))
        .group_by(TaskComment.task_id)
    )).all())
    
    rej_counts = dict((await db.execute(
        select(Annotation.task_id, func.count())
        .where(Annotation.task_id.in_(task_ids), Annotation.review_status == "rejected")
        .group_by(Annotation.task_id)
    )).all())

    for t, assignment_role in rows:
        out.append(MyTaskRow(
            id=t.id, project_id=t.project_id,
            project_name=projects.get(t.project_id, ""),
            name=t.name, task_type=t.task_type, status=t.status,
            priority=t.priority, due_at=t.due_at,
            role=assignment_role,
            image_count=img_counts.get(t.id, 0), 
            annotated_count=ann_counts.get(t.id, 0),
            open_comment_count=open_c_counts.get(t.id, 0),
            created_at=t.created_at,
            rejected_annotation_count=rej_counts.get(t.id, 0),
        ))
    return out


@router.get("/tasks/{task_id}/review/queue")
async def get_review_queue(
    task_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    # check permissions
    await _assert_can_read_task(db, task_id, user)
    
    async def compute():
        rejected = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.task_id == task_id, Annotation.review_status == "rejected")
        )).scalar_one()

        return {
            "stats": {
                "rejected": rejected
            }
        }
        
    return await cache.get_or_set("review_queue", (task_id,), 5, compute)

@router.post("/tasks/{task_id}/duplicate", response_model=TaskResponse,
             status_code=201)
async def duplicate_task(
    task_id: int, request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    src = await db.get(Task, task_id)
    if src is None:
        raise HTTPException(404, "Task not found")
    project = await db.get(Project, src.project_id)
    if project.owner_id != user.id and user.role not in (
        UserRole.ADMIN.value, UserRole.MANAGER.value,
    ):
        raise HTTPException(403, "Not your task")

    clone = Task(
        project_id=src.project_id,
        name=f"{src.name} (copy)",
        task_type=src.task_type,
        status="annotation",
        priority=src.priority,
        description=src.description,
        instructions=src.instructions,
    )
    db.add(clone)
    await db.flush()

    # Copy labels
    src_labels = (await db.execute(
        select(Label).where(Label.task_id == task_id)
    )).scalars().all()
    for lab in src_labels:
        db.add(Label(task_id=clone.id, name=lab.name, color=lab.color))

    await audit(db, user=user, action="task.duplicate",
                resource_type="task", resource_id=clone.id,
                meta={"source_task_id": task_id}, request=request)
    await db.commit()
    await db.refresh(clone)
    return await _task_response(db, clone)
