import enum
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, JSON, Enum as SQLEnum
from app.models.base import BaseModel

class NotificationStatus(str, enum.Enum):
    PENDING = 'PENDING'
    SENT = 'SENT'
    FAILED = 'FAILED'

class NotificationChannel(str, enum.Enum):
    TELEGRAM = 'TELEGRAM'

class Notification(BaseModel):
    __tablename__ = 'notifications'
    company_id = Column('companyId', String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column('branchId', String(36), ForeignKey('branches.id', ondelete='CASCADE'), nullable=True, index=True)
    channel = Column(SQLEnum(NotificationChannel), nullable=False, default=NotificationChannel.TELEGRAM)
    chat_id = Column('chatId', String(255), nullable=False)
    title = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    status = Column(SQLEnum(NotificationStatus), nullable=False, default=NotificationStatus.PENDING, index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column('lastError', Text, nullable=True)
    sent_at = Column('sentAt', DateTime, nullable=True)
    event_type = Column('eventType', String(80), nullable=True, index=True)
    idempotency_key = Column('idempotencyKey', String(255), unique=True, nullable=True, index=True)
    metadata_json = Column('metadata', JSON, nullable=True)
