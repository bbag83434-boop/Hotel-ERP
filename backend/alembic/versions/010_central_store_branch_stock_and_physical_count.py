"""Add branch-based Central Store stock and physical count tables.

Revision ID: 010_central_store_branch_stock_and_physical_count
Revises: 009_add_recipe_active_current_index
Create Date: 2026-09-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "010_central_store_branch_stock_and_physical_count"
down_revision = "009_add_recipe_active_current_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "central_store_stock_balances",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("companyId", sa.String(length=36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branchId", sa.String(length=36), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("itemId", sa.String(length=36), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False, server_default="0.0000"),
        sa.Column("minStockLevel", sa.Numeric(14, 4), nullable=True),
        sa.Column("reorderQty", sa.Numeric(14, 4), nullable=True),
        sa.Column("updatedAt", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("companyId", "branchId", "itemId", name="uq_cs_stock_company_branch_item"),
    )
    op.create_index("idx_cs_stock_company", "central_store_stock_balances", ["companyId"])
    op.create_index("idx_cs_stock_branch", "central_store_stock_balances", ["branchId"])
    op.create_index("idx_cs_stock_item", "central_store_stock_balances", ["itemId"])

    op.create_table(
        "central_store_stock_ledgers",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("companyId", sa.String(length=36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branchId", sa.String(length=36), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("itemId", sa.String(length=36), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unitId", sa.String(length=36), sa.ForeignKey("units.id", ondelete="SET NULL"), nullable=True),
        sa.Column("batchNumber", sa.String(length=100), nullable=True),
        sa.Column("movementType", sa.String(length=50), nullable=False),
        sa.Column("changeQty", sa.Numeric(14, 4), nullable=False),
        sa.Column("balanceQty", sa.Numeric(14, 4), nullable=False),
        sa.Column("unitCost", sa.Numeric(14, 4), nullable=True, server_default="0.0000"),
        sa.Column("totalCost", sa.Numeric(14, 4), nullable=True, server_default="0.0000"),
        sa.Column("referenceType", sa.String(length=100), nullable=False),
        sa.Column("referenceId", sa.String(length=36), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("createdById", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("createdAt", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_cs_ledger_company_branch_item_date", "central_store_stock_ledgers", ["companyId", "branchId", "itemId", "createdAt"])
    op.create_index("idx_cs_ledger_reference", "central_store_stock_ledgers", ["referenceType", "referenceId"])

    op.create_table(
        "central_store_stock_counts",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("companyId", sa.String(length=36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branchId", sa.String(length=36), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("countNumber", sa.String(length=50), nullable=False),
        sa.Column("countDate", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="DRAFT"),
        sa.Column("createdById", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approvedById", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approvedAt", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("createdAt", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updatedAt", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("companyId", "countNumber", name="uq_cs_count_company_number"),
    )
    op.create_index("idx_cs_count_company_branch_date", "central_store_stock_counts", ["companyId", "branchId", "countDate"])
    op.create_index("idx_cs_count_status", "central_store_stock_counts", ["status"])

    op.create_table(
        "central_store_stock_count_items",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("stockCountId", sa.String(length=36), sa.ForeignKey("central_store_stock_counts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("itemId", sa.String(length=36), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("systemQty", sa.Numeric(14, 4), nullable=False),
        sa.Column("physicalQty", sa.Numeric(14, 4), nullable=False),
        sa.Column("varianceQty", sa.Numeric(14, 4), nullable=False),
        sa.Column("unitCost", sa.Numeric(14, 4), nullable=False, server_default="0.0000"),
        sa.Column("varianceValue", sa.Numeric(14, 4), nullable=False, server_default="0.0000"),
        sa.Column("batchNumber", sa.String(length=100), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.UniqueConstraint("stockCountId", "itemId", name="uq_cs_count_item"),
    )
    op.create_index("idx_cs_count_item_stock_count", "central_store_stock_count_items", ["stockCountId"])
    op.create_index("idx_cs_count_item_item", "central_store_stock_count_items", ["itemId"])


def downgrade() -> None:
    op.drop_index("idx_cs_count_item_item", table_name="central_store_stock_count_items")
    op.drop_index("idx_cs_count_item_stock_count", table_name="central_store_stock_count_items")
    op.drop_table("central_store_stock_count_items")

    op.drop_index("idx_cs_count_status", table_name="central_store_stock_counts")
    op.drop_index("idx_cs_count_company_branch_date", table_name="central_store_stock_counts")
    op.drop_table("central_store_stock_counts")

    op.drop_index("idx_cs_ledger_reference", table_name="central_store_stock_ledgers")
    op.drop_index("idx_cs_ledger_company_branch_item_date", table_name="central_store_stock_ledgers")
    op.drop_table("central_store_stock_ledgers")

    op.drop_index("idx_cs_stock_item", table_name="central_store_stock_balances")
    op.drop_index("idx_cs_stock_branch", table_name="central_store_stock_balances")
    op.drop_index("idx_cs_stock_company", table_name="central_store_stock_balances")
    op.drop_table("central_store_stock_balances")
