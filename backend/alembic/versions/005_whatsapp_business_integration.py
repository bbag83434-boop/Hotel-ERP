"""part 30 whatsapp business integration

Revision ID: 005_whatsapp_business_integration
Revises: 004_telegram_integration
"""
from alembic import op
import sqlalchemy as sa

revision = "005_whatsapp_business_integration"
down_revision = "004_telegram_integration"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("whatsapp_user_links",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("createdAt", sa.DateTime(), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), nullable=False), sa.Column("companyId", sa.String(36), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("userId", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("branchId", sa.String(36), sa.ForeignKey("branches.id", ondelete="CASCADE"), nullable=True),
        sa.Column("phoneNumberId", sa.String(64), nullable=False), sa.Column("waUserId", sa.String(64), nullable=False), sa.Column("displayName", sa.String(255), nullable=True),
        sa.Column("isActive", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("linkedAt", sa.DateTime(), nullable=False), sa.Column("lastSeenAt", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("phoneNumberId", "waUserId", name="uq_whatsapp_link_phone_user"))
    for name, cols in [("companyId",["companyId"]),("userId",["userId"]),("branchId",["branchId"]),("phoneNumberId",["phoneNumberId"]),("waUserId",["waUserId"]),("isActive",["isActive"])]:
        op.create_index(f"ix_whatsapp_user_links_{name}", "whatsapp_user_links", cols)
    op.create_table("whatsapp_message_logs",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("createdAt", sa.DateTime(), nullable=False), sa.Column("updatedAt", sa.DateTime(), nullable=False),
        sa.Column("messageId", sa.String(128), nullable=False, unique=True), sa.Column("companyId", sa.String(36), nullable=True), sa.Column("branchId", sa.String(36), nullable=True),
        sa.Column("waUserId", sa.String(64), nullable=False), sa.Column("direction", sa.String(16), nullable=False), sa.Column("messageType", sa.String(32), nullable=False),
        sa.Column("body", sa.Text(), nullable=True), sa.Column("status", sa.String(32), nullable=False), sa.Column("error", sa.Text(), nullable=True))
    op.create_index("ix_whatsapp_message_logs_companyId", "whatsapp_message_logs", ["companyId"])
    op.create_index("ix_whatsapp_message_logs_branchId", "whatsapp_message_logs", ["branchId"])
    op.create_index("ix_whatsapp_message_logs_waUserId", "whatsapp_message_logs", ["waUserId"])
    op.create_index("ix_whatsapp_message_logs_messageId", "whatsapp_message_logs", ["messageId"])

def downgrade():
    op.drop_table("whatsapp_message_logs")
    for name in ["isActive","waUserId","phoneNumberId","branchId","userId","companyId"]:
        op.drop_index(f"ix_whatsapp_user_links_{name}", table_name="whatsapp_user_links")
    op.drop_table("whatsapp_user_links")
