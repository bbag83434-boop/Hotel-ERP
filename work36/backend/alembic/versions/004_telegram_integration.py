"""part 29 telegram integration

Revision ID: 004_telegram_integration
Revises: 003_approval_separation
"""
from alembic import op
import sqlalchemy as sa

revision = "004_telegram_integration"
down_revision = "003_approval_separation"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "telegram_user_links",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("createdAt", sa.DateTime(), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), nullable=False),
        sa.Column("companyId", sa.String(length=36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("userId", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branchId", sa.String(length=36), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=True),
        sa.Column("chatId", sa.String(length=255), nullable=False),
        sa.Column("telegramUserId", sa.String(length=255), nullable=True),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("isActive", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("linkedAt", sa.DateTime(), nullable=False),
        sa.Column("lastSeenAt", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("chatId", name="uq_telegram_user_links_chat_id"),
    )
    op.create_index("ix_telegram_user_links_companyId", "telegram_user_links", ["companyId"])
    op.create_index("ix_telegram_user_links_userId", "telegram_user_links", ["userId"])
    op.create_index("ix_telegram_user_links_branchId", "telegram_user_links", ["branchId"])
    op.create_index("ix_telegram_user_links_telegramUserId", "telegram_user_links", ["telegramUserId"])
    op.create_index("ix_telegram_user_links_isActive", "telegram_user_links", ["isActive"])


def downgrade():
    op.drop_index("ix_telegram_user_links_isActive", table_name="telegram_user_links")
    op.drop_index("ix_telegram_user_links_telegramUserId", table_name="telegram_user_links")
    op.drop_index("ix_telegram_user_links_branchId", table_name="telegram_user_links")
    op.drop_index("ix_telegram_user_links_userId", table_name="telegram_user_links")
    op.drop_index("ix_telegram_user_links_companyId", table_name="telegram_user_links")
    op.drop_table("telegram_user_links")
