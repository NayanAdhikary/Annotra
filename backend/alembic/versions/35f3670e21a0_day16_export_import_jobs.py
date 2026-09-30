"""day16 export_import jobs

Revision ID: 35f3670e21a0
Revises: 8b30515f5dcc
Create Date: 2026-09-30 15:11:29.598489

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '35f3670e21a0'
down_revision: Union[str, None] = '8b30515f5dcc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('export_jobs') as batch_op:
        batch_op.alter_column('id',
               existing_type=sa.INTEGER(),
               type_=sa.BigInteger())
        batch_op.alter_column('progress',
               existing_type=sa.String(length=100),
               type_=sa.String(length=200))

    with op.batch_alter_table('import_jobs') as batch_op:
        batch_op.alter_column('id',
               existing_type=sa.INTEGER(),
               type_=sa.BigInteger())
        batch_op.alter_column('progress',
               existing_type=sa.String(length=100),
               type_=sa.String(length=200))

def downgrade() -> None:
    with op.batch_alter_table('import_jobs') as batch_op:
        batch_op.alter_column('progress',
               existing_type=sa.String(length=200),
               type_=sa.String(length=100))
        batch_op.alter_column('id',
               existing_type=sa.BigInteger(),
               type_=sa.INTEGER())

    with op.batch_alter_table('export_jobs') as batch_op:
        batch_op.alter_column('progress',
               existing_type=sa.String(length=200),
               type_=sa.String(length=100))
        batch_op.alter_column('id',
               existing_type=sa.BigInteger(),
               type_=sa.INTEGER())

