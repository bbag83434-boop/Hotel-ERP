"""add outlet stock balance, batch, and ledger tables (hand-written, safe)

Revision ID: 009_outlet_stock_tables
Revises: 008_outlet_requirement_supply_routing
Create Date: 2026-09-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009_outlet_stock_tables"
down_revision: Union[str, None] = "008_outlet_requirement_supply_routing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "outlet_stock_balances" not in existing_tables:
        op.create_table(
            "outlet_stock_balances",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("companyId", sa.String(length=36), nullable=False),
            sa.Column("branchId", sa.String(length=36), nullable=False),
            sa.Column("itemId", sa.String(length=36), nullable=False),
            sa.Column("quantity", sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column("minStockLevel", sa.Numeric(precision=14, scale=4), nullable=True),
            sa.Column("reorderQty", sa.Numeric(precision=14, scale=4), nullable=True),
            sa.Column("updatedAt", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["branchId"], ["branches.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["companyId"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["itemId"], ["items.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("idx_outlet_stock_company_branch_item", "outlet_stock_balances", ["companyId", "branchId", "itemId"], unique=True)
        op.create_index(op.f("ix_outlet_stock_balances_branchId"), "outlet_stock_balances", ["branchId"])
        op.create_index(op.f("ix_outlet_stock_balances_companyId"), "outlet_stock_balances", ["companyId"])
        op.create_index(op.f("ix_outlet_stock_balances_itemId"), "outlet_stock_balances", ["itemId"])

    if "outlet_stock_batches" not in existing_tables:
        op.create_table(
            "outlet_stock_batches",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("companyId", sa.String(length=36), nullable=False),
            sa.Column("branchId", sa.String(length=36), nullable=False),
            sa.Column("itemId", sa.String(length=36), nullable=False),
            sa.Column("batchNumber", sa.String(length=100), nullable=False),
            sa.Column("quantity", sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column("unitCost", sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column("expiryDate", sa.Date(), nullable=True),
            sa.Column("mfgDate", sa.Date(), nullable=True),
            sa.Column("isActive", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.ForeignKeyConstraint(["branchId"], ["branches.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["companyId"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["itemId"], ["items.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("idx_outlet_batch_company_branch_item_num", "outlet_stock_batches", ["companyId", "branchId", "itemId", "batchNumber"], unique=True)
        op.create_index(op.f("ix_outlet_stock_batches_batchNumber"), "outlet_stock_batches", ["batchNumber"])
        op.create_index(op.f("ix_outlet_stock_batches_branchId"), "outlet_stock_batches", ["branchId"])
        op.create_index(op.f("ix_outlet_stock_batches_companyId"), "outlet_stock_batches", ["companyId"])
        op.create_index(op.f("ix_outlet_stock_batches_itemId"), "outlet_stock_batches", ["itemId"])

    if "outlet_stock_ledgers" not in existing_tables:
        op.create_table(
            "outlet_stock_ledgers",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("companyId", sa.String(length=36), nullable=False),
            sa.Column("branchId", sa.String(length=36), nullable=False),
            sa.Column("itemId", sa.String(length=36), nullable=False),
            sa.Column("unitId", sa.String(length=36), nullable=True),
            sa.Column("batchNumber", sa.String(length=100), nullable=True),
            sa.Column("expiryDate", sa.DateTime(), nullable=True),
            sa.Column("movementType", sa.String(length=50), nullable=False),
            sa.Column("changeQty", sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column("balanceQty", sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column("unitCost", sa.Numeric(precision=14, scale=4), nullable=True),
            sa.Column("totalCost", sa.Numeric(precision=14, scale=4), nullable=True),
            sa.Column("referenceType", sa.String(length=100), nullable=False),
            sa.Column("referenceId", sa.String(length=36), nullable=True),
            sa.Column("reversalReferenceId", sa.String(length=36), nullable=True),
            sa.Column("idempotencyKey", sa.String(length=255), nullable=True),
            sa.Column("isEmergencyOverride", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("createdById", sa.String(length=36), nullable=True),
            sa.Column("createdAt", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["branchId"], ["branches.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["companyId"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["createdById"], ["users.id"]),
            sa.ForeignKeyConstraint(["itemId"], ["items.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["unitId"], ["units.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("idx_outlet_ledger_company_branch", "outlet_stock_ledgers", ["companyId", "branchId"])
        op.create_index("idx_outlet_ledger_company_branch_item_date", "outlet_stock_ledgers", ["companyId", "branchId", "itemId", "createdAt"])
        op.create_index(op.f("ix_outlet_stock_ledgers_branchId"), "outlet_stock_ledgers", ["branchId"])
        op.create_index(op.f("ix_outlet_stock_ledgers_companyId"), "outlet_stock_ledgers", ["companyId"])
        op.create_index(op.f("ix_outlet_stock_ledgers_idempotencyKey"), "outlet_stock_ledgers", ["idempotencyKey"])
        op.create_index(op.f("ix_outlet_stock_ledgers_itemId"), "outlet_stock_ledgers", ["itemId"])
        op.create_index(op.f("ix_outlet_stock_ledgers_reversalReferenceId"), "outlet_stock_ledgers", ["reversalReferenceId"])


def downgrade() -> None:
    op.drop_table("outlet_stock_ledgers")
    op.drop_table("outlet_stock_batches")
    op.drop_table("outlet_stock_balances")