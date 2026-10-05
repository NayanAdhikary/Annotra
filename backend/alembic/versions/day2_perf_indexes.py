"""day2 perf indexes

Revision ID: day2_perf_indexes
Revises: ac599e8d1618
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa


revision = "day2_perf_indexes"
down_revision = "ac599e8d1618"
branch_labels = None
depends_on = None


def upgrade():
    # ---- annotations: the hottest table ----
    op.create_index(
        "ix_annotations_task_image_frame",
        "annotations",
        ["task_id", "image_id", "frame"],
    )
    # postgresql_where is ignored by SQLite, which is fine
    op.create_index(
        "ix_annotations_task_review_status",
        "annotations",
        ["task_id", "review_status"],
        postgresql_where=sa.text("review_status IS NOT NULL"),
        sqlite_where=sa.text("review_status IS NOT NULL"),
    )
    op.create_index(
        "ix_annotations_task_source",
        "annotations",
        ["task_id", "source"],
    )
    op.create_index(
        "ix_annotations_created_by_task",
        "annotations",
        ["created_by", "task_id"],
    )

    # ---- images: list per task, ordered ----
    op.create_index(
        "ix_image_assets_task_id_order",
        "image_assets",
        ["task_id", "id"],
    )

    # ---- assignments: My Tasks page ----
    op.create_index(
        "ix_task_assignments_user_role",
        "task_assignments",
        ["user_id", "role"],
    )

    # ---- notifications: unread badge ----
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "created_at"],
        postgresql_where=sa.text("read_at IS NULL"),
        sqlite_where=sa.text("read_at IS NULL"),
    )

    # ---- audit log: filter by org + recent ----
    # op.create_index(
    #     "ix_audit_org_recent",
    #     "audit_logs",
    #     ["org_id", "created_at"],
    # )

    # ---- refresh tokens: active sessions ----
    op.create_index(
        "ix_refresh_tokens_user_active",
        "refresh_tokens",
        ["user_id", "expires_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
        sqlite_where=sa.text("revoked_at IS NULL"),
    )


def downgrade():
    for name in [
        "ix_annotations_task_image_frame",
        "ix_annotations_task_review_status",
        "ix_annotations_task_source",
        "ix_annotations_created_by_task",
        "ix_image_assets_task_id_order",
        "ix_task_assignments_user_role",
        "ix_notifications_user_unread",
        "ix_refresh_tokens_user_active",
    ]:
        op.drop_index(name)
