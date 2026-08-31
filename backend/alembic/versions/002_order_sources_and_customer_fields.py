"""Add order channel/source integration metadata and customer fields.

Revision ID: 002_order_sources
Revises: 001_enterprise_schema
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_order_sources"
down_revision: Union[str, None] = "001_enterprise_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All additions are nullable/defaulted so existing orders remain readable.
    op.add_column("restaurant_orders", sa.Column("source", sa.String(length=20), nullable=False, server_default="MANUAL"))
    op.add_column("restaurant_orders", sa.Column("externalOrderId", sa.String(length=100), nullable=True))
    op.add_column("restaurant_orders", sa.Column("customerName", sa.String(length=255), nullable=True))
    op.add_column("restaurant_orders", sa.Column("customerPhone", sa.String(length=50), nullable=True))
    op.create_index("ix_restaurant_orders_source", "restaurant_orders", ["source"])
    op.create_index("ix_restaurant_orders_externalOrderId", "restaurant_orders", ["externalOrderId"])
    op.create_index(
        "uq_restaurant_orders_source_external",
        "restaurant_orders",
        ["companyId", "source", "externalOrderId"],
        unique=True,
        postgresql_where=sa.text('"externalOrderId" IS NOT NULL'),
    )
    op.alter_column("restaurant_orders", "source", server_default=None)


def downgrade() -> None:
    op.drop_index("uq_restaurant_orders_source_external", table_name="restaurant_orders")
    op.drop_index("ix_restaurant_orders_externalOrderId", table_name="restaurant_orders")
    op.drop_index("ix_restaurant_orders_source", table_name="restaurant_orders")
    op.drop_column("restaurant_orders", "customerPhone")
    op.drop_column("restaurant_orders", "customerName")
    op.drop_column("restaurant_orders", "externalOrderId")
    op.drop_column("restaurant_orders", "source")
