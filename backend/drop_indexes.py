import sqlite3

indexes_to_drop = [
    "ix_annotations_task_image_frame",
    "ix_annotations_task_review_status",
    "ix_annotations_task_source",
    "ix_annotations_created_by_task",
    "ix_image_assets_task_id",
    "ix_task_assignments_user_role",
]

conn = sqlite3.connect('annotra.db')
for idx in indexes_to_drop:
    try:
        conn.execute(f"DROP INDEX {idx}")
    except Exception as e:
        print(f"Failed to drop {idx}: {e}")

conn.commit()
print("Dropped indexes")
