from sqlalchemy import Column, String, Integer, DateTime, Text
from app.models.base import BaseModel

class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    company_id = Column(String(36), nullable=True, index=True)
    branch_id = Column(String(36), nullable=True, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(36), nullable=True)
    old_values = Column(Text, nullable=True)
    new_values = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)

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
