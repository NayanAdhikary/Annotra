import re

def update_projects():
    with open('app/routers/projects.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. list_projects
    list_projects_search = """    out = []
    for p in projects:
        tc, ic, cc, rc, ac = await _project_stats(db, p.id)
        out.append(ProjectResponse(
            id=p.id, name=p.name, description=p.description,
            owner_id=p.owner_id, task_count=tc, image_count=ic,
            created_at=p.created_at,
            completed_task_count=cc,
            in_review_task_count=rc,
            annotation_task_count=ac,
        ))
    return out"""
    list_projects_replace = """    out = []
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
    return out"""
    
    content = content.replace(list_projects_search, list_projects_replace)

    # 2. my_tasks
    my_tasks_search = """    out = []
    for t, assignment_role in rows:
        project = await db.get(Project, t.project_id)
        ic, _, ac = await _task_stats(db, t.id)
        open_c = (await db.execute(
            select(func.count()).select_from(TaskComment)
            .where(TaskComment.task_id == t.id, TaskComment.resolved.is_(False))
        )).scalar_one()

        rejected_c = (await db.execute(
            select(func.count()).select_from(Annotation)
            .where(Annotation.task_id == t.id, Annotation.review_status == "rejected")
        )).scalar_one()

        out.append(MyTaskRow(
            id=t.id, project_id=t.project_id,
            project_name=project.name if project else "",
            name=t.name, task_type=t.task_type, status=t.status,
            priority=t.priority, due_at=t.due_at,
            role=assignment_role,
            image_count=ic, annotated_count=ac,
            open_comment_count=open_c,
            created_at=t.created_at,
            rejected_annotation_count=rejected_c,
        ))
    return out"""

    my_tasks_replace = """    out = []
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
    return out"""
    content = content.replace(my_tasks_search, my_tasks_replace)
    
    with open('app/routers/projects.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("projects.py updated")


def update_admin():
    with open('app/routers/admin.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # list_users
    list_users_search = """    out = []
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
    return out"""
    list_users_replace = """    out = []
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
    return out"""
    content = content.replace(list_users_search, list_users_replace)

    # list_all_projects
    admin_projects_search = """    out = []
    for p in projects:
        owner = await db.get(User, p.owner_id)
        task_count = (await db.execute(
            select(func.count()).select_from(Task).where(Task.project_id == p.id)
        )).scalar_one()
        image_count = (await db.execute(
            select(func.count()).select_from(ImageAsset)
            .join(Task, Task.id == ImageAsset.task_id)
            .where(Task.project_id == p.id)
        )).scalar_one()
        ann_count = (await db.execute(
            select(func.count()).select_from(Annotation)
            .join(Task, Task.id == Annotation.task_id)
            .where(Task.project_id == p.id)
        )).scalar_one()
        out.append(AdminProjectRow(
            id=p.id, name=p.name, description=p.description,
            owner_id=p.owner_id,
            owner_email=owner.email if owner else None,
            owner_name=(owner.full_name or owner.username) if owner else None,
            task_count=task_count, image_count=image_count,
            annotation_count=ann_count, created_at=p.created_at,
        ))
    return out"""
    admin_projects_replace = """    out = []
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
    return out"""
    content = content.replace(admin_projects_search, admin_projects_replace)
    
    # list_all_tasks
    admin_tasks_search = """    out = []
    for t in tasks:
        project = await db.get(Project, t.project_id)
        ic, lc, ac = await _task_stats(db, t.id)

        # Load assignments
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

        out.append(AdminTaskRow(
            id=t.id, project_id=t.project_id,
            project_name=project.name if project else "",
            name=t.name, task_type=t.task_type, status=t.status,
            image_count=ic, label_count=lc, annotated_count=ac,
            annotator_count=sum(1 for a in assignees if a["role"] == "annotator"),
            reviewer_count=sum(1 for a in assignees if a["role"] == "reviewer"),
            assignees=assignees,
            created_at=t.created_at,
        ))
    return out"""
    admin_tasks_replace = """    out = []
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
    return out"""
    content = content.replace(admin_tasks_search, admin_tasks_replace)

    with open('app/routers/admin.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("admin.py updated")

update_projects()
update_admin()
