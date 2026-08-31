from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from app.models.base import BaseModel

class TelegramUserLink(BaseModel):
    __tablename__ = "telegram_user_links"
    __table_args__ = (UniqueConstraint("chatId", name="uq_telegram_user_links_chat_id"),)

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column("userId", String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    chat_id = Column("chatId", String(255), nullable=False)
    telegram_user_id = Column("telegramUserId", String(255), nullable=True, index=True)
    username = Column(String(255), nullable=True)
    is_active = Column("isActive", Boolean, nullable=False, default=True, index=True)
    linked_at = Column("linkedAt", DateTime, nullable=False, default=datetime.utcnow)
    last_seen_at = Column("lastSeenAt", DateTime, nullable=True)
