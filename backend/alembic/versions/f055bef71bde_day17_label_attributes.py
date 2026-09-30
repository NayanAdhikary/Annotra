"""day17 label attributes

Revision ID: f055bef71bde
Revises: 35f3670e21a0
Create Date: 2026-09-30 15:43:42.173115

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f055bef71bde'
down_revision: Union[str, None] = '35f3670e21a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('labels', schema=None) as batch_op:
        batch_op.add_column(sa.Column('attributes', sa.JSON(), server_default='[]', nullable=False))
        batch_op.alter_column('id',
               existing_type=sa.INTEGER(),
               type_=sa.BigInteger(),
               existing_nullable=False,
               autoincrement=True)
        batch_op.alter_column('task_id',
               existing_type=sa.INTEGER(),
               type_=sa.BigInteger(),
               existing_nullable=False)
        batch_op.create_index(batch_op.f('ix_labels_task_id'), ['task_id'], unique=False)

def downgrade() -> None:
    with op.batch_alter_table('labels', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_labels_task_id'))
        batch_op.alter_column('task_id',
               existing_type=sa.BigInteger(),
               type_=sa.INTEGER(),
               existing_nullable=False)
        batch_op.alter_column('id',
               existing_type=sa.BigInteger(),
               type_=sa.INTEGER(),
               existing_nullable=False,
               autoincrement=True)
        batch_op.drop_column('attributes')
