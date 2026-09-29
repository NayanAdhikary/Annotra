"""day21 perf indexes

Revision ID: 4f609738f86b
Revises: e7091f0765e1
Create Date: 2026-09-29 17:31:04.242015

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f609738f86b'
down_revision: Union[str, None] = 'e7091f0765e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Annotations: nearly every query filters by task_id and image_id
    op.create_index(
        "ix_annotations_task_image_frame",
        "annotations",
        ["task_id", "image_id", "frame"],
    )
    op.create_index(
        "ix_annotations_task_review_status",
        "annotations",
        ["task_id", "review_status"],
        postgresql_where=sa.text("review_status IS NOT NULL"),
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

    # Images: image list per task, ordered by id
    op.create_index(
        "ix_image_assets_task_id",
        "image_assets",
        ["task_id", "id"],
    )

    # Task assignments: "My tasks" queries hit this hard
    op.create_index(
        "ix_task_assignments_user_role",
        "task_assignments",
        ["user_id", "role"],
    )

    # Notifications: unread badge query
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "created_at"],
        postgresql_where=sa.text("read_at IS NULL"),
    )

    # Audit log: filter by user + recent
    op.create_index(
        "ix_audit_user_recent",
        "audit_logs",
        ["user_id", "created_at"],
    )

    # Refresh tokens: session count and revocation lookups
    op.create_index(
        "ix_refresh_tokens_user_active",
        "refresh_tokens",
        ["user_id", "expires_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_annotations_task_image_frame")
    op.drop_index("ix_annotations_task_review_status")
    op.drop_index("ix_annotations_task_source")
    op.drop_index("ix_annotations_created_by_task")
    op.drop_index("ix_image_assets_task_id")
    op.drop_index("ix_task_assignments_user_role")
    op.drop_index("ix_notifications_user_unread")
    op.drop_index("ix_audit_user_recent")
    op.drop_index("ix_refresh_tokens_user_active")
