"""Add purchase order creator for approval separation."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_approval_separation"
down_revision: Union[str, None] = "002_order_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on = None

def upgrade() -> None:
    op.add_column("purchase_orders", sa.Column("createdById", sa.String(length=36), nullable=True))
    op.create_index("ix_purchase_orders_createdById", "purchase_orders", ["createdById"])
    op.create_foreign_key("fk_purchase_orders_createdById_users", "purchase_orders", "users", ["createdById"], ["id"], ondelete="SET NULL")

def downgrade() -> None:
    op.drop_constraint("fk_purchase_orders_createdById_users", "purchase_orders", type_="foreignkey")
    op.drop_index("ix_purchase_orders_createdById", table_name="purchase_orders")
    op.drop_column("purchase_orders", "createdById")
