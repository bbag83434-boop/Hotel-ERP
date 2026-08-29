from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Text
from datetime import datetime
from app.models.base import BaseModel

class WhatsAppUserLink(BaseModel):
    __tablename__ = "whatsapp_user_links"
    __table_args__ = (UniqueConstraint("phoneNumberId", "waUserId", name="uq_whatsapp_link_phone_user"),)
    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column("userId", String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    phone_number_id = Column("phoneNumberId", String(64), nullable=False, index=True)
    wa_user_id = Column("waUserId", String(64), nullable=False, index=True)
    display_name = Column("displayName", String(255), nullable=True)
    is_active = Column("isActive", Boolean, nullable=False, default=True, index=True)
    linked_at = Column("linkedAt", DateTime, nullable=False, default=datetime.utcnow)
    last_seen_at = Column("lastSeenAt", DateTime, nullable=True)

class WhatsAppMessageLog(BaseModel):
    __tablename__ = "whatsapp_message_logs"
    message_id = Column("messageId", String(128), nullable=False, unique=True, index=True)
    company_id = Column("companyId", String(36), nullable=True, index=True)
    branch_id = Column("branchId", String(36), nullable=True, index=True)
    wa_user_id = Column("waUserId", String(64), nullable=False, index=True)
    direction = Column(String(16), nullable=False)
    message_type = Column("messageType", String(32), nullable=False)
    body = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="RECEIVED")
    error = Column(Text, nullable=True)
