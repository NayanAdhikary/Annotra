"""day21_indexes

Revision ID: 31198146b459
Revises: d5eb761860ab
Create Date: 2026-10-04 18:42:18.451108

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '31198146b459'
down_revision: Union[str, None] = 'd5eb761860ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.create_index(
            "ix_annotations_task_image_frame",
            "annotations",
            ["task_id", "image_id", "frame"],
        )
    except Exception: pass
    try:
        op.create_index(
            "ix_annotations_task_review_status",
            "annotations",
            ["task_id", "review_status"],
        )
    except Exception: pass
    try:
        op.create_index(
            "ix_annotations_task_source",
            "annotations",
            ["task_id", "source"],
        )
    except Exception: pass
    try:
        op.create_index(
            "ix_image_assets_task_id",
            "image_assets",
            ["task_id", "id"],
        )
    except Exception: pass
    try:
        op.create_index(
            "ix_task_assignments_user_role",
            "task_assignments",
            ["user_id", "role"],
        )
    except Exception: pass
    try:
        op.create_index(
            "ix_notifications_user_unread",
            "notifications",
            ["user_id", "created_at"],
        )
    except Exception: pass
    try:
        op.create_index(
            "ix_refresh_tokens_user_active",
            "refresh_tokens",
            ["user_id", "expires_at"],
        )
    except Exception: pass


def downgrade() -> None:
    for name in [
        "ix_annotations_task_image_frame",
        "ix_annotations_task_review_status",
        "ix_annotations_task_source",
        "ix_annotations_created_by",
        "ix_image_assets_task_id",
        "ix_task_assignments_user_role",
        "ix_notifications_user_unread",
        "ix_refresh_tokens_user_active",
    ]:
        op.drop_index(name, table_name="annotations")
