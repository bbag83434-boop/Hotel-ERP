"""merge migration heads

Revision ID: 625b9685c638
Revises: 010_central_store_branch_stock_and_physical_count, 03f56d0bf87f
Create Date: 2026-09-21 02:38:11.551361

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '625b9685c638'
down_revision: Union[str, None] = ('010_central_store_branch_stock_and_physical_count', '03f56d0bf87f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
