import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import synonym
from app.core.database import Base
from app.models.base import BaseModel

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column("userId", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column("entity", String(100), nullable=False, index=True)
    entity_id = Column("entityId", String(36), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column("ipAddress", String(50), nullable=True)
    user_agent = Column("userAgent", String(255), nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    userId = synonym("user_id")
    entity = synonym("entity_type")
    entityId = synonym("entity_id")
    ipAddress = synonym("ip_address")
    userAgent = synonym("user_agent")
    createdAt = synonym("created_at")

class IdempotencyRecord(BaseModel):
    __tablename__ = "idempotency_records"

    key = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(36), nullable=True)
    company_id = Column(String(36), nullable=True)
    branch_id = Column(String(36), nullable=True)
    endpoint = Column(String(255), nullable=False)
    request_hash = Column(String(255), nullable=True)
    response_status = Column(Integer, nullable=False)
    response_body = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
