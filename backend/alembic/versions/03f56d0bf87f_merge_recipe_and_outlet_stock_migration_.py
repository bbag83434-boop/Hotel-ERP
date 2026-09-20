"""merge recipe and outlet stock migration branches

Revision ID: 03f56d0bf87f
Revises: 009_add_recipe_active_current_index, 009_outlet_stock_tables
Create Date: 2026-09-19 15:04:17.159910

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '03f56d0bf87f'
down_revision: Union[str, None] = ('009_add_recipe_active_current_index', '009_outlet_stock_tables')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
