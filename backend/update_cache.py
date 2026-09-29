import os

def update_admin():
    with open('app/routers/admin.py', 'r', encoding='utf-8') as f:
        content = f.read()

    import_str = 'from app.services import cache'
    if import_str not in content:
        content = content.replace('from app.services.audit import audit', 'from app.services.audit import audit\nfrom app.services import cache')

    stats_search = '''@router.get("/stats", response_model=SystemStats)
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
    )'''

    stats_replace = '''@router.get("/stats", response_model=SystemStats)
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
    return SystemStats(**data)'''

    content = content.replace(stats_search, stats_replace)
    
    # Also invalidate in review endpoint of admin.py
    review_search = '''
    for a in anns:
        a.review_status = new_status
        a.reviewed_by = admin.id
        a.reviewed_at = now
        a.review_comment = payload.comment

    await audit(db, user=admin, action=f"annotation.review_{payload.action}",
'''
    review_replace = '''
    for a in anns:
        a.review_status = new_status
        a.reviewed_by = admin.id
        a.reviewed_at = now
        a.review_comment = payload.comment
        
    await cache.invalidate("review_queue", task_id)
    await audit(db, user=admin, action=f"annotation.review_{payload.action}",
'''
    content = content.replace(review_search, review_replace)

    with open('app/routers/admin.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('admin.py updated')

update_admin()
