import os

def update_projects():
    with open('app/routers/projects.py', 'r', encoding='utf-8') as f:
        content = f.read()

    import_str = 'from app.services import cache'
    if import_str not in content:
        content = content.replace('from app.services.audit import audit', 'from app.services.audit import audit\nfrom app.services import cache')

    get_task_search = '''@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db),
                   user: User = Depends(get_current_user)):
    t = await db.get(Task, task_id)
    if t is None:
        raise HTTPException(404, "Task not found")
    return await _task_response(db, t)'''
    get_task_replace = '''@router.get("/tasks/{task_id}", response_model=TaskResponse)
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
    return TaskResponse(**data)'''
    content = content.replace(get_task_search, get_task_replace)
    
    get_review_search = '''@router.get("/tasks/{task_id}/review/queue")
async def get_review_queue(
    task_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    # check permissions
    await _assert_can_read_task(db, task_id, user)
    
    rejected = (await db.execute(
        select(func.count()).select_from(Annotation)
        .where(Annotation.task_id == task_id, Annotation.review_status == "rejected")
    )).scalar_one()

    return {
        "stats": {
            "rejected": rejected
        }
    }'''
    get_review_replace = '''@router.get("/tasks/{task_id}/review/queue")
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
        
    return await cache.get_or_set("review_queue", (task_id,), 5, compute)'''
    content = content.replace(get_review_search, get_review_replace)

    transition_search = '''    await audit(db, user=user, action="task.transition",
                resource_type="task", resource_id=t.id,
                meta={"from": old_status, "to": t.status}, request=request)'''
    transition_replace = '''    await cache.invalidate_prefix("admin_stats")
    await cache.invalidate("task_stats", task_id)
    await audit(db, user=user, action="task.transition",
                resource_type="task", resource_id=t.id,
                meta={"from": old_status, "to": t.status}, request=request)'''
    content = content.replace(transition_search, transition_replace)

    with open('app/routers/projects.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("projects.py updated")

update_projects()
