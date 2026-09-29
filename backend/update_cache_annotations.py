import os

def update_annotations():
    with open('app/routers/annotations.py', 'r', encoding='utf-8') as f:
        content = f.read()

    import_str = 'from app.services import cache'
    if import_str not in content:
        content = content.replace('from app.services.audit import audit', 'from app.services.audit import audit\nfrom app.services import cache')

    # Post processing create
    create_search = '''    await audit(db, user=user, action="annotation.create",
                resource_type="task", resource_id=task_id,
                meta={"annotation_id": ann.id, "label_id": payload.label_id},
                request=request)
    await db.commit()'''
    create_replace = '''    await audit(db, user=user, action="annotation.create",
                resource_type="task", resource_id=task_id,
                meta={"annotation_id": ann.id, "label_id": payload.label_id},
                request=request)
    await cache.invalidate("task_stats", task_id)
    await db.commit()'''
    content = content.replace(create_search, create_replace)

    # Put update
    update_search = '''    await audit(db, user=user, action="annotation.update",
                resource_type="task", resource_id=task_id,
                meta={"annotation_id": ann_id}, request=request)
    await db.commit()'''
    update_replace = '''    await audit(db, user=user, action="annotation.update",
                resource_type="task", resource_id=task_id,
                meta={"annotation_id": ann_id}, request=request)
    await cache.invalidate("task_stats", task_id)
    await db.commit()'''
    content = content.replace(update_search, update_replace)

    # Delete
    delete_search = '''    await audit(db, user=user, action="annotation.delete",
                resource_type="task", resource_id=task_id,
                meta={"annotation_id": ann_id}, request=request)
    await db.commit()'''
    delete_replace = '''    await audit(db, user=user, action="annotation.delete",
                resource_type="task", resource_id=task_id,
                meta={"annotation_id": ann_id}, request=request)
    await cache.invalidate("task_stats", task_id)
    await db.commit()'''
    content = content.replace(delete_search, delete_replace)
    
    # Bulk create
    bc_search = '''    await audit(db, user=user, action="annotation.bulk_create",
                resource_type="task", resource_id=task_id,
                meta={"count": len(new_anns)}, request=request)
    await db.commit()'''
    bc_replace = '''    await audit(db, user=user, action="annotation.bulk_create",
                resource_type="task", resource_id=task_id,
                meta={"count": len(new_anns)}, request=request)
    await cache.invalidate("task_stats", task_id)
    await db.commit()'''
    content = content.replace(bc_search, bc_replace)

    # Bulk update
    bu_search = '''    await audit(db, user=user, action="annotation.bulk_update",
                resource_type="task", resource_id=task_id,
                meta={"count": len(payload.shapes)}, request=request)
    await db.commit()'''
    bu_replace = '''    await audit(db, user=user, action="annotation.bulk_update",
                resource_type="task", resource_id=task_id,
                meta={"count": len(payload.shapes)}, request=request)
    await cache.invalidate("task_stats", task_id)
    await db.commit()'''
    content = content.replace(bu_search, bu_replace)

    # Bulk delete
    bd_search = '''    await audit(db, user=user, action="annotation.bulk_delete",
                resource_type="task", resource_id=task_id,
                meta={"count": len(payload.shape_ids)}, request=request)
    await db.commit()'''
    bd_replace = '''    await audit(db, user=user, action="annotation.bulk_delete",
                resource_type="task", resource_id=task_id,
                meta={"count": len(payload.shape_ids)}, request=request)
    await cache.invalidate("task_stats", task_id)
    await db.commit()'''
    content = content.replace(bd_search, bd_replace)
    
    # Bulk patch
    bp_search = '''    await audit(db, user=user, action="annotation.bulk_patch",
                resource_type="task", resource_id=task_id,
                meta={
                    "created": len(created),
                    "updated": len(updated),
                    "deleted": len(deleted),
                },
                request=request)
    await db.commit()'''
    bp_replace = '''    await audit(db, user=user, action="annotation.bulk_patch",
                resource_type="task", resource_id=task_id,
                meta={
                    "created": len(created),
                    "updated": len(updated),
                    "deleted": len(deleted),
                },
                request=request)
    await cache.invalidate("task_stats", task_id)
    await db.commit()'''
    content = content.replace(bp_search, bp_replace)

    with open('app/routers/annotations.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("annotations.py updated")

update_annotations()
