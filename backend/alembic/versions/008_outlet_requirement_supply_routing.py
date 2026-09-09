"""Add Item Master supply routing & Outlet Requirement snapshots (Part 2).

The Item Master gains a supply routing column (`supplySource`) so the system
can auto-determine where each outlet requirement is sourced from (CENTRAL_STORE,
DESSERT_KITCHEN, RAW_MATERIAL_SUPPLY, DAILY_OUTLET_SUPPLY, ...). Requirement
lines (`purchase_request_items`) snapshot the unit and the auto-resolved source.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "008_outlet_requirement_supply_routing"
down_revision: Union[str, None] = "d2474ee7ccd1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("items", sa.Column("supplySource", sa.String(length=30),
                                     nullable=False, server_default="CENTRAL_STORE"))
    op.create_index("ix_items_supplySource", "items", ["supplySource"])

    op.add_column("purchase_request_items", sa.Column("unit", sa.String(length=20), nullable=True))
    op.add_column("purchase_request_items", sa.Column("supplySource", sa.String(length=30), nullable=True))
    op.create_index("ix_purchase_request_items_supplySource", "purchase_request_items", ["supplySource"])


def downgrade() -> None:
    op.drop_index("ix_purchase_request_items_supplySource", table_name="purchase_request_items")
    op.drop_column("purchase_request_items", "supplySource")
    op.drop_column("purchase_request_items", "unit")
    op.drop_index("ix_items_supplySource", table_name="items")
    op.drop_column("items", "supplySource"