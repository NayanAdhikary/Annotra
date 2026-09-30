"""day14 video_assets + annotation track columns

Revision ID: 8b30515f5dcc
Revises: 4f609738f86b
Create Date: 2026-09-30 14:40:02.736802

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b30515f5dcc'
down_revision: Union[str, None] = '4f609738f86b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('''
        CREATE INDEX ix_annotations_track_frame
        ON annotations (track_id, frame)
        WHERE track_id IS NOT NULL;
    ''')

def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_annotations_track_frame')
