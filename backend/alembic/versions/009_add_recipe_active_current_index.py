"""add recipe active/current lookup index

Revision ID: 009_add_recipe_active_current_index
Revises: d2474ee7ccd1
Create Date: 2026-09-19 00:00:00.000000

"""
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "009_add_recipe_active_current_index"
down_revision = "d2474ee7ccd1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add a non-unique index for active/current recipe resolution by item."""
    conn = op.get_bind()
    conn.execute(
        text(
            'CREATE INDEX IF NOT EXISTS "idx_recipe_active_current_item" '
            'ON recipes ("companyId", "finishedItemId", "isCurrent", "isActive")'
        )
    )


def downgrade() -> None:
    """Remove the recipe active/current lookup index."""
    conn = op.get_bind()
    conn.execute(text('DROP INDEX IF EXISTS "idx_recipe_active_current_item"'))
